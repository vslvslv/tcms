import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { suites, runs, tests, projectMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { dispatchWebhooks } from "../lib/webhooks.js";

const paramsTestId = z.object({ id: z.string().uuid() });
const patchTestBody = z.object({
  assigneeId: z.string().uuid().nullable(),
});

/** Returns { projectId } for the test's project, or null if not found / no access. */
async function assertTestAccess(
  db: Awaited<ReturnType<typeof getDb>>,
  testId: string,
  userId: string
): Promise<string | null> {
  const rows = await db
    .select({ runId: tests.runId, suiteId: runs.suiteId, projectId: suites.projectId })
    .from(tests)
    .innerJoin(runs, eq(tests.runId, runs.id))
    .innerJoin(suites, eq(runs.suiteId, suites.id))
    .where(eq(tests.id, testId))
    .limit(1);
  if (!rows[0]) return null;
  const { projectId } = rows[0];
  const ok = await assertProjectAccess(db, projectId, userId);
  return ok ? projectId : null;
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
    const projectId = await assertTestAccess(db, paramsResult.data.id, payload.sub);
    if (!projectId) return replyError(reply, 404, "Test not found", "NOT_FOUND");

    // Validate assignee is a project member (if not null)
    if (bodyResult.data.assigneeId !== null) {
      const [member] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, bodyResult.data.assigneeId)
          )
        )
        .limit(1);
      if (!member) {
        // Allow if assignee is the project owner (checked by assertProjectAccess already covers members;
        // owners are not in projectMembers table, so check via projects table would be needed —
        // but the simplest safe approach is to verify access using the same assertProjectAccess)
        const ownerOk = await assertProjectAccess(db, projectId, bodyResult.data.assigneeId);
        if (!ownerOk) return replyError(reply, 400, "Assignee is not a project member", "VALIDATION_ERROR");
      }
    }

    const [updated] = await db
      .update(tests)
      .set({ assigneeId: bodyResult.data.assigneeId })
      .where(eq(tests.id, paramsResult.data.id))
      .returning();
    await writeAuditLog(db, payload.sub, "test.assigned", "test", updated.id, projectId);
    dispatchWebhooks(projectId, "test.assigned", {
      event: "test.assigned",
      entityType: "test",
      entityId: updated.id,
      projectId,
      timestamp: new Date().toISOString(),
      metadata: { assigneeId: bodyResult.data.assigneeId },
    }).catch(() => {});
    return reply.send(updated);
  });
}
