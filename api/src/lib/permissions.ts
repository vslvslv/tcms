import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { projectMembers, roles, users } from "../db/schema.js";

type Action =
  | "cases.create" | "cases.edit" | "cases.delete"
  | "runs.create" | "runs.close" | "runs.delete"
  | "settings.manage" | "members.manage"
  | "audit.view" | "project.delete";

const PERMISSIONS: Record<string, Action[]> = {
  admin: [
    "cases.create", "cases.edit", "cases.delete",
    "runs.create", "runs.close", "runs.delete",
    "settings.manage", "members.manage",
    "audit.view", "project.delete",
  ],
  lead: [
    "cases.create", "cases.edit", "cases.delete",
    "runs.create", "runs.close", "runs.delete",
    "settings.manage",
    "audit.view",
  ],
  tester: [
    "cases.create", "cases.edit",
    "runs.create", "runs.close",
  ],
};

export async function can(userId: string, projectId: string, action: Action): Promise<boolean> {
  const db = await getDb();

  // Global admins can do everything
  const [user] = await db.select({ globalRole: users.globalRole }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.globalRole === "admin") return true;

  // Check project-level role
  const [membership] = await db.select({ roleId: projectMembers.roleId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .limit(1);
  if (!membership) return false;

  const [role] = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, membership.roleId)).limit(1);
  if (!role) return false;

  const allowed = PERMISSIONS[role.name] ?? [];
  return allowed.includes(action);
}

export { type Action };
