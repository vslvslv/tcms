import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, sections, testCases, testSteps, sharedSteps, caseFieldValues, caseVersions, caseTemplates } from "../db/schema.js";
import { eq, inArray, desc, and, ilike } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { can } from "../lib/permissions.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { dispatchWebhooks } from "../lib/webhooks.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsSectionId = z.object({ sectionId: z.string().uuid() });
const stepSchema = z.union([
  z.object({
    content: z.string().min(1),
    expected: z.string().optional(),
    sortOrder: z.number().int().min(0).optional(),
  }),
  z.object({
    sharedStepId: z.string().uuid(),
    sortOrder: z.number().int().min(0).optional(),
  }),
]);
const customFieldSchema = z.object({ caseFieldId: z.string().uuid(), value: z.string() });
const caseStatusSchema = z.enum(["draft", "ready", "approved"]);
const createCaseBody = z.object({
  title: z.string().min(1),
  prerequisite: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  caseTypeId: z.string().uuid().optional().nullable(),
  priorityId: z.string().uuid().optional().nullable(),
  datasetId: z.string().uuid().optional().nullable(),
  status: caseStatusSchema.optional(),
  templateId: z.string().uuid().optional(),
  steps: z.array(stepSchema).optional(),
  customFields: z.array(customFieldSchema).optional(),
});
const updateCaseBody = z.object({
  title: z.string().min(1).optional(),
  prerequisite: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  caseTypeId: z.string().uuid().optional().nullable(),
  priorityId: z.string().uuid().optional().nullable(),
  datasetId: z.string().uuid().optional().nullable(),
  status: caseStatusSchema.optional(),
  steps: z.array(stepSchema).optional(),
  customFields: z.array(customFieldSchema).optional(),
});

async function assertSectionAccess(db: Awaited<ReturnType<typeof getDb>>, sectionId: string, userId: string) {
  const [sec] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!sec) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

async function assertCaseAccess(db: Awaited<ReturnType<typeof getDb>>, caseId: string, userId: string) {
  const [c] = await db.select().from(testCases).where(eq(testCases.id, caseId)).limit(1);
  if (!c) return false;
  return assertSectionAccess(db, c.sectionId, userId);
}

type StepInput = z.infer<typeof stepSchema>;

async function resolveStepsForInsert(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  testCaseId: string,
  steps: StepInput[]
): Promise<{ testCaseId: string; content: string; expected: string | null; sortOrder: number; sharedStepId: string | null }[]> {
  const resolved: { testCaseId: string; content: string; expected: string | null; sortOrder: number; sharedStepId: string | null }[] = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const sortOrder = "sortOrder" in s ? s.sortOrder ?? i : i;
    if ("sharedStepId" in s && s.sharedStepId) {
      const [shared] = await db.select().from(sharedSteps).where(eq(sharedSteps.id, s.sharedStepId)).limit(1);
      if (!shared || shared.projectId !== projectId) throw new Error("Shared step not found or wrong project");
      resolved.push({
        testCaseId,
        content: shared.content,
        expected: shared.expected,
        sortOrder,
        sharedStepId: shared.id,
      });
    } else if ("content" in s && s.content) {
      resolved.push({
        testCaseId,
        content: s.content,
        expected: s.expected ?? null,
        sortOrder,
        sharedStepId: null,
      });
    }
  }
  return resolved;
}

function stepsWithSharedResolved(
  steps: { id: string; testCaseId: string; sharedStepId: string | null; content: string; expected: string | null; sortOrder: number }[],
  sharedMap: Map<string, { content: string; expected: string | null }>
) {
  return steps
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const shared = s.sharedStepId ? sharedMap.get(s.sharedStepId) : null;
      return {
        id: s.id,
        testCaseId: s.testCaseId,
        content: shared ? shared.content : s.content,
        expected: shared ? shared.expected : s.expected,
        sortOrder: s.sortOrder,
        ...(s.sharedStepId && { sharedStepId: s.sharedStepId }),
      };
    });
}

type StepSnapshotItem = { content: string; expected: string | null; sortOrder: number; sharedStepId?: string };

async function buildStepsSnapshot(
  db: Awaited<ReturnType<typeof getDb>>,
  testCaseId: string
): Promise<StepSnapshotItem[]> {
  const steps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, testCaseId));
  const sharedIds = [...new Set(steps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
  const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
  const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
  return steps
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const shared = s.sharedStepId ? sharedMap.get(s.sharedStepId) : null;
      const item: StepSnapshotItem = {
        content: shared ? shared.content : s.content,
        expected: shared ? shared.expected : s.expected,
        sortOrder: s.sortOrder,
      };
      if (s.sharedStepId) item.sharedStepId = s.sharedStepId;
      return item;
    });
}

export default async function caseRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/sections/:sectionId/cases", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsSectionId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid sectionId", "VALIDATION_ERROR");
    const q = (req as FastifyRequest<{ Querystring: { status?: string } }>).query;
    const db = await getDb();
    if (!(await assertSectionAccess(db, parsed.data.sectionId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    const statusFilter = q.status && ["draft", "ready", "approved"].includes(q.status) ? q.status : undefined;
    const casesList = await db
      .select()
      .from(testCases)
      .where(
        statusFilter
          ? and(eq(testCases.sectionId, parsed.data.sectionId), eq(testCases.status, statusFilter as "draft" | "ready" | "approved"))
          : eq(testCases.sectionId, parsed.data.sectionId)
      );
    const caseIds = casesList.map((c) => c.id);
    const stepsList =
      caseIds.length === 0
        ? []
        : await db.select().from(testSteps).where(inArray(testSteps.testCaseId, caseIds));
    const sharedIds = [...new Set(stepsList.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    const stepsByCase = new Map<string, typeof stepsList>();
    for (const step of stepsList) {
      if (!stepsByCase.has(step.testCaseId)) stepsByCase.set(step.testCaseId, []);
      stepsByCase.get(step.testCaseId)!.push(step);
    }
    const cfValuesList = caseIds.length === 0 ? [] : await db.select().from(caseFieldValues).where(inArray(caseFieldValues.testCaseId, caseIds));
    const cfByCase = new Map<string, { caseFieldId: string; value: string }[]>();
    for (const v of cfValuesList) {
      if (!cfByCase.has(v.testCaseId)) cfByCase.set(v.testCaseId, []);
      cfByCase.get(v.testCaseId)!.push({ caseFieldId: v.caseFieldId, value: v.value });
    }
    const result = casesList.map((c) => ({
      ...c,
      steps: stepsWithSharedResolved(stepsByCase.get(c.id) ?? [], sharedMap),
      customFields: cfByCase.get(c.id) ?? [],
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
        caseTypeId: bodyResult.data.caseTypeId ?? null,
        priorityId: bodyResult.data.priorityId ?? null,
        datasetId: bodyResult.data.datasetId ?? null,
        status: bodyResult.data.status ?? "draft",
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    let stepsToInsert = bodyResult.data.steps;
    if (bodyResult.data.templateId && (!stepsToInsert || stepsToInsert.length === 0)) {
      const [tmpl] = await db.select().from(caseTemplates).where(eq(caseTemplates.id, bodyResult.data.templateId)).limit(1);
      const [sec] = await db.select().from(sections).where(eq(sections.id, paramsResult.data.sectionId)).limit(1);
      const [suit] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
      if (!tmpl || !suit || tmpl.projectId !== suit.projectId) {
        return replyError(reply, 400, "Template not found or wrong project", "VALIDATION_ERROR");
      }
      if (tmpl.defaultSteps && tmpl.defaultSteps.length > 0) {
        stepsToInsert = tmpl.defaultSteps.map((s, i) => ({
          content: s.content,
          expected: s.expected ?? undefined,
          sortOrder: i,
        }));
      }
    }
    if (stepsToInsert && stepsToInsert.length > 0) {
      const [sec] = await db.select().from(sections).where(eq(sections.id, paramsResult.data.sectionId)).limit(1);
      const [suit] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
      const projectId = suit?.projectId;
      if (!projectId) return replyError(reply, 400, "Section/suite not found", "VALIDATION_ERROR");
      try {
        const resolved = await resolveStepsForInsert(db, projectId, inserted.id, stepsToInsert);
        await db.insert(testSteps).values(resolved);
      } catch (err) {
        return replyError(reply, 400, err instanceof Error ? err.message : "Invalid steps", "VALIDATION_ERROR");
      }
    }
    if (bodyResult.data.customFields && bodyResult.data.customFields.length > 0) {
      await db.insert(caseFieldValues).values(
        bodyResult.data.customFields.map((f) => ({
          testCaseId: inserted.id,
          caseFieldId: f.caseFieldId,
          value: f.value,
        }))
      );
    }
    const steps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, inserted.id));
    const sharedIds = [...new Set(steps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    const cfValues = await db.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, inserted.id));
    const snapshot = await buildStepsSnapshot(db, inserted.id);
    await db.insert(caseVersions).values({
      testCaseId: inserted.id,
      title: inserted.title,
      prerequisite: inserted.prerequisite,
      caseTypeId: inserted.caseTypeId,
      priorityId: inserted.priorityId,
      stepsSnapshot: snapshot,
      createdBy: payload.sub,
    });
    const [secForAudit] = await db.select().from(sections).where(eq(sections.id, paramsResult.data.sectionId)).limit(1);
    const [suitForAudit] = secForAudit ? await db.select().from(suites).where(eq(suites.id, secForAudit.suiteId)).limit(1) : [null];
    await writeAuditLog(db, payload.sub, "case.created", "case", inserted.id, suitForAudit?.projectId ?? null);
    if (suitForAudit?.projectId) {
      dispatchWebhooks(suitForAudit.projectId, "case.created", {
        event: "case.created",
        entityType: "case",
        entityId: inserted.id,
        projectId: suitForAudit.projectId,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
    return reply.status(201).send({
      ...inserted,
      steps: stepsWithSharedResolved(steps, sharedMap),
      customFields: cfValues.map((v) => ({ caseFieldId: v.caseFieldId, value: v.value })),
    });
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
    const steps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, parsed.data.id));
    const sharedIds = [...new Set(steps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    const cfValues = await db.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, parsed.data.id));
    return reply.send({
      ...c,
      steps: stepsWithSharedResolved(steps, sharedMap),
      customFields: cfValues.map((v) => ({ caseFieldId: v.caseFieldId, value: v.value })),
    });
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
    if (bodyResult.data.caseTypeId !== undefined) updatePayload.caseTypeId = bodyResult.data.caseTypeId;
    if (bodyResult.data.priorityId !== undefined) updatePayload.priorityId = bodyResult.data.priorityId;
    if (bodyResult.data.datasetId !== undefined) updatePayload.datasetId = bodyResult.data.datasetId;
    if (bodyResult.data.status !== undefined) {
      updatePayload.status = bodyResult.data.status;
      if (bodyResult.data.status === "approved") {
        const [c] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
        if (c) {
          const [sec] = await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1);
          if (sec) {
            const [s] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
            if (s && !(await can(payload.sub, s.projectId, "cases.delete"))) {
              return replyError(reply, 403, "Insufficient permissions to approve cases", "FORBIDDEN");
            }
          }
        }
        updatePayload.approvedById = payload.sub;
        updatePayload.approvedAt = new Date();
      } else {
        updatePayload.approvedById = null;
        updatePayload.approvedAt = null;
      }
    }
    let txResult: Awaited<ReturnType<typeof db.transaction<{ c: typeof testCases.$inferSelect; steps: (typeof testSteps.$inferSelect)[]; sharedMap: Map<string, { content: string; expected: string | null }>; cfValues: (typeof caseFieldValues.$inferSelect)[] }>>>;
    try {
      txResult = await db.transaction(async (tx) => {
        await tx.update(testCases).set(updatePayload).where(eq(testCases.id, paramsResult.data.id));
        if (bodyResult.data.steps !== undefined) {
          await tx.delete(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
          if (bodyResult.data.steps.length > 0) {
            const [cas] = await tx.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
            const [sec] = cas ? await tx.select().from(sections).where(eq(sections.id, cas.sectionId)).limit(1) : [null];
            const [suit] = sec ? await tx.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
            const projectId = suit?.projectId;
            if (!projectId) throw new Error("Case/section/suite not found");
            const resolved = await resolveStepsForInsert(tx as unknown as typeof db, projectId, paramsResult.data.id, bodyResult.data.steps);
            await tx.insert(testSteps).values(resolved);
          }
        }
        if (bodyResult.data.customFields !== undefined) {
          await tx.delete(caseFieldValues).where(eq(caseFieldValues.testCaseId, paramsResult.data.id));
          if (bodyResult.data.customFields.length > 0) {
            await tx.insert(caseFieldValues).values(
              bodyResult.data.customFields.map((f) => ({
                testCaseId: paramsResult.data.id,
                caseFieldId: f.caseFieldId,
                value: f.value,
              }))
            );
          }
        }
        const [updatedCase] = await tx.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
        const updatedSteps = await tx.select().from(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
        const sIds = [...new Set(updatedSteps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
        const sList = sIds.length === 0 ? [] : await tx.select().from(sharedSteps).where(inArray(sharedSteps.id, sIds));
        const sMap = new Map(sList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
        const cfVals = await tx.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, paramsResult.data.id));
        const snapshot = await buildStepsSnapshot(tx as unknown as typeof db, paramsResult.data.id);
        await tx.insert(caseVersions).values({
          testCaseId: paramsResult.data.id,
          title: updatedCase.title,
          prerequisite: updatedCase.prerequisite,
          caseTypeId: updatedCase.caseTypeId,
          priorityId: updatedCase.priorityId,
          stepsSnapshot: snapshot,
          createdBy: payload.sub,
        });
        return { c: updatedCase, steps: updatedSteps, sharedMap: sMap, cfValues: cfVals };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "Case/section/suite not found") return replyError(reply, 404, "Case not found", "NOT_FOUND");
      throw err;
    }
    const { c, steps, sharedMap, cfValues } = txResult;
    const [secForAudit] = await db.select().from(sections).where(eq(sections.id, c.sectionId)).limit(1);
    const [suitForAudit] = secForAudit ? await db.select().from(suites).where(eq(suites.id, secForAudit.suiteId)).limit(1) : [null];
    await writeAuditLog(db, payload.sub, "case.updated", "case", paramsResult.data.id, suitForAudit?.projectId ?? null);
    if (suitForAudit?.projectId) {
      dispatchWebhooks(suitForAudit.projectId, "case.updated", {
        event: "case.updated",
        entityType: "case",
        entityId: paramsResult.data.id,
        projectId: suitForAudit.projectId,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
    return reply.send({
      ...c,
      steps: stepsWithSharedResolved(steps, sharedMap),
      customFields: cfValues.map((v) => ({ caseFieldId: v.caseFieldId, value: v.value })),
    });
  });

  app.get("/api/cases/:id/versions", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(caseVersions)
      .where(eq(caseVersions.testCaseId, parsed.data.id))
      .orderBy(desc(caseVersions.createdAt))
      .limit(50);
    return reply.send(list);
  });

  app.get("/api/cases/:id/versions/diff", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const q = (req as FastifyRequest<{ Querystring: { from?: string; to?: string } }>).query;
    const fromId = q.from;
    const toId = q.to;
    if (!fromId || !toId) return replyError(reply, 400, "Query params from and to (version ids) required", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const [fromV] = await db.select().from(caseVersions).where(eq(caseVersions.id, fromId)).limit(1);
    const [toV] = await db.select().from(caseVersions).where(eq(caseVersions.id, toId)).limit(1);
    if (!fromV || fromV.testCaseId !== parsed.data.id) return replyError(reply, 404, "From version not found", "NOT_FOUND");
    if (!toV || toV.testCaseId !== parsed.data.id) return replyError(reply, 404, "To version not found", "NOT_FOUND");
    const changes: { field: string; old: string | null; new: string | null }[] = [];
    if (fromV.title !== toV.title) changes.push({ field: "title", old: fromV.title, new: toV.title });
    if ((fromV.prerequisite ?? "") !== (toV.prerequisite ?? "")) changes.push({ field: "prerequisite", old: fromV.prerequisite, new: toV.prerequisite });
    const fromSteps = (fromV.stepsSnapshot ?? []) as StepSnapshotItem[];
    const toSteps = (toV.stepsSnapshot ?? []) as StepSnapshotItem[];
    const stepsEqual =
      fromSteps.length === toSteps.length &&
      fromSteps.every((s, i) => {
        const t = toSteps[i];
        return t && s.content === t.content && (s.expected ?? "") === (t.expected ?? "") && s.sortOrder === t.sortOrder;
      });
    if (!stepsEqual) {
      changes.push({
        field: "steps",
        old: JSON.stringify(fromSteps.map((s) => ({ content: s.content, expected: s.expected }))),
        new: JSON.stringify(toSteps.map((s) => ({ content: s.content, expected: s.expected }))),
      });
    }
    return reply.send({ from: fromV, to: toV, changes });
  });

  app.get("/api/cases/:id/versions/:versionId", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid params", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const [v] = await db
      .select()
      .from(caseVersions)
      .where(eq(caseVersions.id, paramsResult.data.versionId))
      .limit(1);
    if (!v || v.testCaseId !== paramsResult.data.id) return replyError(reply, 404, "Version not found", "NOT_FOUND");
    return reply.send(v);
  });

  app.post("/api/cases/:id/versions/:versionId/restore", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid params", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    // Check edit permission
    const [caseRow] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
    if (!caseRow) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    const [secRow] = await db.select().from(sections).where(eq(sections.id, caseRow.sectionId)).limit(1);
    const [suitRow] = secRow ? await db.select().from(suites).where(eq(suites.id, secRow.suiteId)).limit(1) : [null];
    if (!suitRow) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    if (!(await can(payload.sub, suitRow.projectId, "cases.edit"))) {
      return replyError(reply, 403, "Insufficient permissions", "FORBIDDEN");
    }
    const [v] = await db.select().from(caseVersions).where(eq(caseVersions.id, paramsResult.data.versionId)).limit(1);
    if (!v || v.testCaseId !== paramsResult.data.id) return replyError(reply, 404, "Version not found", "NOT_FOUND");
    if (!Array.isArray(v.stepsSnapshot)) return replyError(reply, 422, "Version snapshot is corrupted", "INVALID_STATE");
    const snapshot = v.stepsSnapshot as StepSnapshotItem[];
    const restored = await db.transaction(async (tx) => {
      // Restore case fields (title, prerequisite, caseTypeId, priorityId)
      await tx.update(testCases)
        .set({ title: v.title, prerequisite: v.prerequisite, caseTypeId: v.caseTypeId, priorityId: v.priorityId, updatedAt: new Date() })
        .where(eq(testCases.id, paramsResult.data.id));
      // Replace steps from snapshot — strip sharedStepId to preserve frozen content
      await tx.delete(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
      if (snapshot.length > 0) {
        await tx.insert(testSteps).values(
          snapshot.map((s, i) => ({
            testCaseId: paramsResult.data.id,
            content: s.content,
            expected: s.expected,
            sortOrder: s.sortOrder ?? i,
            sharedStepId: null,
          }))
        );
      }
      // Record restore as a new version (restore becomes the new HEAD)
      const [updatedCase] = await tx.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
      const restoredSteps = await tx.select().from(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
      const newSnapshot: StepSnapshotItem[] = restoredSteps.sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({
        content: s.content,
        expected: s.expected,
        sortOrder: s.sortOrder,
      }));
      await tx.insert(caseVersions).values({
        testCaseId: paramsResult.data.id,
        title: updatedCase.title,
        prerequisite: updatedCase.prerequisite,
        caseTypeId: updatedCase.caseTypeId,
        priorityId: updatedCase.priorityId,
        stepsSnapshot: newSnapshot,
        createdBy: payload.sub,
      });
      return { updatedCase, restoredSteps };
    });
    const restoredCfValues = await db.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, paramsResult.data.id));
    await writeAuditLog(db, payload.sub, "case.restored", "case", paramsResult.data.id, suitRow.projectId);
    return reply.send({
      ...restored.updatedCase,
      steps: restored.restoredSteps.sort((a, b) => a.sortOrder - b.sortOrder),
      customFields: restoredCfValues.map((v) => ({ caseFieldId: v.caseFieldId, value: v.value })),
    });
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
    const [caseRow] = await db.select().from(testCases).where(eq(testCases.id, parsed.data.id)).limit(1);
    const [secForAudit] = caseRow ? await db.select().from(sections).where(eq(sections.id, caseRow.sectionId)).limit(1) : [null];
    const [suitForAudit] = secForAudit ? await db.select().from(suites).where(eq(suites.id, secForAudit.suiteId)).limit(1) : [null];
    await db.delete(testSteps).where(eq(testSteps.testCaseId, parsed.data.id));
    await db.delete(testCases).where(eq(testCases.id, parsed.data.id));
    await writeAuditLog(db, payload.sub, "case.deleted", "case", parsed.data.id, suitForAudit?.projectId ?? null);
    return reply.status(204).send();
  });

  // POST /api/cases/:id/duplicate
  // Creates a copy of the case (+ all steps) in the same section, appending " (Copy)" to the title.
  // sharedStepId references are preserved as-is — the copy points to the same shared step.
  app.post("/api/cases/:id/duplicate", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertCaseAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }
    const [source] = await db.select().from(testCases).where(eq(testCases.id, parsed.data.id)).limit(1);
    if (!source) return replyError(reply, 404, "Case not found", "NOT_FOUND");
    const [sec] = await db.select().from(sections).where(eq(sections.id, source.sectionId)).limit(1);
    const [suit] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
    if (!suit) return replyError(reply, 404, "Case not found", "NOT_FOUND");

    const [duplicate] = await db
      .insert(testCases)
      .values({
        sectionId: source.sectionId,
        title: `${source.title} (Copy)`,
        prerequisite: source.prerequisite,
        caseTypeId: source.caseTypeId,
        priorityId: source.priorityId,
        datasetId: source.datasetId,
        status: source.status,
        sortOrder: source.sortOrder,
      })
      .returning();

    // Copy steps using a single INSERT...SELECT pattern (avoids N+1)
    const sourceSteps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, source.id));
    if (sourceSteps.length > 0) {
      await db.insert(testSteps).values(
        sourceSteps.map((s) => ({
          testCaseId: duplicate.id,
          content: s.content,
          expected: s.expected,
          sortOrder: s.sortOrder,
          sharedStepId: s.sharedStepId,
        }))
      );
    }

    // Copy custom field values
    const sourceCfValues = await db.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, source.id));
    if (sourceCfValues.length > 0) {
      await db.insert(caseFieldValues).values(
        sourceCfValues.map((f) => ({
          testCaseId: duplicate.id,
          caseFieldId: f.caseFieldId,
          value: f.value,
        }))
      );
    }

    await writeAuditLog(db, payload.sub, "case.duplicated", "case", duplicate.id, suit.projectId);

    // Return the new case with its steps
    const newSteps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, duplicate.id));
    const sharedIds = [...new Set(newSteps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    return reply.status(201).send({
      ...duplicate,
      steps: stepsWithSharedResolved(newSteps, sharedMap),
    });
  });

  // Bulk operations: delete, move, or copy cases within a project
  const bulkBody = z.object({
    action: z.enum(["delete", "move", "copy"]),
    caseIds: z.array(z.string().uuid()).min(1).max(500),
    targetSectionId: z.string().uuid().optional(),
  });
  const paramsProjectId = z.object({ projectId: z.string().uuid() });

  app.post("/api/projects/:projectId/cases/bulk", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");

    const paramsParsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsParsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const { projectId } = paramsParsed.data;

    const db = await getDb();
    if (!(await assertProjectAccess(db, projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }

    const bodyParsed = bulkBody.safeParse(req.body);
    if (!bodyParsed.success) return replyError(reply, 400, "Invalid body", "VALIDATION_ERROR");
    const { action, caseIds, targetSectionId } = bodyParsed.data;

    if (caseIds.length === 0) return replyError(reply, 400, "caseIds must not be empty", "VALIDATION_ERROR");

    // Deduplicate caseIds — inArray() deduplicates in SQL, causing false "not found" if client sends dupes
    const uniqueCaseIds = [...new Set(caseIds)];

    // Verify all cases belong to this project
    const casesInProject = await db
      .select({ id: testCases.id, sectionId: testCases.sectionId })
      .from(testCases)
      .innerJoin(sections, eq(sections.id, testCases.sectionId))
      .innerJoin(suites, eq(suites.id, sections.suiteId))
      .where(and(inArray(testCases.id, uniqueCaseIds), eq(suites.projectId, projectId)));

    if (casesInProject.length !== uniqueCaseIds.length) {
      return replyError(reply, 400, "One or more cases not found in this project", "VALIDATION_ERROR");
    }

    if (action === "delete") {
      if (!(await can(payload.sub, projectId, "cases.delete"))) {
        return replyError(reply, 403, "Forbidden", "FORBIDDEN");
      }
      await db.delete(testCases).where(inArray(testCases.id, uniqueCaseIds));
      await writeAuditLog(db, payload.sub, "case.bulk_deleted", "project", projectId, projectId);
      return reply.status(200).send({ deleted: uniqueCaseIds.length });
    }

    if (action === "move") {
      if (!(await can(payload.sub, projectId, "cases.edit"))) {
        return replyError(reply, 403, "Forbidden", "FORBIDDEN");
      }
      if (!targetSectionId) return replyError(reply, 400, "targetSectionId required for move", "VALIDATION_ERROR");
      // Verify target section belongs to same project
      const [targetSec] = await db
        .select({ id: sections.id })
        .from(sections)
        .innerJoin(suites, eq(suites.id, sections.suiteId))
        .where(and(eq(sections.id, targetSectionId), eq(suites.projectId, projectId)))
        .limit(1);
      if (!targetSec) return replyError(reply, 400, "Target section not found in this project", "VALIDATION_ERROR");
      await db.update(testCases).set({ sectionId: targetSectionId }).where(inArray(testCases.id, uniqueCaseIds));
      await writeAuditLog(db, payload.sub, "case.bulk_moved", "project", projectId, projectId);
      return reply.status(200).send({ moved: uniqueCaseIds.length });
    }

    if (action === "copy") {
      if (!(await can(payload.sub, projectId, "cases.create"))) {
        return replyError(reply, 403, "Forbidden", "FORBIDDEN");
      }
      if (!targetSectionId) return replyError(reply, 400, "targetSectionId required for copy", "VALIDATION_ERROR");
      const [targetSec] = await db
        .select({ id: sections.id })
        .from(sections)
        .innerJoin(suites, eq(suites.id, sections.suiteId))
        .where(and(eq(sections.id, targetSectionId), eq(suites.projectId, projectId)))
        .limit(1);
      if (!targetSec) return replyError(reply, 400, "Target section not found in this project", "VALIDATION_ERROR");

      const sourceCases = await db.select().from(testCases).where(inArray(testCases.id, uniqueCaseIds));
      const sourceSteps = await db.select().from(testSteps).where(inArray(testSteps.testCaseId, uniqueCaseIds));
      const sourceCfValues = await db.select().from(caseFieldValues).where(inArray(caseFieldValues.testCaseId, uniqueCaseIds));

      const newCaseIds: string[] = await db.transaction(async (tx) => {
        const inserted: string[] = [];
        for (const src of sourceCases) {
          const [newCase] = await tx
            .insert(testCases)
            .values({
              sectionId: targetSectionId,
              title: `${src.title} (Copy)`,
              prerequisite: src.prerequisite,
              caseTypeId: src.caseTypeId,
              priorityId: src.priorityId,
              datasetId: src.datasetId,
              status: src.status,
              sortOrder: src.sortOrder,
            })
            .returning({ id: testCases.id });
          const caseSteps = sourceSteps.filter((s) => s.testCaseId === src.id);
          if (caseSteps.length > 0) {
            await tx.insert(testSteps).values(
              caseSteps.map((s) => ({
                testCaseId: newCase.id,
                content: s.content,
                expected: s.expected,
                sortOrder: s.sortOrder,
                sharedStepId: s.sharedStepId,
              }))
            );
          }
          const caseCfValues = sourceCfValues.filter((f) => f.testCaseId === src.id);
          if (caseCfValues.length > 0) {
            await tx.insert(caseFieldValues).values(
              caseCfValues.map((f) => ({
                testCaseId: newCase.id,
                caseFieldId: f.caseFieldId,
                value: f.value,
              }))
            );
          }
          inserted.push(newCase.id);
        }
        return inserted;
      });

      await writeAuditLog(db, payload.sub, "case.bulk_copied", "project", projectId, projectId);
      return reply.status(201).send({ copied: newCaseIds.length, caseIds: newCaseIds });
    }

    return replyError(reply, 400, "Unknown action", "VALIDATION_ERROR");
  });

  // Case search: GET /api/projects/:projectId/cases/search?q=<query>
  const searchQuery = z.object({ q: z.string().min(1).max(200) });

  app.get("/api/projects/:projectId/cases/search", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsParsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsParsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const queryParsed = searchQuery.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    if (!queryParsed.success) return replyError(reply, 400, "Query parameter 'q' is required", "VALIDATION_ERROR");

    const { projectId } = paramsParsed.data;
    const { q } = queryParsed.data;
    // Escape ILIKE wildcards so user input is treated as a literal string
    const escapedQ = q.replace(/[%_\\]/g, "\\$&");
    const db = await getDb();

    if (!(await assertProjectAccess(db, projectId, payload.sub))) {
      return replyError(reply, 403, "Forbidden", "FORBIDDEN");
    }

    // Get all suite IDs for this project
    const suiteRows = await db.select({ id: suites.id }).from(suites).where(eq(suites.projectId, projectId));
    if (suiteRows.length === 0) return reply.send([]);
    const suiteIds = suiteRows.map((s) => s.id);

    // Get all section IDs in these suites
    const sectionRows = await db
      .select({ id: sections.id, name: sections.name, parentId: sections.parentId, suiteId: sections.suiteId })
      .from(sections)
      .where(inArray(sections.suiteId, suiteIds));
    if (sectionRows.length === 0) return reply.send([]);
    const sectionIds = sectionRows.map((s) => s.id);

    // Search cases by title using ILIKE (case-insensitive)
    const matchingCases = await db
      .select({ id: testCases.id, title: testCases.title, sectionId: testCases.sectionId })
      .from(testCases)
      .where(and(inArray(testCases.sectionId, sectionIds), ilike(testCases.title, `%${escapedQ}%`)))
      .limit(50);

    // Build section breadcrumb
    const sectionMap = new Map(sectionRows.map((s) => [s.id, s]));
    function buildBreadcrumb(sectionId: string, visited = new Set<string>()): string[] {
      if (visited.has(sectionId)) return []; // cycle guard
      const sec = sectionMap.get(sectionId);
      if (!sec) return [];
      if (!sec.parentId) return [sec.name];
      visited.add(sectionId);
      return [...buildBreadcrumb(sec.parentId, visited), sec.name];
    }

    const results = matchingCases.map((c) => ({
      id: c.id,
      title: c.title,
      sectionId: c.sectionId,
      sectionPath: buildBreadcrumb(c.sectionId),
    }));

    return reply.send(results);
  });
}
