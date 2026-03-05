import bcrypt from "bcrypt";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
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
}
