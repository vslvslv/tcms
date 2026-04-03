import { type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  primary: "border-transparent bg-primary text-white hover:bg-primary-hover",
  secondary: "border-border bg-surface-raised text-text hover:bg-surface",
  ghost: "border-transparent bg-transparent text-text hover:bg-surface-raised",
};

export function Button({ variant = "secondary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export function SubmitButton({ variant = "primary", className, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded border border-transparent bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
