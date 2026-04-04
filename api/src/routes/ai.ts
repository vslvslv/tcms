import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { suites, sections, testCases, testSteps } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { can } from "../lib/permissions.js";
import { createAiClient } from "../lib/ai.js";
import { writeAuditLog } from "../lib/auditLog.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });

const generateBody = z.object({
  sectionId: z.string().uuid(),
  prompt: z.string().min(1).max(2000),
  count: z.number().int().min(1).max(20).default(5),
});

const generateFromFailureBody = z.object({
  failureLog: z.string().min(1).max(10000),
  context: z.string().max(2000).optional(),
  sectionId: z.string().uuid().optional(),
});

export default async function aiRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.post("/api/projects/:projectId/ai/generate-cases", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");

    const paramsParsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsParsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const { projectId } = paramsParsed.data;

    const db = await getDb();
    if (!(await assertProjectAccess(db, projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const bodyParsed = generateBody.safeParse(req.body);
    if (!bodyParsed.success) return replyError(reply, 400, "Invalid body", "VALIDATION_ERROR");
    const { sectionId, prompt, count } = bodyParsed.data;

    // Verify section belongs to this project
    const [sec] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
    if (!sec) return replyError(reply, 404, "Section not found", "NOT_FOUND");
    const [suite] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
    if (!suite || suite.projectId !== projectId) return replyError(reply, 404, "Section not found", "NOT_FOUND");

    // Create AI client — 503 if key missing
    let client;
    try {
      client = createAiClient();
    } catch {
      return replyError(reply, 503, "AI service not configured", "AI_NOT_CONFIGURED");
    }

    const systemPrompt = `You are a QA engineer generating test cases for a software product.
Generate exactly ${count} test case(s) as a JSON array. Each test case must have:
- "title": string (concise, action-oriented, max 100 chars)
- "steps": array of objects with "content" (action) and "expected" (expected result)
Return ONLY valid JSON — no markdown, no explanation, no extra text.
Format: [{"title":"...","steps":[{"content":"...","expected":"..."},...]}]`;

    const userPrompt = `<context>
Section: ${sec.name.replace(/</g, "&lt;")}
Suite: ${suite.name.replace(/</g, "&lt;")}
</context>
<request>
${prompt.replace(/<\/request>/gi, "[/request]")}
</request>
Generate ${count} test case(s) for this context.`;

    let rawText: string;
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      });
      const block = message.content[0];
      rawText = block.type === "text" ? block.text : "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      return replyError(reply, 502, `AI generation failed: ${msg}`, "AI_ERROR");
    }

    // Parse JSON response
    let generated: { title: string; steps: { content: string; expected: string }[] }[];
    try {
      generated = JSON.parse(rawText);
      if (!Array.isArray(generated)) throw new Error("Expected array");
    } catch {
      return replyError(reply, 502, "AI returned invalid JSON", "AI_PARSE_ERROR");
    }

    // Insert cases and steps in a transaction — avoids orphan case rows if step insert fails
    const createdCases = await db.transaction(async (tx) => {
      const results = [];
      for (const item of generated.slice(0, count)) {
        if (!item || typeof item !== "object" || !item.title || typeof item.title !== "string") continue;
        const [newCase] = await tx
          .insert(testCases)
          .values({
            sectionId,
            title: item.title.slice(0, 255),
            status: "draft",
          })
          .returning();
        const stepsToInsert = Array.isArray(item.steps)
          ? item.steps.slice(0, 50).map((s, i) => ({
              testCaseId: newCase.id,
              content: String(s.content ?? "").slice(0, 1000),
              expected: String(s.expected ?? "").slice(0, 1000) || null,
              sortOrder: i,
              sharedStepId: null,
            }))
          : [];
        if (stepsToInsert.length > 0) {
          await tx.insert(testSteps).values(stepsToInsert);
        }
        results.push({ ...newCase, steps: stepsToInsert });
      }
      return results;
    });

    await writeAuditLog(db, payload.sub, "ai.generated_cases", "project", projectId, projectId);

    return reply.status(201).send({ created: createdCases.length, cases: createdCases });
  });

  app.post("/api/projects/:projectId/generate-from-failure", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");

    const paramsParsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsParsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const { projectId } = paramsParsed.data;

    const db = await getDb();
    if (!(await assertProjectAccess(db, projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const bodyParsed = generateFromFailureBody.safeParse(req.body);
    if (!bodyParsed.success) return replyError(reply, 400, "Invalid body", "VALIDATION_ERROR");
    const { failureLog, context, sectionId } = bodyParsed.data;

    // Check write permission before burning AI tokens — any project member can call this
    // endpoint, but only those with cases.create can insert into a section.
    if (sectionId && !(await can(payload.sub, projectId, "cases.create"))) {
      return replyError(reply, 403, "Insufficient permissions", "FORBIDDEN");
    }

    let client;
    try {
      client = createAiClient();
    } catch {
      return replyError(reply, 503, "AI service not configured", "AI_NOT_CONFIGURED");
    }

    const systemPrompt = `You are a QA engineer analyzing CI failure logs to suggest test cases that would catch these failures.
Given a CI failure log (and optionally a PRD/ticket description), suggest 3-8 specific test cases that:
1. Directly target the failure scenario
2. Cover edge cases revealed by the failure
3. Prevent regressions for the affected code path

Return ONLY a valid JSON array. Each item must have:
- "title": string (concise, action-oriented, max 100 chars)
- "steps": array of objects with "content" (action) and "expected" (expected result)
- "reasoning": string (1 sentence explaining why this test catches the failure)

Format: [{"title":"...","steps":[{"content":"...","expected":"..."}],"reasoning":"..."}]`;

    const sanitizeXml = (s: string) =>
      s.replace(/<\/failure_log>/gi, "[/failure_log]").replace(/<\/context>/gi, "[/context]");

    const userPrompt = `<failure_log>
${sanitizeXml(failureLog.slice(0, 8000))}
</failure_log>${context ? `\n<context>\n${sanitizeXml(context)}\n</context>` : ""}

Suggest test cases that would catch and prevent this failure.`;

    let rawText: string;
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      });
      const block = message.content[0];
      rawText = block.type === "text" ? block.text : "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      return replyError(reply, 502, `AI generation failed: ${msg}`, "AI_ERROR");
    }

    let suggestions: { title: string; steps: { content: string; expected: string }[]; reasoning: string }[];
    try {
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) throw new Error("Expected array");
      suggestions = parsed;
    } catch {
      return replyError(reply, 502, "AI returned invalid JSON", "AI_PARSE_ERROR");
    }

    // If sectionId provided, insert suggested cases (permission already checked above)
    let createdCases: { id: string; title: string }[] = [];
    if (sectionId) {
      const [sec] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
      if (!sec) return replyError(reply, 404, "Section not found", "NOT_FOUND");
      const [suite] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
      if (!suite || suite.projectId !== projectId) return replyError(reply, 404, "Section not found", "NOT_FOUND");

      createdCases = await db.transaction(async (tx) => {
        const results = [];
        for (const item of suggestions.slice(0, 8)) {
          if (!item || typeof item.title !== "string") continue;
          const [newCase] = await tx.insert(testCases).values({ sectionId, title: item.title.slice(0, 255), status: "draft" }).returning();
          const stepsToInsert = Array.isArray(item.steps)
            ? item.steps.slice(0, 50).map((s, i) => ({
                testCaseId: newCase.id,
                content: String(s.content ?? "").slice(0, 1000),
                expected: String(s.expected ?? "").slice(0, 1000) || null,
                sortOrder: i,
                sharedStepId: null,
              }))
            : [];
          if (stepsToInsert.length > 0) await tx.insert(testSteps).values(stepsToInsert);
          results.push({ id: newCase.id, title: newCase.title });
        }
        return results;
      });
    }

    await writeAuditLog(db, payload.sub, "ai.generated_cases", "project", projectId, projectId);

    return reply.status(201).send({
      suggestions: suggestions.slice(0, 8).map((s) => ({
        title: typeof s.title === "string" ? s.title : "",
        reasoning: typeof s.reasoning === "string" ? s.reasoning : "",
        steps: Array.isArray(s.steps) ? s.steps : [],
      })),
      created: createdCases.length,
      cases: createdCases,
    });
  });
}
