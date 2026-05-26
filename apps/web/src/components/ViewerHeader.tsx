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
  /** When true, the header carries a hard bottom border instead of
   *  the soft mask-fade. Bundle viewer uses this — the canvas + doc
   *  split below needs a clean horizontal hairline to anchor the
   *  fixed-height pane underneath. */
  bordered?: boolean;
}

export default function ViewerHeader({ title, subtitle, breadcrumb, actions, bordered = false }: ViewerHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 shrink-0 flex items-center gap-3 px-4 sm:px-5 py-3 mw-viewer-header"
      data-bordered={bordered ? "true" : undefined}
      style={{
        // Bordered variant (bundle viewer) needs a SOLID bg so the
        // canvas + doc split underneath doesn't bleed through the
        // sticky header on scroll. Default variant stays transparent
        // because the glass ::before layer below provides the
        // backdrop.
        background: bordered ? "var(--canvas)" : "transparent",
        borderBottom: bordered ? "1px solid var(--border-dim)" : undefined,
      }}
    >
      <Link href="/" className="shrink-0 flex items-center transition-opacity hover:opacity-80" aria-label="Memory.Wiki home">
        <MemoryWikiLogo size={18} withBlob />
      </Link>

      <div className="flex-1 min-w-0 flex items-center gap-2 pl-3">
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ color: "var(--text-primary)", lineHeight: 1.2, fontSize: 14, fontWeight: 500 }}
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
