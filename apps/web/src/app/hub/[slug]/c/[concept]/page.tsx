import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Network, FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Props = { params: Promise<{ slug: string; concept: string }> };

interface ConceptPageData {
  profile: { display_name: string | null; hub_slug: string; hub_description: string | null };
  concept: { id: number; label: string; concept_type: string | null; description: string | null; weight: number };
  docs: Array<{ id: string; title: string | null; updated_at: string }>;
  neighbors: Array<{ label: string; slug: string }>;
}

async function getConceptPage(slug: string, conceptParam: string): Promise<ConceptPageData | null> {
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) return null;
  if (!conceptParam || conceptParam.length > 96) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) return null;

  const normalized = conceptParam.toLowerCase().replace(/-+/g, " ").trim();
  const { data: rows } = await supabase
    .from("concept_index")
    .select("id, label, concept_type, description, weight, doc_ids")
    .eq("user_id", profile.id)
    .eq("normalized_label", normalized)
    .limit(1);
  const conceptRow = (rows && rows[0]) || null;
  if (!conceptRow) return null;

  const docIds = (conceptRow.doc_ids || []) as string[];
  let docs: Array<{ id: string; title: string | null; updated_at: string }> = [];
  if (docIds.length > 0) {
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, title, updated_at, is_draft, deleted_at, password_hash, allowed_emails")
      .in("id", docIds);
    docs = (docRows || [])
      .filter((d) => !d.is_draft && !d.deleted_at && !d.password_hash &&
        !(Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0))
      .map((d) => ({ id: d.id, title: d.title, updated_at: d.updated_at }));
  }

  type RelRow = { source_concept_id: number; target_concept_id: number };
  const { data: relRows } = await supabase
    .from("concept_relations")
    .select("source_concept_id, target_concept_id")
    .eq("user_id", profile.id)
    .or(`source_concept_id.eq.${conceptRow.id},target_concept_id.eq.${conceptRow.id}`)
    .limit(20);
  const neighborIds = new Set<number>();
  for (const r of (relRows || []) as RelRow[]) {
    neighborIds.add(r.source_concept_id === conceptRow.id ? r.target_concept_id : r.source_concept_id);
  }
  let neighbors: Array<{ label: string; slug: string }> = [];
  if (neighborIds.size > 0) {
    const { data: nRows } = await supabase
      .from("concept_index")
      .select("label, normalized_label")
      .in("id", Array.from(neighborIds))
      .limit(15);
    neighbors = (nRows || []).map((n) => ({
      label: n.label,
      slug: (n.normalized_label as string).replace(/\s+/g, "-"),
    }));
  }

  return {
    profile: {
      display_name: profile.display_name,
      hub_slug: profile.hub_slug,
      hub_description: profile.hub_description,
    },
    concept: {
      id: conceptRow.id,
      label: conceptRow.label,
      concept_type: conceptRow.concept_type,
      description: conceptRow.description,
      weight: Math.round(conceptRow.weight || 0),
    },
    docs,
    neighbors,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, concept } = await params;
  const data = await getConceptPage(slug, concept);
  if (!data) return { title: "Concept not found" };
  const author = data.profile.display_name || slug;
  return {
    title: `${data.concept.label} — ${author}'s knowledge hub`,
    description: data.concept.description || `${data.concept.label} across ${data.docs.length} documents in ${author}'s hub.`,
    alternates: {
      canonical: `https://memory.wiki/hub/${slug}/c/${concept}`,
      types: { "text/markdown": `https://memory.wiki/raw/hub/${slug}/c/${concept}?compact=1` },
    },
  };
}

export default async function ConceptPage({ params }: Props) {
  const { slug, concept } = await params;
  const data = await getConceptPage(slug, concept);
  if (!data) notFound();

  const author = data.profile.display_name || slug;

  return (
    <div className="min-h-screen mdcore-rendered" style={{ background: "var(--background)" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          href={`/hub/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          {author}&apos;s hub
        </Link>

        <div className="flex items-center gap-2 text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>
          <Network size={12} />
          <span>{data.concept.concept_type || "concept"}</span>
          <span>•</span>
          <span>weight {data.concept.weight}</span>
          <span>•</span>
          <span>{data.docs.length} doc{data.docs.length === 1 ? "" : "s"}</span>
        </div>
        <h1 className="text-3xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {data.concept.label}
        </h1>
        {data.concept.description && (
          <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
            {data.concept.description}
          </p>
        )}

        {data.docs.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Source documents
            </h2>
            <ul className="space-y-2">
              {data.docs.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/${d.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--toggle-bg)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <FileText size={14} style={{ color: "var(--text-muted)" }} />
                    <span className="flex-1 truncate">{d.title || "Untitled"}</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                      {new Date(d.updated_at).toISOString().slice(0, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.neighbors.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Related concepts
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.neighbors.map((n) => (
                <Link
                  key={n.slug}
                  href={`/hub/${slug}/c/${n.slug}`}
                  className="text-sm px-3 py-1 rounded-full"
                  style={{ background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border-dim)" }}
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs font-mono mt-12" style={{ color: "var(--text-faint)" }}>
          For LLM consumption:{" "}
          <code style={{ color: "var(--text-muted)" }}>
            https://memory.wiki/raw/hub/{slug}/c/{concept}?compact=1
          </code>
        </p>
      </div>
    </div>
  );
}
