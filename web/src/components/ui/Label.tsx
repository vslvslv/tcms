import { type LabelHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Label({
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-muted", className)}
      {...props}
    >
      {children}
    </label>
  );
}
