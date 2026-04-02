import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  users,
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
  fileFailureCorrelations,
} from "../db/schema.js";
import { eq, inArray, desc, and, gte } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { can } from "../lib/permissions.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { dispatchWebhooks } from "../lib/webhooks.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsSuiteId = z.object({ suiteId: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const projectRunsQuery = z.object({
  is_completed: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().min(1).max(250).optional(),
  offset: z.coerce.number().min(0).optional(),
});
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

  app.get("/api/projects/:projectId/runs", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const queryResult = projectRunsQuery.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    const query = queryResult.success ? queryResult.data : {};
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const suiteRows = await db
      .select({ id: suites.id })
      .from(suites)
      .where(eq(suites.projectId, paramsResult.data.projectId));
    const suiteIds = suiteRows.map((s) => s.id);
    if (suiteIds.length === 0) {
      return reply.send([]);
    }
    const whereCond =
      query.is_completed === "true"
        ? and(inArray(runs.suiteId, suiteIds), eq(runs.isCompleted, true))
        : query.is_completed === "false"
          ? and(inArray(runs.suiteId, suiteIds), eq(runs.isCompleted, false))
          : inArray(runs.suiteId, suiteIds);
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const runsList = await db
      .select()
      .from(runs)
      .where(whereCond)
      .orderBy(desc(runs.createdAt))
      .limit(limit)
      .offset(offset);
    if (runsList.length === 0) {
      return reply.send([]);
    }
    const runIds = runsList.map((r) => r.id);
    const runTestsList = await db.select().from(tests).where(inArray(tests.runId, runIds));
    const resultRows = await db.select().from(results).where(inArray(results.testId, runTestsList.map((t) => t.id)));
    const latestByTestId = new Map<string, (typeof resultRows)[0]>();
    for (const r of resultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }
    const summaryByRunId = new Map<
      string,
      { passed: number; failed: number; blocked: number; skipped: number; untested: number }
    >();
    for (const run of runsList) {
      summaryByRunId.set(run.id, { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 });
    }
    for (const t of runTestsList) {
      const sum = summaryByRunId.get(t.runId);
      if (!sum) continue;
      const latest = latestByTestId.get(t.id);
      if (latest) {
        if (latest.status === "passed") sum.passed++;
        else if (latest.status === "failed") sum.failed++;
        else if (latest.status === "blocked") sum.blocked++;
        else if (latest.status === "skipped") sum.skipped++;
        else sum.untested++;
      } else sum.untested++;
    }
    const suiteById = new Map((await db.select().from(suites).where(inArray(suites.id, suiteIds))).map((s) => [s.id, s]));
    const creatorIds = [...new Set(runsList.map((r) => r.createdBy))];
    const planIds = [...new Set(runsList.map((r) => r.planId).filter(Boolean))] as string[];
    const milestoneIds = [...new Set(runsList.map((r) => r.milestoneId).filter(Boolean))] as string[];
    const [usersList, plansList, milestonesList] = await Promise.all([
      creatorIds.length > 0 ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds)) : Promise.resolve([]),
      planIds.length > 0 ? db.select({ id: testPlans.id, name: testPlans.name }).from(testPlans).where(inArray(testPlans.id, planIds)) : Promise.resolve([]),
      milestoneIds.length > 0 ? db.select({ id: milestones.id, name: milestones.name }).from(milestones).where(inArray(milestones.id, milestoneIds)) : Promise.resolve([]),
    ]);
    const userById = new Map((usersList as { id: string; name: string }[]).map((u) => [u.id, u.name]));
    const planById = new Map((plansList as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    const milestoneById = new Map((milestonesList as { id: string; name: string }[]).map((m) => [m.id, m.name]));
    const out = runsList.map((r) => ({
      ...r,
      suiteName: suiteById.get(r.suiteId)?.name ?? null,
      createdByName: userById.get(r.createdBy) ?? null,
      planName: r.planId ? planById.get(r.planId) ?? null : null,
      milestoneName: r.milestoneId ? milestoneById.get(r.milestoneId) ?? null : null,
      summary: summaryByRunId.get(r.id) ?? { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 },
    }));
    return reply.send(out);
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
        : await db
            .select({
              id: testCases.id,
              title: testCases.title,
              sectionId: testCases.sectionId,
              sectionName: sections.name,
            })
            .from(testCases)
            .innerJoin(sections, eq(testCases.sectionId, sections.id))
            .where(inArray(testCases.id, caseIds));
    const caseById = new Map(
      casesRows.map((c) => [
        c.id,
        { title: c.title, sectionId: c.sectionId, sectionName: c.sectionName },
      ])
    );
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
      const caseInfo = caseById.get(t.testCaseId);
      return {
        id: t.id,
        runId: t.runId,
        testCaseId: t.testCaseId,
        caseTitle: caseInfo?.title ?? "",
        sectionId: caseInfo?.sectionId ?? null,
        sectionName: caseInfo?.sectionName ?? null,
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
    if (s && !(await can(payload.sub, s.projectId, "runs.delete"))) {
      return replyError(reply, 403, "Insufficient permissions to delete run", "FORBIDDEN");
    }
    await db.delete(runs).where(eq(runs.id, paramsResult.data.id));
    await writeAuditLog(db, payload.sub, "run.deleted", "run", paramsResult.data.id, s?.projectId ?? null);
    return reply.status(204).send();
  });

  // Re-run failed tests: create a new run with only the failed tests from a given run
  app.post("/api/runs/:id/rerun-failures", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertRunAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const [runRow] = await db.select().from(runs).where(eq(runs.id, paramsResult.data.id)).limit(1);
    if (!runRow) return replyError(reply, 404, "Run not found", "NOT_FOUND");

    // Find all tests in this run
    const runTests = await db.select().from(tests).where(eq(tests.runId, runRow.id));
    if (runTests.length === 0) return replyError(reply, 400, "Run has no tests", "VALIDATION_ERROR");

    // Get latest result for each test
    const allResults = await db.select().from(results).where(inArray(results.testId, runTests.map((t) => t.id)));
    const latestByTestId = new Map<string, (typeof allResults)[0]>();
    for (const r of allResults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }

    // Filter to failed tests only
    const failedTests = runTests.filter((t) => {
      const latest = latestByTestId.get(t.id);
      return latest && latest.status === "failed";
    });
    if (failedTests.length === 0) return replyError(reply, 400, "No failed tests to re-run", "VALIDATION_ERROR");

    // Create new run in the same suite
    const [newRun] = await db.insert(runs).values({
      suiteId: runRow.suiteId,
      name: `${runRow.name} (re-run failures)`,
      description: `Re-run of ${failedTests.length} failed tests from ${runRow.name}`,
      createdBy: payload.sub,
      planId: runRow.planId,
      milestoneId: runRow.milestoneId,
    }).returning();

    // Create tests in the new run for each failed case (batch insert)
    if (failedTests.length > 0) {
      await db.insert(tests).values(
        failedTests.map((t) => ({
          runId: newRun.id,
          testCaseId: t.testCaseId,
          datasetRowId: t.datasetRowId,
        }))
      );
    }

    const [s] = await db.select().from(suites).where(eq(suites.id, runRow.suiteId)).limit(1);
    if (s) {
      await writeAuditLog(db, payload.sub, "run.created", "run", newRun.id, s.projectId);
      dispatchWebhooks(s.projectId, "run.created", {
        event: "run.created",
        entityType: "run",
        entityId: newRun.id,
        projectId: s.projectId,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    return reply.status(201).send(newRun);
  });

  // Smart test selection: suggest test cases based on changed files
  const suggestQuery = z.object({ changedFiles: z.string().min(1) });

  app.get("/api/projects/:projectId/suggest-tests", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const queryResult = suggestQuery.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    if (!queryResult.success) return replyError(reply, 400, "changedFiles query parameter required (comma-separated)", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const changedFiles = queryResult.data.changedFiles.split(",").map((f) => f.trim()).filter(Boolean);
    if (changedFiles.length === 0) return reply.send([]);

    // Look at correlations from the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const correlations = await db
      .select()
      .from(fileFailureCorrelations)
      .where(
        and(
          inArray(fileFailureCorrelations.filePath, changedFiles),
          gte(fileFailureCorrelations.createdAt, ninetyDaysAgo)
        )
      );

    if (correlations.length === 0) return reply.send([]);

    // Count how many times each caseId appears in correlations (higher = more correlated)
    const caseScores = new Map<string, number>();
    for (const c of correlations) {
      caseScores.set(c.caseId, (caseScores.get(c.caseId) ?? 0) + 1);
    }

    // Get case details and filter to this project's cases
    const caseIds = [...caseScores.keys()];
    const cases = caseIds.length === 0
      ? []
      : await db
          .select({ id: testCases.id, title: testCases.title, sectionId: testCases.sectionId })
          .from(testCases)
          .innerJoin(sections, eq(testCases.sectionId, sections.id))
          .innerJoin(suites, eq(sections.suiteId, suites.id))
          .where(
            and(
              inArray(testCases.id, caseIds),
              eq(suites.projectId, paramsResult.data.projectId)
            )
          );

    const ranked = cases
      .map((c) => ({
        caseId: c.id,
        caseTitle: c.title,
        score: caseScores.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    return reply.send(ranked);
  });
}
