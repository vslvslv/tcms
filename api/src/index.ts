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
import milestoneRoutes from "./routes/milestones.js";
import planRoutes from "./routes/plans.js";
import caseTypeRoutes from "./routes/caseTypes.js";
import priorityRoutes from "./routes/priorities.js";
import configRoutes from "./routes/configs.js";
import caseFieldRoutes from "./routes/caseFields.js";
import projectMemberRoutes from "./routes/projectMembers.js";
import sharedStepRoutes from "./routes/sharedSteps.js";
import caseTemplateRoutes from "./routes/caseTemplates.js";
import issueLinkRoutes from "./routes/issueLinks.js";
import importResultsRoutes from "./routes/importResults.js";
import datasetRoutes from "./routes/datasets.js";
import auditRoutes from "./routes/audit.js";
import importExportRoutes from "./routes/importExport.js";
import requirementLinkRoutes from "./routes/requirementLinks.js";
import webhookRoutes from "./routes/webhooks.js";
import dashboardRoutes from "./routes/dashboard.js";
import shareRoutes from "./routes/shares.js";

const app = Fastify({ logger: true });

const corsOrigin = process.env.CORS_ORIGIN;
await app.register(cors, {
  origin: corsOrigin
    ? corsOrigin.includes(",")
      ? corsOrigin.split(",").map((o) => o.trim())
      : corsOrigin
    : ["http://localhost:5001", "http://localhost:5173"],
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

app.addContentTypeParser("text/csv", async (_req: FastifyRequest, payload: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];
  for await (const chunk of payload) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
});

await app.register(authRoutes);
await app.register(projectRoutes);
await app.register(suiteRoutes);
await app.register(sectionRoutes);
await app.register(caseRoutes);
await app.register(runRoutes);
await app.register(resultRoutes);
await app.register(milestoneRoutes);
await app.register(planRoutes);
await app.register(caseTypeRoutes);
await app.register(priorityRoutes);
await app.register(configRoutes);
await app.register(caseFieldRoutes);
await app.register(projectMemberRoutes);
await app.register(sharedStepRoutes);
await app.register(caseTemplateRoutes);
await app.register(issueLinkRoutes);
await app.register(importResultsRoutes);
await app.register(datasetRoutes);
await app.register(auditRoutes);
await app.register(importExportRoutes);
await app.register(requirementLinkRoutes);
await app.register(webhookRoutes);
await app.register(dashboardRoutes);
await app.register(shareRoutes);

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
