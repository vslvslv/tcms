import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { getDb } from "../db/index.js";
import { apiTokens } from "../db/schema.js";
import { replyError } from "../lib/errors.js";

const createBody = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).optional().default(90),
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function tokenRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  // Create token
  app.post("/api/tokens", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const body = createBody.safeParse((req as any).body);
    if (!body.success) return replyError(reply, 400, "Invalid body", "VALIDATION_ERROR");

    const plaintext = `tcms_${crypto.randomBytes(32).toString("hex")}`;
    const hash = hashToken(plaintext);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + body.data.expiresInDays);

    const db = await getDb();
    const [row] = await db.insert(apiTokens).values({
      userId: payload.sub,
      name: body.data.name,
      tokenHash: hash,
      expiresAt,
    }).returning();

    return reply.status(201).send({
      ...row,
      token: plaintext, // Shown once, never stored
    });
  });

  // List tokens (no plaintext)
  app.get("/api/tokens", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const db = await getDb();
    const tokens = await db.select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    }).from(apiTokens).where(eq(apiTokens.userId, payload.sub));
    return tokens;
  });

  // Delete token
  app.delete("/api/tokens/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string };
    const params = z.object({ id: z.string().uuid() }).safeParse((req as any).params);
    if (!params.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");

    const db = await getDb();
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.id, params.data.id)).limit(1);
    if (!token || token.userId !== payload.sub) {
      return replyError(reply, 404, "Token not found", "NOT_FOUND");
    }

    await db.delete(apiTokens).where(eq(apiTokens.id, params.data.id));
    return reply.status(204).send();
  });
}
