import { cn } from "@/lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center p-8", className)}
      role="status"
      aria-label="Loading"
    >
      <div
        className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
    </div>
  );
}
