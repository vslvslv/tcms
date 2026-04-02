import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users, passwordResetTokens } from "../db/schema.js";
import { eq, and, isNull, gt } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) {
      return replyError(reply, 400, parsed.error.message, "VALIDATION_ERROR");
    }
    const { email, password, name } = parsed.data;
    const db = await getDb();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return replyError(reply, 409, "Email already registered", "EMAIL_EXISTS");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name })
      .returning({ id: users.id, email: users.email, name: users.name });
    const token = app.jwt.sign({ sub: user.id });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post("/api/auth/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) {
      return replyError(reply, 400, parsed.error.message, "VALIDATION_ERROR");
    }
    const { email, password } = parsed.data;
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return replyError(reply, 401, "Invalid email or password", "UNAUTHORIZED");
    }
    const token = app.jwt.sign({ sub: user.id });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  app.get("/api/auth/me", { preValidation: [app.authenticate] }, async (req, reply) => {
      const payload = req.user as { sub: string } | undefined;
      if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
      const db = await getDb();
      const [user] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!user) {
        return replyError(reply, 404, "User not found", "NOT_FOUND");
      }
      return reply.send(user);
    }
  );

  // Update profile (name, password)
  const updateProfileBody = z.object({
    name: z.string().min(1).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  });

  app.patch("/api/auth/me", { preValidation: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const body = updateProfileBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!body.success) return replyError(reply, 400, body.error.message, "VALIDATION_ERROR");
    const db = await getDb();

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user) return replyError(reply, 404, "User not found", "NOT_FOUND");

    const updates: Record<string, unknown> = {};
    if (body.data.name) updates.name = body.data.name;

    if (body.data.newPassword) {
      if (!body.data.currentPassword) {
        return replyError(reply, 400, "Current password required", "VALIDATION_ERROR");
      }
      const bcrypt = await import("bcrypt");
      const valid = await bcrypt.default.compare(body.data.currentPassword, user.passwordHash);
      if (!valid) return replyError(reply, 400, "Current password is incorrect", "VALIDATION_ERROR");
      updates.passwordHash = await bcrypt.default.hash(body.data.newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return replyError(reply, 400, "No fields to update", "VALIDATION_ERROR");
    }

    updates.updatedAt = new Date();
    await db.update(users).set(updates).where(eq(users.id, payload.sub));
    return reply.send({ ok: true });
  });

  // Password reset request: generates a token. Returns it in the response (no email in MVP).
  const resetRequestBody = z.object({ email: z.string().email() });

  app.post("/api/auth/reset-request", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = resetRequestBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) return replyError(reply, 400, parsed.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
    if (!user) {
      // Fixed delay to mask timing difference from DB insert path
      await new Promise((r) => setTimeout(r, 200));
      return reply.send({ message: "If the email exists, a reset link has been generated." });
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });
    // In MVP, return the token directly (no email). In production, send via email.
    return reply.send({
      message: "If the email exists, a reset link has been generated.",
      resetToken: token,
      resetUrl: `/reset-password/${token}`,
    });
  });

  // Password reset confirm: validates token, updates password
  const resetConfirmBody = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });

  app.post("/api/auth/reset-confirm", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = resetConfirmBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    if (!parsed.success) return replyError(reply, 400, parsed.error.message, "VALIDATION_ERROR");
    const db = await getDb();
    const [resetRow] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, parsed.data.token),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!resetRow) {
      return replyError(reply, 400, "Invalid or expired reset token", "INVALID_TOKEN");
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, resetRow.userId));
    // Mark token as used to prevent replay
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetRow.id));
    return reply.send({ message: "Password reset successfully" });
  });
}
