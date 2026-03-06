import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  sections,
  suites,
  runs,
  tests,
  results,
  testCases,
  testSteps,
  caseTypes,
  priorities,
  sharedSteps,
  caseVersions,
} from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { writeAuditLog } from "../lib/auditLog.js";

const paramsSectionId = z.object({ sectionId: z.string().uuid() });
const paramsRunId = z.object({ id: z.string().uuid() });

async function assertSectionAccess(db: Awaited<ReturnType<typeof getDb>>, sectionId: string, userId: string) {
  const [sec] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!sec) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

/** Parse a single line of CSV; handles quoted fields with commas */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      out.push(field);
    } else {
      let field = "";
      while (i < line.length && line[i] !== ",") {
        field += line[i];
        i++;
      }
      out.push(field.trim());
      if (i < line.length) i++;
    }
  }
  return out;
}

/** Escape a field for CSV (quote if contains comma or newline) */
function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

export default async function importExportRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/sections/:sectionId/cases/export", async (req: FastifyRequest, reply: FastifyReply) => {
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
      .where(eq(testCases.sectionId, parsed.data.sectionId))
      .orderBy(testCases.sortOrder, testCases.createdAt);
    const caseIds = casesList.map((c) => c.id);
    const stepsList =
      caseIds.length === 0
        ? []
        : await db.select().from(testSteps).where(inArray(testSteps.testCaseId, caseIds));
    const sharedIds = [...new Set(stepsList.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    const typeIds = [...new Set(casesList.map((c) => c.caseTypeId).filter(Boolean) as string[])];
    const priorityIds = [...new Set(casesList.map((c) => c.priorityId).filter(Boolean) as string[])];
    const typesList = typeIds.length === 0 ? [] : await db.select().from(caseTypes).where(inArray(caseTypes.id, typeIds));
    const prioritiesList = priorityIds.length === 0 ? [] : await db.select().from(priorities).where(inArray(priorities.id, priorityIds));
    const typeNameById = new Map(typesList.map((t) => [t.id, t.name]));
    const priorityNameById = new Map(prioritiesList.map((p) => [p.id, p.name]));
    const stepsByCase = new Map<string, typeof stepsList>();
    for (const s of stepsList) {
      if (!stepsByCase.has(s.testCaseId)) stepsByCase.set(s.testCaseId, []);
      stepsByCase.get(s.testCaseId)!.push(s);
    }
    const header = "title,prerequisite,case_type,priority,steps";
    const rows = casesList.map((c) => {
      const steps = (stepsByCase.get(c.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
      const stepStrs = steps.map((s) => {
        const content = s.sharedStepId ? sharedMap.get(s.sharedStepId)?.content ?? s.content : s.content;
        const expected = s.sharedStepId ? sharedMap.get(s.sharedStepId)?.expected ?? s.expected : s.expected;
        return `${content}|${expected ?? ""}`;
      });
      const stepsCell = stepStrs.join("\n");
      return [
        csvEscape(c.title),
        csvEscape(c.prerequisite ?? ""),
        csvEscape(c.caseTypeId ? typeNameById.get(c.caseTypeId) ?? "" : ""),
        csvEscape(c.priorityId ? priorityNameById.get(c.priorityId) ?? "" : ""),
        csvEscape(stepsCell),
      ].join(",");
    });
    const csv = [header, ...rows].join("\r\n");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="cases.csv"')
      .send(csv);
  });

  app.post("/api/sections/:sectionId/cases/import", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsSectionId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid sectionId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSectionAccess(db, parsed.data.sectionId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    const [sec] = await db.select().from(sections).where(eq(sections.id, parsed.data.sectionId)).limit(1);
    const [suit] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
    const projectId = suit?.projectId;
    if (!projectId) return replyError(reply, 400, "Section/suite not found", "VALIDATION_ERROR");

    let rawBody: string;
    const contentType = (req.headers["content-type"] ?? "").toLowerCase();
    if (typeof (req as FastifyRequest<{ Body: unknown }>).body === "string") {
      rawBody = (req as FastifyRequest<{ Body: string }>).body;
    } else if (
      contentType.includes("application/json") &&
      typeof (req as FastifyRequest<{ Body: { csv?: string } }>).body === "object" &&
      (req as FastifyRequest<{ Body: { csv?: string } }>).body?.csv
    ) {
      rawBody = (req as FastifyRequest<{ Body: { csv: string } }>).body.csv;
    } else {
      return replyError(reply, 400, "Send CSV as raw text (Content-Type: text/csv) or JSON { csv: \"...\" }", "VALIDATION_ERROR");
    }

    const lines = rawBody.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return reply.send({ created: 0, errors: [{ row: 0, message: "CSV must have header and at least one row" }] });
    }
    const header = parseCsvLine(lines[0]!);
    const titleIdx = header.findIndex((h) => h.toLowerCase() === "title");
    const prerequisiteIdx = header.findIndex((h) => h.toLowerCase() === "prerequisite");
    const caseTypeIdx = header.findIndex((h) => h.toLowerCase().replace(/[_-]/g, "") === "casetype");
    const priorityIdx = header.findIndex((h) => h.toLowerCase() === "priority");
    const stepsIdx = header.findIndex((h) => h.toLowerCase() === "steps");
    if (titleIdx === -1) {
      return reply.send({ created: 0, errors: [{ row: 0, message: "CSV must have a 'title' column" }] });
    }

    const caseTypeNames = await db.select().from(caseTypes).where(eq(caseTypes.projectId, projectId));
    const priorityNames = await db.select().from(priorities).where(eq(priorities.projectId, projectId));
    const caseTypeIdByName = new Map(caseTypeNames.map((t) => [t.name.toLowerCase(), t.id]));
    const priorityIdByName = new Map(priorityNames.map((p) => [p.name.toLowerCase(), p.id]));

    let created = 0;
    const errors: { row: number; message: string }[] = [];
    for (let rowNum = 1; rowNum < lines.length; rowNum++) {
      const row = parseCsvLine(lines[rowNum]!);
      const title = (row[titleIdx] ?? "").trim();
      if (!title) {
        errors.push({ row: rowNum + 1, message: "Title is required" });
        continue;
      }
      const prerequisite = prerequisiteIdx >= 0 ? (row[prerequisiteIdx] ?? "").trim() || null : null;
      const caseTypeName = caseTypeIdx >= 0 ? (row[caseTypeIdx] ?? "").trim() : "";
      const priorityName = priorityIdx >= 0 ? (row[priorityIdx] ?? "").trim() : "";
      const caseTypeId = caseTypeName ? caseTypeIdByName.get(caseTypeName.toLowerCase()) ?? null : null;
      const priorityId = priorityName ? priorityIdByName.get(priorityName.toLowerCase()) ?? null : null;
      const stepsRaw = stepsIdx >= 0 ? (row[stepsIdx] ?? "").trim() : "";
      const stepLines = stepsRaw ? stepsRaw.split(/\n/).map((l) => l.trim()).filter(Boolean) : [];
      const steps: { content: string; expected: string | null; sortOrder: number }[] = stepLines.map((l, i) => {
        const pipe = l.indexOf("|");
        const content = pipe >= 0 ? l.slice(0, pipe).trim() : l;
        const expected = pipe >= 0 ? l.slice(pipe + 1).trim() || null : null;
        return { content: content || "(empty)", expected, sortOrder: i };
      });

      try {
        const [inserted] = await db
          .insert(testCases)
          .values({
            sectionId: parsed.data.sectionId,
            title,
            prerequisite,
            caseTypeId,
            priorityId,
            sortOrder: rowNum - 1,
          })
          .returning();
        if (steps.length > 0) {
          await db.insert(testSteps).values(
            steps.map((s) => ({
              testCaseId: inserted.id,
              content: s.content,
              expected: s.expected,
              sortOrder: s.sortOrder,
              sharedStepId: null,
            }))
          );
        }
        const snapshot = steps.map((s) => ({ content: s.content, expected: s.expected, sortOrder: s.sortOrder }));
        await db.insert(caseVersions).values({
          testCaseId: inserted.id,
          title: inserted.title,
          prerequisite: inserted.prerequisite,
          caseTypeId: inserted.caseTypeId,
          priorityId: inserted.priorityId,
          stepsSnapshot: snapshot,
          createdBy: payload.sub,
        });
        await writeAuditLog(db, payload.sub, "case.created", "case", inserted.id, projectId);
        created++;
      } catch (err) {
        errors.push({ row: rowNum + 1, message: err instanceof Error ? err.message : "Failed to create case" });
      }
    }
    return reply.send({ created, errors });
  });

  app.get("/api/runs/:id/export/results", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsRunId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [run] = await db.select().from(runs).where(eq(runs.id, paramsResult.data.id)).limit(1);
    if (!run) return replyError(reply, 404, "Run not found", "NOT_FOUND");
    const [s] = await db.select().from(suites).where(eq(suites.id, run.suiteId)).limit(1);
    if (!s || !(await assertProjectAccess(db, s.projectId, payload.sub))) {
      return replyError(reply, 404, "Run not found", "NOT_FOUND");
    }
    const runTests = await db.select().from(tests).where(eq(tests.runId, run.id));
    const caseIds = runTests.map((t) => t.testCaseId);
    const casesRows =
      caseIds.length === 0
        ? []
        : await db.select({ id: testCases.id, title: testCases.title }).from(testCases).where(inArray(testCases.id, caseIds));
    const caseTitleById = new Map(casesRows.map((c) => [c.id, c.title]));
    const resultRows = await db.select().from(results).where(inArray(results.testId, runTests.map((t) => t.id)));
    const latestByTestId = new Map<string, (typeof resultRows)[0]>();
    for (const r of resultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }
    const header = "run_name,case_title,status,comment,elapsed_seconds";
    const rows = runTests.map((t) => {
      const latest = latestByTestId.get(t.id);
      const caseTitle = caseTitleById.get(t.testCaseId) ?? "";
      const status = latest?.status ?? "untested";
      const comment = latest?.comment ?? "";
      const elapsed = latest?.elapsedSeconds ?? "";
      return [csvEscape(run.name), csvEscape(caseTitle), csvEscape(status), csvEscape(comment), String(elapsed)].join(",");
    });
    const csv = [header, ...rows].join("\r\n");
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="run-results.csv"')
      .send(csv);
  });
}
