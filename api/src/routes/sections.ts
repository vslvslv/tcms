import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { suites, sections } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsSuiteId = z.object({ suiteId: z.string().uuid() });
const paramsParentId = z.object({ parentId: z.string().uuid() });
const createSectionBody = z.object({ name: z.string().min(1) });
const updateSectionBody = z.object({ name: z.string().min(1) });

async function assertSuiteAccess(db: Awaited<ReturnType<typeof getDb>>, suiteId: string, userId: string) {
  const [s] = await db.select().from(suites).where(eq(suites.id, suiteId)).limit(1);
  if (!s) return false;
  return assertProjectAccess(db, s.projectId, userId);
}

export default async function sectionRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/suites/:suiteId/sections", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsSuiteId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid suiteId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, parsed.data.suiteId, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const list = await db
      .select()
      .from(sections)
      .where(eq(sections.suiteId, parsed.data.suiteId));
    return reply.send(list);
  });

  app.post("/api/suites/:suiteId/sections", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsSuiteId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid suiteId", "VALIDATION_ERROR");
    const bodyResult = createSectionBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertSuiteAccess(db, paramsResult.data.suiteId, payload.sub))) {
      return replyError(reply, 404, "Suite not found", "NOT_FOUND");
    }
    const [section] = await db
      .insert(sections)
      .values({
        suiteId: paramsResult.data.suiteId,
        name: bodyResult.data.name,
        parentId: null,
      })
      .returning();
    return reply.status(201).send(section);
  });

  app.post("/api/sections/:parentId/sections", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsParentId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid parentId", "VALIDATION_ERROR");
    const bodyResult = createSectionBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [parent] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, paramsResult.data.parentId))
      .limit(1);
    if (!parent) return replyError(reply, 404, "Parent section not found", "NOT_FOUND");
    if (!(await assertSuiteAccess(db, parent.suiteId, payload.sub))) {
      return replyError(reply, 403, "Forbidden", "FORBIDDEN");
    }
    const [section] = await db
      .insert(sections)
      .values({
        suiteId: parent.suiteId,
        parentId: parent.id,
        name: bodyResult.data.name,
      })
      .returning();
    return reply.status(201).send(section);
  });

  app.get("/api/sections/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [section] = await db.select().from(sections).where(eq(sections.id, parsed.data.id)).limit(1);
    if (!section) return replyError(reply, 404, "Section not found", "NOT_FOUND");
    if (!(await assertSuiteAccess(db, section.suiteId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    return reply.send(section);
  });

  app.patch("/api/sections/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateSectionBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(sections).where(eq(sections.id, paramsResult.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Section not found", "NOT_FOUND");
    if (!(await assertSuiteAccess(db, existing.suiteId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    const [updated] = await db
      .update(sections)
      .set({ name: bodyResult.data.name, updatedAt: new Date() })
      .where(eq(sections.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });

  app.delete("/api/sections/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const rawParams = (req as FastifyRequest<{ Params: { id?: string } }>).params;
    const idRaw = rawParams?.id;
    const idFromParams = typeof idRaw === "string" ? idRaw : Array.isArray(idRaw) ? idRaw[0] : undefined;
    const idFromPath = req.url.replace(/^.*\/api\/sections\//, "").split("?")[0].split("/")[0]?.trim() || "";
    const id = (idFromParams ?? idFromPath).trim();
    const parsed = paramsId.safeParse({ id });
    if (!parsed.success) {
      return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    }
    const db = await getDb();
    const [existing] = await db.select().from(sections).where(eq(sections.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Section not found", "NOT_FOUND");
    if (!(await assertSuiteAccess(db, existing.suiteId, payload.sub))) {
      return replyError(reply, 404, "Section not found", "NOT_FOUND");
    }
    await db.delete(sections).where(eq(sections.id, parsed.data.id));
    return reply.status(204).send();
  });
}
