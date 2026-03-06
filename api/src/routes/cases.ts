import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, sections, testCases, testSteps, sharedSteps, caseFieldValues, caseVersions, caseTemplates } from "../db/schema.js";
import { eq, inArray, desc, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess, assertProjectRole } from "../lib/projectAccess.js";
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
            if (s && !(await assertProjectRole(db, s.projectId, payload.sub, ["admin", "lead"]))) {
              return replyError(reply, 403, "Only admin or lead can approve cases", "FORBIDDEN");
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
    await db.update(testCases).set(updatePayload).where(eq(testCases.id, paramsResult.data.id));
    if (bodyResult.data.steps !== undefined) {
      await db.delete(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
      if (bodyResult.data.steps.length > 0) {
        const [cas] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
        const [sec] = cas ? await db.select().from(sections).where(eq(sections.id, cas.sectionId)).limit(1) : [null];
        const [suit] = sec ? await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1) : [null];
        const projectId = suit?.projectId;
        if (!projectId) return replyError(reply, 400, "Case/section/suite not found", "VALIDATION_ERROR");
        try {
          const resolved = await resolveStepsForInsert(db, projectId, paramsResult.data.id, bodyResult.data.steps);
          await db.insert(testSteps).values(resolved);
        } catch (err) {
          return replyError(reply, 400, err instanceof Error ? err.message : "Invalid steps", "VALIDATION_ERROR");
        }
      }
    }
    if (bodyResult.data.customFields !== undefined) {
      await db.delete(caseFieldValues).where(eq(caseFieldValues.testCaseId, paramsResult.data.id));
      if (bodyResult.data.customFields.length > 0) {
        await db.insert(caseFieldValues).values(
          bodyResult.data.customFields.map((f) => ({
            testCaseId: paramsResult.data.id,
            caseFieldId: f.caseFieldId,
            value: f.value,
          }))
        );
      }
    }
    const [c] = await db.select().from(testCases).where(eq(testCases.id, paramsResult.data.id)).limit(1);
    const steps = await db.select().from(testSteps).where(eq(testSteps.testCaseId, paramsResult.data.id));
    const sharedIds = [...new Set(steps.map((s) => s.sharedStepId).filter(Boolean) as string[])];
    const sharedList = sharedIds.length === 0 ? [] : await db.select().from(sharedSteps).where(inArray(sharedSteps.id, sharedIds));
    const sharedMap = new Map(sharedList.map((sh) => [sh.id, { content: sh.content, expected: sh.expected }]));
    const cfValues = await db.select().from(caseFieldValues).where(eq(caseFieldValues.testCaseId, paramsResult.data.id));
    const snapshot = await buildStepsSnapshot(db, paramsResult.data.id);
    await db.insert(caseVersions).values({
      testCaseId: paramsResult.data.id,
      title: c.title,
      prerequisite: c.prerequisite,
      caseTypeId: c.caseTypeId,
      priorityId: c.priorityId,
      stepsSnapshot: snapshot,
      createdBy: payload.sub,
    });
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
}
