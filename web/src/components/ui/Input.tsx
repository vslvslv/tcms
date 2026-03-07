import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-border px-3 py-2 text-sm text-gray-900 placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          className
        )}
        {...props}
      />
    );
  }
);
