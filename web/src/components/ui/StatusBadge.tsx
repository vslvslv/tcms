import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type CaseStatus = "draft" | "ready" | "approved";

const statusClasses: Record<CaseStatus, string> = {
  approved: "bg-success/10 text-success",
  ready: "bg-primary/10 text-primary",
  draft: "bg-muted/20 text-muted",
};

export function StatusBadge({
  status,
  className,
  ...props
}: { status: CaseStatus } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", statusClasses[status], className)}
      {...props}
    >
      {status}
    </span>
  );
}
