import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { sql } from "drizzle-orm";
import { getDb } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import suiteRoutes from "./routes/suites.js";
import sectionRoutes from "./routes/sections.js";
import caseRoutes from "./routes/cases.js";
import runRoutes from "./routes/runs.js";
import resultRoutes from "./routes/results.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5001",
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
});

app.decorate("authenticate", async function (req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
  }
});

await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(suiteRoutes);
await app.register(sectionRoutes);
await app.register(caseRoutes);
await app.register(runRoutes);
await app.register(resultRoutes);

app.get("/health", async () => {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return { status: "ok", db: "connected" };
  } catch (e) {
    app.log.error(e);
    return { status: "ok", db: "disconnected" };
  }
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`API listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
