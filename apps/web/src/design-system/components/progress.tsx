import type { CSSProperties, HTMLAttributes } from "react";

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  inverted?: boolean;
  label: string;
  value: number;
  max?: number;
}

export function normalizeProgress(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), max);
}

export function Progress({
  className = "",
  inverted = false,
  label,
  value,
  max = 100,
  ...props
}: ProgressProps) {
  const normalizedValue = normalizeProgress(value, max);
  const percentage = (normalizedValue / max) * 100;
  const style = {
    "--progress-value": `${percentage}%`,
  } as CSSProperties;

  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={[
        "h-1 w-full overflow-hidden rounded-full",
        inverted
          ? "bg-[color-mix(in_srgb,var(--primary-foreground)_22%,transparent)]"
          : "bg-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
      {...props}
    >
      <div
        className={[
          "h-full w-[var(--progress-value)] rounded-[inherit] transition-[width] duration-250 ease-out",
          inverted ? "bg-primary-foreground" : "bg-primary",
        ].join(" ")}
        style={style}
      />
    </div>
  );
}
