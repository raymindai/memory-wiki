"use client";

import Link from "next/link";
import { ReactNode } from "react";

// Shared footer for the public viewers (/d/<id>, /b/<id>, /hub/<slug>).
// Three slots, left-to-right:
//   1) minimal nav links (About / Plugins / GitHub)
//   2) optional stats slot (e.g. word count, doc count) — viewer passes it in
//   3) "Make your own" CTA — primary, always present, drives the funnel
//
// Kept intentionally one row tall on desktop and wraps cleanly on mobile.
// No engine badges, no five-link clutter — that's the bug the doc viewer
// had before this consolidation.

interface ViewerFooterProps {
  stats?: ReactNode;
  /** Hide the "Make your own" CTA when the visitor is the owner. */
  hideCta?: boolean;
}

export default function ViewerFooter({ stats, hideCta = false }: ViewerFooterProps) {
  return (
    <footer
      className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 sm:px-5 py-2 text-caption font-mono"
      style={{
        borderTop: "1px solid var(--border-dim)",
        color: "var(--text-muted)",
        background: "var(--background)",
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <Link href="/about" className="transition-colors hover:text-[var(--text-primary)]">About</Link>
        <Link href="/install" className="transition-colors hover:text-[var(--text-primary)] hidden sm:inline">Install /memory.wiki</Link>
        <Link href="/plugins" className="transition-colors hover:text-[var(--text-primary)] hidden sm:inline">Plugins</Link>
        <a
          href="https://github.com/raymindai/mdcore"
          className="transition-colors hover:text-[var(--text-primary)] hidden md:inline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 ml-auto">
        {stats && (
          <div className="flex items-center gap-3 text-caption" style={{ color: "var(--text-faint)" }}>
            {stats}
          </div>
        )}
        {!hideCta && (
          <Link
            href="/"
            className="flex items-center px-2.5 h-6 rounded-md font-medium transition-transform hover:scale-[1.02]"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            Make your own
          </Link>
        )}
      </div>
    </footer>
  );
}
