import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { requirementLinks, testCases, sections, suites } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsCaseId = z.object({ id: z.string().uuid() });
const paramsLinkId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({
  requirementRef: z.string().min(1),
  title: z.string().optional(),
});

async function assertCaseAccessForRequirement(
  db: Awaited<ReturnType<typeof getDb>>,
  caseId: string,
  userId: string
): Promise<string | null> {
  const [c] = await db.select().from(testCases).where(eq(testCases.id, caseId)).limit(1);
  if (!c) return null;
  const [sec] = await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1);
  if (!sec) return null;
  const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  if (!s) return null;
  const ok = await assertProjectAccess(db, s.projectId, userId);
  return ok ? s.projectId : null;
}

export default async function requirementLinkRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/cases/:id/requirement-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsCaseId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const projectId = await assertCaseAccessForRequirement(db, parsed.data.id, payload.sub);
    if (!projectId) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    const list = await db
      .select()
      .from(requirementLinks)
      .where(eq(requirementLinks.caseId, parsed.data.id));
    return reply.send(list);
  });

  app.post("/api/cases/:id/requirement-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsCaseId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const projectId = await assertCaseAccessForRequirement(db, parsed.data.id, payload.sub);
    if (!projectId) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    const [row] = await db
      .insert(requirementLinks)
      .values({
        projectId,
        caseId: parsed.data.id,
        requirementRef: bodyResult.data.requirementRef,
        title: bodyResult.data.title ?? null,
      })
      .returning();
    return reply.status(201).send(row);
  });

  app.delete("/api/requirement-links/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsLinkId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [link] = await db.select().from(requirementLinks).where(eq(requirementLinks.id, parsed.data.id)).limit(1);
    if (!link) return replyError(reply, 404, "Requirement link not found", "NOT_FOUND");
    const projectId = await assertCaseAccessForRequirement(db, link.caseId, payload.sub);
    if (!projectId) return replyError(reply, 404, "Requirement link not found", "NOT_FOUND");
    await db.delete(requirementLinks).where(eq(requirementLinks.id, parsed.data.id));
    return reply.status(204).send();
  });

  app.get("/api/projects/:projectId/requirements/coverage", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const links = await db
      .select()
      .from(requirementLinks)
      .where(eq(requirementLinks.projectId, parsed.data.projectId));
    const byRef = new Map<string, { requirementRef: string; title: string | null; caseIds: string[] }>();
    for (const l of links) {
      const existing = byRef.get(l.requirementRef);
      if (existing) {
        existing.caseIds.push(l.caseId);
      } else {
        byRef.set(l.requirementRef, {
          requirementRef: l.requirementRef,
          title: l.title,
          caseIds: [l.caseId],
        });
      }
    }
    const coverage = [...byRef.values()].map((v) => ({
      requirementRef: v.requirementRef,
      title: v.title,
      caseCount: v.caseIds.length,
      caseIds: v.caseIds,
    }));
    return reply.send(coverage);
  });
}
