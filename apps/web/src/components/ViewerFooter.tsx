"use client";

import Link from "next/link";
import { ReactNode } from "react";

// Shared footer for the public viewers (/d/<id>, /b/<id>, /hub/<slug>).
// Quiet chrome row — minimal nav links + optional stats. The marketing
// CTA ("Make your own", "Install /memory.wiki") lives in ViewerPromoStrip
// directly above the footer; duplicating them here was confusing visitors.

interface ViewerFooterProps {
  stats?: ReactNode;
  /** Accepted for API compatibility — the CTA was removed from this row
   *  since the PromoStrip above carries it. */
  hideCta?: boolean;
}

export default function ViewerFooter({ stats }: ViewerFooterProps) {
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
          href="https://github.com/raymindai/memory-wiki"
          className="transition-colors hover:text-[var(--text-primary)] hidden md:inline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>

      {stats && (
        <div className="flex items-center gap-3 text-caption ml-auto" style={{ color: "var(--text-faint)" }}>
          {stats}
        </div>
      )}
    </footer>
  );
}
