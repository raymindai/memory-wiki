"use client";

/**
 * Canonical Memory.Wiki logo component.
 * Two-tone wordmark — orange "Memory" + theme-primary ".Wiki".
 * Gray is intentionally NOT used in the wordmark (founder spec).
 *
 * Default split ("Memory.Wiki"):
 *   "Memory"   accent         (#fb923c dark / #ea580c light)
 *   ".Wiki"    text-primary   (#fafafa dark / #09090b light)
 *
 * Compact mobile collapses to "M.W" — same two-tone split:
 *   "M"    accent
 *   ".W"   text-primary
 */
export default function MemoryWikiLogo({
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
  const left = variant === "mdcore.ai" ? "md" : "Memory";
  const right = variant === "mdcore.ai" ? "core.ai" : ".Wiki";

  if (compact) {
    const baseStyle = { fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" as const };
    return (
      <>
        <span className="sm:hidden" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{variant === "mdcore.ai" ? "m" : "M"}</span>
          <span style={{ color: "var(--text-primary)" }}>{variant === "mdcore.ai" ? "d" : ".W"}</span>
        </span>
        <span className="hidden sm:inline" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{left}</span>
          <span style={{ color: "var(--text-primary)" }}>{right}</span>
        </span>
      </>
    );
  }

  return (
    <span
      style={{ fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" }}
      aria-label={variant}
    >
      <span style={{ color: "var(--accent)" }}>{left}</span>
      <span style={{ color: "var(--text-primary)" }}>{right}</span>
    </span>
  );
}
