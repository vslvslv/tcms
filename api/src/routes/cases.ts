import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, sections, testCases, testSteps } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsSectionId = z.object({ sectionId: z.string().uuid() });
const stepSchema = z.object({
  content: z.string().min(1),
  expected: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const createCaseBody = z.object({
  title: z.string().min(1),
  prerequisite: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  steps: z.array(stepSchema).optional(),
});
const updateCaseBody = z.object({
  title: z.string().min(1).optional(),
  prerequisite: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  steps: z.array(stepSchema).optional(),
});

async function assertSectionAccess(db: Awaited<ReturnType<typeof getDb>>, sectionId: string, userId: string) {
  const [sec] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!sec) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  if (!s) return false;
  const [p] = await db.select().from(projects).where(eq(projects.id, s.projectId)).limit(1);
  return !!p && p.userId === userId;
}

async function assertCaseAccess(db: Awaited<ReturnType<typeof getDb>>, caseId: string, userId: string) {
  const [c] = await db.select().from(testCases).where(eq(testCases.id, caseId)).limit(1);
  if (!c) return false;
  return assertSectionAccess(db, c.sectionId, userId);
}

export default async function caseRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/sections/:sectionId/cases", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsSectionId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid sectionId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSectionAccess(db, parsed.data.sectionId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    const casesList = await db
      .select()
      .from(testCases)
      .where(eq(testCases.sectionId, parsed.data.sectionId));
    const caseIds = casesList.map((c) => c.id);
    const stepsList =
      caseIds.length === 0
        ? []
        : await db.select().from(testSteps).where(inArray(testSteps.testCaseId, caseIds));
    const stepsByCase = new Map<string, typeof stepsList>();
    for (const step of stepsList) {
      if (!stepsByCase.has(step.testCaseId)) stepsByCase.set(step.testCaseId, []);
      stepsByCase.get(step.testCaseId)!.push(step);
    }
    const result = casesList.map((c) => ({
      ...c,
      steps: (stepsByCase.get(c.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));
    return reply.send(result);
  });

  app.post("/api/sections/:sectionId/cases", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsSectionId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid sectionId", "VALIDATION_ERROR");
    const bodyResult = createCaseBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSectionAccess(db, paramsResult.data.sectionId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    const [inserted] = await db
      .insert(testCases)
      .values({
        sectionId: paramsResult.data.sectionId,
        title: bodyResult.data.title,
        prerequisite: bodyResult.data.prerequisite ?? null,
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    if (bodyResult.data.steps && bodyResult.data.steps.length > 0) {
      await db.insert(testSteps).values(
        bodyResult.data.steps.map((s, i) => ({
          testCaseId: inserted.id,
          content: s.content,
          expected: s.expected ?? null,
          sortOrder: s.sortOrder ?? i,
        }))
      );
    }
    const steps = await db
      .select()
      .from(testSteps)
      .where(eq(testSteps.testCaseId, inserted.id));
    return reply.status(201).send({ ...inserted, steps: steps.sort((a, b) => a.sortOrder - b.sortOrder) });
  });

  app.get("/api/cases/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const [c] = await db.select().from(testCases).where(eq(testCases.id, parsed.data.id)).limit(1);
    if (!c) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    const steps = await db
      .select()
      .from(testSteps)
      .where(eq(testSteps.testCaseId, parsed.data.id));
    return reply.send({ ...c, steps: steps.sort((a, b) => a.sortOrder - b.sortOrder) });
  });

  app.patch("/api/cases/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateCaseBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const updatePayload: Partial<typeof testCases.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (bodyResult.data.title !== undefined) updatePayload.title = bodyResult.data.title;
    if (bodyResult.data.prerequisite !== undefined) updatePayload.prerequisite = bodyResult.data.prerequisite;
    if (bodyResult.data.sortOrder !== undefined) updatePayload.sortOrder = bodyResult.data.sortOrder;
    await db.update(testCases).set(updatePayload).where(eq(testCases.id, paramsResult.data.id));
    if (bodyResult.data.steps !== undefined) {
      await db.delete(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
      if (bodyResult.data.steps.length > 0) {
        await db.insert(testSteps).values(
          bodyResult.data.steps.map((s, i) => ({
            testCaseId: paramsResult.data.id,
            content: s.content,
            expected: s.expected ?? null,
            sortOrder: s.sortOrder ?? i,
          }))
        );
      }
    }
    const [c] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
    const steps = await db
      .select()
      .from(testSteps)
      .where(eq(testSteps.testCaseId, paramsResult.data.id));
    return reply.send({ ...c, steps: steps.sort((a, b) => a.sortOrder - b.sortOrder) });
  });

  app.delete("/api/cases/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    await db.delete(testSteps).where(eq(testSteps.testCaseId, parsed.data.id));
    await db.delete(testCases).where(eq(testCases.id, parsed.data.id));
    return reply.status(204).send();
  });
}
