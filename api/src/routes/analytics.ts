import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { results, tests, runs, testCases, sections, suites, milestones } from "../db/schema.js";
import { eq, inArray, and, gte, desc, sql, count } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsMilestoneId = z.object({ id: z.string().uuid() });

/** Get all suite IDs for a project */
async function projectSuiteIds(db: Awaited<ReturnType<typeof getDb>>, projectId: string): Promise<string[]> {
  const rows = await db.select({ id: suites.id }).from(suites).where(eq(suites.projectId, projectId));
  return rows.map((r) => r.id);
}

/** Get all test IDs in project runs */
async function projectTestIds(db: Awaited<ReturnType<typeof getDb>>, suiteIds: string[]): Promise<string[]> {
  if (suiteIds.length === 0) return [];
  const runRows = await db.select({ id: runs.id }).from(runs).where(inArray(runs.suiteId, suiteIds));
  if (runRows.length === 0) return [];
  const testRows = await db.select({ id: tests.id }).from(tests).where(inArray(tests.runId, runRows.map((r) => r.id)));
  return testRows.map((t) => t.id);
}

export default async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  // Flaky tests — compute flakinessScore per case
  app.get("/api/projects/:projectId/flaky-tests", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsProjectId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, params.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const suiteIds = await projectSuiteIds(db, params.data.projectId);
    if (suiteIds.length === 0) return [];

    const runRows = await db.select({ id: runs.id }).from(runs).where(inArray(runs.suiteId, suiteIds));
    if (runRows.length === 0) return [];

    const testRows = await db.select({ id: tests.id, testCaseId: tests.testCaseId, runId: tests.runId })
      .from(tests).where(inArray(tests.runId, runRows.map((r) => r.id)));
    if (testRows.length === 0) return [];

    // Get latest result per test
    const allResults = await db.select({ testId: results.testId, status: results.status, createdAt: results.createdAt })
      .from(results)
      .where(inArray(results.testId, testRows.map((t) => t.id)))
      .orderBy(desc(results.createdAt));

    // Group results by testCaseId (across runs)
    const testIdToCase = new Map(testRows.map((t) => [t.id, t.testCaseId]));
    const caseResults = new Map<string, string[]>();
    for (const r of allResults) {
      const caseId = testIdToCase.get(r.testId);
      if (!caseId) continue;
      const arr = caseResults.get(caseId) ?? [];
      arr.push(r.status);
      caseResults.set(caseId, arr);
    }

    // Compute flakiness: count alternations in last 10 results per case
    const flaky: { caseId: string; flakinessScore: number; lastResults: string[] }[] = [];
    for (const [caseId, statuses] of caseResults) {
      const last10 = statuses.slice(0, 10);
      let alternations = 0;
      for (let i = 1; i < last10.length; i++) {
        if (last10[i] !== last10[i - 1]) alternations++;
      }
      if (alternations > 0) {
        flaky.push({ caseId, flakinessScore: alternations, lastResults: last10 });
      }
    }

    // Sort by score desc, limit to top 20
    flaky.sort((a, b) => b.flakinessScore - a.flakinessScore);
    const top = flaky.slice(0, 20);

    // Resolve case titles
    if (top.length > 0) {
      const caseIds = top.map((f) => f.caseId);
      const cases = await db.select({ id: testCases.id, title: testCases.title })
        .from(testCases).where(inArray(testCases.id, caseIds));
      const titleMap = new Map(cases.map((c) => [c.id, c.title]));
      return top.map((f) => ({ ...f, caseTitle: titleMap.get(f.caseId) ?? "Unknown" }));
    }
    return [];
  });

  // Pass-rate trend — daily aggregation over last N days
  app.get("/api/projects/:projectId/trends/pass-rate", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsProjectId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, params.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const days = Number((req as any).query?.days ?? 30);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const suiteIds = await projectSuiteIds(db, params.data.projectId);
    if (suiteIds.length === 0) return [];

    const runRows = await db.select({ id: runs.id }).from(runs)
      .where(and(inArray(runs.suiteId, suiteIds), gte(runs.createdAt, since)));
    if (runRows.length === 0) return [];

    const testRows = await db.select({ id: tests.id }).from(tests)
      .where(inArray(tests.runId, runRows.map((r) => r.id)));
    if (testRows.length === 0) return [];

    const allResults = await db.select({
      status: results.status,
      createdAt: results.createdAt,
    }).from(results)
      .where(and(inArray(results.testId, testRows.map((t) => t.id)), gte(results.createdAt, since)));

    // Group by date
    const byDate = new Map<string, { passed: number; failed: number; total: number }>();
    for (const r of allResults) {
      const date = r.createdAt.toISOString().slice(0, 10);
      const entry = byDate.get(date) ?? { passed: 0, failed: 0, total: 0 };
      entry.total++;
      if (r.status === "passed") entry.passed++;
      else if (r.status === "failed") entry.failed++;
      byDate.set(date, entry);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date,
        passRate: d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0,
        totalTests: d.total,
        passed: d.passed,
        failed: d.failed,
      }));
  });

  // Milestone readiness — raw metrics (not a single score)
  app.get("/api/milestones/:id/readiness", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsMilestoneId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();

    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, params.data.id)).limit(1);
    if (!milestone) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, milestone.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }

    // Find all runs linked to this milestone
    const milestoneRuns = await db.select({ id: runs.id }).from(runs).where(eq(runs.milestoneId, milestone.id));
    if (milestoneRuns.length === 0) {
      return { passRate: null, blockerRate: null, flakyPct: null, runsAnalyzed: 0, totalResults: 0 };
    }

    const testRows = await db.select({ id: tests.id, testCaseId: tests.testCaseId })
      .from(tests).where(inArray(tests.runId, milestoneRuns.map((r) => r.id)));
    if (testRows.length === 0) {
      return { passRate: null, blockerRate: null, flakyPct: null, runsAnalyzed: milestoneRuns.length, totalResults: 0 };
    }

    // Get latest result per test
    const allResults = await db.select({ testId: results.testId, status: results.status, createdAt: results.createdAt })
      .from(results).where(inArray(results.testId, testRows.map((t) => t.id)))
      .orderBy(desc(results.createdAt));

    const latestByTest = new Map<string, string>();
    for (const r of allResults) {
      if (!latestByTest.has(r.testId)) latestByTest.set(r.testId, r.status);
    }

    const total = latestByTest.size;
    let passed = 0, failed = 0, blocked = 0;
    for (const status of latestByTest.values()) {
      if (status === "passed") passed++;
      else if (status === "failed") failed++;
      else if (status === "blocked") blocked++;
    }

    const passRate = total > 0 ? Math.round((passed / total) * 100) : null;
    const blockerRate = total > 0 ? Math.round((blocked / total) * 100) : null;

    return {
      passRate,
      blockerRate,
      flakyPct: null, // Would need flaky detection scoped to milestone — deferred
      runsAnalyzed: milestoneRuns.length,
      totalResults: total,
      passed,
      failed,
      blocked,
    };
  });

  // Report builder — filtered results
  app.get("/api/projects/:projectId/reports", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsProjectId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, params.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const query = (req as any).query ?? {};
    const fromDate = query.from ? new Date(query.from) : undefined;
    const toDate = query.to ? new Date(query.to) : undefined;
    const statusFilter = query.status as string | undefined;

    // Validate dates
    if (fromDate && isNaN(fromDate.getTime())) return replyError(reply, 400, "Invalid 'from' date", "VALIDATION_ERROR");
    if (toDate && isNaN(toDate.getTime())) return replyError(reply, 400, "Invalid 'to' date", "VALIDATION_ERROR");

    const suiteIds = await projectSuiteIds(db, params.data.projectId);
    if (suiteIds.length === 0) return [];

    const runRows = await db.select({ id: runs.id, name: runs.name }).from(runs)
      .where(inArray(runs.suiteId, suiteIds));
    if (runRows.length === 0) return [];

    const testRows = await db.select({ id: tests.id, testCaseId: tests.testCaseId, runId: tests.runId })
      .from(tests).where(inArray(tests.runId, runRows.map((r) => r.id)));
    if (testRows.length === 0) return [];

    // Build conditions
    const conditions = [inArray(results.testId, testRows.map((t) => t.id))];
    if (fromDate) conditions.push(gte(results.createdAt, fromDate));
    if (toDate) {
      const to = new Date(toDate);
      to.setDate(to.getDate() + 1);
      conditions.push(sql`${results.createdAt} < ${to}`);
    }
    if (statusFilter && ["passed", "failed", "blocked", "skipped", "untested"].includes(statusFilter)) {
      conditions.push(eq(results.status, statusFilter as any));
    }

    const allResults = await db.select()
      .from(results)
      .where(and(...conditions))
      .orderBy(desc(results.createdAt))
      .limit(500);

    // Resolve test case titles and run names
    const testIdToInfo = new Map(testRows.map((t) => [t.id, t]));
    const runNameMap = new Map(runRows.map((r) => [r.id, r.name]));
    const caseIds = [...new Set(testRows.map((t) => t.testCaseId))];
    const cases = caseIds.length > 0
      ? await db.select({ id: testCases.id, title: testCases.title }).from(testCases).where(inArray(testCases.id, caseIds))
      : [];
    const caseTitleMap = new Map(cases.map((c) => [c.id, c.title]));

    return allResults.map((r) => {
      const testInfo = testIdToInfo.get(r.testId);
      return {
        id: r.id,
        status: r.status,
        comment: r.comment,
        elapsedSeconds: r.elapsedSeconds,
        createdAt: r.createdAt,
        caseTitle: testInfo ? caseTitleMap.get(testInfo.testCaseId) ?? "Unknown" : "Unknown",
        runName: testInfo ? runNameMap.get(testInfo.runId) ?? "Unknown" : "Unknown",
      };
    });
  });
}
