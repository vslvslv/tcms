import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getDb } from "../db/index.js";
import { projects, projectMembers, milestones, testPlans, suites, runs } from "../db/schema.js";
import { eq, inArray, desc } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  app.get("/api/dashboard", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");
    const db = await getDb();
    const owned = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, payload.sub));
    const memberRows = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, payload.sub));
    const projectIds = [...new Set([...owned.map((p) => p.id), ...memberRows.map((m) => m.projectId)])];
    if (projectIds.length === 0) {
      return reply.send({
        projects: [],
        milestones: [],
        plans: [],
        recentRuns: [],
      });
    }
    const [projectsList, milestonesList, plansList] = await Promise.all([
      db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, projectIds)),
      db.select().from(milestones).where(inArray(milestones.projectId, projectIds)),
      db.select().from(testPlans).where(inArray(testPlans.projectId, projectIds)),
    ]);
    const suiteRows = await db.select({ id: suites.id, projectId: suites.projectId }).from(suites).where(inArray(suites.projectId, projectIds));
    const suiteIds = suiteRows.map((s) => s.id);
    const recentRunsList =
      suiteIds.length === 0
        ? []
        : await db
            .select()
            .from(runs)
            .where(inArray(runs.suiteId, suiteIds))
            .orderBy(desc(runs.createdAt))
            .limit(20);
    const suiteById = new Map(suiteRows.map((s) => [s.id, s]));
    const recentRunsWithProject = recentRunsList.map((r) => ({
      ...r,
      projectId: suiteById.get(r.suiteId)?.projectId,
    }));
    return reply.send({
      projects: projectsList,
      milestones: milestonesList,
      plans: plansList,
      recentRuns: recentRunsWithProject,
    });
  });
}
