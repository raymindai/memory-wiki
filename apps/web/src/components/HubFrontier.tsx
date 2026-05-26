"use client";

// Hub Frontier — Layer 3 of the "growing knowledge hub" surface. Three
// columns of next-action prompts: concepts newly growing, AI-suggested
// bundles waiting for the user's nod, and gap detection (concepts the
// user keeps referencing but never wrote a doc on).
//
// All three pull existing tables (concept_index, hub_suggestions,
// documents). No new schema. See claude memory note
// `start_growing_hub_concept_2026_05` for full design rationale.

import { useEffect, useState } from "react";
import Link from "next/link";

interface NewConcept {
  id: number;
  label: string;
  type: string;
  description: string | null;
  occurrence: number;
  docCount: number;
  createdAt: string;
}

interface BundleHint {
  id: number;
  type: string;
  title: string;
  reason: string | null;
  docCount: number;
}

interface Gap {
  label: string;
  occurrence: number;
  docCount: number;
}

interface FrontierData {
  newConcepts: NewConcept[];
  bundleHints: BundleHint[];
  gaps: Gap[];
}

interface Props {
  authHeaders: Record<string, string>;
}

export default function HubFrontier({ authHeaders }: Props) {
  const [data, setData] = useState<FrontierData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/hub/frontier", { headers: authHeaders });
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const json = (await res.json()) as FrontierData;
        if (cancelled) return;
        setData(json);
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;
  if (!data) return null;

  // If nothing to surface in any column, render nothing — better than
  // an empty 3-column panel screaming "nothing to do."
  const hasAny =
    data.newConcepts.length > 0 || data.bundleHints.length > 0 || data.gaps.length > 0;
  if (!hasAny) return null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-dim)",
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div className="flex items-baseline gap-3 mb-3">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
        >
          Frontier
        </span>
        <span className="text-caption" style={{ color: "var(--text-faint)" }}>
          Where your hub is growing
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {/* New concepts */}
        {data.newConcepts.length > 0 && (
          <div>
            <h4
              className="text-caption mb-2"
              style={{
                color: "var(--text-secondary)",
                fontWeight: 600,
                margin: 0,
              }}
            >
              New this week
            </h4>
            <ul className="space-y-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.newConcepts.slice(0, 5).map((c) => (
                <li key={c.id} className="text-caption" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-primary)" }}>{c.label}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {" "}({c.docCount} {c.docCount === 1 ? "doc" : "docs"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Bundle hints */}
        {data.bundleHints.length > 0 && (
          <div>
            <h4
              className="text-caption mb-2"
              style={{ color: "var(--text-secondary)", fontWeight: 600, margin: 0 }}
            >
              Bundle suggestions
            </h4>
            <ul className="space-y-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.bundleHints.map((h) => (
                <li key={h.id} className="text-caption" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-primary)" }}>{h.title}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {" "}({h.docCount} {h.docCount === 1 ? "doc" : "docs"})
                  </span>
                  {h.reason && (
                    <div style={{ color: "var(--text-faint)", fontSize: 11, marginTop: 2 }}>
                      {h.reason}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Gaps */}
        {data.gaps.length > 0 && (
          <div>
            <h4
              className="text-caption mb-2"
              style={{ color: "var(--text-secondary)", fontWeight: 600, margin: 0 }}
            >
              Gaps worth filling
            </h4>
            <p className="text-caption mb-2" style={{ color: "var(--text-faint)", fontSize: 11 }}>
              Mentioned a lot, no dedicated doc yet
            </p>
            <ul className="space-y-1.5" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.gaps.map((g) => (
                <li key={g.label} className="text-caption" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--text-primary)" }}>{g.label}</span>
                  <span style={{ color: "var(--text-faint)" }}>
                    {" "}(in {g.docCount} {g.docCount === 1 ? "doc" : "docs"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {data.bundleHints.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-dim)" }}>
          <Link
            href="/hubs"
            className="text-caption"
            style={{ color: "var(--text-primary)", textDecoration: "none" }}
          >
            Review all suggestions in /hubs →
          </Link>
        </div>
      )}
    </div>
  );
}
