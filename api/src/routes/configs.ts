import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { configGroups, configOptions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsGroupId = z.object({ groupId: z.string().uuid() });
const createGroupBody = z.object({ name: z.string().min(1) });
const createOptionBody = z.object({ name: z.string().min(1) });

export default async function configRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/config-groups", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const groups = await db.select().from(configGroups).where(eq(configGroups.projectId, parsed.data.projectId));
    const withOptions = await Promise.all(
      groups.map(async (g) => {
        const options = await db.select().from(configOptions).where(eq(configOptions.configGroupId, g.id));
        return { ...g, options };
      })
    );
    return reply.send(withOptions);
  });

  app.post("/api/projects/:projectId/config-groups", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createGroupBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(configGroups)
      .values({ projectId: paramsResult.data.projectId, name: bodyResult.data.name })
      .returning();
    return reply.status(201).send(row);
  });

  app.post("/api/config-groups/:groupId/options", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsGroupId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid groupId", "VALIDATION_ERROR");
    const bodyResult = createOptionBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [group] = await db.select().from(configGroups).where(eq(configGroups.id, paramsResult.data.groupId)).limit(1);
    if (!group) return replyError(reply, 404, "Config group not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, group.projectId, payload.sub))) {
      return replyError(reply, 404, "Config group not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(configOptions)
      .values({ configGroupId: paramsResult.data.groupId, name: bodyResult.data.name })
      .returning();
    return reply.status(201).send(row);
  });
}
