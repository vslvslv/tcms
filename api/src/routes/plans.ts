import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { testPlans, milestones, runs, tests, results } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  milestoneId: z.string().uuid().optional().nullable(),
});
const updateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  milestoneId: z.string().uuid().optional().nullable(),
});

export default async function planRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/plans", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db.select().from(testPlans).where(eq(testPlans.projectId, parsed.data.projectId));
    return reply.send(list);
  });

  app.post("/api/projects/:projectId/plans", async (req: FastifyRequest, reply: FastifyReply) => {
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
    if (bodyResult.data.milestoneId) {
      const [mil] = await db.select().from(milestones).where(eq(milestones.id, bodyResult.data.milestoneId)).limit(1);
      if (!mil || mil.projectId !== paramsResult.data.projectId) {
        return replyError(reply, 400, "Milestone not found or not in project", "VALIDATION_ERROR");
      }
    }
    const [plan] = await db
      .insert(testPlans)
      .values({
        projectId: paramsResult.data.projectId,
        milestoneId: bodyResult.data.milestoneId ?? null,
        name: bodyResult.data.name,
        description: bodyResult.data.description ?? null,
        createdBy: payload.sub,
      })
      .returning();
    return reply.status(201).send(plan);
  });

  app.get("/api/plans/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [plan] = await db.select().from(testPlans).where(eq(testPlans.id, parsed.data.id)).limit(1);
    if (!plan) return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, plan.projectId, payload.sub))) {
      return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    }
    return reply.send(plan);
  });

  app.patch("/api/plans/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(testPlans).where(eq(testPlans.id, paramsResult.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    }
    const setPayload: Record<string, unknown> = { updatedAt: new Date() };
    if (bodyResult.data.name !== undefined) setPayload.name = bodyResult.data.name;
    if (bodyResult.data.description !== undefined) setPayload.description = bodyResult.data.description;
    if (bodyResult.data.milestoneId !== undefined) setPayload.milestoneId = bodyResult.data.milestoneId;
    const [updated] = await db
      .update(testPlans)
      .set(setPayload as typeof testPlans.$inferInsert)
      .where(eq(testPlans.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });

  app.get("/api/plans/:id/summary", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [plan] = await db.select().from(testPlans).where(eq(testPlans.id, parsed.data.id)).limit(1);
    if (!plan) return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, plan.projectId, payload.sub))) {
      return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    }
    const planRuns = await db.select().from(runs).where(eq(runs.planId, parsed.data.id));
    const runSummaries = await Promise.all(
      planRuns.map(async (run) => {
        const testRows = await db.select().from(tests).where(eq(tests.runId, run.id));
        const resultRows = testRows.length === 0 ? [] : await db.select().from(results).where(inArray(results.testId, testRows.map((t) => t.id)));
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
        return { run, summary };
      })
    );
    return reply.send({ plan, runs: runSummaries });
  });

  app.delete("/api/plans/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(testPlans).where(eq(testPlans.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Plan not found", "NOT_FOUND");
    }
    await db.delete(testPlans).where(eq(testPlans.id, parsed.data.id));
    return reply.status(204).send();
  });
}
