import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function SectionHeading({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    >
      {children}
    </h2>
  );
}
