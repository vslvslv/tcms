import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { auditLog } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { can } from "../lib/permissions.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });

export default async function auditRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/audit-log", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const q = (req as FastifyRequest<{ Querystring: { limit?: string; offset?: string; entityType?: string; action?: string } }>).query;
    const limit = Math.min(Math.max(1, parseInt(q.limit ?? "50", 10)), 100);
    const offset = Math.max(0, parseInt(q.offset ?? "0", 10));
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    if (!(await can(payload.sub, parsed.data.projectId, "audit.view"))) {
      return replyError(reply, 403, "Insufficient permissions to view audit log", "FORBIDDEN");
    }
    const conditions = [eq(auditLog.projectId, parsed.data.projectId)];
    if (q.entityType) conditions.push(eq(auditLog.entityType, q.entityType));
    if (q.action) conditions.push(eq(auditLog.action, q.action));
    const whereCond = conditions.length === 1 ? conditions[0]! : and(...conditions);
    const list = await db
      .select()
      .from(auditLog)
      .where(whereCond)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);
    return reply.send(list);
  });
}
