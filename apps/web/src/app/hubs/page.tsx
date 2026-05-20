import type { Metadata } from "next";
import Link from "next/link";
import { File as FileIcon, Layers } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { extractCrossRefs, rankCitations } from "@/lib/cross-refs";
import MdfyLogo from "@/components/MdfyLogo";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Public hubs — memory.wiki",
  description: "Personal knowledge hubs published with memory.wiki. Each one is a single URL deployable to any AI.",
  alternates: { canonical: "https://memory.wiki/hubs" },
  openGraph: {
    title: "Public hubs — memory.wiki",
    description: "Personal knowledge hubs published with memory.wiki. One URL, deployable anywhere.",
    url: "https://memory.wiki/hubs",
    siteName: "memory.wiki",
    type: "website",
  },
};

interface HubRow {
  id: string;
  hub_slug: string;
  display_name: string | null;
  avatar_url: string | null;
  hub_description: string | null;
  doc_count: number;
  bundle_count: number;
}

interface ActivityRow {
  kind: "doc" | "bundle";
  id: string;
  title: string | null;
  url: string;
  updated_at: string;
  owner: { hub_slug: string; display_name: string | null };
}

interface CitedRow {
  kind: "doc" | "bundle";
  id: string;
  title: string;
  url: string;
  hub_slug: string | null;
  citation_count: number;
}

async function getMostCited(hubs: HubRow[]): Promise<CitedRow[]> {
  if (hubs.length === 0) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const userIds = hubs.map(h => h.id);

  const [{ data: docs }, { data: bundles }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, user_id, markdown")
      .in("user_id", userIds)
      .eq("is_draft", false)
      .is("deleted_at", null)
      .is("password_hash", null)
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase
      .from("bundles")
      .select("id, title, user_id, password_hash, allowed_emails")
      .in("user_id", userIds)
      .eq("is_draft", false),
  ]);
  const allDocs = docs || [];
  if (allDocs.length === 0) return [];
  const publicBundles = (bundles || []).filter(b =>
    !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0)
  );

  const knownDocIds = new Set(allDocs.map(d => d.id));
  const knownBundleIds = new Set(publicBundles.map(b => b.id));
  const knownHubSlugs = new Set(hubs.map(h => h.hub_slug));

  const totals = extractCrossRefs(allDocs, knownDocIds, knownBundleIds, knownHubSlugs);

  const docMeta = new Map(allDocs.map(d => [d.id, { title: d.title, user_id: d.user_id }]));
  const bundleMeta = new Map(publicBundles.map(b => [b.id, { title: b.title, user_id: b.user_id }]));
  const userToHub = new Map(hubs.map(h => [h.id, h.hub_slug]));

  const docs5 = rankCitations(totals.docCitations, 5).map<CitedRow>(r => {
    const m = docMeta.get(r.targetId);
    return {
      kind: "doc",
      id: r.targetId,
      title: m?.title || "Untitled",
      url: `/${r.targetId}`,
      hub_slug: m ? userToHub.get(m.user_id) || null : null,
      citation_count: r.citationCount,
    };
  });
  const bundles3 = rankCitations(totals.bundleCitations, 3).map<CitedRow>(r => {
    const m = bundleMeta.get(r.targetId);
    return {
      kind: "bundle",
      id: r.targetId,
      title: m?.title || "Untitled Bundle",
      url: `/b/${r.targetId}`,
      hub_slug: m ? userToHub.get(m.user_id) || null : null,
      citation_count: r.citationCount,
    };
  });
  return [...docs5, ...bundles3].sort((a, b) => b.citation_count - a.citation_count);
}

async function getActivityFeed(hubs: HubRow[]): Promise<ActivityRow[]> {
  if (hubs.length === 0) return [];
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const ownersById = new Map(hubs.map(h => [h.id, { hub_slug: h.hub_slug, display_name: h.display_name }]));
  const userIds = hubs.map(h => h.id);

  const [{ data: docs }, { data: bundles }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, updated_at, user_id")
      .in("user_id", userIds)
      .eq("is_draft", false)
      .is("deleted_at", null)
      .is("password_hash", null)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("bundles")
      .select("id, title, updated_at, user_id, password_hash, allowed_emails")
      .in("user_id", userIds)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const items: ActivityRow[] = [];
  for (const d of docs || []) {
    const owner = ownersById.get(d.user_id);
    if (!owner) continue;
    items.push({ kind: "doc", id: d.id, title: d.title, url: `/${d.id}`, updated_at: d.updated_at, owner });
  }
  for (const b of bundles || []) {
    if (b.password_hash) continue;
    if (Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0) continue;
    const owner = ownersById.get(b.user_id);
    if (!owner) continue;
    items.push({ kind: "bundle", id: b.id, title: b.title, url: `/b/${b.id}`, updated_at: b.updated_at, owner });
  }

  return items
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 12);
}

// Hubs we exclude from every public aggregation surface: the founder
// hub (raymindai) and the demo fixture (yc-demo). Both stay
// hub_public=true so their docs are still fetchable as raw markdown by
// AI agents — they just don't appear in the gallery / Recently Active /
// Most Cited as if they were community examples. memory.wiki's official
// content surfaces (dashboard EXPLORE, /shared bundles) point at this
// content directly via specific URLs, not via the gallery.
const RESERVED_HUB_SLUGS = new Set(["yc-demo", "raymindai"]);

async function getHubs(): Promise<HubRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, hub_slug, display_name, avatar_url, hub_description")
    .eq("hub_public", true)
    .not("hub_slug", "is", null)
    .limit(100);
  if (!profiles || profiles.length === 0) return [];
  // Apply reserved-slug filter early so all downstream lookups (counts,
  // activity feed, cited rollup) share the same exclusion set.
  const filteredProfiles = profiles.filter((p) => !RESERVED_HUB_SLUGS.has(p.hub_slug as string));
  if (filteredProfiles.length === 0) return [];

  const userIds = filteredProfiles.map(p => p.id);

  // Per-user public doc counts. Single query per user would explode; use
  // a single rpc-like query and aggregate in memory.
  const { data: docs } = await supabase
    .from("documents")
    .select("user_id")
    .in("user_id", userIds)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null);
  const docCount = new Map<string, number>();
  for (const d of docs || []) {
    docCount.set(d.user_id, (docCount.get(d.user_id) || 0) + 1);
  }

  const { data: bundles } = await supabase
    .from("bundles")
    .select("user_id, password_hash, allowed_emails")
    .in("user_id", userIds)
    .eq("is_draft", false);
  const bundleCount = new Map<string, number>();
  for (const b of bundles || []) {
    if (b.password_hash) continue;
    if (Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0) continue;
    bundleCount.set(b.user_id, (bundleCount.get(b.user_id) || 0) + 1);
  }

  return filteredProfiles
    .filter(p => p.hub_slug)
    .map(p => ({
      id: p.id,
      hub_slug: p.hub_slug as string,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      hub_description: p.hub_description,
      doc_count: docCount.get(p.id) || 0,
      bundle_count: bundleCount.get(p.id) || 0,
    }))
    // Sort by activity — most docs first, then alphabetically by slug
    .sort((a, b) => (b.doc_count + b.bundle_count) - (a.doc_count + a.bundle_count) || a.hub_slug.localeCompare(b.hub_slug));
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return min <= 1 ? "just now" : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function HubsPage() {
  const hubs = await getHubs();
  const [activity, mostCited] = await Promise.all([
    getActivityFeed(hubs),
    getMostCited(hubs),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <Link href="/" className="shrink-0"><MdfyLogo size={18} /></Link>
        <nav className="flex items-center gap-3 text-caption" style={{ color: "var(--text-muted)" }}>
          <Link href="/about" className="transition-colors hover:text-[var(--text-primary)]">About</Link>
          <Link href="/manifesto" className="transition-colors hover:text-[var(--text-primary)]">Manifesto</Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <div className="mb-10">
          <h1 className="text-display font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Public hubs
          </h1>
          <p className="text-body mt-3 leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Personal knowledge hubs published with memory.wiki. Each one is a single URL — paste it into Claude, ChatGPT, or Cursor, and the AI deploys the entire hub as context.
          </p>
        </div>

        {activity.length > 0 && (
          <section className="mb-10">
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="text-heading" style={{ color: "var(--accent)" }}>Recently active</h2>
              <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                across all public hubs
              </span>
            </header>
            <ul className="space-y-1">
              {activity.map(item => (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                >
                  <span
                    className="text-caption font-mono uppercase shrink-0"
                    style={{ color: item.kind === "bundle" ? "var(--accent)" : "var(--text-faint)" }}
                  >
                    {item.kind}
                  </span>
                  <Link
                    href={item.url}
                    className="flex-1 truncate text-body hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title || (item.kind === "bundle" ? "Untitled Bundle" : "Untitled")}
                  </Link>
                  <Link
                    href={`/hub/${item.owner.hub_slug}`}
                    className="text-caption font-mono shrink-0 hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    /hub/{item.owner.hub_slug}
                  </Link>
                  <span className="text-caption shrink-0 tabular-nums" style={{ color: "var(--text-faint)" }}>
                    {fmtAgo(item.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {mostCited.length > 0 && (
          <section className="mb-10">
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="text-heading" style={{ color: "var(--accent)" }}>Most cited</h2>
              <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                docs and bundles linked to from elsewhere on memory.wiki
              </span>
            </header>
            <ul className="space-y-1">
              {mostCited.map(item => (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                >
                  <span
                    className="text-caption font-mono uppercase shrink-0"
                    style={{ color: item.kind === "bundle" ? "var(--accent)" : "var(--text-faint)" }}
                  >
                    {item.kind}
                  </span>
                  <Link
                    href={item.url}
                    className="flex-1 truncate text-body hover:underline"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.title}
                  </Link>
                  {item.hub_slug && (
                    <Link
                      href={`/hub/${item.hub_slug}`}
                      className="text-caption font-mono shrink-0 hover:underline"
                      style={{ color: "var(--text-muted)" }}
                    >
                      /hub/{item.hub_slug}
                    </Link>
                  )}
                  <span
                    className="text-caption shrink-0 tabular-nums px-2 rounded"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                  >
                    ×{item.citation_count}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hubs.length === 0 ? (
          <div className="py-16 text-center" style={{ color: "var(--text-faint)" }}>
            <p className="text-body mb-2">No public hubs yet.</p>
            <p className="text-caption">
              <Link href="/settings" className="underline" style={{ color: "var(--accent)" }}>
                Be the first → enable yours from Settings
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {hubs.map(h => (
              <Link
                key={h.id}
                href={`/hub/${h.hub_slug}`}
                className="flex gap-3 p-4 rounded-lg transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
              >
                {h.avatar_url ? (
                  <img
                    src={h.avatar_url}
                    alt=""
                    className="w-12 h-12 rounded-full shrink-0"
                    style={{ border: "1px solid var(--border-dim)" }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-semibold"
                    style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--border-dim)" }}
                  >
                    {(h.display_name || h.hub_slug)[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {h.display_name || h.hub_slug}
                  </div>
                  <div className="text-caption font-mono mb-1.5" style={{ color: "var(--text-faint)" }}>
                    /hub/{h.hub_slug}
                  </div>
                  {h.hub_description && (
                    <p className="text-caption leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {h.hub_description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                    <span className="flex items-center gap-1"><FileIcon width={10} height={10} aria-hidden />{h.doc_count} {h.doc_count === 1 ? "doc" : "docs"}</span>
                    {h.bundle_count > 0 && (
                      <span className="flex items-center gap-1"><Layers width={10} height={10} aria-hidden />{h.bundle_count} {h.bundle_count === 1 ? "bundle" : "bundles"}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <footer className="mt-16 pt-6 text-caption flex items-center justify-between" style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-dim)" }}>
          <span>
            Want yours listed? <Link href="/settings" style={{ color: "var(--accent)" }}>Enable from Settings →</Link>
          </span>
          <span>memory.wiki</span>
        </footer>
      </main>
    </div>
  );
}
