import { Metadata } from "next";
import { getSupabaseClient } from "@/lib/supabase";
import { getServerUserId } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import ClientViewer from "./ClientViewer";

type Props = { params: Promise<{ id: string }> };

async function getBundle(id: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: bundle } = await supabase
    .from("bundles")
    .select("id, title, description, password_hash, is_draft, user_id, graph_data, layout, created_at, updated_at")
    .eq("id", id)
    .single();

  if (!bundle) return null;

  // Get document count
  const { count } = await supabase
    .from("bundle_documents")
    .select("*", { count: "exact", head: true })
    .eq("bundle_id", id);

  // Get owner info
  let ownerPlan = "free";
  let ownerName: string | null = null;
  if (bundle.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, display_name")
      .eq("id", bundle.user_id)
      .single();
    if (profile?.plan) ownerPlan = profile.plan;
    if (profile?.display_name) ownerName = profile.display_name;
  }

  // Draft bundles: don't expose in SSR
  if (bundle.is_draft) {
    return { ...bundle, documentCount: count || 0, ownerPlan, ownerName, isDraft: true };
  }

  return { ...bundle, documentCount: count || 0, ownerPlan, ownerName };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getBundle(id);
  if (!bundle) return { robots: { index: false, follow: false } };

  const isProtected = !!bundle.password_hash;
  const title = isProtected ? "Protected Bundle" : (bundle.title || "Shared Bundle");
  const description = isProtected
    ? "This bundle is password protected."
    : `${bundle.documentCount} documents${bundle.description ? ` — ${bundle.description.slice(0, 150)}` : ""}`;

  const authorParam = !isProtected && bundle.ownerName ? `&author=${encodeURIComponent(bundle.ownerName)}` : "";
  const ogImageUrl = `https://memory.wiki/api/og?title=${encodeURIComponent(title)}&features=${encodeURIComponent(`Bundle,${bundle.documentCount} docs,Knowledge Graph`)}${authorParam}`;

  return {
    title: `${title} — Memory.Wiki`,
    description,
    robots: isProtected ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: `${title} — Memory.Wiki`,
      description,
      url: `https://memory.wiki/b/${id}`,
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
    // Advertise the Bundle Spec v1.0 raw markdown alternate so AI
    // fetchers / clients that follow alternate links pick up the
    // structured payload directly. Skipped for protected bundles so
    // the alternate URL doesn't leak.
    alternates: isProtected ? undefined : {
      canonical: `https://memory.wiki/b/${id}`,
      types: {
        "text/markdown": `https://memory.wiki/b/${id}.md`,
      },
    },
  };
}

export default async function BundlePage({ params }: Props) {
  const { id } = await params;
  const bundle = await getBundle(id);
  if (!bundle) notFound();

  // SSR-side owner redirect — see /d/[id] for the rationale. Avoids the
  // double-mount (viewer → window.location.replace → editor) for the
  // common signed-in-owner case.
  if (bundle.user_id) {
    const userId = await getServerUserId();
    if (userId && userId === bundle.user_id) {
      redirect(`/?bundle=${id}`);
    }
  }

  const isProtected = !!bundle.password_hash;
  const isDraft = !!(bundle as { isDraft?: boolean }).isDraft;

  return (
    <div>
      <ClientViewer
        id={bundle.id}
        title={isProtected ? "Protected Bundle" : bundle.title}
        description={bundle.description}
        isProtected={isProtected}
        isDraft={isDraft}
        documentCount={bundle.documentCount}
        showBadge={bundle.ownerPlan !== "pro"}
        layout={bundle.layout || "graph"}
      />
    </div>
  );
}
