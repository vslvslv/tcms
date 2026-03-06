import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { caseTemplates } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({
  name: z.string().min(1),
  templateType: z.enum(["steps_based", "exploratory"]).optional(),
  defaultSteps: z.array(z.object({ content: z.string(), expected: z.string().optional().nullable(), sortOrder: z.number().optional() })).optional(),
});
const updateBody = z.object({
  name: z.string().min(1).optional(),
  templateType: z.enum(["steps_based", "exploratory"]).optional(),
  defaultSteps: z.array(z.object({ content: z.string(), expected: z.string().optional().nullable(), sortOrder: z.number().optional() })).optional().nullable(),
});

export default async function caseTemplateRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/case-templates", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db.select().from(caseTemplates).where(eq(caseTemplates.projectId, parsed.data.projectId));
    return reply.send(list);
  });

  app.post("/api/projects/:projectId/case-templates", async (req: FastifyRequest, reply: FastifyReply) => {
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
    const defaultSteps = bodyResult.data.defaultSteps?.map((s, i) => ({
      content: s.content,
      expected: s.expected ?? null,
      sortOrder: s.sortOrder ?? i,
    }));
    const [row] = await db
      .insert(caseTemplates)
      .values({
        projectId: paramsResult.data.projectId,
        name: bodyResult.data.name,
        templateType: bodyResult.data.templateType ?? "steps_based",
        defaultSteps: defaultSteps ?? null,
      })
      .returning();
    return reply.status(201).send(row);
  });

  app.get("/api/case-templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [row] = await db.select().from(caseTemplates).where(eq(caseTemplates.id, parsed.data.id)).limit(1);
    if (!row) return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, row.projectId, payload.sub))) {
      return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    }
    return reply.send(row);
  });

  app.patch("/api/case-templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = updateBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(caseTemplates).where(eq(caseTemplates.id, paramsResult.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    }
    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (bodyResult.data.name !== undefined) updatePayload.name = bodyResult.data.name;
    if (bodyResult.data.templateType !== undefined) updatePayload.templateType = bodyResult.data.templateType;
    if (bodyResult.data.defaultSteps !== undefined) {
      updatePayload.defaultSteps = bodyResult.data.defaultSteps === null
        ? null
        : bodyResult.data.defaultSteps.map((s, i) => ({
            content: s.content,
            expected: s.expected ?? null,
            sortOrder: s.sortOrder ?? i,
          }));
    }
    const [updated] = await db
      .update(caseTemplates)
      .set(updatePayload as typeof caseTemplates.$inferInsert)
      .where(eq(caseTemplates.id, paramsResult.data.id))
      .returning();
    return reply.send(updated);
  });

  app.delete("/api/case-templates/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [existing] = await db.select().from(caseTemplates).where(eq(caseTemplates.id, parsed.data.id)).limit(1);
    if (!existing) return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, existing.projectId, payload.sub))) {
      return replyError(reply, 404, "Case template not found", "NOT_FOUND");
    }
    await db.delete(caseTemplates).where(eq(caseTemplates.id, parsed.data.id));
    return reply.status(204).send();
  });
}
