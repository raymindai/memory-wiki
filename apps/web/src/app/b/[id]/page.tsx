import { Metadata } from "next";
import { getSupabaseClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import ClientViewer from "./ClientViewer";

// ISR-cached at the edge. The supabase calls are wrapped in
// `unstable_cache` so Vercel can emit `cache-control: public,
// s-maxage=60` instead of the dynamic default `private, no-store`
// that ChatGPT's safe-URL filter treats as untrusted.
export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

const _getBundle = async (id: string) => {
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
    return { ...bundle, documentCount: count || 0, ownerPlan, ownerName, isDraft: true, documents: [] as Array<{ id: string; title: string | null }> };
  }

  // Fetch the document list for SSR crawlers — title + id of every
  // doc in the bundle, in display order. Public bundles are fully
  // index-friendly, so we want LLM browsers to see what's inside.
  const { data: docRows } = await supabase
    .from("bundle_documents")
    .select("position, documents(id, title)")
    .eq("bundle_id", id)
    .order("position", { ascending: true });
  const documents = (docRows || [])
    .map((row: { documents: unknown }) => row.documents as { id: string; title: string | null } | null)
    .filter((d): d is { id: string; title: string | null } => !!d);

  return { ...bundle, documentCount: count || 0, ownerPlan, ownerName, documents };
};

const getBundle = (id: string) =>
  unstable_cache(_getBundle, ["bundle"], {
    revalidate: 60,
    tags: [`bundle:${id}`],
  })(id);

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

  // Owner redirect is handled in ClientViewer (client-side). Reading
  // cookies here would mark this page dynamic and break edge caching.

  const isProtected = !!bundle.password_hash;
  const isDraft = !!(bundle as { isDraft?: boolean }).isDraft;
  const visibleDocs = !isProtected && !isDraft ? (bundle.documents || []) : [];

  const jsonLd = !isProtected && !isDraft
    ? {
        "@context": "https://schema.org",
        "@type": "Collection",
        name: bundle.title || "Untitled Bundle",
        description: bundle.description || `${bundle.documentCount} documents`,
        url: `https://memory.wiki/b/${bundle.id}`,
        dateCreated: bundle.created_at,
        dateModified: bundle.updated_at || bundle.created_at,
        author: bundle.ownerName
          ? { "@type": "Person", name: bundle.ownerName }
          : { "@type": "Organization", name: "Memory.Wiki" },
        publisher: {
          "@type": "Organization",
          name: "Memory.Wiki",
          url: "https://memory.wiki",
        },
        numberOfItems: bundle.documentCount,
        hasPart: visibleDocs.slice(0, 50).map((d) => ({
          "@type": "Article",
          name: d.title || "Untitled",
          url: `https://memory.wiki/${d.id}`,
        })),
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
      {visibleDocs.length > 0 && (
        <article
          id="memory-wiki-ssr-body"
          className="mdcore-rendered max-w-3xl mx-auto px-4 sm:px-6 py-8"
        >
          <h1>{bundle.title || "Untitled Bundle"}</h1>
          {bundle.description && <p>{bundle.description}</p>}
          <p>{bundle.documentCount} document{bundle.documentCount === 1 ? "" : "s"} in this bundle.</p>
          <ul>
            {visibleDocs.map((d) => (
              <li key={d.id}>
                <a href={`https://memory.wiki/${d.id}`}>{d.title || "Untitled"}</a>
              </li>
            ))}
          </ul>
        </article>
      )}
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
