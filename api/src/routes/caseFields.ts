import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { caseFieldDefinitions } from "../db/schema.js";
import { eq, or, isNull } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsProjectId = z.object({ projectId: z.string().uuid() });
const paramsId = z.object({ id: z.string().uuid() });
const createBody = z.object({
  name: z.string().min(1),
  fieldType: z.enum(["text", "dropdown", "number", "multiline"]),
  options: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});
const updateBody = createBody.partial();

export default async function caseFieldRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/case-fields", async (req: FastifyRequest, reply: FastifyReply) => {
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
      .from(caseFieldDefinitions)
      .where(or(eq(caseFieldDefinitions.projectId, parsed.data.projectId), isNull(caseFieldDefinitions.projectId)));
    return reply.send(list.sort((a, b) => a.sortOrder - b.sortOrder));
  });

  app.post("/api/projects/:projectId/case-fields", async (req: FastifyRequest, reply: FastifyReply) => {
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
      .insert(caseFieldDefinitions)
      .values({
        projectId: paramsResult.data.projectId,
        name: bodyResult.data.name,
        fieldType: bodyResult.data.fieldType,
        options: bodyResult.data.options ?? null,
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    return reply.status(201).send(row);
  });

  app.get("/api/case-fields/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [row] = await db
      .select()
      .from(caseFieldDefinitions)
      .where(eq(caseFieldDefinitions.id, parsed.data.id))
      .limit(1);
    if (!row) return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    if (row.projectId && !(await assertProjectAccess(db, row.projectId, payload.sub))) {
      return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    }
    return reply.send(row);
  });

  app.patch("/api/case-fields/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(caseFieldDefinitions)
      .where(eq(caseFieldDefinitions.id, parsed.data.id))
      .limit(1);
    if (!existing) return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    if (existing.projectId && !(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    }
    const setPayload: Partial<typeof caseFieldDefinitions.$inferInsert> = {};
    if (bodyResult.data.name !== undefined) setPayload.name = bodyResult.data.name;
    if (bodyResult.data.fieldType !== undefined) setPayload.fieldType = bodyResult.data.fieldType;
    if (bodyResult.data.options !== undefined) setPayload.options = bodyResult.data.options;
    if (bodyResult.data.sortOrder !== undefined) setPayload.sortOrder = bodyResult.data.sortOrder;
    const [updated] = await db
      .update(caseFieldDefinitions)
      .set(setPayload)
      .where(eq(caseFieldDefinitions.id, parsed.data.id))
      .returning();
    return reply.send(updated);
  });

  app.delete("/api/case-fields/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db
      .select()
      .from(caseFieldDefinitions)
      .where(eq(caseFieldDefinitions.id, parsed.data.id))
      .limit(1);
    if (!existing) return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    if (existing.projectId && !(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Case field not found", "NOT_FOUND");
    }
    await db.delete(caseFieldDefinitions).where(eq(caseFieldDefinitions.id, parsed.data.id));
    return reply.status(204).send();
  });
}
