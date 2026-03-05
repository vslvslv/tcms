import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, runs, tests, results } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const paramsTestId = z.object({ id: z.string().uuid() });
const paramsResultId = z.object({ id: z.string().uuid() });
const createResultBody = z.object({
  status: z.enum(["untested", "passed", "failed", "blocked", "skipped"]),
  comment: z.string().optional(),
  elapsedSeconds: z.number().int().min(0).optional(),
});
const updateResultBody = z.object({
  status: z.enum(["untested", "passed", "failed", "blocked", "skipped"]).optional(),
  comment: z.string().optional(),
  elapsedSeconds: z.number().int().min(0).optional(),
});

async function assertTestAccess(db: Awaited<ReturnType<typeof getDb>>, testId: string, userId: string) {
  const [t] = await db.select().from(tests).where(eq(tests.id, testId)).limit(1);
  if (!t) return false;
  const [r] = await db.select().from(runs).where(eq(runs.id, t.runId)).limit(1);
  if (!r) return false;
  const [s] = await db.select().from(suites).where(eq(suites.id, r.suiteId)).limit(1);
  if (!s) return false;
  const [p] = await db.select().from(projects).where(eq(projects.id, s.projectId)).limit(1);
  return !!p && p.userId === userId;
}

async function assertResultAccess(db: Awaited<ReturnType<typeof getDb>>, resultId: string, userId: string) {
  const [res] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
  if (!res) return false;
  return assertTestAccess(db, res.testId, userId);
}

export default async function resultRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/tests/:id/results", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsTestId.safeParse((req as FastifyRequest<{ Params: { id: string } }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid test id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertTestAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Test not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(results)
      .where(eq(results.testId, paramsResult.data.id))
      .orderBy(desc(results.createdAt));
    return reply.send(list);
  });

  app.get("/api/results/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsResultId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertResultAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Result not found", "NOT_FOUND");
    }
    const [row] = await db.select().from(results).where(eq(results.id, paramsResult.data.id)).limit(1);
    if (!row) return replyError(reply, 404, "Result not found", "NOT_FOUND");
    return reply.send(row);
  });

  app.post("/api/tests/:id/results", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsTestId.safeParse((req as FastifyRequest<{ Params: { id: string } }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid test id", "VALIDATION_ERROR");
    const bodyResult = createResultBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertTestAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Test not found", "NOT_FOUND");
    }
    const [result] = await db
      .insert(results)
      .values({
        testId: paramsResult.data.id,
        status: bodyResult.data.status,
        comment: bodyResult.data.comment ?? null,
        elapsedSeconds: bodyResult.data.elapsedSeconds ?? null,
        createdBy: payload.sub,
      })
      .returning();
    return reply.status(201).send(result);
  });

  app.patch("/api/results/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsResultId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateResultBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertResultAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Result not found", "NOT_FOUND");
    }
    const setPayload: Partial<{ status: "untested" | "passed" | "failed" | "blocked" | "skipped"; comment: string | null; elapsedSeconds: number | null }> = {};
    if (bodyResult.data.status !== undefined) setPayload.status = bodyResult.data.status;
    if (bodyResult.data.comment !== undefined) setPayload.comment = bodyResult.data.comment;
    if (bodyResult.data.elapsedSeconds !== undefined) setPayload.elapsedSeconds = bodyResult.data.elapsedSeconds;
    const [updated] = await db
      .update(results)
      .set(setPayload)
      .where(eq(results.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });
}
