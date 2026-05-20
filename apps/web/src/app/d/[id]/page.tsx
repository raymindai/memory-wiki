import { Metadata } from "next";
import { getSupabaseClient } from "@/lib/supabase";
import { getServerUserId } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import ClientViewer from "./ClientViewer";

type Props = { params: Promise<{ id: string }> };

async function getDocument(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("documents")
    .select("id, markdown, title, created_at, password_hash, expires_at, user_id, is_draft, edit_mode, allowed_emails")
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
    return { title: "Expired — memory.wiki", robots: { index: false, follow: false } };
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
    title: `${title} — memory.wiki`,
    description,
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${title} — memory.wiki`,
      description,
      url: `https://memory.wiki/${id}`,
      siteName: "memory.wiki",
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — memory.wiki`,
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

  // SSR-side owner redirect — if the caller is signed in and owns this
  // doc, send them straight to the editor instead of rendering the
  // public viewer first. The client-side check in DocumentViewer is
  // kept as a fallback for browsers without a Supabase session cookie
  // (e.g. just refreshed from a stale tab), but the server hop here
  // means the common case (owner with a fresh cookie) never sees the
  // viewer flash + window.location.replace round trip.
  if (doc.user_id) {
    const userId = await getServerUserId();
    if (userId && userId === doc.user_id) {
      redirect(`/?from=${id}`);
    }
  }

  const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date();
  const isRestricted = (doc.allowed_emails || []).length > 0;
  const isDraft = !!(doc as { isDraft?: boolean }).isDraft;

  const visibleMarkdown = isExpired || isRestricted || isDraft ? "" : doc.markdown;

  return (
    <div>
      {/* LLM readability handled by /api/docs/{id} via Vercel rewrite — no SSR raw text needed */}
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

