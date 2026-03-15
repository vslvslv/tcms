import { randomBytes } from "crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { shareTokens, milestones, runs, tests, results } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";
import { assertProjectAccess } from "../lib/projectAccess.js";

const paramsToken = z.object({ token: z.string().min(1) });
const paramsMilestoneId = z.object({ id: z.string().uuid() });
const shareBody = z.object({ expiresInDays: z.number().int().min(1).max(365).optional() });

export default async function shareRoutes(app: FastifyInstance) {
  app.get("/api/shares/:token", async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = paramsToken.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid token", "VALIDATION_ERROR");
    const db = await getDb();
    const [row] = await db.select().from(shareTokens).where(eq(shareTokens.token, parsed.data.token)).limit(1);
    if (!row) return replyError(reply, 404, "Share not found", "NOT_FOUND");
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      return replyError(reply, 404, "Share link expired", "NOT_FOUND");
    }
    if (row.resourceType === "plan") {
      return replyError(reply, 404, "Share not found", "NOT_FOUND");
    }
    const [m] = await db.select().from(milestones).where(eq(milestones.id, row.resourceId)).limit(1);
    if (!m) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    const milestoneRuns = await db.select().from(runs).where(eq(runs.milestoneId, row.resourceId));
    const runIds = milestoneRuns.map((r) => r.id);
    const testRows = runIds.length === 0 ? [] : await db.select().from(tests).where(inArray(tests.runId, runIds));
    const testIds = testRows.map((t) => t.id);
    const resultRows = testIds.length === 0 ? [] : await db.select().from(results).where(inArray(results.testId, testIds));
    const latestByTestId = new Map<string, (typeof resultRows)[0]>();
    for (const r of resultRows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
      if (!latestByTestId.has(r.testId)) latestByTestId.set(r.testId, r);
    }
    const summary = { passed: 0, failed: 0, blocked: 0, skipped: 0, untested: 0 };
    for (const t of testRows) {
      const latest = latestByTestId.get(t.id);
      if (latest) {
        if (latest.status === "passed") summary.passed++;
        else if (latest.status === "failed") summary.failed++;
        else if (latest.status === "blocked") summary.blocked++;
        else if (latest.status === "skipped") summary.skipped++;
        else summary.untested++;
      } else summary.untested++;
    }
    return reply.send({
      milestone: m,
      runsCount: milestoneRuns.length,
      completedRuns: milestoneRuns.filter((r) => r.isCompleted).length,
      summary,
    });
  });

  app.post("/api/milestones/:id/share", { preValidation: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const parsed = paramsMilestoneId.safeParse((req as FastifyRequest<{ Params: unknown }>).params);
    if (!parsed.success) return replyError(reply, 400, "Invalid id", "VALIDATION_ERROR");
    const bodyResult = shareBody.safeParse((req as FastifyRequest<{ Body: unknown }>).body);
    const expiresInDays = bodyResult.success ? bodyResult.data.expiresInDays : undefined;
    const db = await getDb();
    const [m] = await db.select().from(milestones).where(eq(milestones.id, parsed.data.id)).limit(1);
    if (!m) return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    if (!(await assertProjectAccess(db, m.projectId, payload.sub))) {
      return replyError(reply, 404, "Milestone not found", "NOT_FOUND");
    }
    const token = randomBytes(24).toString("hex");
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
    await db.insert(shareTokens).values({
      projectId: m.projectId,
      resourceType: "milestone",
      resourceId: m.id,
      token,
      expiresAt,
      createdBy: payload.sub,
    });
    const baseUrl = process.env.PUBLIC_URL ?? "http://localhost:5001";
    return reply.send({ shareUrl: `${baseUrl}/shares/${token}`, token, expiresAt: expiresAt?.toISOString() ?? null });
  });
}
