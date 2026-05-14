import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { testCases, sections, suites, runs, projects, projectMembers } from "../db/schema.js";
import { eq, ilike, or, inArray } from "drizzle-orm";
import { replyError } from "../lib/errors.js";

const querySchema = z.object({ q: z.string().min(1) });

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook("preValidation", app.authenticate);

  /**
   * GET /api/search?q=...
   *
   * Returns up to 10 case + run matches scoped to the calling user's projects.
   * Cross-project leak prevention: only projects owned by or membered by userId.
   *
   * Note: ILIKE with LIMIT 10 — no pg_trgm index required at this scale.
   * If volume grows, add GIN index on test_cases.title.
   */
  app.get("/api/search", async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = req.user as { sub: string } | undefined;
    if (!payload) return replyError(reply, 401, "Unauthorized", "UNAUTHORIZED");

    const parsed = querySchema.safeParse((req as FastifyRequest<{ Querystring: unknown }>).query);
    if (!parsed.success) return replyError(reply, 400, "Query parameter 'q' is required", "VALIDATION_ERROR");

    const q = parsed.data.q.trim();
    if (q.length < 3) return reply.send([]);

    const db = await getDb();
    const userId = payload.sub;

    // Resolve user's accessible project IDs (owned + membered)
    const ownedProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId));

    const memberProjects = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId));

    const memberProjectIds = memberProjects.map((m) => m.projectId);
    const projectMap = new Map<string, string>(ownedProjects.map((p) => [p.id, p.name]));

    // Also fetch names for member projects
    if (memberProjectIds.length > 0) {
      const memberProjectRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, memberProjectIds));
      for (const p of memberProjectRows) projectMap.set(p.id, p.name);
    }

    const allProjectIds = Array.from(projectMap.keys());
    if (allProjectIds.length === 0) return reply.send([]);

    const results: {
      id: string;
      type: "case" | "run";
      title: string;
      projectId: string;
      projectName: string;
    }[] = [];

    // Search test cases (ILIKE, LIMIT 10 per ISSUE 8)
    const suiteRows = await db
      .select({ id: suites.id, projectId: suites.projectId })
      .from(suites)
      .where(inArray(suites.projectId, allProjectIds));
    const suiteMap = new Map<string, string>(suiteRows.map((s) => [s.id, s.projectId]));
    const suiteIds = suiteRows.map((s) => s.id);

    if (suiteIds.length > 0) {
      const sectionRows = await db
        .select({ id: sections.id, suiteId: sections.suiteId })
        .from(sections)
        .where(inArray(sections.suiteId, suiteIds));
      const sectionMap = new Map<string, string>(sectionRows.map((s) => [s.id, s.suiteId]));
      const sectionIds = sectionRows.map((s) => s.id);

      if (sectionIds.length > 0) {
        const caseRows = await db
          .select({ id: testCases.id, title: testCases.title, sectionId: testCases.sectionId })
          .from(testCases)
          .where(
            or(
              inArray(testCases.sectionId, sectionIds),
              ilike(testCases.title, `%${q}%`)
            )
          )
          .limit(10);

        for (const c of caseRows) {
          if (!iLikeMatch(c.title, q)) continue;
          const suiteId = sectionMap.get(c.sectionId);
          if (!suiteId) continue;
          const projectId = suiteMap.get(suiteId);
          if (!projectId) continue;
          const projectName = projectMap.get(projectId) ?? "";
          results.push({ id: c.id, type: "case", title: c.title, projectId, projectName });
        }
      }

      // Search runs
      const runRows = await db
        .select({ id: runs.id, name: runs.name, suiteId: runs.suiteId })
        .from(runs)
        .where(
          or(
            inArray(runs.suiteId, suiteIds),
            ilike(runs.name, `%${q}%`)
          )
        )
        .limit(10);

      for (const r of runRows) {
        if (!iLikeMatch(r.name, q)) continue;
        const projectId = suiteMap.get(r.suiteId);
        if (!projectId) continue;
        const projectName = projectMap.get(projectId) ?? "";
        results.push({ id: r.id, type: "run", title: r.name, projectId, projectName });
      }
    }

    return reply.send(results.slice(0, 10));
  });
}

/** JS-side case-insensitive contains check (mirrors SQL ILIKE %q%) */
function iLikeMatch(value: string, q: string): boolean {
  return value.toLowerCase().includes(q.toLowerCase());
}
