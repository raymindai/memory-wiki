"use client";

// Related-docs widget rendered under the doc body.
//
// Calls /api/docs/[id]/related to find other docs in the user's
// hub that share concepts with the current one, then renders a
// compact card per match: title, count of shared concepts, and
// the labels themselves as small mono chips.
//
// Why a list (not a graph): at typical hub size (~20-100 docs)
// a graph is just a fancy list with extra cognitive load. The
// list is also LLM-readable — the user can copy URLs straight
// from this section into a chat to expand the citation.
//
// Owner-only and gated on cloudId. Non-cloud (sample) docs and
// other people's shared docs render nothing.

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import DocStatusIcon from "@/components/DocStatusIcon";

interface RelatedDoc {
  id: string;
  title: string;
  sharedConcepts: string[];
  overlap: number;
  isDraft?: boolean;
  isRestricted?: boolean;
  sharedWithCount?: number;
}

interface RelatedDocsResponse {
  related: RelatedDoc[];
}

// Module-level cache: stale-while-revalidate keyed by cloudId. The
// editor often re-mounts the widget when switching tabs; refetching
// every time wastes a round-trip and flickers an empty state in
// between. 60s TTL is plenty.
const cache = new Map<string, { data: RelatedDoc[]; ts: number }>();
const TTL_MS = 60_000;

interface Props {
  cloudId?: string | null;
  isOwner: boolean;
  onOpenDoc: (id: string) => void;
}

export default function RelatedDocsWidget({ cloudId, isOwner, onOpenDoc }: Props) {
  const [data, setData] = useState<RelatedDoc[] | null>(() => {
    if (!cloudId) return null;
    const cached = cache.get(cloudId);
    return cached && Date.now() - cached.ts < TTL_MS ? cached.data : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cloudId || !isOwner) { setData(null); return; }
    let cancelled = false;
    const cached = cache.get(cloudId);
    if (cached && Date.now() - cached.ts < TTL_MS) {
      setData(cached.data);
    } else {
      setLoading(true);
    }
    fetch(`/api/docs/${cloudId}/related`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: RelatedDocsResponse | null) => {
        if (cancelled) return;
        const list = j?.related ?? [];
        cache.set(cloudId, { data: list, ts: Date.now() });
        setData(list);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cloudId, isOwner]);

  if (!cloudId || !isOwner) return null;
  if (data === null && !loading) return null;
  if (data && data.length === 0) return null;

  return (
    <div className="mx-auto" style={{ maxWidth: 760, padding: "var(--space-4) var(--space-3) var(--space-6)" }}>
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
        >
          Related in your hub
        </span>
        {data && data.length > 0 && (
          <span className="text-caption" style={{ color: "var(--text-faint)" }}>
            {data.length} related
          </span>
        )}
      </div>
      {loading && data === null ? (
        <div className="text-caption" style={{ color: "var(--text-faint)", padding: "var(--space-2) var(--space-1)" }}>
          Looking for related docs…
        </div>
      ) : (
        <ul className="space-y-1">
          {(data || []).map((d) => (
            <li key={d.id}>
              <button
                onClick={() => onOpenDoc(d.id)}
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
                  <DocStatusIcon
                    tab={{
                      isDraft: d.isDraft,
                      isRestricted: d.isRestricted,
                      sharedWithCount: d.sharedWithCount,
                      cloudId: d.id,
                      permission: "mine",
                    }}
                    isActive={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {d.title}
                    </span>
                    <span className="text-caption shrink-0" style={{ color: "var(--text-faint)" }}>
                      ({d.overlap} shared)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {d.sharedConcepts.map((c) => (
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
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
