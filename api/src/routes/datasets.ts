import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { datasets, datasetColumns, datasetRows } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsId = z.object({ id: z.string().uuid() });
const paramsProjectId = z.object({ projectId: z.string().uuid() });
const createDatasetBody = z.object({ name: z.string().min(1) });
const createColumnBody = z.object({ name: z.string().min(1), sortOrder: z.number().int().min(0).optional() });
const createRowBody = z.object({ data: z.record(z.string()) });

export default async function datasetRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/projects/:projectId/datasets", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, parsed.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const list = await db.select().from(datasets).where(eq(datasets.projectId, parsed.data.projectId));
    const withDetails = await Promise.all(
      list.map(async (d) => {
        const cols = await db.select().from(datasetColumns).where(eq(datasetColumns.datasetId, d.id));
        const rows = await db.select().from(datasetRows).where(eq(datasetRows.datasetId, d.id));
        return { ...d, columns: cols.sort((a, b) => a.sortOrder - b.sortOrder), rows };
      })
    );
    return reply.send(withDetails);
  });

  app.post("/api/projects/:projectId/datasets", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsProjectId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid projectId", "VALIDATION_ERROR");
    const bodyResult = createDatasetBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    if (!(await assertProjectAccess(db, paramsResult.data.projectId, payload.sub))) {
      return replyError(reply, 404, "Project not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(datasets)
      .values({ projectId: paramsResult.data.projectId, name: bodyResult.data.name })
      .returning();
    return reply.status(201).send(row);
  });

  app.get("/api/datasets/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [d] = await db.select().from(datasets).where(eq(datasets.id, parsed.data.id)).limit(1);
    if (!d) return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, d.projectId, payload.sub))) {
      return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    }
    const cols = await db.select().from(datasetColumns).where(eq(datasetColumns.datasetId, d.id));
    const rows = await db.select().from(datasetRows).where(eq(datasetRows.datasetId, d.id));
    return reply.send({ ...d, columns: cols.sort((a, b) => a.sortOrder - b.sortOrder), rows });
  });

  app.post("/api/datasets/:id/columns", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = createColumnBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [d] = await db.select().from(datasets).where(eq(datasets.id, paramsResult.data.id)).limit(1);
    if (!d) return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, d.projectId, payload.sub))) {
      return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(datasetColumns)
      .values({
        datasetId: paramsResult.data.id,
        name: bodyResult.data.name,
        sortOrder: bodyResult.data.sortOrder ?? 0,
      })
      .returning();
    return reply.status(201).send(row);
  });

  app.post("/api/datasets/:id/rows", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const paramsResult = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!paramsResult.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = createRowBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!bodyResult.success) return replyError(reply, 400, bodyResult.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [d] = await db.select().from(datasets).where(eq(datasets.id, paramsResult.data.id)).limit(1);
    if (!d) return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, d.projectId, payload.sub))) {
      return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    }
    const [row] = await db
      .insert(datasetRows)
      .values({ datasetId: paramsResult.data.id, data: bodyResult.data.data })
      .returning();
    return reply.status(201).send(row);
  });

  app.delete("/api/datasets/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [d] = await db.select().from(datasets).where(eq(datasets.id, parsed.data.id)).limit(1);
    if (!d) return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, d.projectId, payload.sub))) {
      return replyError(reply, 404, "Dataset not found", "NOT_FOUND");
    }
    await db.delete(datasets).where(eq(datasets.id, parsed.data.id));
    return reply.status(204).send();
  });
}
