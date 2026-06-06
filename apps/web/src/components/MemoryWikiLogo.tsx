"use client";

/**
 * Canonical memory.wiki logo.
 *
 * Renders the brand v2 monochrome mark + wordmark on a SINGLE
 * horizontal line. The full v2 SVG lockup (logo-full-*.svg) is
 * STACKED (memory / .wiki on two rows) by design — that shape fits
 * the marketing nav but not the editor / viewer header strip, so we
 * render the lockup ourselves: SVG icon + Cal Sans wordmark next to
 * it. Theme-swapped via the .mw-logo-{dark,light}theme rules in
 * globals.css.
 *
 * Variants:
 *   - "full"      (default) → icon + wordmark inline
 *   - "text-only"           → wordmark only
 *   - "icon-only"           → SVG mark alone
 *
 * `size` is the rendered HEIGHT in px (icon SVG height + wordmark
 * font-size). Width auto-derives.
 */

export type MemoryWikiLogoVariant = "full" | "text-only" | "icon-only";

export default function MemoryWikiLogo({
  size = 22,
  variant = "full",
  // Back-compat with the previous component:
  //   withBlob === false  ⇒  text-only
  //   withBlob === true   ⇒  full
  // New callers should set `variant` directly.
  withBlob,
}: {
  size?: number;
  variant?: MemoryWikiLogoVariant;
  withBlob?: boolean;
}) {
  const resolved: MemoryWikiLogoVariant =
    withBlob === false ? "text-only"
    : withBlob === true ? "full"
    : variant;

  // Uniform wordmark weight 500 (max weight rule across the app).
  // Symbol scales relative to cap-height: 1.55x in small/mid lockups
  // so the mark dominates the wordmark, 1.25x in large lockups so
  // the wordmark gets more visual presence in headline contexts.
  const isCompact = size <= 30;
  const wordmarkWeight = 500;
  const iconScale = isCompact ? 1.55 : 1.25;
  const iconSize = Math.round(size * iconScale);

  // The symbol is ALWAYS the animated morph blob — same asset the
  // marketing nav uses — so the brand mark feels alive everywhere
  // (editor header, loaders, viewer chrome). File naming convention:
  //   mwblob_morph.svg       = white blob → use on dark theme
  //   mwblob_morph_dark.svg  = dark blob  → use on light theme
  // (The "_dark" suffix is the historical name for the dark-on-light
  // variant, not the dark-theme asset.)
  // .mw-logo-blob in globals.css does the theme swap + positions both
  // imgs absolute inside the span; both imgs share the span's size.
  const Icon = (
    <span
      className="mw-logo-blob"
      aria-hidden
      style={{ display: "inline-block", width: iconSize, height: iconSize, flexShrink: 0 }}
    >
      <img
        src="/brand/mwblob_morph.svg"
        alt=""
        className="mw-logo-blob-darktheme"
        draggable={false}
      />
      <img
        src="/brand/mwblob_morph_dark.svg"
        alt=""
        className="mw-logo-blob-lighttheme"
        draggable={false}
      />
    </span>
  );

  const Wordmark = (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: wordmarkWeight,
        letterSpacing: 0,
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: "var(--text-primary)",
      }}
    >
      memory.wiki
    </span>
  );

  if (resolved === "icon-only") {
    return (
      <span className="mw-logo" style={{ display: "inline-block", lineHeight: 0 }} aria-label="memory.wiki">
        {Icon}
      </span>
    );
  }
  if (resolved === "text-only") {
    return (
      <span className="mw-logo" aria-label="memory.wiki">
        {Wordmark}
      </span>
    );
  }
  // "full" — icon + wordmark on one line
  return (
    <span
      className="mw-logo"
      style={{
        display: "inline-flex",
        alignItems: "center",
        // Gap scales with size so the lockup keeps its visual rhythm
        // whether the logo is 14 (mobile) or 32 (auth pages) tall.
        gap: Math.max(6, Math.round(size * 0.35)),
        lineHeight: 1,
      }}
      aria-label="memory.wiki"
    >
      {Icon}
      {Wordmark}
    </span>
  );
}
