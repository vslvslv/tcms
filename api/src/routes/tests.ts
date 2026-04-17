import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, suites, runs, tests } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const paramsTestId = z.object({ id: z.string().uuid() });
const patchTestBody = z.object({
  assigneeId: z.string().uuid().nullable(),
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

export default async function testRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.patch("/api/tests/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsTestId.safeParse((req as FastifyRequest<{ Params: { id: string } }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid test id", "VALIDATION_ERROR");
    const bodyResult = patchTestBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertTestAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Test not found", "NOT_FOUND");
    }
    const [updated] = await db
      .update(tests)
      .set({ assigneeId: bodyResult.data.assigneeId })
      .where(eq(tests.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });
}
