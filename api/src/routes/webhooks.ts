import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { webhooks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess, assertProjectRole } from "../lib/projectAccess.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsId = z.object({ id: z.string().uuid() });
const eventList = ["case.created", "case.updated", "run.created", "run.completed", "result.created"] as const;
const createBody = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(eventList)).min(1),
  isActive: z.boolean().optional(),
});
const updateBody = z.object({
  url: z.string().url().optional(),
  secret: z.string().optional().nullable(),
  events: z.array(z.enum(eventList)).optional(),
  isActive: z.boolean().optional(),
});

export default async function webhookRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/webhooks", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    if (!(await assertProjectRole(db, parsed.data.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can manage webhooks", "FORBIDDEN");
    }
    const list = await db.select().from(webhooks).where(eq(webhooks.projectId, parsed.data.projectId));
    return reply.send(list.map((w) => ({ ...w, secret: undefined })));
  });

  app.post("/api/projects/:projectId/webhooks", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    if (!(await assertProjectRole(db, parsed.data.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can manage webhooks", "FORBIDDEN");
    }
    const [row] = await db
      .insert(webhooks)
      .values({
        projectId: parsed.data.projectId,
        url: bodyResult.data.url,
        secret: bodyResult.data.secret ?? null,
        events: bodyResult.data.events,
        isActive: bodyResult.data.isActive ?? true,
      })
      .returning();
    const out = { ...row, secret: undefined };
    return reply.status(201).send(out);
  });

  app.get("/api/webhooks/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [row] = await db.select().from(webhooks).where(eq(webhooks.id, parsed.data.id)).limit(1);
    if (!row) return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, row.projectId, payload.sub))) {
      return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    }
    if (!(await assertProjectRole(db, row.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can manage webhooks", "FORBIDDEN");
    }
    return reply.send({ ...row, secret: undefined });
  });

  app.patch("/api/webhooks/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(webhooks).where(eq(webhooks.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    }
    if (!(await assertProjectRole(db, existing.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can manage webhooks", "FORBIDDEN");
    }
    const setPayload: Partial<typeof webhooks.$inferInsert> = {};
    if (bodyResult.data.url !== undefined) setPayload.url = bodyResult.data.url;
    if (bodyResult.data.secret !== undefined) setPayload.secret = bodyResult.data.secret;
    if (bodyResult.data.events !== undefined) setPayload.events = bodyResult.data.events;
    if (bodyResult.data.isActive !== undefined) setPayload.isActive = bodyResult.data.isActive;
    const [updated] = await db.update(webhooks).set(setPayload).where(eq(webhooks.id, parsed.data.id)).returning();
    return reply.send(updated ? { ...updated, secret: undefined } : existing);
  });

  app.delete("/api/webhooks/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(webhooks).where(eq(webhooks.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Webhook not found", "NOT_FOUND");
    }
    if (!(await assertProjectRole(db, existing.projectId, payload.sub, ["admin", "lead"]))) {
      return replyError(reply, 403, "Only admin or lead can manage webhooks", "FORBIDDEN");
    }
    await db.delete(webhooks).where(eq(webhooks.id, parsed.data.id));
    return reply.status(204).send();
  });
}
