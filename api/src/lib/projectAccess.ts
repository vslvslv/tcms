import { getDb } from "../db/index.js";
import { projects, projectMembers, roles } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

/** Returns role name for user in project, or "admin" if project owner, or null if no access. */
export async function getProjectRole(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  userId: string
): Promise<string | null> {
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return null;
  if (p.userId === userId) return "admin";
  const [m] = await db
    .select({ roleName: roles.name })
    .from(projectMembers)
    .innerJoin(roles, eq(projectMembers.roleId, roles.id))
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return m?.roleName ?? null;
}

/** Asserts user has one of the allowed roles (or is project owner, treated as admin). Returns true or false. */
export async function assertProjectRole(
  db: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  userId: string,
  allowedRoles: string[]
): Promise<boolean> {
  const role = await getProjectRole(db, projectId, userId);
  if (!role) return false;
  return allowedRoles.includes(role.toLowerCase());
}

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
