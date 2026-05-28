"use client";

import Link from "next/link";
import { File as FileIcon, Layers, Globe } from "lucide-react";
import type { ReferencedBy } from "@/lib/queryBacklinks";

// Client component. Despite being just a list renderer, it carries
// onMouseEnter / onMouseLeave handlers for the row hover effect —
// passing those to <Link> (a Client component) from a Server
// component throws "Event handlers cannot be passed to Client
// Component props" in production. Marking this file 'use client'
// resolves that without changing visuals.
//
// Visual parity with RelatedInHubPanel: mono caption + count on the
// right, then boxed card rows with a leading kind-icon, bold title,
// and a snippet of the calling context as a single chip below.

interface Props {
  data: ReferencedBy;
  /** Show as a sidebar block (narrow) or inline section (wide). */
  variant?: "sidebar" | "inline";
}

type Row = {
  key: string;
  href: string;
  title: string;
  context: string | null;
  icon: React.ReactNode;
};

export default function ReferencedBy({ data, variant = "inline" }: Props) {
  if (data.total === 0) return null;

  const rows: Row[] = [
    ...data.documents.map((d) => ({
      key: `d:${d.id}`,
      href: `/d/${d.id}`,
      title: d.title || "Untitled",
      context: d.context,
      icon: <FileIcon width={12} height={12} style={{ color: "var(--text-faint)" }} />,
    })),
    ...data.bundles.map((b) => ({
      key: `b:${b.id}`,
      href: `/b/${b.id}`,
      title: b.title || "Untitled Bundle",
      context: b.context,
      icon: <Layers width={12} height={12} style={{ color: "var(--text-faint)" }} />,
    })),
    ...data.hubs.map((h) => ({
      key: `h:${h.id}`,
      href: `/@${h.id}`,
      title: h.title || h.id,
      context: h.context,
      icon: <Globe width={12} height={12} style={{ color: "var(--text-faint)" }} />,
    })),
  ];

  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: variant === "sidebar" ? undefined : 760,
        padding: variant === "sidebar" ? "var(--space-3) var(--space-3)" : "var(--space-4) var(--space-3) var(--space-6)",
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}
        >
          Referenced by
        </span>
        <span className="text-caption" style={{ color: "var(--text-faint)" }}>
          {data.total} {data.total === 1 ? "ref" : "refs"}
        </span>
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className="w-full text-left flex items-start gap-3 transition-colors group"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: 6,
                background: "var(--surface)",
                border: "1px solid var(--border-dim)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
            >
              <div className="shrink-0 mt-0.5">{r.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {r.title}
                  </span>
                </div>
                {r.context && (
                  <div className="flex flex-wrap gap-1">
                    <span
                      className="text-caption font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--border)",
                        color: "var(--text-primary)",
                        fontSize: 10,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.context}
                    >
                      {r.context}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
