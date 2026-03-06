import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { milestones, runs, results, tests } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { writeAuditLog } from "../lib/auditLog.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});
const updateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
});

export default async function milestoneRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/milestones", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db.select().from(milestones).where(eq(milestones.projectId, parsed.data.projectId));
    return reply.send(list);
  });

  app.post("/api/projects/:projectId/milestones", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const [milestone] = await db
      .insert(milestones)
      .values({
        projectId: paramsResult.data.projectId,
        name: bodyResult.data.name,
        description: bodyResult.data.description ?? null,
        dueDate: bodyResult.data.dueDate ?? null,
      })
      .returning();
    await writeAuditLog(db, payload.sub, "milestone.created", "milestone", milestone.id, paramsResult.data.projectId);
    return reply.status(201).send(milestone);
  });

  app.get("/api/milestones/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [m] = await db.select().from(milestones).where(eq(milestones.id, parsed.data.id)).limit(1);
    if (!m) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, m.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }
    return reply.send(m);
  });

  app.patch("/api/milestones/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(milestones).where(eq(milestones.id, paramsResult.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }
    const [updated] = await db
      .update(milestones)
      .set({
        ...(bodyResult.data.name !== undefined && { name: bodyResult.data.name }),
        ...(bodyResult.data.description !== undefined && { description: bodyResult.data.description }),
        ...(bodyResult.data.dueDate !== undefined && { dueDate: bodyResult.data.dueDate }),
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, paramsResult.data.id))
      .returning();
    await writeAuditLog(db, payload.sub, "milestone.updated", "milestone", paramsResult.data.id, existing.projectId);
    return reply.send(updated);
  });

  app.get("/api/milestones/:id/progress", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [m] = await db.select().from(milestones).where(eq(milestones.id, parsed.data.id)).limit(1);
    if (!m) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, m.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }
    const milestoneRuns = await db.select().from(runs).where(eq(runs.milestoneId, parsed.data.id));
    const runIds = milestoneRuns.map((r) => r.id);
    const testRows = runIds.length === 0 ? [] : await db.select().from(tests).where(inArray(tests.runId, runIds));
    const testIds = testRows.map((t) => t.id);
    const resultRows = testIds.length === 0 ? [] : await db.select().from(results).where(inArray(results.testId, testIds));
    const latestByTestId = new Map<string, (typeof resultRows)[0]>();
    for (const r of resultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }
    const summary = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
    for (const t of testRows) {
      const latest = latestByTestId.get(t.id);
      if (latest) {
        if (latest.status === "passed") summary.passed++;
        else if (latest.status === "failed") summary.failed++;
        else if (latest.status === "blocked") summary.blocked++;
        else if (latest.status === "skipped") summary.skipped++;
        else summary.untested++;
      } else summary.untested++;
    }
    return reply.send({
      milestone: m,
      runsCount: milestoneRuns.length,
      completedRuns: milestoneRuns.filter((r) => r.isCompleted).length,
      summary,
    });
  });

  app.delete("/api/milestones/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(milestones).where(eq(milestones.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }
    await db.delete(milestones).where(eq(milestones.id, parsed.data.id));
    await writeAuditLog(db, payload.sub, "milestone.deleted", "milestone", parsed.data.id, existing.projectId);
    return reply.status(204).send();
  });
}
