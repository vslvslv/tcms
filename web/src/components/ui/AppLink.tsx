import { type ComponentProps } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

type AppLinkProps = ComponentProps<typeof Link>;

/**
 * In-app link with consistent primary style. For external links, use <a> with text-primary hover:underline.
 */
export function AppLink({ className, ...props }: AppLinkProps) {
  return (
    <Link
      className={cn("font-medium text-primary no-underline hover:underline", className)}
      {...props}
    />
  );
}
