"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe } from "lucide-react";

interface RelatedRow {
  id: string;
  title: string;
  sharedConcepts: string[];
  overlap: number;
  updated_at: string | null;
  isDraft: boolean;
  isRestricted: boolean;
  sharedWithCount: number;
}

interface Props {
  docId: string;
  /** Caller mode: "public" renders for anonymous visitors (the
   *  endpoint already gates by hub_public + doc visibility). "owner"
   *  is for the in-editor variant if we ever re-mount this. */
  mode?: "public" | "owner";
}

/**
 * The AI-era replacement for traditional [[wikilink]] backlinks.
 * Visual parity with RelatedDocsWidget (the in-editor variant) —
 * same compact card row, same mono chips, same hover affordance —
 * so the public viewer feels like one continuous surface with the
 * authoring side instead of a different product.
 *
 * Hidden when:
 *   - The endpoint returns 403 (this doc isn't in a public hub)
 *   - The endpoint returns 0 related docs
 *   - The endpoint errors (silent fallback — never blocks the
 *     reading flow)
 */
export default function RelatedInHubPanel({ docId, mode = "public" }: Props) {
  const [related, setRelated] = useState<RelatedRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/docs/${docId}/related?limit=5`, { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) { setRelated([]); setLoaded(true); }
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        setRelated((json.related || []) as RelatedRow[]);
        setLoaded(true);
      } catch {
        if (!cancelled) { setRelated([]); setLoaded(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [docId]);

  if (!loaded) return null;
  if (!related || related.length === 0) return null;

  return (
    <div
      className="mx-auto"
      style={{ maxWidth: 760, padding: "var(--space-4) var(--space-3) var(--space-6)" }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
        >
          {mode === "public" ? "Related in this hub" : "Related in your hub"}
        </span>
        <span className="text-caption" style={{ color: "var(--text-faint)" }}>
          {related.length} related
        </span>
      </div>
      <ul className="space-y-1">
        {related.map((r) => (
          <li key={r.id}>
            <Link
              href={`/${r.id}`}
              className="w-full text-left flex items-start gap-3 transition-colors group"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: 6,
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
            >
              <div className="shrink-0 mt-0.5">
                <Globe width={12} height={12} style={{ color: "var(--text-faint)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {r.title || "Untitled"}
                  </span>
                  <span className="text-caption shrink-0" style={{ color: "var(--text-faint)" }}>
                    ({r.overlap} shared)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.sharedConcepts.map((c) => (
                    <span
                      key={c}
                      className="text-caption font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--border)",
                        color: "var(--text-primary)",
                        fontSize: 10,
                      }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <ArrowUpRight
                width={12}
                height={12}
                className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-faint)" }}
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
