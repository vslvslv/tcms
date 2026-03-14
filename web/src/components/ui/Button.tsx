import type { ButtonHTMLAttributes } from "react";
import { ButtonRoot, type ButtonVariantProps } from "./shadcn-button";

type ShadcnVariant = NonNullable<ButtonVariantProps["variant"]>;

const variantMap: Record<"primary" | "secondary" | "ghost" | "danger", ShadcnVariant> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  variant = "secondary",
  type = "button",
  ...props
}: ButtonProps) {
  return <ButtonRoot type={type} variant={variantMap[variant]} {...props} />;
}

export function SubmitButton({
  variant = "primary",
  ...props
}: ButtonProps) {
  return <ButtonRoot type="submit" variant={variantMap[variant]} {...props} />;
}
