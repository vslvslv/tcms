import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

function ChevronDown() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
    </svg>
  );
}

const selectClasses = [
  "w-full rounded-xl border border-border bg-surface pl-3 pr-10 py-2.5 text-sm text-gray-900",
  "transition-shadow duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-md",
  "disabled:cursor-not-allowed disabled:opacity-60",
  "appearance-none cursor-pointer",
].join(" ");

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <div className="relative inline-flex w-full">
        <select
          ref={ref}
          className={cn(selectClasses, className)}
          {...props}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <ChevronDown />
        </span>
      </div>
    );
  }
);
