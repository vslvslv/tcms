import type { getDb } from "../db/index.js";
import { auditLog } from "../db/schema.js";

export type AuditAction =
  | "case.created"
  | "case.updated"
  | "case.deleted"
  | "run.created"
  | "run.updated"
  | "run.deleted"
  | "result.created"
  | "result.updated"
  | "plan.created"
  | "plan.updated"
  | "plan.deleted"
  | "milestone.created"
  | "milestone.updated"
  | "milestone.deleted"
  | "member.added"
  | "member.removed"
  | "shared_step.created"
  | "shared_step.updated"
  | "shared_step.deleted"
  | "issue_link.added"
  | "issue_link.removed"
  | "case.duplicated"
  | "case.bulk_deleted"
  | "case.bulk_moved"
  | "case.bulk_copied"
  | "ai.generated_cases"
  | "result.bulk_updated"
  | "case.restored"
  | "test.assigned";

export async function writeAuditLog(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  projectId: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(auditLog).values({
    userId,
    action,
    entityType,
    entityId,
    projectId,
    metadata: metadata ?? null,
  });
}
