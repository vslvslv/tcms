import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { suites } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsSuiteId = z.object({ suiteId: z.string().uuid() });
const createSuiteBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
const updateSuiteBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

async function assertSuiteAccess(db: Awaited<ReturnType<typeof getDb>>, suiteId: string, userId: string) {
  const [s] = await db.select().from(suites).where(eq(suites.id, suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

export default async function suiteRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/suites", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db.select().from(suites).where(eq(suites.projectId, parsed.data.projectId));
    return reply.send(list);
  });

  app.post("/api/projects/:projectId/suites", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createSuiteBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const [suite] = await db
      .insert(suites)
      .values({
        projectId: paramsResult.data.projectId,
        name: bodyResult.data.name,
        description: bodyResult.data.description ?? null,
      })
      .returning();
    return reply.status(201).send(suite);
  });

  app.get("/api/suites/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const [suite] = await db.select().from(suites).where(eq(suites.id, parsed.data.id)).limit(1);
    return reply.send(suite);
  });

  app.patch("/api/suites/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateSuiteBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, paramsResult.data.id, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const [updated] = await db
      .update(suites)
      .set({
        ...(bodyResult.data.name !== undefined && { name: bodyResult.data.name }),
        ...(bodyResult.data.description !== undefined && { description: bodyResult.data.description }),
        updatedAt: new Date(),
      })
      .where(eq(suites.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });

  app.delete("/api/suites/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, parsed.data.id, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    await db.delete(suites).where(eq(suites.id, parsed.data.id));
    return reply.status(204).send();
  });
}
