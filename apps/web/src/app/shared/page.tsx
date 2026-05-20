import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";

export const metadata: Metadata = {
  title: "Shared bundles — Memory.Wiki",
  description:
    "Bundles other people on Memory.Wiki chose to share publicly. Each one is a curated set of documents you can paste into any AI as context.",
  alternates: { canonical: "https://memory.wiki/shared" },
};

interface DiscoverableBundle {
  id: string;
  title: string | null;
  description: string | null;
  updated_at: string;
  user_id: string;
  document_count: number;
  owner: {
    hub_slug: string | null;
    display_name: string | null;
  };
}

async function getDiscoverableBundles(): Promise<DiscoverableBundle[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data: rows } = await supabase
    .from("bundles")
    .select("id, title, description, updated_at, allowed_emails, password_hash, user_id")
    .eq("is_discoverable", true)
    .eq("is_draft", false)
    .is("password_hash", null)
    .order("updated_at", { ascending: false })
    .limit(60);

  const filtered = (rows || []).filter(b =>
    !Array.isArray(b.allowed_emails) || b.allowed_emails.length === 0
  );
  if (filtered.length === 0) return [];

  const ids = filtered.map(b => b.id);
  const userIds = Array.from(new Set(filtered.map(b => b.user_id)));

  const [{ data: counts }, { data: profiles }] = await Promise.all([
    supabase.from("bundle_documents").select("bundle_id").in("bundle_id", ids),
    supabase.from("profiles").select("id, hub_slug, display_name, hub_public").in("id", userIds),
  ]);

  const countByBundle = new Map<string, number>();
  for (const row of counts || []) {
    countByBundle.set(row.bundle_id, (countByBundle.get(row.bundle_id) || 0) + 1);
  }
  const profileById = new Map(
    (profiles || []).map(p => [p.id, {
      hub_slug: p.hub_public ? p.hub_slug : null,
      display_name: p.display_name,
    }])
  );

  return filtered.map(b => ({
    id: b.id,
    title: b.title,
    description: b.description,
    updated_at: b.updated_at,
    user_id: b.user_id,
    document_count: countByBundle.get(b.id) || 0,
    owner: profileById.get(b.user_id) || { hub_slug: null, display_name: null },
  }));
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function SharedBundlesPage() {
  const bundles = await getDiscoverableBundles();

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <header
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between"
        style={{
          borderBottom: "1px solid var(--border-dim)",
          background: "color-mix(in srgb, var(--background) 85%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <MemoryWikiLogo size={18} />
        </Link>
        <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>
          memory.wiki/<span style={{ color: "var(--accent)" }}>shared</span>
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <section className="mb-10">
          <p
            className="text-xs uppercase tracking-wider mb-3"
            style={{ color: "var(--accent)" }}
          >
            Bundles
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Shared by people on Memory.Wiki
          </h1>
          <p
            className="text-body"
            style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}
          >
            Curated sets of documents that owners chose to list publicly. Paste any bundle URL into Claude, ChatGPT, or Cursor and the AI reads the whole context at once.
          </p>
        </section>

        {bundles.length === 0 && (
          <div
            className="py-16 text-center rounded-xl"
            style={{ color: "var(--text-faint)", border: "1px dashed var(--border-dim)" }}
          >
            <p>No public bundles yet.</p>
            <p className="text-caption mt-2">
              Owners can list a bundle here from its share menu.
            </p>
          </div>
        )}

        {bundles.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-3">
            {bundles.map(b => {
              const ownerLabel = b.owner.display_name || b.owner.hub_slug || "anonymous";
              const ownerHref = b.owner.hub_slug ? `/hub/${b.owner.hub_slug}` : null;
              return (
                <li key={b.id}>
                  <Link
                    href={`/b/${b.id}`}
                    className="flex flex-col gap-2 p-4 rounded-lg transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                  >
                    <span className="text-body font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {b.title || "Untitled Bundle"}
                    </span>
                    {b.description ? (
                      <span className="text-caption leading-relaxed line-clamp-2" style={{ color: "var(--text-muted)" }}>
                        {b.description}
                      </span>
                    ) : null}
                    <div
                      className="flex items-center gap-3 mt-1 text-caption"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <span>{b.document_count} {b.document_count === 1 ? "doc" : "docs"}</span>
                      <span aria-hidden>—</span>
                      <span>by {ownerLabel}</span>
                      <span aria-hidden>—</span>
                      <span>{fmtRelative(b.updated_at)}</span>
                    </div>
                  </Link>
                  {ownerHref && (
                    <Link
                      href={ownerHref}
                      className="block mt-1 ml-1 text-caption underline"
                      style={{ color: "var(--text-faint)" }}
                    >
                      → {ownerLabel}&apos;s hub
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <footer
          className="mt-16 pt-6 text-caption flex items-center justify-between"
          style={{ borderTop: "1px solid var(--border-dim)", color: "var(--text-faint)" }}
        >
          <span>
            Hosted on <Link href="/" style={{ color: "var(--accent)" }}>Memory.Wiki</Link>
          </span>
          <span>Owners control whether their bundle appears here.</span>
        </footer>
      </main>
    </div>
  );
}
