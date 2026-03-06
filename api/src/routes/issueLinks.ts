import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { issueLinks, testCases, sections, suites, results, tests, runs } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { writeAuditLog } from "../lib/auditLog.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsCaseId = z.object({ id: z.string().uuid() });
const paramsResultId = z.object({ id: z.string().uuid() });
const createBody = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  externalId: z.string().optional(),
});

async function assertCaseAccessForIssue(db: Awaited<ReturnType<typeof getDb>>, caseId: string, userId: string) {
  const [c] = await db.select().from(testCases).where(eq(testCases.id, caseId)).limit(1);
  if (!c) return false;
  const [sec] = await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1);
  if (!sec) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

async function assertResultAccessForIssue(db: Awaited<ReturnType<typeof getDb>>, resultId: string, userId: string) {
  const [res] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  if (!res) return false;
  const [t] = await db.select().from(tests).where(eq(tests.id, res.testId)).limit(1);
  if (!t) return false;
  const [r] = await db.select().from(runs).where(eq(runs.id, t.runId)).limit(1);
  if (!r) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, r.suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

export default async function issueLinkRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/cases/:id/issue-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsCaseId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccessForIssue(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(issueLinks)
      .where(and(eq(issueLinks.entityId, parsed.data.id), eq(issueLinks.entityType, "case")));
    return reply.send(list);
  });

  app.post("/api/cases/:id/issue-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsCaseId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccessForIssue(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(issueLinks)
      .values({
        entityType: "case",
        entityId: paramsResult.data.id,
        url: bodyResult.data.url,
        title: bodyResult.data.title ?? null,
        externalId: bodyResult.data.externalId ?? null,
        createdBy: payload.sub,
      })
      .returning();
    const [c] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
    const [sec] = c ? await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1) : [null];
    const [s] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
    await writeAuditLog(db, payload.sub, "issue_link.added", "issue_link", row.id, s?.projectId ?? null);
    return reply.status(201).send(row);
  });

  app.get("/api/results/:id/issue-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsResultId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertResultAccessForIssue(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Result not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(issueLinks)
      .where(and(eq(issueLinks.entityId, parsed.data.id), eq(issueLinks.entityType, "result")));
    return reply.send(list);
  });

  app.post("/api/results/:id/issue-links", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsResultId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertResultAccessForIssue(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Result not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(issueLinks)
      .values({
        entityType: "result",
        entityId: paramsResult.data.id,
        url: bodyResult.data.url,
        title: bodyResult.data.title ?? null,
        externalId: bodyResult.data.externalId ?? null,
        createdBy: payload.sub,
      })
      .returning();
    const [res] = await db.select().from(results).where(eq(results.id, paramsResult.data.id)).limit(1);
    const [t] = res ? await db.select().from(tests).where(eq(tests.id, res.testId)).limit(1) : [null];
    const [r] = t ? await db.select().from(runs).where(eq(runs.id, t.runId)).limit(1) : [null];
    const [s] = r ? await db.select().from(suites).where(eq(suites.id, r.suiteId)).limit(1) : [null];
    await writeAuditLog(db, payload.sub, "issue_link.added", "issue_link", row.id, s?.projectId ?? null);
    return reply.status(201).send(row);
  });

  app.delete("/api/issue-links/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [link] = await db.select().from(issueLinks).where(eq(issueLinks.id, parsed.data.id)).limit(1);
    if (!link) return replyError(reply, 404, "Issue link not found", "NOT_FOUND");
    const allowed =
      link.entityType === "case"
        ? await assertCaseAccessForIssue(db, link.entityId, payload.sub)
        : await assertResultAccessForIssue(db, link.entityId, payload.sub);
    if (!allowed) return replyError(reply, 404, "Issue link not found", "NOT_FOUND");
    let projectId: string | null = null;
    if (link.entityType === "case") {
      const [c] = await db.select().from(testCases).where(eq(testCases.id, link.entityId)).limit(1);
      const [sec] = c ? await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1) : [null];
      const [s] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
      projectId = s?.projectId ?? null;
    } else {
      const [res] = await db.select().from(results).where(eq(results.id, link.entityId)).limit(1);
      const [t] = res ? await db.select().from(tests).where(eq(tests.id, res.testId)).limit(1) : [null];
      const [r] = t ? await db.select().from(runs).where(eq(runs.id, t.runId)).limit(1) : [null];
      const [s] = r ? await db.select().from(suites).where(eq(suites.id, r.suiteId)).limit(1) : [null];
      projectId = s?.projectId ?? null;
    }
    await db.delete(issueLinks).where(eq(issueLinks.id, parsed.data.id));
    await writeAuditLog(db, payload.sub, "issue_link.removed", "issue_link", parsed.data.id, projectId);
    return reply.status(204).send();
  });
}
