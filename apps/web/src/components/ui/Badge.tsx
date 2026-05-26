import type { HTMLAttributes, ReactNode } from "react";

/**
 * Badge — small, decorative status/count indicator. Non-interactive (use
 * Chip for clickable). Uppercase tracking style for type tags;
 * tabular-nums for numeric counts.
 */

type Variant = "default" | "accent" | "cool" | "warm" | "success" | "danger";
type Size = "xs" | "sm";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  size?: Size;
  uppercase?: boolean;
  children?: ReactNode;
}

const VARIANT: Record<Variant, { bg: string; color: string; border: string }> = {
  default: { bg: "var(--toggle-bg)",            color: "var(--text-faint)",      border: "transparent" },
  accent:  { bg: "var(--border)",           color: "var(--text-primary)",          border: "transparent" },
  cool:    { bg: "var(--color-cool-dim)",       color: "var(--color-cool)",      border: "transparent" },
  warm:    { bg: "var(--color-warm-dim)",       color: "var(--color-warm)",      border: "transparent" },
  success: { bg: "var(--color-success-dim)",    color: "var(--color-success)",   border: "transparent" },
  danger:  { bg: "var(--color-danger-dim)",     color: "var(--color-danger)",    border: "transparent" },
};

const SIZE: Record<Size, string> = {
  xs: "px-1 py-0 text-caption leading-none",
  sm: "px-1.5 py-0.5 text-caption",
};

export function Badge({ variant = "default", size = "sm", uppercase = false, className = "", children, style, ...rest }: BadgeProps) {
  const v = VARIANT[variant];
  return (
    <span
      className={[
        "inline-flex items-center rounded font-semibold tabular-nums",
        SIZE[size],
        uppercase ? "uppercase tracking-wider" : "",
        className,
      ].filter(Boolean).join(" ")}
      style={{ background: v.bg, color: v.color, border: `1px solid ${v.border}`, ...style }}
      {...rest}
    >
      {children}
    </span>
  );
}
