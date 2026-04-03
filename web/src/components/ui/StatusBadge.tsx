import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type CaseStatus = "draft" | "ready" | "approved";
type RunStatus = "passed" | "failed" | "blocked" | "skipped" | "untested";
type BadgeStatus = CaseStatus | RunStatus;

const statusClasses: Record<BadgeStatus, string> = {
  approved: "bg-success/20 text-success",
  ready: "bg-primary/20 text-primary",
  draft: "bg-muted/20 text-muted",
  passed: "bg-success/20 text-success",
  failed: "bg-error/20 text-error",
  blocked: "bg-warning/20 text-warning",
  skipped: "bg-muted/20 text-muted",
  untested: "bg-muted/10 text-muted",
};

export function StatusBadge({
  status,
  className,
  ...props
}: { status: BadgeStatus } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", statusClasses[status], className)}
      {...props}
    >
      {status}
    </span>
  );
}
