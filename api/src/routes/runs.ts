import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  projects,
  suites,
  sections,
  testCases,
  runs,
  tests,
  results,
  runConfigs,
  testPlans,
  milestones,
  datasetRows,
} from "../db/schema.js";
import { eq, inArray, desc } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess, assertProjectRole } from "../lib/projectAccess.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { dispatchWebhooks } from "../lib/webhooks.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsSuiteId = z.object({ suiteId: z.string().uuid() });
const createRunBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  planId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  configOptionIds: z.array(z.string().uuid()).optional(),
});
const updateRunBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isCompleted: z.boolean().optional(),
});

async function assertSuiteAccess(db: Awaited<ReturnType<typeof getDb>>, suiteId: string, userId: string) {
  const [s] = await db.select().from(suites).where(eq(suites.id, suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

async function assertRunAccess(db: Awaited<ReturnType<typeof getDb>>, runId: string, userId: string) {
  const [r] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!r) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, r.suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

/** Collect all section IDs in suite (flat; includes children recursively via parent_id) */
async function sectionIdsInSuite(db: Awaited<ReturnType<typeof getDb>>, suiteId: string): Promise<string[]> {
  const all = await db.select().from(sections).where(eq(sections.suiteId, suiteId));
  return all.map((s) => s.id);
}

/** All test cases in a suite (id and optional datasetId) */
async function casesInSuite(db: Awaited<ReturnType<typeof getDb>>, suiteId: string): Promise<{ id: string; datasetId: string | null }[]> {
  const sectionIdList = await sectionIdsInSuite(db, suiteId);
  if (sectionIdList.length === 0) return [];
  return db
    .select({ id: testCases.id, datasetId: testCases.datasetId })
    .from(testCases)
    .where(inArray(testCases.sectionId, sectionIdList));
}

export default async function runRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/suites/:suiteId/runs", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsSuiteId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid suiteId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, paramsResult.data.suiteId, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(runs)
      .where(eq(runs.suiteId, paramsResult.data.suiteId))
      .orderBy(desc(runs.createdAt));
    return reply.send(list);
  });

  app.post("/api/suites/:suiteId/runs", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsSuiteId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid suiteId", "VALIDATION_ERROR");
    const bodyResult = createRunBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, paramsResult.data.suiteId, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const [suite] = await db.select().from(suites).where(eq(suites.id, paramsResult.data.suiteId)).limit(1);
    if (!suite) return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    if (bodyResult.data.planId) {
      const [plan] = await db.select().from(testPlans).where(eq(testPlans.id, bodyResult.data.planId)).limit(1);
      if (!plan || plan.projectId !== suite.projectId) return replyError(reply, 400, "Plan not found or wrong project", "VALIDATION_ERROR");
    }
    if (bodyResult.data.milestoneId) {
      const [m] = await db.select().from(milestones).where(eq(milestones.id, bodyResult.data.milestoneId)).limit(1);
      if (!m || m.projectId !== suite.projectId) return replyError(reply, 400, "Milestone not found or wrong project", "VALIDATION_ERROR");
    }
    const casesList = await casesInSuite(db, paramsResult.data.suiteId);
    const [run] = await db
      .insert(runs)
      .values({
        suiteId: paramsResult.data.suiteId,
        planId: bodyResult.data.planId ?? null,
        milestoneId: bodyResult.data.milestoneId ?? null,
        name: bodyResult.data.name,
        description: bodyResult.data.description ?? null,
        createdBy: payload.sub,
      })
      .returning();
    if (bodyResult.data.configOptionIds && bodyResult.data.configOptionIds.length > 0) {
      await db.insert(runConfigs).values(
        bodyResult.data.configOptionIds.map((configOptionId) => ({ runId: run.id, configOptionId }))
      );
    }
    const testValues: { runId: string; testCaseId: string; datasetRowId?: string | null }[] = [];
    for (const c of casesList) {
      if (!c.datasetId) {
        testValues.push({ runId: run.id, testCaseId: c.id });
      } else {
        const rows = await db.select().from(datasetRows).where(eq(datasetRows.datasetId, c.datasetId));
        for (const row of rows) {
          testValues.push({ runId: run.id, testCaseId: c.id, datasetRowId: row.id });
        }
        if (rows.length === 0) {
          testValues.push({ runId: run.id, testCaseId: c.id });
        }
      }
    }
    if (testValues.length > 0) {
      await db.insert(tests).values(testValues);
    }
    const runTests = await db.select().from(tests).where(eq(tests.runId, run.id));
    const caseIdList = runTests.map((t) => t.testCaseId);
    const casesRows =
      caseIdList.length === 0
        ? []
        : await db.select({ id: testCases.id, title: testCases.title }).from(testCases).where(inArray(testCases.id, caseIdList));
    const caseTitleById = new Map(casesRows.map((c) => [c.id, c.title]));
    const testList = runTests.map((t) => ({
      id: t.id,
      runId: t.runId,
      testCaseId: t.testCaseId,
      caseTitle: caseTitleById.get(t.testCaseId) ?? "",
      latestResult: null as { status: string; comment: string | null; elapsedSeconds: number | null; createdAt: Date } | null,
    }));
    const summary = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: testList.length };
    await writeAuditLog(db, payload.sub, "run.created", "run", run.id, suite.projectId);
    dispatchWebhooks(suite.projectId, "run.created", {
      event: "run.created",
      entityType: "run",
      entityId: run.id,
      projectId: suite.projectId,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
    return reply.status(201).send({
      ...run,
      tests: testList,
      summary,
    });
  });

  app.get("/api/runs/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertRunAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const [run] = await db.select().from(runs).where(eq(runs.id, parsed.data.id)).limit(1);
    if (!run) return replyError(reply, 404, "Run not found", "NOT_FOUND");
    const runTests = await db.select().from(tests).where(eq(tests.runId, run.id));
    const caseIds = runTests.map((t) => t.testCaseId);
    const casesRows =
      caseIds.length === 0
        ? []
        : await db.select({ id: testCases.id, title: testCases.title }).from(testCases).where(inArray(testCases.id, caseIds));
    const caseTitleById = new Map(casesRows.map((c) => [c.id, c.title]));
    const datasetRowIds = runTests.map((t) => t.datasetRowId).filter(Boolean) as string[];
    const datasetRowsList = datasetRowIds.length === 0 ? [] : await db.select().from(datasetRows).where(inArray(datasetRows.id, datasetRowIds));
    const datasetRowById = new Map(datasetRowsList.map((r) => [r.id, r.data]));
    const resultRows = await db.select().from(results).where(inArray(results.testId, runTests.map((t) => t.id)));
    const latestByTestId = new Map<string, (typeof resultRows)[0]>();
    for (const r of resultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }
    const summary = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
    const testList = runTests.map((t) => {
      const latest = latestByTestId.get(t.id);
      if (latest) {
        if (latest.status === "passed") summary.passed++;
        else if (latest.status === "failed") summary.failed++;
        else if (latest.status === "blocked") summary.blocked++;
        else if (latest.status === "skipped") summary.skipped++;
        else summary.untested++;
      } else summary.untested++;
      return {
        id: t.id,
        runId: t.runId,
        testCaseId: t.testCaseId,
        caseTitle: caseTitleById.get(t.testCaseId) ?? "",
        datasetRowId: t.datasetRowId ?? undefined,
        datasetRow: t.datasetRowId ? datasetRowById.get(t.datasetRowId) ?? undefined : undefined,
        latestResult: latest
          ? {
              id: latest.id,
              status: latest.status,
              comment: latest.comment,
              elapsedSeconds: latest.elapsedSeconds,
              createdAt: latest.createdAt,
            }
          : null,
      };
    });
    return reply.send({
      ...run,
      tests: testList,
      summary,
    });
  });

  app.patch("/api/runs/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateRunBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertRunAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const setPayload: Partial<typeof runs.$inferInsert> = { updatedAt: new Date() };
    if (bodyResult.data.name !== undefined) setPayload.name = bodyResult.data.name;
    if (bodyResult.data.description !== undefined) setPayload.description = bodyResult.data.description;
    if (bodyResult.data.isCompleted !== undefined) setPayload.isCompleted = bodyResult.data.isCompleted;
    const [updated] = await db
      .update(runs)
      .set(setPayload)
      .where(eq(runs.id, paramsResult.data.id))
      .returning();
    const [runRow] = await db.select().from(runs).where(eq(runs.id, paramsResult.data.id)).limit(1);
    const [s] = runRow ? await db.select().from(suites).where(eq(suites.id, runRow.suiteId)).limit(1) : [null];
    await writeAuditLog(db, payload.sub, "run.updated", "run", paramsResult.data.id, s?.projectId ?? null);
    if (bodyResult.data.isCompleted === true && s?.projectId) {
      dispatchWebhooks(s.projectId, "run.completed", {
        event: "run.completed",
        entityType: "run",
        entityId: paramsResult.data.id,
        projectId: s.projectId,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
    return reply.send(updated);
  });

  app.delete("/api/runs/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertRunAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const [runRow] = await db.select().from(runs).where(eq(runs.id, paramsResult.data.id)).limit(1);
    const [s] = runRow ? await db.select().from(suites).where(eq(suites.id, runRow.suiteId)).limit(1) : [null];
    if (s && !(await assertProjectRole(db, s.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can delete run", "FORBIDDEN");
    }
    await db.delete(runs).where(eq(runs.id, paramsResult.data.id));
    await writeAuditLog(db, payload.sub, "run.deleted", "run", paramsResult.data.id, s?.projectId ?? null);
    return reply.status(204).send();
  });
}
