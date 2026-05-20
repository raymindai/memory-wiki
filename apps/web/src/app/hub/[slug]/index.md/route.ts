// GET /hub/[slug]/index.md
//
// Wiki-style table of contents for a public hub. Differs from
// `/llms.txt` (link manifest for AI agents) and `/llms-full.txt`
// (dense concatenation) by grouping documents under the concepts
// they touch — closer to how a human-curated wiki reads.
//
// Inspired by the Hermes Agent shape (Karpathy's "wiki-as-codebase"):
// SCHEMA.md describes the structure, index.md is the navigation
// table, log.md is the activity stream. We expose all three so an
// agent (or a human) pointing at the hub root sees the same affordances
// they'd expect from a Markdown KB on disk.
//
// Restricted hubs (hub_public=false) return 404 so we don't leak
// titles via the unauthenticated channel.

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { estimateTokens } from "@/lib/markdown-compact";

interface ConceptRow {
  label: string;
  doc_ids: string[] | null;
  weight: number | null;
  occurrence_count: number | null;
}

const MAX_CONCEPTS_IN_INDEX = 40;
const MAX_DOCS_PER_CONCEPT = 10;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) {
    return new NextResponse("Invalid slug", { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return new NextResponse("Service unavailable", { status: 503 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();

  if (!profile || !profile.hub_public) {
    return new NextResponse("Hub not found", { status: 404 });
  }

  // Pull public docs + concept index in parallel.
  const [{ data: docs }, { data: concepts }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, updated_at, markdown")
      .eq("user_id", profile.id)
      .eq("is_draft", false)
      .is("deleted_at", null)
      .is("password_hash", null)
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("concept_index")
      .select("label, doc_ids, weight, occurrence_count")
      .eq("user_id", profile.id)
      .order("weight", { ascending: false })
      .limit(200),
  ]);

  const visibleDocs = (docs || []).filter((d) => {
    const ae = (d as { allowed_emails?: string[] | null }).allowed_emails;
    return !(Array.isArray(ae) && ae.length > 0);
  });

  const visibleIds = new Set(visibleDocs.map((d) => d.id));
  const docById = new Map(visibleDocs.map((d) => [d.id, d]));

  // Restrict concepts to those that mention at least one public doc
  // we're allowed to surface. Drop the rest — they'd render as
  // bullet-less concept headings, which is noisy.
  const usableConcepts = ((concepts || []) as ConceptRow[])
    .map((c) => ({
      label: c.label,
      docIds: (c.doc_ids || []).filter((id) => visibleIds.has(id)),
      weight: c.weight || 1,
      occurrenceCount: c.occurrence_count || 0,
    }))
    .filter((c) => c.docIds.length > 0)
    // Rank: more docs first, then weight, then more mentions.
    .sort((a, b) => b.docIds.length - a.docIds.length || b.weight - a.weight || b.occurrenceCount - a.occurrenceCount)
    .slice(0, MAX_CONCEPTS_IN_INDEX);

  const author = profile.display_name || slug;
  const description = (profile.hub_description || "").trim();
  const totalTokens = visibleDocs.reduce((sum, d) => sum + estimateTokens(d.markdown || ""), 0);

  const lines: string[] = [];
  lines.push(`# ${author}'s knowledge hub`);
  lines.push("");
  if (description) {
    lines.push(`> ${description}`);
    lines.push("");
  }
  lines.push(`**${visibleDocs.length}** public documents · **${usableConcepts.length}** indexed concepts · ~**${totalTokens.toLocaleString()}** tokens total.`);
  lines.push("");
  lines.push(`Companion files: [SCHEMA.md](/hub/${slug}/SCHEMA.md) · [log.md](/hub/${slug}/log.md) · [llms.txt](/hub/${slug}/llms.txt)`);
  lines.push("");

  // ─── Concepts section ───
  if (usableConcepts.length > 0) {
    lines.push("## Concepts");
    lines.push("");
    lines.push("Each concept lists the public documents that mention it. Cross-doc concepts (≥2 docs) are the most informative entry points.");
    lines.push("");
    for (const c of usableConcepts) {
      const heading = `${c.label} (${c.docIds.length} doc${c.docIds.length === 1 ? "" : "s"})`;
      lines.push(`### ${heading}`);
      lines.push("");
      for (const id of c.docIds.slice(0, MAX_DOCS_PER_CONCEPT)) {
        const d = docById.get(id);
        if (!d) continue;
        lines.push(`- [${d.title || "Untitled"}](https://memory.wiki/${d.id})`);
      }
      if (c.docIds.length > MAX_DOCS_PER_CONCEPT) {
        lines.push(`- …and ${c.docIds.length - MAX_DOCS_PER_CONCEPT} more.`);
      }
      lines.push("");
    }
  }

  // ─── Recent docs section ───
  lines.push("## Recent documents");
  lines.push("");
  for (const d of visibleDocs.slice(0, 30)) {
    const date = (d.updated_at || "").slice(0, 10);
    lines.push(`- ${date} — [${d.title || "Untitled"}](https://memory.wiki/${d.id})`);
  }
  if (visibleDocs.length > 30) {
    lines.push(`- …and ${visibleDocs.length - 30} more in [llms.txt](/hub/${slug}/llms.txt).`);
  }
  lines.push("");

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      "Link": `<https://memory.wiki/hub/${slug}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
    },
  });
}
