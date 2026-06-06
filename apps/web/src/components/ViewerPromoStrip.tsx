"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// Sits between the viewer content and the footer. Pure section break:
// canvas background, mono eyebrow, display title, lede, two pill
// buttons (primary ink-filled + secondary soft chip), quiet footnote.
// Owners see a single one-liner. Follows the user's theme via canvas
// tokens — no forced data-frontier-theme any more.

interface ViewerPromoStripProps {
  isOwner?: boolean;
}

export default function ViewerPromoStrip({ isOwner = false }: ViewerPromoStripProps) {
  if (isOwner) {
    return (
      <section
        className="px-6 py-6 flex flex-wrap items-center justify-between gap-3"
        style={{
          background: "var(--canvas)",
          borderTop: "1px solid var(--border-dim)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: "0.04em",
        }}
      >
        <span>
          Open your workspace to capture more, build bundles, and share your hub.
        </span>
        <Link
          href="/"
          className="inline-flex items-center gap-1 transition-colors hover:underline"
          style={{ color: "var(--text-primary)" }}
        >
          Go to memory.wiki
        </Link>
      </section>
    );
  }

  return (
    <section
      className="px-6 py-16 relative overflow-hidden"
      style={{
        background: "var(--canvas)",
        borderTop: "1px solid var(--border-dim)",
      }}
    >
      {/* Animated MW-blob — mirrors the /about CTA band pattern
          (.pure-cta-band-blob): 600x600 fixed, anchored 140px past
          the right edge, rotated 14deg, blur 8px, opacity 0.05
          dark / 0.08 light. Same shape on every viewer. */}
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}
      >
        <img
          src="/brand/mwblob_morph.svg"
          alt=""
          draggable={false}
          className="mw-logo-darktheme"
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            right: -140,
            top: "50%",
            transform: "translateY(-50%) rotate(14deg)",
            opacity: 0.025,
            filter: "blur(10px)",
          }}
        />
        <img
          src="/brand/mwblob_morph_dark.svg"
          alt=""
          draggable={false}
          className="mw-logo-lighttheme"
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            right: -140,
            top: "50%",
            transform: "translateY(-50%) rotate(14deg)",
            opacity: 0.045,
            filter: "blur(10px)",
          }}
        />
      </div>
      <div className="max-w-2xl mx-auto mw-start-backdrop-content">
        <div
          className="mb-4"
          style={{
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Personal knowledge hub for the AI era
        </div>
        <h2
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 500,
            letterSpacing: 0,
            lineHeight: 1.15,
            margin: "0 0 16px",
          }}
        >
          Make your own.
        </h2>
        <p
          className="mb-8"
          style={{
            color: "var(--text-secondary)",
            fontSize: 15,
            lineHeight: 1.6,
            maxWidth: 560,
          }}
        >
          Capture from any AI tool. Bundles roll up by topic. Paste your hub URL into Claude, ChatGPT, or Cursor, and they read it as your full personal context.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Primary CTA — ink-filled pure pill. */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full transition-opacity hover:opacity-90"
            style={{
              background: "var(--text-primary)",
              color: "var(--background)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {/* Brand symbol, INVERTED — the button is ink-filled, so
                we need the OPPOSITE blob from what the current theme
                normally shows. On dark theme the button is white →
                use the dark blob; on light theme the button is dark
                → use the white blob. `mw-logo-darktheme` /
                `mw-logo-lighttheme` are the existing theme-swap
                classes in globals.css, just paired against flipped
                assets here. */}
            <span
              aria-hidden
              style={{ position: "relative", display: "inline-block", width: 16, height: 16, flexShrink: 0, lineHeight: 0 }}
            >
              <img
                src="/brand/mwblob_morph_dark.svg"
                alt=""
                draggable={false}
                className="mw-logo-darktheme"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
              <img
                src="/brand/mwblob_morph.svg"
                alt=""
                draggable={false}
                className="mw-logo-lighttheme"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </span>
            <span>Start your hub</span>
          </Link>
          {/* Secondary — soft chip. */}
          <Link
            href="/install"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-colors hover:bg-[var(--border-dim)]"
            style={{
              background: "var(--toggle-bg)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.02em",
            }}
          >
            Install /memory.wiki
          </Link>
        </div>

        <Link
          href="/how-memorywiki-works"
          className="inline-flex items-center gap-1 transition-colors hover:underline"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.04em",
          }}
        >
          How memory.wiki works
          <ArrowUpRight size={11} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
