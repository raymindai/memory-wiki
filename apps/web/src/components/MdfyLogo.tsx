"use client";

/**
 * Canonical Memory.Wiki logo component.
 * Inline text wordmark — three coloured spans so CSS variables
 * carry theme switches.
 *
 * Default split ("Memory.Wiki"):
 *   prefix  "Mem"   accent           (#fb923c dark / #ea580c light)
 *   middle  "ory"   text-primary     (#fafafa dark / #09090b light)
 *   suffix  ".Wiki" text-faint       (#737373 dark / #a1a1aa light)
 *
 * Compact mobile collapses to the "M.W" mark so the toolbar
 * doesn't crowd on narrow viewports.
 */
export default function MdfyLogo({
  size = 22,
  variant = "Memory.Wiki",
  compact = false,
}: {
  size?: number;
  variant?: "Memory.Wiki" | "mdcore.ai";
  /** When true, render the "M.W" mark on mobile and the full
   *  wordmark on desktop. Useful in tight rows (app toolbar)
   *  where the full wordmark would crowd. */
  compact?: boolean;
}) {
  const weight = 800;
  const letterSpacing = "-0.02em";
  const prefix = variant === "mdcore.ai" ? "md" : "Mem";
  const middle = variant === "mdcore.ai" ? "core" : "ory";
  const suffix = variant === "mdcore.ai" ? ".ai" : ".Wiki";

  if (compact) {
    const baseStyle = { fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" as const };
    return (
      <>
        <span className="sm:hidden" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{variant === "mdcore.ai" ? "m" : "M"}</span>
          <span style={{ color: "var(--text-faint)" }}>.</span>
          <span style={{ color: "var(--text-primary)" }}>{variant === "mdcore.ai" ? "d" : "W"}</span>
        </span>
        <span className="hidden sm:inline" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{prefix}</span>
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
      <span style={{ color: "var(--accent)" }}>{prefix}</span>
      <span style={{ color: "var(--text-primary)" }}>{middle}</span>
      <span style={{ color: "var(--text-faint)" }}>{suffix}</span>
    </span>
  );
}
