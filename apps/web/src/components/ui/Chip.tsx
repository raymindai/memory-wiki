"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Chip — small pill for filters, type tags, removable tags. Compared to
 * Badge: Chip is interactive (clickable / focusable), Badge is decorative.
 */

type Variant = "default" | "accent" | "cool" | "warm" | "success" | "danger";
type Size = "xs" | "sm";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
  leadingIcon?: ReactNode;
}

const SIZE: Record<Size, string> = {
  xs: "h-5 px-1.5 text-caption gap-1",
  sm: "h-6 px-2 text-caption gap-1.5",
};

const VARIANT: Record<Variant, { active: string; idle: string }> = {
  default: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--text-secondary)]",
    active: "bg-[var(--toggle-bg)] text-[var(--text-primary)] border border-[var(--border)]",
  },
  accent: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--text-primary)]",
    active: "bg-[var(--border)] text-[var(--text-primary)] border border-[var(--text-primary)]",
  },
  cool: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--color-cool)]",
    active: "bg-[var(--color-cool-dim)] text-[var(--color-cool)] border border-[var(--color-cool)]",
  },
  warm: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--color-warm)]",
    active: "bg-[var(--color-warm-dim)] text-[var(--color-warm)] border border-[var(--color-warm)]",
  },
  success: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--color-success)]",
    active: "bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]",
  },
  danger: {
    idle:   "bg-transparent text-[var(--text-faint)] border border-[var(--border-dim)] hover:text-[var(--color-danger)]",
    active: "bg-[var(--color-danger-dim)] text-[var(--color-danger)] border border-[var(--color-danger)]",
  },
};

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { variant = "default", size = "sm", active = false, leadingIcon, children, className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        "inline-flex items-center font-medium rounded-md transition-colors select-none",
        SIZE[size],
        active ? VARIANT[variant].active : VARIANT[variant].idle,
        className,
      ].filter(Boolean).join(" ")}
      style={{ transitionDuration: "var(--duration-fast)" }}
      {...rest}
    >
      {leadingIcon}
      <span className="truncate">{children}</span>
    </button>
  );
});
