import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import { getDb } from "../db/index.js";
import { runs, tests, results, testCases, sections, suites, attachments } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { uploadFile } from "../lib/storage.js";

const paramsRunId = z.object({ runId: z.string().uuid() });

type NormalizedAttachment = { name: string; contentType: string; body: string }; // body is base64
type NormalizedTestResult = { title: string; status: "passed" | "failed" | "blocked" | "skipped" | "untested"; duration?: number; attachments?: NormalizedAttachment[] };

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
  const obj = body as { tests?: unknown[]; results?: unknown[]; suites?: unknown[] };
  // Playwright reports can have tests at top level or nested in suites
  let list = obj.tests ?? obj.results ?? (Array.isArray(body) ? body : []);
  if (!Array.isArray(list)) list = [];
  // Flatten suites if present (Playwright nested format)
  if (list.length === 0 && Array.isArray(obj.suites)) {
    for (const suite of obj.suites as { specs?: { tests?: unknown[]; title?: string; ok?: boolean }[] }[]) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          if (spec.tests) list.push(...spec.tests);
          else list.push(spec);
        }
      }
    }
  }
  const statusMap: Record<string, NormalizedTestResult["status"]> = {
    passed: "passed",
    ok: "passed",
    expected: "passed",
    failed: "failed",
    unexpected: "failed",
    skipped: "skipped",
    blocked: "blocked",
    untested: "untested",
  };
  for (const item of list) {
    const t = item as { title?: string; name?: string; status?: string; duration?: number; results?: { status?: string; duration?: number; attachments?: { name?: string; contentType?: string; body?: string; path?: string }[] }[] };
    const title = t.title ?? t.name ?? "";
    // Playwright nested: test.results[0].status
    const firstResult = t.results?.[0];
    const s = (firstResult?.status ?? t.status ?? "passed").toLowerCase();
    const status = statusMap[s] ?? "passed";
    const duration = firstResult?.duration ?? t.duration;

    // Extract attachments (base64-encoded screenshots from Playwright)
    const atts: NormalizedAttachment[] = [];
    const rawAtts = firstResult?.attachments ?? (t as { attachments?: unknown[] }).attachments ?? [];
    if (Array.isArray(rawAtts)) {
      for (const a of rawAtts) {
        const att = a as { name?: string; contentType?: string; body?: string; path?: string };
        if (att.body && att.contentType) {
          atts.push({
            name: att.name ?? "attachment",
            contentType: att.contentType,
            body: att.body,
          });
        }
      }
    }

    out.push({ title, status, duration, attachments: atts.length > 0 ? atts : undefined });
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
    let attachmentCount = 0;
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
      const [result] = await db.insert(results).values({
        testId,
        status: item.status,
        elapsedSeconds: item.duration != null ? Math.round(item.duration) : null,
        createdBy: payload.sub,
      }).returning();

      // Upload attachments from Playwright report (base64-encoded)
      if (item.attachments?.length) {
        for (const att of item.attachments) {
          try {
            const buf = Buffer.from(att.body, "base64");
            const ext = att.contentType.split("/")[1] ?? "bin";
            const fileName = `${att.name}.${ext}`;
            const s3Key = `result/${result.id}/${crypto.randomUUID()}-${fileName}`;
            await uploadFile(s3Key, buf, att.contentType);
            await db.insert(attachments).values({
              entityType: "result",
              entityId: result.id,
              filePath: s3Key,
              fileName,
              contentType: att.contentType,
              size: buf.length,
              uploadedBy: payload.sub,
            });
            attachmentCount++;
          } catch {
            // Skip failed attachment uploads silently
          }
        }
      }
    }
    return reply.send({ imported: items.length, added, updated, attachments: attachmentCount });
  });
}
