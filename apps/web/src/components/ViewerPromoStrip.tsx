"use client";

import Link from "next/link";

// Sits between the viewer content and the footer. The v6 thesis in one
// line plus three concrete actions — Browse hubs, Install /memory.wiki, Start
// your hub. Owners see a short, less aggressive variant; everyone else
// gets the full pitch.
//
// Designed to feel like a section break in the document, not a banner
// ad. Same surface tone as the rest of the page, just flanked by
// horizontal rules and a one-line headline.

interface ViewerPromoStripProps {
  /** When true, the visitor owns the resource — show a lighter variant
   *  with a single action that points back to their workspace. */
  isOwner?: boolean;
}

export default function ViewerPromoStrip({ isOwner = false }: ViewerPromoStripProps) {
  if (isOwner) {
    return (
      <section
        className="shrink-0 px-4 sm:px-6 py-5 text-center"
        style={{
          borderTop: "1px solid var(--border-dim)",
          color: "var(--text-muted)",
          background: "var(--background)",
        }}
      >
        <p className="text-caption" style={{ color: "var(--text-faint)" }}>
          Open your workspace to capture more, build bundles, and share your hub.{" "}
          <Link
            href="/"
            className="font-medium"
            style={{ color: "var(--accent)" }}
          >
            Go to Memory.Wiki →
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section
      className="shrink-0 px-4 sm:px-8 py-8"
      style={{
        // Slightly lifted surface so the promo band visually separates from
        // the doc / hub / bundle content above. var(--surface) is the same
        // shade the dashboard cards sit on; here it does the section-break job.
        background: "var(--surface)",
        borderTop: "1px solid var(--border-dim)",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <p
          className="text-xs uppercase tracking-widest mb-2 font-mono"
          style={{ color: "var(--accent)" }}
        >
          Personal knowledge hub for the AI era
        </p>
        <h2
          className="text-lg sm:text-xl font-semibold tracking-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Make your own.
        </h2>
        <p
          className="text-caption mb-5"
          style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
        >
          Capture from any AI tool. Bundles roll up by topic. Paste your hub URL into Claude, ChatGPT, or Cursor — they read it as your full personal context.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
            style={{
              background: "var(--accent)",
              color: "#000",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            <span className="flex-1">Start your hub</span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l5 5-5 5" />
            </svg>
          </Link>
          <Link
            href="/install"
            className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <span className="flex-1 font-medium">Install /memory.wiki</span>
            <span className="text-caption" style={{ color: "var(--text-faint)" }}>any AI tool</span>
          </Link>
          <Link
            href="/hubs"
            className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-dim)",
              color: "var(--text-primary)",
              fontSize: 13,
            }}
          >
            <span className="flex-1 font-medium">Browse hubs</span>
            <span className="text-caption" style={{ color: "var(--text-faint)" }}>see examples</span>
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <Link
            href="/how-mdfy-works"
            className="text-caption"
            style={{ color: "var(--text-faint)" }}
          >
            How Memory.Wiki works &rarr;
          </Link>
          <Link
            href="/mdfy-memory"
            className="text-caption"
            style={{ color: "var(--text-faint)" }}
          >
            How Memory.Wiki Memory works &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
