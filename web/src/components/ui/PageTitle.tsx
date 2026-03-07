import { type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function PageTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("text-xl font-semibold text-gray-900", className)} {...props}>
      {children}
    </h1>
  );
}
