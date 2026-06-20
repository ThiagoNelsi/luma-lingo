import type { HTMLAttributes } from "react";

type SurfaceVariant = "default" | "secondary" | "tinted" | "primary";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

const variantClasses: Record<SurfaceVariant, string> = {
  default: "border-border bg-card text-card-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  tinted:
    "border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--background))] text-foreground",
  primary:
    "rounded-[var(--radius-feature)] border-transparent bg-primary p-5 text-primary-foreground",
};

export function Surface({
  className = "",
  variant = "default",
  ...props
}: SurfaceProps) {
  const classes = ["rounded-xl border p-4", variantClasses[variant], className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} {...props} />;
}
