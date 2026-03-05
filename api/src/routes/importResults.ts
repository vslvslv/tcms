import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { getDb } from "../db/index.js";
import { runs, tests, results, testCases, sections, suites } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsRunId = z.object({ runId: z.string().uuid() });

type NormalizedTestResult = { title: string; status: "passed" | "failed" | "blocked" | "skipped" | "untested"; duration?: number };

async function sectionIdsInSuite(db: Awaited<ReturnType<typeof getDb>>, suiteId: string): Promise<string[]> {
  const all = await db.select().from(sections).where(eq(sections.suiteId, suiteId));
  return all.map((s) => s.id);
}

function parseJUnitXml(xml: string): NormalizedTestResult[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const out: NormalizedTestResult[] = [];
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const root = doc as { testsuites?: { testsuite?: unknown | unknown[] }; testsuite?: { testcase?: unknown | unknown[] }; testcase?: unknown | unknown[] };
  const suites: { testcase?: unknown | unknown[] }[] = [];
  if (root.testsuites) {
    const ts = root.testsuites as { testsuite?: unknown | unknown[] };
    const arr = Array.isArray(ts.testsuite) ? ts.testsuite : ts.testsuite ? [ts.testsuite] : [];
    suites.push(...(arr as { testcase?: unknown | unknown[] }[]));
  } else if (root.testsuite) {
    suites.push(root.testsuite as { testcase?: unknown | unknown[] });
  } else if (root.testcase) {
    return parseTestCases(Array.isArray(root.testcase) ? root.testcase : [root.testcase]);
  }
  for (const suite of suites) {
    if (!suite.testcase) continue;
    const cases = Array.isArray(suite.testcase) ? suite.testcase : [suite.testcase];
    out.push(...parseTestCases(cases));
  }
  return out;

  function parseTestCases(cases: unknown[]): NormalizedTestResult[] {
    return cases.map((tc) => {
      const t = tc as { "@_name"?: string; "@_classname"?: string; "@_time"?: string; failure?: unknown; error?: unknown; skipped?: unknown };
      const name = t["@_name"] ?? "";
      const classname = t["@_classname"] ?? "";
      const title = name ? (classname ? `${classname}.${name}` : name) : classname || "unknown";
      const time = t["@_time"] != null ? parseFloat(t["@_time"]) : undefined;
      let status: NormalizedTestResult["status"] = "passed";
      if (t.skipped) status = "skipped";
      else if (t.failure || t.error) status = "failed";
      return { title, status, duration: time };
    });
  }
}

function parsePlaywrightJson(body: unknown): NormalizedTestResult[] {
  const out: NormalizedTestResult[] = [];
  const obj = body as { tests?: { title: string; status?: string; duration?: number }[]; results?: { title: string; status?: string; duration?: number }[] };
  const list = obj.tests ?? obj.results ?? (Array.isArray(body) ? body : []);
  if (!Array.isArray(list)) return [];
  const statusMap: Record<string, NormalizedTestResult["status"]> = {
    passed: "passed",
    ok: "passed",
    failed: "failed",
    skipped: "skipped",
    blocked: "blocked",
    untested: "untested",
  };
  for (const item of list) {
    const t = item as { title?: string; name?: string; status?: string; duration?: number };
    const title = t.title ?? t.name ?? "";
    const s = (t.status ?? "passed").toLowerCase();
    const status = statusMap[s] ?? "passed";
    out.push({ title, status, duration: t.duration });
  }
  return out;
}

export default async function importResultsRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.addContentTypeParser("application/xml", { parseAs: "string" }, (req, body, done) => {
    done(null, body as string);
  });

  app.post("/api/runs/:runId/import/results", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsRunId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid runId", "VALIDATION_ERROR");
    const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    const db = await getDb();
    const [run] = await db.select().from(runs).where(eq(runs.id, paramsResult.data.runId)).limit(1);
    if (!run) return replyError(reply, 404, "Run not found", "NOT_FOUND");
    const [suite] = await db.select().from(suites).where(eq(suites.id, run.suiteId)).limit(1);
    if (!suite || !(await assertProjectAccess(db, suite.projectId, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const sectionIds = await sectionIdsInSuite(db, run.suiteId);
    const casesInSuite =
      sectionIds.length === 0
        ? []
        : await db.select({ id: testCases.id, title: testCases.title }).from(testCases).where(inArray(testCases.sectionId, sectionIds));
    const titleToCaseId = new Map(casesInSuite.map((c) => [c.title.trim().toLowerCase(), c.id]));
    const existingTests = await db.select().from(tests).where(eq(tests.runId, paramsResult.data.runId));
    const caseIdToTestId = new Map(existingTests.map((t) => [t.testCaseId, t.id]));

    let items: NormalizedTestResult[];
    if (contentType === "application/xml") {
      const raw = (req as FastifyRequest<{ Body: string }>).body;
      items = parseJUnitXml(typeof raw === "string" ? raw : "");
    } else {
      const body = (req as FastifyRequest<{ Body: unknown }>).body;
      items = parsePlaywrightJson(body);
    }

    let added = 0;
    let updated = 0;
    for (const item of items) {
      const key = item.title.trim().toLowerCase();
      const caseId = titleToCaseId.get(key) ?? casesInSuite.find((c) => c.title.trim().toLowerCase().includes(key) || key.includes(c.title.trim().toLowerCase()))?.id;
      if (!caseId) continue;
      let testId = caseIdToTestId.get(caseId);
      if (!testId) {
        const [newTest] = await db.insert(tests).values({ runId: paramsResult.data.runId, testCaseId: caseId }).returning();
        testId = newTest.id;
        caseIdToTestId.set(caseId, testId);
        added++;
      } else {
        updated++;
      }
      await db.insert(results).values({
        testId,
        status: item.status,
        elapsedSeconds: item.duration != null ? Math.round(item.duration) : null,
        createdBy: payload.sub,
      });
    }
    return reply.send({ imported: items.length, added, updated });
  });
}
