import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { notificationPreferences } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const EVENTS = [
  "run.assigned",
  "run.completed",
  "case.approval_requested",
  "result.recorded",
] as const;

const updateBody = z.object({
  event: z.enum(EVENTS),
  enabled: z.boolean(),
});

export default async function notificationRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/notifications/preferences", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const db = await getDb();
    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, payload.sub));

    // Return all events with defaults (enabled=true) for any not yet set
    const prefMap = new Map(prefs.map((p) => [p.event, p.enabled]));
    const result = EVENTS.map((event) => ({
      event,
      enabled: prefMap.get(event) ?? true,
    }));
    return reply.send(result);
  });

  app.patch("/api/notifications/preferences", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const body = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!body.success) return replyError(reply, 400, body.error.message, "VALIDATION_ERROR");
    const db = await getDb();

    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, payload.sub),
          eq(notificationPreferences.event, body.data.event)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({ enabled: body.data.enabled })
        .where(eq(notificationPreferences.id, existing.id));
    } else {
      await db.insert(notificationPreferences).values({
        userId: payload.sub,
        event: body.data.event,
        enabled: body.data.enabled,
      });
    }

    return reply.send({ ok: true });
  });
}
