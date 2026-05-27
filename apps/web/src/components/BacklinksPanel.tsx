"use client";

import { useEffect, useState } from "react";
import { File as FileIcon, Layers, Globe, Link2 } from "lucide-react";
import type { ReferencedBy } from "@/lib/queryBacklinks";

/**
 * In-editor backlinks panel. Fetches owner-side backlinks for the
 * given target and renders them as a foldable section. Clicks open
 * the referenced entity as a new tab in the editor via the supplied
 * callbacks — staying inside the editor, not navigating away.
 */
export default function BacklinksPanel({
  type,
  id,
  authHeaders,
  onOpenDoc,
  onOpenBundle,
}: {
  type: "document" | "bundle" | "hub";
  id: string;
  authHeaders?: Record<string, string>;
  onOpenDoc?: (id: string) => void;
  onOpenBundle?: (id: string) => void;
}) {
  const [data, setData] = useState<ReferencedBy | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/backlinks/${type}/${encodeURIComponent(id)}`, {
      headers: { ...(authHeaders || {}) },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, id, authHeaders]);

  if (loading || !data || data.total === 0) return null;

  return (
    <section
      className="mt-8 mb-6 rounded-lg"
      style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-opacity hover:opacity-90"
        aria-expanded={!collapsed}
      >
        <Link2 width={13} height={13} style={{ color: "var(--text-muted)" }} />
        <span className="text-caption font-mono uppercase" style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>
          Referenced by
        </span>
        <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
          {data.total}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="ml-auto"
          style={{ color: "var(--text-faint)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {!collapsed && (
        <div className="px-2 pb-2">
          {data.documents.length > 0 && (
            <Group
              items={data.documents}
              icon={<FileIcon width={12} height={12} style={{ color: "var(--text-faint)" }} />}
              onClick={(itemId) => onOpenDoc?.(itemId)}
            />
          )}
          {data.bundles.length > 0 && (
            <Group
              items={data.bundles}
              icon={<Layers width={12} height={12} style={{ color: "var(--text-faint)" }} />}
              onClick={(itemId) => onOpenBundle?.(itemId)}
            />
          )}
          {data.hubs.length > 0 && (
            <Group
              items={data.hubs}
              icon={<Globe width={12} height={12} style={{ color: "var(--micro-lime)" }} />}
              onClick={() => { /* hub click is no-op inside editor */ }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Group({
  items,
  icon,
  onClick,
}: {
  items: Array<{ id: string; title: string | null; context: string | null }>;
  icon: React.ReactNode;
  onClick: (id: string) => void;
}) {
  return (
    <ul className="list-none p-0 m-0">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onClick(item.id)}
            className="w-full flex items-start gap-2 px-3 py-1.5 rounded-md text-left transition-colors hover:bg-[var(--toggle-bg)]"
            style={{ color: "var(--text-primary)" }}
          >
            <span className="mt-1 shrink-0">{icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-body truncate">{item.title || "Untitled"}</span>
              {item.context && (
                <span className="block text-caption truncate" style={{ color: "var(--text-faint)" }}>
                  {item.context}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
