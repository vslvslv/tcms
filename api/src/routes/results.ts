import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, runs, tests, results } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const paramsTestId = z.object({ id: z.string().uuid() });
const createResultBody = z.object({
  status: z.enum(["untested", "passed", "failed", "blocked", "skipped"]),
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

export default async function resultRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

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
}
