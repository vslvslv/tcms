import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { caseTypes } from "../db/schema.js";
import { eq, or, isNull } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createBody = z.object({ name: z.string().min(1), sortOrder: z.number().int().min(0).optional() });

export default async function caseTypeRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/case-types", async (req: FastifyRequest, reply: FastifyReply) => {
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
      .from(caseTypes)
      .where(or(eq(caseTypes.projectId, parsed.data.projectId), isNull(caseTypes.projectId)));
    return reply.send(list.sort((a, b) => a.sortOrder - b.sortOrder));
  });

  app.post("/api/projects/:projectId/case-types", async (req: FastifyRequest, reply: FastifyReply) => {
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
      .insert(caseTypes)
      .values({
        projectId: paramsResult.data.projectId,
        name: bodyResult.data.name,
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    return reply.status(201).send(row);
  });
}
