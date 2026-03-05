import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { sharedSteps, testSteps } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({
  content: z.string().min(1),
  expected: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const updateBody = z.object({
  content: z.string().min(1).optional(),
  expected: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export default async function sharedStepRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/shared-steps", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(sharedSteps)
      .where(eq(sharedSteps.projectId, parsed.data.projectId));
    return reply.send(list.sort((a, b) => a.sortOrder - b.sortOrder));
  });

  app.post("/api/projects/:projectId/shared-steps", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(sharedSteps)
      .values({
        projectId: paramsResult.data.projectId,
        content: bodyResult.data.content,
        expected: bodyResult.data.expected ?? null,
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    return reply.status(201).send(row);
  });

  app.get("/api/shared-steps/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [row] = await db.select().from(sharedSteps).where(eq(sharedSteps.id, parsed.data.id)).limit(1);
    if (!row) return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, row.projectId, payload.sub))) {
      return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    }
    return reply.send(row);
  });

  app.patch("/api/shared-steps/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(sharedSteps).where(eq(sharedSteps.id, paramsResult.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    }
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (bodyResult.data.content !== undefined) updatePayload.content = bodyResult.data.content;
    if (bodyResult.data.expected !== undefined) updatePayload.expected = bodyResult.data.expected;
    if (bodyResult.data.sortOrder !== undefined) updatePayload.sortOrder = bodyResult.data.sortOrder;
    const [updated] = await db
      .update(sharedSteps)
      .set(updatePayload as typeof sharedSteps.$inferInsert)
      .where(eq(sharedSteps.id, paramsResult.data.id))
      .returning();
    if (bodyResult.data.content !== undefined || bodyResult.data.expected !== undefined) {
      await db
        .update(testSteps)
        .set({
          content: (bodyResult.data.content ?? existing.content) as string,
          expected: bodyResult.data.expected !== undefined ? bodyResult.data.expected : existing.expected,
          updatedAt: new Date(),
        })
        .where(eq(testSteps.sharedStepId, paramsResult.data.id));
    }
    return reply.send(updated);
  });

  app.delete("/api/shared-steps/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(sharedSteps).where(eq(sharedSteps.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Shared step not found", "NOT_FOUND");
    }
    await db.update(testSteps).set({ sharedStepId: null, content: existing.content, expected: existing.expected, updatedAt: new Date() }).where(eq(testSteps.sharedStepId, parsed.data.id));
    await db.delete(sharedSteps).where(eq(sharedSteps.id, parsed.data.id));
    return reply.status(204).send();
  });
}
