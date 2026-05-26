"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

// Shared header for the public viewers (/d/<id>, /b/<id>, /hub/<slug>).
// Single source of truth for the chrome each viewer wears at the top:
// - sticky + backdrop blur (so the page scrolls under it)
// - Memory.Wiki logo on the left (always links to /)
// - title + optional subtitle, both truncated so long titles don't shove
//   the action buttons off the viewport
// - actions slot on the right — each viewer passes its viewer-specific
//   buttons (Copy / Theme / PDF / Edit / etc.). The slot stays small so
//   the header reads as one row on every viewport.
//
// Each viewer was previously rendering its own bespoke header with
// different padding, blur amounts, action heights, and breadcrumb
// styles. The doc viewer especially packed five separate buttons into
// the right side at slightly different heights — looked broken.

interface ViewerHeaderProps {
  /** Primary line — usually the doc / bundle title or "<author>'s hub". */
  title: ReactNode;
  /** Optional secondary line (one short string). Bundle uses this for
   *  the description; hub leaves it empty. Truncated. */
  subtitle?: ReactNode;
  /** Optional mono breadcrumb on the right side of the title slot
   *  (e.g. "memory.wiki/hub/yc-demo"). */
  breadcrumb?: ReactNode;
  /** Action buttons (Copy / Theme / Edit / etc.). Each viewer keeps its
   *  buttons compact (h-7, gap-1.5) so the right side stays one row. */
  actions?: ReactNode;
}

export default function ViewerHeader({ title, subtitle, breadcrumb, actions }: ViewerHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 shrink-0 flex items-center gap-3 px-4 sm:px-5 py-2.5"
      style={{
        borderBottom: "1px solid var(--border-dim)",
        background: "color-mix(in srgb, var(--background) 88%, transparent)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <Link href="/" className="shrink-0 flex items-center transition-opacity hover:opacity-80" aria-label="Memory.Wiki home">
        <MemoryWikiLogo size={18} withBlob />
      </Link>

      <div
        className="flex-1 min-w-0 flex items-center gap-2"
        style={{ borderLeft: "1px solid var(--border-dim)", paddingLeft: 12 }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="text-body font-semibold truncate"
            style={{ color: "var(--text-primary)", lineHeight: 1.2 }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              className="text-caption truncate"
              style={{ color: "var(--text-muted)", lineHeight: 1.3 }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {breadcrumb && (
          <span
            className="hidden sm:inline text-caption font-mono shrink-0"
            style={{ color: "var(--text-faint)" }}
          >
            {breadcrumb}
          </span>
        )}
      </div>

      {actions && (
        <div className="shrink-0 flex items-center gap-1.5">
          {actions}
        </div>
      )}
    </header>
  );
}
