import { getDb } from "../db/index.js";
import { projects, projectMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return false;
  if (p.userId === userId) return true;
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId))
    .limit(1);
  if (!member) return false;
  const [m] = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .limit(1);
  return !!m && m.projectId === projectId;
}

export async function assertProjectAccess(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  userId: string
): Promise<boolean> {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return false;
  if (p.userId === userId) return true;
  const [m] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return !!m;
}
