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
  withBlob = false,
}: {
  size?: number;
  variant?: "Memory.Wiki" | "mdcore.ai";
  /** When true, render the "M.W" mark on mobile and the full
   *  wordmark on desktop. Useful in tight rows (app toolbar)
   *  where the full wordmark would crowd. */
  compact?: boolean;
  /** When true, prepend the animated MW blob mark in front of the
   *  wordmark — the "full" logo lock-up (blob + wordmark together).
   *  The blob swaps light/dark variants automatically via the
   *  `data-theme` attribute on `<html>`. */
  withBlob?: boolean;
}) {
  const weight = 800;
  const letterSpacing = "-0.02em";
  const left = variant === "mdcore.ai" ? "md" : "Memory";
  const right = variant === "mdcore.ai" ? "core.ai" : ".Wiki";

  // Blob mark sized relative to wordmark — slightly taller so the curve
  // sits on the cap-height of the wordmark without dominating it.
  const blobSize = Math.round(size * 1.35);
  const blob = withBlob && variant === "Memory.Wiki" ? (
    <span
      aria-hidden
      className="mw-logo-blob"
      style={{ width: blobSize, height: blobSize, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <img src="/brand/mwblob_morph.svg" alt="" className="mw-logo-blob-darktheme" style={{ width: "100%", height: "100%", display: "block" }} />
      <img src="/brand/mwblob_morph_dark.svg" alt="" className="mw-logo-blob-lighttheme" style={{ width: "100%", height: "100%", display: "block" }} />
    </span>
  ) : null;

  if (compact) {
    const baseStyle = { fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" as const };
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: withBlob ? 8 : 0 }}>
        {blob}
        <span className="sm:hidden" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{variant === "mdcore.ai" ? "m" : "M"}</span>
          <span style={{ color: "var(--text-primary)" }}>{variant === "mdcore.ai" ? "d" : ".W"}</span>
        </span>
        <span className="hidden sm:inline" style={baseStyle} aria-label={variant}>
          <span style={{ color: "var(--accent)" }}>{left}</span>
          <span style={{ color: "var(--text-primary)" }}>{right}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: withBlob ? 8 : 0 }}
      aria-label={variant}
    >
      {blob}
      <span style={{ fontSize: size, fontWeight: weight, letterSpacing, whiteSpace: "nowrap" }}>
        <span style={{ color: "var(--accent)" }}>{left}</span>
        <span style={{ color: "var(--text-primary)" }}>{right}</span>
      </span>
    </span>
  );
}
