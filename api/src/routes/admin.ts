import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { replyError } from "../lib/errors.js";

const paramsId = z.object({ id: z.string().uuid() });
const updateBody = z.object({
  isActive: z.boolean().optional(),
  globalRole: z.enum(["user", "admin"]).optional(),
});

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  // Verify global admin on every admin route
  app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const db = await getDb();
    const [user] = await db.select({ globalRole: users.globalRole }).from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || user.globalRole !== "admin") {
      return replyError(reply, 403, "Admin access required", "FORBIDDEN");
    }
  });

  // List all users
  app.get("/api/admin/users", async (req: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      globalRole: users.globalRole,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users);
    return allUsers;
  });

  // Update user (deactivate, change role)
  app.patch("/api/admin/users/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const body = updateBody.safeParse((req as any).body);
    if (!body.success) return replyError(reply, 400, "Invalid body", "VALIDATION_ERROR");

    const db = await getDb();
    const updates: Record<string, unknown> = {};
    if (body.data.isActive !== undefined) updates.isActive = body.data.isActive;
    if (body.data.globalRole !== undefined) updates.globalRole = body.data.globalRole;

    if (Object.keys(updates).length === 0) {
      return replyError(reply, 400, "No fields to update", "VALIDATION_ERROR");
    }

    const [updated] = await db.update(users).set(updates).where(eq(users.id, params.data.id)).returning();
    if (!updated) return replyError(reply, 404, "User not found", "NOT_FOUND");
    return updated;
  });
}
