import Link from "next/link";
import { File as FileIcon, Layers, Globe } from "lucide-react";
import type { ReferencedBy } from "@/lib/queryBacklinks";

// Server component. Renders the "Referenced by" section on viewer
// pages — auto-generated from the `backlinks` table populated by
// syncBacklinks() at write time. Pure data → markup, no client state.

interface Props {
  data: ReferencedBy;
  /** Show as a sidebar block (narrow) or inline section (wide). */
  variant?: "sidebar" | "inline";
}

export default function ReferencedBy({ data, variant = "inline" }: Props) {
  if (data.total === 0) return null;

  return (
    <section
      className={variant === "sidebar" ? "referenced-by referenced-by-sidebar" : "referenced-by"}
      style={{
        padding: variant === "sidebar" ? "14px 16px" : "20px 24px",
        borderTop: "1px solid var(--border-dim)",
        background: "var(--surface)",
        borderRadius: variant === "sidebar" ? 10 : 0,
      }}
    >
      <header
        style={{
          fontSize: 10.5,
          letterSpacing: "0.1em",
          color: "var(--text-muted)",
          marginBottom: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        REFERENCED BY · {data.total}
      </header>

      {data.documents.length > 0 && (
        <RefGroup
          icon={<FileIcon width={12} height={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
          items={data.documents}
          hrefFor={(id) => `/d/${id}`}
        />
      )}
      {data.bundles.length > 0 && (
        <RefGroup
          icon={<Layers width={12} height={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
          items={data.bundles}
          hrefFor={(id) => `/b/${id}`}
        />
      )}
      {data.hubs.length > 0 && (
        <RefGroup
          icon={<Globe width={12} height={12} style={{ color: "#22c55e", flexShrink: 0 }} />}
          items={data.hubs}
          hrefFor={(slug) => `/hub/${slug}`}
        />
      )}
    </section>
  );
}

function RefGroup({
  icon,
  items,
  hrefFor,
}: {
  icon: React.ReactNode;
  items: Array<{ id: string; title: string | null; context: string | null }>;
  hrefFor: (id: string) => string;
}) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={hrefFor(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 6,
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: 13,
              lineHeight: 1.3,
            }}
            className="transition-colors hover:bg-[var(--toggle-bg)]"
          >
            {icon}
            <span
              style={{
                flex: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {item.title || "Untitled"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
