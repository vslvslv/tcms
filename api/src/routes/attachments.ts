import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import path from "path";
import { getDb } from "../db/index.js";
import { attachments, testCases, results, sections, suites } from "../db/schema.js";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";
import { uploadFile, getFileStream, deleteFile } from "../lib/storage.js";

const paramsId = z.object({ id: z.string().uuid() });

/** Sanitize user-provided filename: strip path, control chars, limit length. */
function sanitizeFilename(raw: string): string {
  const base = path.basename(raw).replace(/[^\w.\-() ]/g, "_").slice(0, 200);
  return base || "attachment";
}

async function traceProjectIdFromCase(db: Awaited<ReturnType<typeof getDb>>, caseId: string): Promise<string | null> {
  const [tc] = await db.select().from(testCases).where(eq(testCases.id, caseId)).limit(1);
  if (!tc) return null;
  const [sec] = await db.select().from(sections).where(eq(sections.id, tc.sectionId)).limit(1);
  if (!sec) return null;
  const [suite] = await db.select().from(suites).where(eq(suites.id, sec.suiteId)).limit(1);
  return suite?.projectId ?? null;
}

export default async function attachmentRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" }); }
  });

  // Upload attachment to a case
  app.post("/api/cases/:id/attachments", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");

    const db = await getDb();
    const projectId = await traceProjectIdFromCase(db, params.data.id);
    if (!projectId || !(await assertProjectAccess(db, projectId, payload.sub))) {
      return replyError(reply, 404, "Case not found", "NOT_FOUND");
    }

    const file = await req.file();
    if (!file) return replyError(reply, 400, "No file uploaded", "VALIDATION_ERROR");

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const safeName = sanitizeFilename(file.filename);
    const key = `case/${params.data.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadFile(key, body, file.mimetype);

    const [row] = await db.insert(attachments).values({
      entityType: "case",
      entityId: params.data.id,
      filePath: key,
      fileName: safeName,
      contentType: file.mimetype,
      size: body.length,
      uploadedBy: payload.sub,
    }).returning();

    return reply.status(201).send(row);
  });

  // Upload attachment to a result
  app.post("/api/results/:id/attachments", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");

    const db = await getDb();
    const [result] = await db.select().from(results).where(eq(results.id, params.data.id)).limit(1);
    if (!result) return replyError(reply, 404, "Result not found", "NOT_FOUND");

    const file = await req.file();
    if (!file) return replyError(reply, 400, "No file uploaded", "VALIDATION_ERROR");

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const safeName = sanitizeFilename(file.filename);
    const key = `result/${params.data.id}/${crypto.randomUUID()}-${safeName}`;
    await uploadFile(key, body, file.mimetype);

    const [row] = await db.insert(attachments).values({
      entityType: "result",
      entityId: params.data.id,
      filePath: key,
      fileName: safeName,
      contentType: file.mimetype,
      size: body.length,
      uploadedBy: payload.sub,
    }).returning();

    return reply.status(201).send(row);
  });

  // List attachments for a case
  app.get("/api/cases/:id/attachments", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const rows = await db.select().from(attachments)
      .where(and(eq(attachments.entityType, "case"), eq(attachments.entityId, params.data.id)));
    return rows;
  });

  // List attachments for a result
  app.get("/api/results/:id/attachments", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const rows = await db.select().from(attachments)
      .where(and(eq(attachments.entityType, "result"), eq(attachments.entityId, params.data.id)));
    return rows;
  });

  // Download attachment
  app.get("/api/attachments/:id/download", async (req: FastifyRequest, reply: FastifyReply) => {
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [att] = await db.select().from(attachments).where(eq(attachments.id, params.data.id)).limit(1);
    if (!att) return replyError(reply, 404, "Attachment not found", "NOT_FOUND");

    const stream = await getFileStream(att.filePath);
    return reply
      .header("Content-Type", att.contentType ?? "application/octet-stream")
      .header("Content-Disposition", `inline; filename="${encodeURIComponent(att.fileName)}"`)
      .send(stream);
  });

  // Delete attachment
  app.delete("/api/attachments/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = paramsId.safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const db = await getDb();
    const [att] = await db.select().from(attachments).where(eq(attachments.id, params.data.id)).limit(1);
    if (!att) return replyError(reply, 404, "Attachment not found", "NOT_FOUND");

    await deleteFile(att.filePath);
    await db.delete(attachments).where(eq(attachments.id, att.id));
    return reply.status(204).send();
  });
}
