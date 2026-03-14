import { type HTMLAttributes } from "react";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";

type CaseStatus = "draft" | "ready" | "approved";

const statusVariantMap: Record<CaseStatus, "muted" | "secondary" | "success"> = {
  approved: "success",
  ready: "secondary",
  draft: "muted",
};

export function StatusBadge({
  status,
  className,
  ...props
}: { status: CaseStatus } & HTMLAttributes<HTMLDivElement>) {
  return (
    <Badge
      variant={statusVariantMap[status]}
      className={cn("capitalize", className)}
      {...props}
    >
      {status}
    </Badge>
  );
}
