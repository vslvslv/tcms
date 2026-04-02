import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects, projectMembers, users, roles } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { can } from "../lib/permissions.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsId = z.object({ id: z.string().uuid() });
const addMemberBody = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export default async function projectMemberRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/users", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const db = await getDb();
    const list = await db.select({ id: users.id, email: users.email, name: users.name }).from(users);
    return reply.send(list);
  });

  app.get("/api/roles", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const db = await getDb();
    const list = await db.select().from(roles);
    return reply.send(list);
  });

  app.get("/api/projects/:projectId/members", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    const [p] = await db.select().from(projects).where(eq(projects.id, parsed.data.projectId)).limit(1);
    if (!p) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (!(await can(payload.sub, parsed.data.projectId, "members.manage"))) {
      return replyError(reply, 403, "Insufficient permissions to manage members", "FORBIDDEN");
    }
    const members = await db.select().from(projectMembers).where(eq(projectMembers.projectId, parsed.data.projectId));
    const userIds = [...new Set(members.map((m) => m.userId))];
    const roleIds = [...new Set(members.map((m) => m.roleId))];
    const userList = userIds.length === 0 ? [] : await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(inArray(users.id, userIds));
    const roleList = roleIds.length === 0 ? [] : await db.select().from(roles).where(inArray(roles.id, roleIds));
    const byId = (arr: { id: string }[]) => new Map(arr.map((x) => [x.id, x]));
    const userMap = byId(userList as { id: string }[]);
    const roleMap = byId(roleList);
    const result = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      projectId: m.projectId,
      roleId: m.roleId,
      user: userMap.get(m.userId),
      role: roleMap.get(m.roleId),
    }));
    return reply.send(result);
  });

  app.post("/api/projects/:projectId/members", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = addMemberBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [p] = await db.select().from(projects).where(eq(projects.id, paramsResult.data.projectId)).limit(1);
    if (!p) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (!(await can(payload.sub, paramsResult.data.projectId, "members.manage"))) {
      return replyError(reply, 403, "Insufficient permissions to manage members", "FORBIDDEN");
    }
    const [existing] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, paramsResult.data.projectId), eq(projectMembers.userId, bodyResult.data.userId)))
      .limit(1);
    if (existing) return replyError(reply, 409, "User already a member", "CONFLICT");
    const [member] = await db
      .insert(projectMembers)
      .values({
        projectId: paramsResult.data.projectId,
        userId: bodyResult.data.userId,
        roleId: bodyResult.data.roleId,
      })
      .returning();
    await writeAuditLog(db, payload.sub, "member.added", "member", member.id, paramsResult.data.projectId);
    return reply.status(201).send(member);
  });

  app.delete("/api/projects/:projectId/members/:userId", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const params = (req as FastifyRequest<{ Params: { projectId: string; userId: string } }>).params;
    const paramsResult = z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).safeParse(params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid params", "VALIDATION_ERROR");
    const db = await getDb();
    const [p] = await db.select().from(projects).where(eq(projects.id, paramsResult.data.projectId)).limit(1);
    if (!p) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (!(await can(payload.sub, paramsResult.data.projectId, "members.manage"))) {
      return replyError(reply, 403, "Insufficient permissions to manage members", "FORBIDDEN");
    }
    await writeAuditLog(db, payload.sub, "member.removed", "member", paramsResult.data.userId, paramsResult.data.projectId);
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, paramsResult.data.projectId), eq(projectMembers.userId, paramsResult.data.userId)));
    return reply.status(204).send();
  });
}
