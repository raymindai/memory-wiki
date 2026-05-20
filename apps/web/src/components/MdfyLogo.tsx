"use client";

/**
 * Canonical memory.wiki logo component.
 * Inline text wordmark — three coloured spans so CSS variables
 * carry theme switches.
 *
 * Default split ("memory.wiki"):
 *   prefix  "mem"   accent           (#fb923c dark / #ea580c light)
 *   middle  "ory"   text-primary     (#fafafa dark / #09090b light)
 *   suffix  ".wiki" text-faint       (#737373 dark / #a1a1aa light)
 *
 * Compact mobile collapses the wordmark to the two-letter "mw" mark
 * so the toolbar doesn't crowd on narrow viewports.
 */
export default function MdfyLogo({
  size = 22,
  variant = "memory.wiki",
  compact = false,
}: {
  size?: number;
  variant?: "memory.wiki" | "mdcore.ai";
  /** When true, render only the two-letter "mw" mark on mobile and
   *  the full wordmark on desktop. Useful in tight rows (app
   *  toolbar) where the full wordmark would crowd. */
  compact?: boolean;
}) {
  const weight = 800;
  const letterSpacing = "-0.02em";
  const prefix = variant === "mdcore.ai" ? "md" : "mem";
  const middle = variant === "mdcore.ai" ? "core" : "ory";
  const suffix = variant === "mdcore.ai" ? ".ai" : ".wiki";

  if (compact) {
    const baseStyle = { fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" as const };
    const compactPrefix = variant === "mdcore.ai" ? "m" : "m";
    const compactSecond = variant === "mdcore.ai" ? "d" : "w";
    return (
      <>
        <span className="sm:hidden" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{compactPrefix}</span>
          <span style={{ color: "var(--text-primary)" }}>{compactSecond}</span>
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
