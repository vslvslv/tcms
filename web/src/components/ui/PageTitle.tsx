import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function PageTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("font-mono text-xl font-semibold text-text", className)} {...props}>
      {children}
    </h1>
  );
}
