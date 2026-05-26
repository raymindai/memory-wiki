import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { compactMarkdown, estimateTokens } from "@/lib/markdown-compact";
import { extractRequestSignals, logRawFetch } from "@/lib/raw-telemetry";

/**
 * GET /hub/[slug]/llms-full.txt — dense variant of the LLM manifest.
 *
 * llms.txt is INDEX-only: titles + URLs the model follows on demand.
 * This endpoint emits the FULL markdown of every public document in
 * the hub, separated by a frontmatter-style `---` block per doc, so
 * an LLM can ingest the entire hub in a single fetch.
 *
 * Token cap: stops appending when total estimated tokens cross the
 * cap so a runaway hub doesn't blow past any model's context window.
 * Default 80k — comfortable margin under Claude Sonnet's 200k. The
 * tail is summarized as a "more docs available at /raw/<id>" line.
 *
 * Restricted hubs (hub_public=false) → 404. Drafts / passworded /
 * email-restricted docs are excluded — same gating as /raw/hub.
 */

const TOKEN_CAP_DEFAULT = 120_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{3,32}$/.test(slug)) {
    return new NextResponse("Invalid slug", { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return new NextResponse("Service unavailable", { status: 503 });

  const url = new URL(request.url);
  const cap = (() => {
    const raw = parseInt(url.searchParams.get("cap") || "", 10);
    if (Number.isFinite(raw) && raw > 1000 && raw <= 500_000) return raw;
    return TOKEN_CAP_DEFAULT;
  })();
  const compact = (url.searchParams.get("compact") || "").toLowerCase();
  const useCompact = compact === "1" || compact === "true" || compact === "yes" || compact === "on" || true; // dense variant defaults compact-on

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();
  if (!profile || !profile.hub_public) {
    return new NextResponse("Hub not found", { status: 404 });
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown, updated_at, allowed_emails")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  const visibleDocs = (docs || []).filter((d) => {
    const ae = (d as { allowed_emails?: string[] | null }).allowed_emails;
    return !(Array.isArray(ae) && ae.length > 0);
  });

  // ── Knowledge graph layer ─────────────────────────────────────
  // Concepts + relations + bundle AI graphs that the compact digest
  // already exposes. Until this lived only at /raw/hub/<slug>?digest=1,
  // llms-full was *less* informed than its compact sibling. Including
  // the graph here means an AI fetching the full payload gets the
  // pre-computed navigation alongside the raw doc bodies.
  type ConceptRow = {
    id: number;
    label: string;
    concept_type: string | null;
    description: string | null;
    weight: number | null;
    doc_ids: string[] | null;
  };
  type RelationRow = {
    source_concept_id: number;
    target_concept_id: number;
    relation_label: string | null;
    weight: number | null;
  };
  const { data: rawConcepts } = await supabase
    .from("concept_index")
    .select("id, label, concept_type, description, weight, doc_ids")
    .eq("user_id", profile.id)
    .order("weight", { ascending: false })
    .limit(40);
  const concepts = (rawConcepts as ConceptRow[] | null) || [];
  const conceptIds = concepts.map((c) => c.id);
  let topRelations: RelationRow[] = [];
  if (conceptIds.length > 0) {
    const { data: relRows } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label, weight")
      .eq("user_id", profile.id)
      .in("source_concept_id", conceptIds)
      .in("target_concept_id", conceptIds)
      .order("weight", { ascending: false })
      .limit(30);
    topRelations = (relRows as RelationRow[] | null) || [];
  }
  const conceptLabelById = new Map(concepts.map((c) => [c.id, c.label]));

  type BundleRow = {
    id: string;
    title: string | null;
    description: string | null;
    graph_data: unknown;
    is_draft: boolean;
    password_hash: string | null;
    allowed_emails: string[] | null;
    deleted_at: string | null;
  };
  const { data: rawBundles } = await supabase
    .from("bundles")
    .select("id, title, description, graph_data, is_draft, password_hash, allowed_emails, deleted_at")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .order("updated_at", { ascending: false })
    .limit(50);
  const bundles = ((rawBundles as BundleRow[] | null) || []).filter(
    (b) => !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0),
  );

  const author = profile.display_name || slug;
  const description = (profile.hub_description || "").trim();

  const lines: string[] = [];
  lines.push(`# ${author}'s knowledge hub — full text`);
  if (description) {
    lines.push("");
    lines.push(`> ${description}`);
  }
  lines.push("");
  lines.push(`Canonical hub URL: https://memory.wiki/hub/${slug}`);
  lines.push(`Index-only manifest: https://memory.wiki/hub/${slug}/llms.txt`);
  lines.push(`Concept digest: https://memory.wiki/raw/hub/${slug}?digest=1&compact=1`);
  lines.push("");

  // Knowledge graph header — concepts + relations + bundles.
  // Lives ABOVE the doc bodies so the AI sees the structure first,
  // then can match doc bodies against the concept taxonomy.
  if (concepts.length > 0 || bundles.length > 0) {
    lines.push("# Knowledge graph");
    lines.push("");
    lines.push(
      `_Pre-computed structure across this hub: ${concepts.length} concept${concepts.length === 1 ? "" : "s"}, ${topRelations.length} relation${topRelations.length === 1 ? "" : "s"}, ${bundles.length} bundle${bundles.length === 1 ? "" : "s"} with AI analysis. Use this as navigation; the doc bodies below contain the prose._`,
    );
    lines.push("");
  }

  if (concepts.length > 0) {
    lines.push("## Concepts");
    for (const c of concepts) {
      const meta = `${c.concept_type || "concept"} • weight ${Math.round(c.weight || 0)} • ${(c.doc_ids || []).length} doc${(c.doc_ids || []).length === 1 ? "" : "s"}`;
      lines.push(`- **${c.label}** _(${meta})_`);
      if (c.description) lines.push(`  ${c.description.split("\n")[0].slice(0, 240)}`);
    }
    lines.push("");
  }

  if (topRelations.length > 0) {
    lines.push("## Concept relations");
    for (const r of topRelations) {
      const src = conceptLabelById.get(r.source_concept_id);
      const tgt = conceptLabelById.get(r.target_concept_id);
      if (!src || !tgt) continue;
      lines.push(`- **${src}** ${(r.relation_label || "→").trim()} **${tgt}**`);
    }
    lines.push("");
  }

  if (bundles.length > 0) {
    lines.push("## Bundles (with AI analysis)");
    type Graph = {
      summary?: string;
      themes?: string[];
      insights?: string[];
      keyTakeaways?: string[];
    };
    for (const b of bundles) {
      const title = (b.title || "Untitled bundle").replace(/[\r\n]+/g, " ");
      lines.push(`### [${title}](https://memory.wiki/b/${b.id})`);
      if (b.description) {
        lines.push(`> ${b.description.split("\n")[0].slice(0, 240)}`);
      }
      const g = (b.graph_data as Graph | null) || null;
      if (g) {
        if (g.summary && g.summary.trim()) {
          lines.push("");
          lines.push(`**Summary:** ${g.summary.trim().slice(0, 400)}`);
        }
        if (Array.isArray(g.themes) && g.themes.length > 0) {
          lines.push("");
          lines.push("**Themes:** " + g.themes.slice(0, 5).join(" · "));
        }
        if (Array.isArray(g.keyTakeaways) && g.keyTakeaways.length > 0) {
          lines.push("");
          lines.push("**Key takeaways:**");
          for (const t of g.keyTakeaways.slice(0, 4)) {
            lines.push(`- ${t.slice(0, 200)}`);
          }
        }
      }
      lines.push("");
    }
  }

  // Append docs in newest-first order until we hit the token cap.
  let runningTokens = estimateTokens(lines.join("\n"));
  let included = 0;
  let truncatedAt = -1;
  for (let i = 0; i < visibleDocs.length; i++) {
    const d = visibleDocs[i];
    const docMd = d.markdown || "";
    const body = useCompact ? compactMarkdown(docMd) : docMd;
    const block: string[] = [
      "",
      "---",
      `id: ${d.id}`,
      `title: ${(d.title || "Untitled").replace(/[\r\n]+/g, " ")}`,
      `url: https://memory.wiki/${d.id}`,
      `updated: ${d.updated_at || ""}`,
      "---",
      "",
      body.trimEnd(),
    ];
    const blockText = block.join("\n");
    const blockTokens = estimateTokens(blockText);
    if (runningTokens + blockTokens > cap && included > 0) {
      truncatedAt = i;
      break;
    }
    lines.push(blockText);
    runningTokens += blockTokens;
    included++;
  }

  if (truncatedAt >= 0) {
    const remaining = visibleDocs.slice(truncatedAt);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`_Token cap (${cap.toLocaleString()}) reached. ${remaining.length} more document${remaining.length === 1 ? "" : "s"} available — fetch on demand:_`);
    for (const d of remaining.slice(0, 200)) {
      lines.push(`- [${(d.title || "Untitled").replace(/[\r\n]+/g, " ")}](https://memory.wiki/raw/${d.id}?compact=1)`);
    }
    if (remaining.length > 200) {
      lines.push(`- _…and ${remaining.length - 200} more — see https://memory.wiki/hub/${slug}/llms.txt for the full list._`);
    }
  }

  const body = lines.join("\n") + "\n";

  const sig = extractRequestSignals(request);
  logRawFetch({
    route: "hub",
    resource: `${slug}/llms-full`,
    compact: useCompact,
    bytes: Buffer.byteLength(body, "utf8"),
    tokens: estimateTokens(body),
    status: 200,
    ua: sig.ua,
    referer: sig.referer,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      "Link": `<https://memory.wiki/hub/${slug}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
      "X-Token-Cap": String(cap),
      "X-Documents-Included": String(included),
      "X-Documents-Total": String(visibleDocs.length),
    },
  });
}
