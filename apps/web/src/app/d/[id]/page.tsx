import { Metadata } from "next";
import { getSupabaseClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ClientViewer from "./ClientViewer";
import { render } from "@/lib/render";

// Force this page to be cached at the edge. Without this, the previous
// SSR owner-redirect read cookies, which made Next.js auto-emit
// `cache-control: private, no-store` — and ChatGPT's browse tool
// treats `private` as "user-specific, refuse to fetch", so pasted
// memory.wiki short URLs failed safe-URL validation. The owner
// redirect now happens only client-side in ClientViewer.
export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

async function getDocument(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("documents")
    .select("id, markdown, title, created_at, updated_at, password_hash, expires_at, user_id, is_draft, edit_mode, allowed_emails")
    .eq("id", id)
    .single();

  if (!data) return null;

  // Check if document owner is a Pro user (hide badge) and get display name
  let ownerPlan = "free";
  let ownerName: string | null = null;
  if (data.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, display_name")
      .eq("id", data.user_id)
      .single();
    if (profile?.plan) ownerPlan = profile.plan;
    if (profile?.display_name) ownerName = profile.display_name;
  }

  // Draft documents: don't expose content in SSR, let client-side handle with auth
  if (data.is_draft) {
    return { ...data, markdown: "", isDraft: true, ownerPlan, ownerName };
  }

  return { ...data, ownerPlan, ownerName };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return { robots: { index: false, follow: false } };

  const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date();
  const isRestricted = (doc.allowed_emails || []).length > 0;

  if (isExpired) {
    return { title: "Expired — Memory.Wiki", robots: { index: false, follow: false } };
  }

  // Don't index restricted content. The password gate was removed,
  // so the only "don't index" reason is allowed_emails restriction.
  const noIndex = isRestricted;

  const title = doc.title || "Shared Document";
  const description = doc.markdown.slice(0, 200).replace(/[#*_`\n]/g, " ").trim();

  // Detect which features the doc actually uses, for dynamic OG pills.
  const md = doc.markdown;
  const features: string[] = [];
  if (/```mermaid/.test(md)) features.push("Mermaid");
  if (/\$\$[\s\S]+?\$\$|(?:^|\s)\$[^$\n]+\$/.test(md)) features.push("KaTeX");
  if (/```[a-zA-Z]/.test(md)) features.push("Code");
  if (/^\|.*\|/m.test(md)) features.push("Tables");
  if (/!\[.*?\]\(/.test(md)) features.push("Images");
  if (features.length === 0) features.push("GFM");

  // Author attribution
  const authorParam = doc.ownerName ? `&author=${encodeURIComponent(doc.ownerName)}` : "";
  const ogImageUrl = `https://memory.wiki/api/og?title=${encodeURIComponent(title)}&features=${encodeURIComponent(features.slice(0, 5).join(","))}${authorParam}`;

  return {
    title: `${title} — Memory.Wiki`,
    description,
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${title} — Memory.Wiki`,
      description,
      url: `https://memory.wiki/${id}`,
      siteName: "Memory.Wiki",
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Memory.Wiki`,
      description,
      images: [ogImageUrl],
    },
    // Advertise the raw-markdown alternate so AI fetchers (and curious
    // crawlers) can find the LLM-friendly representation directly. The
    // browser still loads the rich page; AI tools that follow alternate
    // links pick up text/markdown without any extra config.
    alternates: noIndex ? undefined : {
      canonical: `https://memory.wiki/${id}`,
      types: {
        "text/markdown": `https://memory.wiki/${id}.md`,
      },
    },
  };
}

export default async function DocPage({ params }: Props) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) notFound();

  // Owner redirect happens client-side in ClientViewer (reads supabase
  // session from localStorage). The previous SSR cookie check made
  // this page dynamic, breaking edge caching and tripping ChatGPT's
  // safe-URL filter.

  const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date();
  const isRestricted = (doc.allowed_emails || []).length > 0;
  const isDraft = !!(doc as { isDraft?: boolean }).isDraft;

  const visibleMarkdown = isExpired || isRestricted || isDraft ? "" : doc.markdown;
  // SSR the markdown body so non-JS clients (ChatGPT browse, Google,
  // Claude, etc.) see the actual content. ClientViewer removes this
  // element once it mounts the interactive TipTap viewer.
  const ssrHtml = visibleMarkdown ? render(visibleMarkdown).html : "";

  // JSON-LD Article markup helps LLM browsers and search engines
  // understand the page as a discrete document with author, dates,
  // and canonical URL — the exact signals safe-URL filters use to
  // build trust for new domains.
  const jsonLd = visibleMarkdown
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: doc.title || "Untitled",
        url: `https://memory.wiki/${doc.id}`,
        datePublished: doc.created_at,
        dateModified: doc.updated_at || doc.created_at,
        author: doc.ownerName
          ? { "@type": "Person", name: doc.ownerName }
          : { "@type": "Organization", name: "Memory.Wiki" },
        publisher: {
          "@type": "Organization",
          name: "Memory.Wiki",
          url: "https://memory.wiki",
        },
        mainEntityOfPage: `https://memory.wiki/${doc.id}`,
      }
    : null;

  return (
    <div>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {ssrHtml && (
        <article
          id="memory-wiki-ssr-body"
          className="mdcore-rendered max-w-3xl mx-auto px-4 sm:px-6 py-8"
          dangerouslySetInnerHTML={{ __html: ssrHtml }}
        />
      )}
      <ClientViewer
        id={doc.id}
        markdown={visibleMarkdown}
        title={isExpired ? "Expired" : doc.title}
        isExpired={!!isExpired}
        isRestricted={isRestricted || isDraft}
        showBadge={doc.ownerPlan !== "pro"}
        editMode={doc.edit_mode || "token"}
      />
    </div>
  );
}

