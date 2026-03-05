import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const createBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  suiteMode: z.enum(["single", "multiple"]).optional(),
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  suiteMode: z.enum(["single", "multiple"]).optional(),
});

const paramsId = z.object({ id: z.string().uuid() });

export default async function projectRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const db = await getDb();
    const list = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, payload.sub));
    return reply.send(list);
  });

  app.post("/api/projects", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) {
      return replyError(reply, 400, parsed.error.message, "VALIDATION_ERROR");
    }
    const db = await getDb();
    const [project] = await db
      .insert(projects)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        userId: payload.sub,
        suiteMode: parsed.data.suiteMode ?? "single",
      })
      .returning();
    return reply.status(201).send(project);
  });

  app.get("/api/projects/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) {
      return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    }
    const db = await getDb();
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, parsed.data.id))
      .limit(1);
    if (!project) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (project.userId !== payload.sub) {
      return replyError(reply, 403, "Forbidden", "FORBIDDEN");
    }
    return reply.send(project);
  });

  app.patch("/api/projects/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) {
      return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    }
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) {
      return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    }
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, paramsResult.data.id))
      .limit(1);
    if (!existing) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (existing.userId !== payload.sub) {
      return replyError(reply, 403, "Forbidden", "FORBIDDEN");
    }
    const [updated] = await db
      .update(projects)
      .set({
        ...(bodyResult.data.name !== undefined && { name: bodyResult.data.name }),
        ...(bodyResult.data.description !== undefined && { description: bodyResult.data.description }),
        ...(bodyResult.data.suiteMode !== undefined && { suiteMode: bodyResult.data.suiteMode }),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });

  app.delete("/api/projects/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) {
      return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    }
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, parsed.data.id))
      .limit(1);
    if (!existing) return replyError(reply, 404, "Project not found", "NOT_FOUND");
    if (existing.userId !== payload.sub) {
      return replyError(reply, 403, "Forbidden", "FORBIDDEN");
    }
    await db.delete(projects).where(eq(projects.id, parsed.data.id));
    return reply.status(204).send();
  });
}
