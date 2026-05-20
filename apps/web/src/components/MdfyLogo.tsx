"use client";

/**
 * Canonical memory.wiki logo component.
 * Renders inline SVG so CSS variables are respected for theming.
 * Source of truth: assets/brand/
 *
 * Colors (dark):  md=#fb923c  fy=#fafafa  .app=#737373
 * Colors (light): md=#ea580c  fy=#09090b  .app=#a1a1aa
 */
export default function MdfyLogo({
  size = 22,
  variant = "memory.wiki",
  compact = false,
}: {
  size?: number;
  variant?: "memory.wiki" | "mdcore.ai";
  /** When true, render only the orange "md" mark — useful in tight spots
   *  (app toolbar) where the full wordmark crowds the row. */
  compact?: boolean;
}) {
  const weight = 800;
  const letterSpacing = "-0.02em";
  const suffix = variant === "mdcore.ai" ? ".ai" : ".app";
  const middle = variant === "mdcore.ai" ? "core" : "fy";

  // Compact = "show only the md mark on mobile, full wordmark at
  // sm+". The two breakpoints render different colour pairings:
  // mobile splits the mark into m=accent + d=text-primary (the
  // founder's spec), desktop keeps the canonical md=accent /
  // fy=text-primary / .app=text-faint stripe. Easiest correct way
  // is to render both and let Tailwind hide whichever doesn't fit
  // the breakpoint.
  if (compact) {
    const baseStyle = { fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" as const };
    return (
      <>
        <span className="sm:hidden" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>m</span>
          <span style={{ color: "var(--text-primary)" }}>d</span>
        </span>
        <span className="hidden sm:inline" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>md</span>
          <span style={{ color: "var(--text-primary)" }}>{middle}</span>
          <span style={{ color: "var(--text-faint)" }}>{suffix}</span>
        </span>
      </>
    );
  }

  return (
    <span
      style={{ fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" }}
      aria-label={variant}
    >
      <span style={{ color: "var(--accent)" }}>md</span>
      <span style={{ color: "var(--text-primary)" }}>{middle}</span>
      <span style={{ color: "var(--text-faint)" }}>{suffix}</span>
    </span>
  );
}
