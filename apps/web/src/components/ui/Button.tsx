"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Button — the single source of truth for all action triggers.
 * Variants and sizes draw from docs/DESIGN-TOKENS.md. Anything that needs
 * a different look should justify a new variant here, not inline overrides.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  variant?: Variant;
  size?: Size;
  /** Icon-only buttons get equal padding on all sides for a square hit target. */
  iconOnly?: boolean;
  loading?: boolean;
  /** Inline icon node (Lucide). Renders to the left of children. */
  leadingIcon?: ReactNode;
}

const SIZE: Record<Size, { h: string; px: string; gap: string; text: string; iconSquare: string }> = {
  xs: { h: "h-5",  px: "px-1.5", gap: "gap-1",   text: "text-caption", iconSquare: "w-5 h-5" },
  sm: { h: "h-6",  px: "px-2",   gap: "gap-1.5", text: "text-caption", iconSquare: "w-6 h-6" },
  md: { h: "h-8",  px: "px-3",   gap: "gap-1.5", text: "text-body",    iconSquare: "w-8 h-8" },
};

const VARIANT: Record<Variant, string> = {
  primary:   "bg-[var(--text-primary)] text-black hover:brightness-110 active:brightness-95 disabled:bg-[var(--toggle-bg)] disabled:text-[var(--text-faint)] disabled:cursor-not-allowed",
  secondary: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--toggle-bg)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed",
  ghost:     "bg-transparent text-[var(--text-muted)] hover:bg-[var(--toggle-bg)] hover:text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed",
  danger:    "bg-[var(--color-danger-dim)] text-[var(--color-danger)] border border-[var(--color-danger)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", iconOnly = false, loading, leadingIcon, children, className = "", disabled, ...rest },
  ref,
) {
  const s = SIZE[size];
  const padding = iconOnly ? "" : s.px;
  const square = iconOnly ? s.iconSquare : "";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center font-medium rounded-md transition-colors select-none",
        s.h, padding, square, s.gap, s.text,
        VARIANT[variant],
        className,
      ].filter(Boolean).join(" ")}
      style={{ transitionDuration: "var(--duration-fast)" }}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : leadingIcon}
      {children && <span className="truncate">{children}</span>}
    </button>
  );
});
