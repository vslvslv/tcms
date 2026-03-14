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
  milestones,
  datasetRows,
} from "../db/schema.js";
import { eq, inArray, desc, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess, assertProjectRole } from "../lib/projectAccess.js";
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
    const milestoneIds = [...new Set(runsList.map((r) => r.milestoneId).filter(Boolean))] as string[];
    const [usersList, milestonesList] = await Promise.all([
      creatorIds.length > 0 ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds)) : Promise.resolve([]),
      milestoneIds.length > 0 ? db.select({ id: milestones.id, name: milestones.name }).from(milestones).where(inArray(milestones.id, milestoneIds)) : Promise.resolve([]),
    ]);
    const userById = new Map((usersList as { id: string; name: string }[]).map((u) => [u.id, u.name]));
    const milestoneById = new Map((milestonesList as { id: string; name: string }[]).map((m) => [m.id, m.name]));
    const out = runsList.map((r) => ({
      ...r,
      suiteName: suiteById.get(r.suiteId)?.name ?? null,
      createdByName: userById.get(r.createdBy) ?? null,
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
    if (bodyResult.data.milestoneId) {
      const [m] = await db.select().from(milestones).where(eq(milestones.id, bodyResult.data.milestoneId)).limit(1);
      if (!m || m.projectId !== suite.projectId) return replyError(reply, 400, "Milestone not found or wrong project", "VALIDATION_ERROR");
    }
    const casesList = await casesInSuite(db, paramsResult.data.suiteId);
    const [run] = await db
      .insert(runs)
      .values({
        suiteId: paramsResult.data.suiteId,
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
    const [suite] = await db.select().from(suites).where(eq(suites.id, run.suiteId)).limit(1);
    const projectId = suite?.projectId ?? null;
    const runTests = await db.select().from(tests).where(eq(tests.runId, run.id));
    const assignedToIds = [...new Set(runTests.map((t) => t.assignedTo).filter(Boolean))] as string[];
    const assigneeUsers =
      assignedToIds.length === 0 ? [] : await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assignedToIds));
    const assigneeByName = new Map(assigneeUsers.map((u) => [u.id, u.name]));
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
        assignedTo: t.assignedTo ?? undefined,
        assignedToName: t.assignedTo ? assigneeByName.get(t.assignedTo) ?? null : null,
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
      projectId,
      tests: testList,
      summary,
    });
  });

  app.get("/api/runs/:id/activity", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertRunAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const runTests = await db.select().from(tests).where(eq(tests.runId, parsed.data.id));
    if (runTests.length === 0) {
      return reply.send({ activity: [] });
    }
    const testIds = runTests.map((t) => t.id);
    const rows = await db
      .select({
        resultId: results.id,
        testId: results.testId,
        caseTitle: testCases.title,
        status: results.status,
        comment: results.comment,
        createdByName: users.name,
        createdAt: results.createdAt,
      })
      .from(results)
      .innerJoin(tests, eq(results.testId, tests.id))
      .innerJoin(testCases, eq(tests.testCaseId, testCases.id))
      .innerJoin(users, eq(results.createdBy, users.id))
      .where(inArray(results.testId, testIds))
      .orderBy(desc(results.createdAt))
      .limit(100);
    type ActivityEntry = {
      id: string;
      type: "result" | "comment";
      resultId: string;
      testId: string;
      caseTitle: string;
      status?: string;
      comment?: string | null;
      createdByName: string;
      createdAt: string;
    };
    const activity: ActivityEntry[] = [];
    for (const r of rows) {
      const createdAt = r.createdAt.toISOString();
      const caseTitle = r.caseTitle ?? "";
      activity.push({
        id: r.resultId,
        type: "result",
        resultId: r.resultId,
        testId: r.testId,
        caseTitle,
        status: r.status,
        createdByName: r.createdByName,
        createdAt,
      });
      if (r.comment != null && r.comment.trim() !== "") {
        activity.push({
          id: `${r.resultId}-comment`,
          type: "comment",
          resultId: r.resultId,
          testId: r.testId,
          caseTitle,
          comment: r.comment,
          createdByName: r.createdByName,
          createdAt,
        });
      }
    }
    activity.sort((a, b) => {
      const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (t !== 0) return t;
      return a.type === "comment" && b.type === "result" ? 1 : a.type === "result" && b.type === "comment" ? -1 : 0;
    });
    return reply.send({ activity });
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
