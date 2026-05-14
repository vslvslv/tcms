import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

export function EmptyState({
  message,
  action,
  className,
  variant = "default",
}: {
  message: string;
  action?: ReactNode;
  className?: string;
  variant?: "default" | "cta";
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-raised/30 py-12 text-center", className)}>
      {variant === "cta" ? (
        <>
          {action && <div className="mb-3">{action}</div>}
          <p className="text-muted">{message}</p>
        </>
      ) : (
        <>
          <p className="text-muted">{message}</p>
          {action && <div className="mt-4">{action}</div>}
        </>
      )}
    </div>
  );
}
