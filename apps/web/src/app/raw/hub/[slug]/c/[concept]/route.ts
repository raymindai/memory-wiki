// Per-concept token-economical brief.
//
// Lets an LLM ask "what does <author> say about <concept>" by fetching
// a single URL — much denser than reading every doc that mentions the
// concept. The response is a concept summary + the doc list with
// per-doc one-liners pulled from the concept's evidence chain.
//
// URL: /raw/hub/<slug>/c/<concept-slug>
// concept-slug is the normalized_label with spaces → "-".

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { compactMarkdown, estimateTokens, isCompactRequested, tokenEconomyHeaders } from "@/lib/markdown-compact";
import { extractRequestSignals, logRawFetch } from "@/lib/raw-telemetry";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; concept: string }> }
) {
  const { slug, concept } = await params;
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) {
    return new NextResponse("Invalid slug", { status: 400 });
  }
  if (!concept || concept.length > 96) {
    return new NextResponse("Invalid concept", { status: 400 });
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

  // Concept slug → normalized_label (replace dashes with spaces). The
  // ILIKE catches near-matches that hyphenate differently.
  const normalized = concept.toLowerCase().replace(/-+/g, " ").trim();
  const { data: rows } = await supabase
    .from("concept_index")
    .select("id, label, concept_type, description, weight, occurrence_count, doc_ids")
    .eq("user_id", profile.id)
    .eq("normalized_label", normalized)
    .limit(1);

  const conceptRow = (rows && rows[0]) || null;
  if (!conceptRow) {
    return new NextResponse(
      `Concept "${concept}" not found in this hub. See https://memory.wiki/raw/hub/${slug}?digest=1 for the available concepts.\n`,
      { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  // Pull the public docs that reference this concept.
  const docIds = (conceptRow.doc_ids || []) as string[];
  let docs: Array<{ id: string; title: string | null; markdown: string | null; updated_at: string | null }> = [];
  if (docIds.length > 0) {
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, title, markdown, updated_at, is_draft, deleted_at, password_hash, allowed_emails")
      .in("id", docIds);
    docs = (docRows || [])
      .filter((d) => !d.is_draft && !d.deleted_at && !d.password_hash &&
        !(Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0))
      .map((d) => ({ id: d.id, title: d.title, markdown: d.markdown, updated_at: d.updated_at }));
  }

  // Pull related concepts (1 hop) so the LLM can follow the network
  // without a separate query.
  type RelRow = { source_concept_id: number; target_concept_id: number; relation_label: string; weight: number };
  const { data: relRows } = await supabase
    .from("concept_relations")
    .select("source_concept_id, target_concept_id, relation_label, weight")
    .eq("user_id", profile.id)
    .or(`source_concept_id.eq.${conceptRow.id},target_concept_id.eq.${conceptRow.id}`)
    .limit(40);
  const neighborIds = new Set<number>();
  for (const r of (relRows || []) as RelRow[]) {
    const otherId = r.source_concept_id === conceptRow.id ? r.target_concept_id : r.source_concept_id;
    neighborIds.add(otherId);
  }
  let neighbors: Array<{ id: number; label: string }> = [];
  if (neighborIds.size > 0) {
    const { data: nRows } = await supabase
      .from("concept_index")
      .select("id, label, normalized_label")
      .in("id", Array.from(neighborIds))
      .limit(20);
    neighbors = (nRows || []).map((n) => ({ id: n.id, label: n.label }));
  }

  const compact = isCompactRequested(request.url);
  const author = (profile.display_name || slug).replace(/"/g, '\\"');

  const frontmatter = [
    "---",
    "mdfy_bundle: 1",
    "type: hub_concept",
    `slug: ${slug}`,
    `concept: "${conceptRow.label.replace(/"/g, '\\"')}"`,
    `concept_type: ${conceptRow.concept_type || "concept"}`,
    `author: "${author}"`,
    `url: https://memory.wiki/hub/${slug}/c/${concept}`,
    `document_count: ${docs.length}`,
    `weight: ${Math.round(conceptRow.weight || 0)}`,
    'source: "memory.wiki"',
    "---",
    "",
  ].join("\n");

  const sections: string[] = [];
  sections.push(`# ${conceptRow.label}`);
  sections.push(`*from ${author}'s knowledge hub — ${docs.length} document${docs.length === 1 ? "" : "s"}*`);
  if (conceptRow.description) sections.push(`> ${conceptRow.description}`);

  if (docs.length === 0) {
    sections.push("_No publicly accessible documents reference this concept._");
  } else {
    // Per-doc passages — the actual paragraphs where the concept
    // appears, not just a one-line snippet. This is what makes the
    // page citable on its own without the AI having to fetch every
    // doc separately.
    sections.push("## What the hub says about this concept");
    let runningChars = 0;
    const PAGE_CHAR_BUDGET = 24_000; // ~6k tokens — fits in any model
    for (const d of docs) {
      const passages = extractPassagesFor(d.markdown || "", conceptRow.label, 3, 320);
      sections.push(`### [${d.title || "Untitled"}](https://memory.wiki/${d.id})`);
      if (passages.length === 0) {
        sections.push(`*No paragraph-level passage extracted — the concept may appear only in a heading or list.*`);
      } else {
        for (const p of passages) {
          const block = `> ${p.replace(/\n/g, " ")}`;
          // Soft budget cap — once we cross it, stop adding new
          // passages but keep the doc heading (so the AI knows the
          // doc exists and can fetch it directly).
          if (runningChars + block.length > PAGE_CHAR_BUDGET) {
            sections.push(`*…more passages available — fetch \`https://memory.wiki/raw/${d.id}?compact=1\` for the full doc.*`);
            break;
          }
          sections.push(block);
          runningChars += block.length;
        }
      }
      sections.push(`*Full doc: \`https://memory.wiki/raw/${d.id}?compact=1\`*`);
    }
  }

  if (neighbors.length > 0) {
    sections.push("## Related concepts");
    sections.push(neighbors
      .map((n) => `- [${n.label}](https://memory.wiki/raw/hub/${slug}/c/${labelToSlug(n.label)})`)
      .join("\n"));
  }

  sections.push(
    `---\n\n_Need the broader context? [Hub digest](https://memory.wiki/raw/hub/${slug}?digest=1&compact=1) — every concept in this hub at one glance._`,
  );

  const body = (compact ? compactMarkdown : (s: string) => s)(`${frontmatter}\n${sections.join("\n\n")}\n`);

  const sig = extractRequestSignals(request);
  logRawFetch({
    route: "hub_concept",
    resource: `${slug}/c/${concept}`,
    compact,
    bytes: Buffer.byteLength(body, "utf8"),
    tokens: estimateTokens(body),
    status: 200,
    ua: sig.ua,
    referer: sig.referer,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=120, stale-while-revalidate=600",
      "Link": `<https://memory.wiki/hub/${slug}/c/${concept}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Concept": conceptRow.label,
      ...tokenEconomyHeaders(body, { compact }),
    },
  });
}

function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extract the paragraphs in `markdown` that mention `conceptLabel`,
// returning up to `maxPassages`, each clipped to `maxChars`. Sorts
// by mention density so the most concept-dense passages come first.
//
// Why paragraphs (not sentences): a sentence containing the term
// often sits inside a paragraph that explains it; pulling the whole
// paragraph gives the LLM enough context to cite without having to
// fetch the doc.
function extractPassagesFor(markdown: string, conceptLabel: string, maxPassages: number, maxChars: number): string[] {
  if (!markdown) return [];
  const needle = conceptLabel.toLowerCase().trim();
  if (!needle) return [];

  const cleaned = markdown
    .replace(/^---[\s\S]*?---\n?/, "")     // drop frontmatter
    .replace(/```[\s\S]*?```/g, "")        // drop code fences (rarely cite-worthy)
    .replace(/^\s*[-*+]\s+/gm, "");        // simplify bullet markers

  // Paragraph split — markdown paragraphs are blank-line separated.
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);

  type Scored = { text: string; mentions: number };
  const scored: Scored[] = [];
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  for (const p of paragraphs) {
    const matches = p.match(re);
    if (!matches) continue;
    scored.push({ text: p, mentions: matches.length });
  }

  // Sort descending by mention count, tiebreak by paragraph length
  // (slightly longer = usually more context, but cap at maxChars).
  scored.sort((a, b) => b.mentions - a.mentions || b.text.length - a.text.length);

  return scored.slice(0, maxPassages).map((s) =>
    s.text.length > maxChars ? s.text.slice(0, maxChars - 1) + "…" : s.text,
  );
}
