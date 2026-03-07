import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-4 shadow-card", className)} {...props}>
      {children}
    </div>
  );
}
