import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import ViewerFooter from "@/components/ViewerFooter";
import ViewerPromoStrip from "@/components/ViewerPromoStrip";
import ViewerHeader from "@/components/ViewerHeader";
import HubViewerV8 from "./HubViewerV8";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ at?: string }>;
};

interface HubData {
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    hub_slug: string;
    hub_description: string | null;
  };
  docs: Array<{ id: string; title: string | null; markdown: string; updated_at: string; created_at: string }>;
  bundles: Array<{ id: string; title: string | null; description: string | null; updated_at: string; created_at: string }>;
}

function parseAt(raw: string | undefined): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999Z` : trimmed);
  if (isNaN(date.getTime())) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

async function getHub(slug: string, at: Date | null): Promise<HubData | null> {
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) return null;

  // Match the sidebar's resolveAvatar fallback chain (profile →
  // OAuth metadata → dicebear) so the hub page never shows a
  // different face than the in-app sidebar for the same person.
  let resolvedAvatar = profile.avatar_url || null;
  let ownerEmail: string | null = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    ownerEmail = authUser?.user?.email || null;
    if (!resolvedAvatar) {
      const meta = (authUser?.user?.user_metadata as { avatar_url?: string } | undefined) || {};
      if (meta.avatar_url) resolvedAvatar = meta.avatar_url;
    }
  } catch { /* admin lookup unavailable */ }
  if (!resolvedAvatar) {
    const seed = encodeURIComponent(ownerEmail || profile.hub_slug || "user");
    resolvedAvatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
  }

  const atIso = at ? at.toISOString() : null;

  let docsQuery = supabase
    .from("documents")
    .select("id, title, markdown, updated_at, created_at")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null);
  if (atIso) docsQuery = docsQuery.lte("created_at", atIso);
  const { data: docs } = await docsQuery
    .order("updated_at", { ascending: false })
    .limit(200);

  let bundlesQuery = supabase
    .from("bundles")
    .select("id, title, description, updated_at, created_at, password_hash, allowed_emails")
    .eq("user_id", profile.id)
    .eq("is_draft", false);
  if (atIso) bundlesQuery = bundlesQuery.lte("created_at", atIso);
  const { data: bundles } = await bundlesQuery
    .order("updated_at", { ascending: false })
    .limit(50);

  const publicBundles = (bundles || [])
    .filter(b => !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0))
    .map(b => ({ id: b.id, title: b.title, description: b.description, updated_at: b.updated_at, created_at: b.created_at }));

  return {
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      hub_slug: profile.hub_slug,
      hub_description: profile.hub_description,
    },
    docs: docs || [],
    bundles: publicBundles,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { at: atRaw } = await searchParams;
  if (parseAt(atRaw)) return { robots: { index: false, follow: false } };
  const hub = await getHub(slug, null);
  if (!hub) return { robots: { index: false, follow: false } };

  const author = hub.profile.display_name || slug;
  const title = `${author}'s knowledge hub — Memory.Wiki`;
  const description = hub.profile.hub_description ||
    `${hub.docs.length} documents, ${hub.bundles.length} bundles. Karpathy's wiki, deployable to any AI.`;

  // Compute the same stats the on-page banner shows so the
  // hub-specific OG image can present them. We pass concept count
  // as the bundle count for now (we don't fetch concept_index here
  // to keep generateMetadata cheap) — the OG card labels them
  // "docs · concepts · tokens", but the third number is the most
  // load-bearing for AI users so we make sure it's right.
  const totalWords = hub.docs.reduce(
    (sum, d) => sum + (d.markdown || "").trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  const tokenEstimate = Math.round(totalWords * 1.3 + hub.docs.length * 8);
  const ogParams = new URLSearchParams({
    hub: slug,
    author,
    docs: String(hub.docs.length),
    concepts: String(hub.bundles.length),
    tokens: String(tokenEstimate),
  });
  const ogImage = `/api/og?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://memory.wiki/hub/${slug}`,
      siteName: "Memory.Wiki",
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://memory.wiki/hub/${slug}`,
      types: { "text/markdown": `https://memory.wiki/hub/${slug}.md` },
    },
  };
}

function fmtRelative(iso: string, anchor: number): string {
  const ms = anchor - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default async function HubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { at: atRaw } = await searchParams;
  const at = parseAt(atRaw);
  const hub = await getHub(slug, at);
  if (!hub) notFound();

  const author = hub.profile.display_name || slug;
  const anchor = at ? at.getTime() : Date.now();
  const sevenDaysAgo = anchor - 7 * 24 * 60 * 60 * 1000;
  const recent = hub.docs.filter(d => {
    const updated = d.updated_at ? new Date(d.updated_at).getTime() : 0;
    return updated >= sevenDaysAgo && updated <= anchor;
  });
  const olderDocs = hub.docs.filter(d => !recent.find(r => r.id === d.id));
  const hubUrl = `https://memory.wiki/hub/${slug}`;
  const atLabel = at ? at.toISOString().slice(0, 10) : null;

  return (
    <div className="min-h-screen" style={{ background: "#08080a", color: "#fafafa" }}>
      <ViewerHeader
        title={`${author}'s hub`}
        breadcrumb={<>memory.wiki/hub/<span style={{ color: "var(--accent)" }}>{slug}</span></>}
      />
      <HubViewerV8
        slug={slug}
        profile={hub.profile}
        docs={hub.docs}
        bundles={hub.bundles}
        recent={recent}
        olderDocs={olderDocs}
        hubUrl={hubUrl}
        atLabel={atLabel}
        anchor={anchor}
      />
      <ViewerPromoStrip />
      <ViewerFooter
        stats={
          <>
            <span className="hidden sm:inline">{hub.docs.length} {hub.docs.length === 1 ? "doc" : "docs"}</span>
            <span>{hub.bundles.length} {hub.bundles.length === 1 ? "bundle" : "bundles"}</span>
          </>
        }
      />
    </div>
  );
}
