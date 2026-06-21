import type { ButtonHTMLAttributes } from "react";

type ButtonVariant =
  | "primary"
  | "accent"
  | "emphasis"
  | "outline"
  | "ghost"
  | "tinted";

type ButtonSize = "default" | "full" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses =
  "inline-flex min-h-11 items-center justify-center gap-2 border border-transparent font-medium leading-tight no-underline transition-[color,background-color,border-color,transform] duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground [&>svg]:shrink-0";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:not-disabled:bg-primary-hover",
  accent: "bg-accent text-accent-foreground hover:not-disabled:bg-accent-hover",
  emphasis: "bg-foreground text-background hover:not-disabled:opacity-90",
  outline:
    "border-primary bg-transparent text-foreground hover:not-disabled:bg-secondary",
  ghost:
    "bg-transparent text-muted-foreground hover:not-disabled:bg-secondary hover:not-disabled:text-foreground",
  tinted: "bg-secondary text-foreground hover:not-disabled:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "rounded-lg px-5 py-3",
  full: "min-h-13 w-full rounded-lg px-5 py-3",
  icon: "size-11 min-h-11 rounded-full p-0",
};

export function Button({
  className = "",
  variant = "primary",
  size = "default",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} type={type} {...props} />;
}
