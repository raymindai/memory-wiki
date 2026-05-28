import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { getReferencedBy } from "@/lib/queryBacklinks";
import ViewerFooter from "@/components/ViewerFooter";
import ViewerPromoStrip from "@/components/ViewerPromoStrip";
import ViewerHeader from "@/components/ViewerHeader";
import ReferencedBy from "@/components/ReferencedBy";
import HubViewerV8 from "./HubViewerV8";
import HubHeaderActions from "./HubHeaderActions";
import { Globe } from "lucide-react";

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
    .select("id, display_name, avatar_url, avatar_style, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) return null;

  // Match the sidebar / editor `resolveAvatar` chain: avatar_style
  // (when not "oauth") wins, then profile.avatar_url, then OAuth
  // metadata, then a deterministic DiceBear identicon. Without
  // honouring avatar_style here, the public hub showed the OAuth
  // photo even when the user had explicitly picked Identicon in
  // Settings — which is exactly what the user reported.
  let ownerEmail: string | null = null;
  let oauthAvatar: string | null = null;
  try {
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    ownerEmail = authUser?.user?.email || null;
    const meta = (authUser?.user?.user_metadata as { avatar_url?: string } | undefined) || {};
    if (meta.avatar_url) oauthAvatar = meta.avatar_url;
  } catch { /* admin lookup unavailable */ }
  const seed = encodeURIComponent(ownerEmail || profile.hub_slug || "user");
  const rawStyle = (profile as { avatar_style?: string | null }).avatar_style;
  // Match the same upgrade resolveAvatar does — older rows with
  // avatar_style="identicon" render the new "shapes" style.
  const style = rawStyle === "identicon" ? "shapes" : rawStyle;
  let resolvedAvatar: string;
  // "upload" is the sentinel meaning the user uploaded their own
  // image to Supabase Storage — profile.avatar_url holds the URL.
  // Treating "upload" as a DiceBear style name produced a broken
  // /9.x/upload/svg request (no such style) and rendered a broken
  // image on the hub face.
  if (style === "upload") {
    resolvedAvatar = profile.avatar_url
      || oauthAvatar
      || `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;
  } else if (style && style !== "oauth") {
    resolvedAvatar = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
  } else if (profile.avatar_url) {
    resolvedAvatar = profile.avatar_url;
  } else if (oauthAvatar) {
    resolvedAvatar = oauthAvatar;
  } else {
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
      // Resolved avatar, not the raw column — honours avatar_style.
      avatar_url: resolvedAvatar,
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
      // /@<slug> is the v8 canonical user URL; /hub/<slug> still
      // serves the same page via vercel.json rewrite, but every
      // outbound link (OG share preview, sitemap, share copy) uses
      // the @-form so it propagates as the user-facing identity.
      url: `https://memory.wiki/@${slug}`,
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
      canonical: `https://memory.wiki/@${slug}`,
      types: { "text/markdown": `https://memory.wiki/@${slug}.md` },
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
  const hubUrl = `https://memory.wiki/@${slug}`;
  const atLabel = at ? at.toISOString().slice(0, 10) : null;

  // Pull backlinks pointing AT this hub — docs / bundles / other hubs
  // that reference it. Best-effort: if migration 045 isn't applied yet
  // the query returns an empty shape and ReferencedBy renders nothing.
  const supabaseForRefs = getSupabaseClient();
  const referencedBy = supabaseForRefs
    ? await getReferencedBy(supabaseForRefs, "hub", slug, 20).catch(() => ({
        documents: [],
        bundles: [],
        hubs: [],
        total: 0,
      }))
    : { documents: [], bundles: [], hubs: [], total: 0 };

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      <ViewerHeader
        title={`${author}'s hub`}
        breadcrumb={
          <span className="inline-flex items-center gap-1.5">
            <Globe width={12} height={12} style={{ color: "#4ade80" }} aria-label="Public hub" />
            <span>memory.wiki/@<span style={{ color: "var(--text-secondary)" }}>{slug}</span></span>
          </span>
        }
        actions={<HubHeaderActions hubUrl={hubUrl} />}
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
      {/* Self-wiring backlinks — docs / bundles / hubs that reference
          this hub. Inline variant sits in the page flow above the
          promo strip + footer. */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        <ReferencedBy data={referencedBy} variant="inline" />
      </div>
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
