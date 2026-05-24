import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { permissionResponse } from "@/lib/permission-response";
import { verifyAuthToken } from "@/lib/verify-auth";
import { compactMarkdown, estimateTokens, isCompactRequested, tokenEconomyHeaders } from "@/lib/markdown-compact";
import { extractRequestSignals, logRawFetch } from "@/lib/raw-telemetry";

// Public, AI-deployable representation of a single Memory.Wiki document.
// Hit by:
//   - explicit /raw/{id} requests
//   - middleware-rewritten /{id} requests where the caller signaled "I want
//     markdown" (Accept: text/markdown / text/plain, or known AI bot UA)
//   - /{id}.md and /{id}.txt suffix URLs (also handled by middleware)
//
// Output is plain markdown with a YAML frontmatter block carrying the bits
// an AI reader needs to attribute and reuse the doc:
//   - title  — human title
//   - url    — canonical Memory.Wiki URL (so the LLM can cite it back)
//   - updated — ISO timestamp
//   - source  — always "Memory.Wiki" so the LLM knows the origin
//
// Restricted documents (draft / soft-deleted / password-protected /
// expired / email-restricted) intentionally 404 here so the AI never
// receives content the user didn't make public.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canonicalUrl = `https://memory.wiki/${id}`;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return permissionResponse({ reason: "service_unavailable", canonicalUrl, resourceKind: "doc", resourceId: id });
  }

  const { data } = await supabase
    .from("documents")
    .select("id, markdown, title, is_draft, deleted_at, password_hash, expires_at, allowed_emails, updated_at, source, user_id, ai_graph, ai_graph_generated_at, summary")
    .eq("id", id)
    .single();

  if (!data) {
    return permissionResponse({ reason: "not_found", canonicalUrl, resourceKind: "doc", resourceId: id });
  }
  if (data.deleted_at) {
    return permissionResponse({ reason: "deleted", canonicalUrl, resourceKind: "doc", resourceId: id });
  }
  if (data.is_draft) {
    return permissionResponse({ reason: "draft", canonicalUrl, resourceKind: "doc", resourceId: id });
  }
  if (data.password_hash) {
    return permissionResponse({ reason: "password_protected", canonicalUrl, resourceKind: "doc", resourceId: id });
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return permissionResponse({ reason: "expired", canonicalUrl, resourceKind: "doc", resourceId: id });
  }
  if (Array.isArray(data.allowed_emails) && data.allowed_emails.length > 0) {
    const verified = await verifyAuthToken(request.headers.get("authorization"));
    const requesterEmail = (verified?.email || request.headers.get("x-user-email") || "").toLowerCase();
    const allowed = (data.allowed_emails as string[]).map((e) => e.toLowerCase());
    const isOwner = verified?.userId && verified.userId === data.user_id;
    if (!isOwner && (!requesterEmail || !allowed.includes(requesterEmail))) {
      return permissionResponse({ reason: "email_restricted", canonicalUrl, resourceKind: "doc", resourceId: id });
    }
  }

  const title = (data.title || "Untitled").replace(/"/g, '\\"');
  const updated = data.updated_at ? new Date(data.updated_at).toISOString() : "";
  const source = data.source ? String(data.source).replace(/"/g, '\\"') : "Memory.Wiki";

  // ── Knowledge-graph context for this doc ──────────────────────
  // The hub-level digest carries the full concept graph; for an AI
  // landing on a single doc URL we surface just the concepts that
  // touch THIS doc + the relations between them + the bundles that
  // include it. Lets the AI position the doc inside the larger hub
  // without an extra round-trip.
  type ConceptRow = { id: number; label: string; concept_type: string | null; description: string | null; weight: number | null; doc_ids: string[] | null };
  const { data: conceptRows } = await supabase
    .from("concept_index")
    .select("id, label, concept_type, description, weight, doc_ids")
    .eq("user_id", data.user_id)
    .contains("doc_ids", [id])
    .order("weight", { ascending: false })
    .limit(12);
  const concepts = (conceptRows as ConceptRow[] | null) || [];
  const conceptIds = concepts.map((c) => c.id);
  type RelationRow = { source_concept_id: number; target_concept_id: number; relation_label: string | null };
  let relations: RelationRow[] = [];
  if (conceptIds.length > 1) {
    const { data: relRows } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label")
      .eq("user_id", data.user_id)
      .in("source_concept_id", conceptIds)
      .in("target_concept_id", conceptIds)
      .limit(20);
    relations = (relRows as RelationRow[] | null) || [];
  }
  const conceptLabelById = new Map(concepts.map((c) => [c.id, c.label]));

  // Bundles that contain this doc. Cheap one-shot join. Filter out
  // private/draft/restricted bundles so we don't leak metadata.
  type BundleRow = { id: string; title: string | null; description: string | null; is_draft: boolean | null; password_hash: string | null; allowed_emails: string[] | null };
  type BundleDocRow = { bundle_id: string };
  const { data: bdRows } = await supabase
    .from("bundle_documents")
    .select("bundle_id")
    .eq("document_id", id);
  const bundleIds = Array.from(new Set((bdRows as BundleDocRow[] | null || []).map((r) => r.bundle_id)));
  let parentBundles: BundleRow[] = [];
  if (bundleIds.length > 0) {
    const { data: bundleRows } = await supabase
      .from("bundles")
      .select("id, title, description, is_draft, password_hash, allowed_emails")
      .in("id", bundleIds);
    parentBundles = ((bundleRows as BundleRow[] | null) || []).filter(
      (b) => !b.is_draft && !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0),
    );
  }

  // Owner's hub slug — gives the AI the canonical "what hub does this
  // doc live in" pointer so it can fetch the wider corpus if needed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("hub_slug, hub_public, display_name")
    .eq("id", data.user_id)
    .single();
  const hubSlug = profile?.hub_public ? profile.hub_slug : null;

  const contextLines: string[] = [];

  // AI graph (themes / insights / takeaways / open questions) generated
  // by Claude Haiku at write time and cached on the row. Same shape as
  // bundle.graph_data but scoped to a single doc — lets an AI fetching
  // /raw/<id> see the analytical surface, not just the body. Surfaced
  // FIRST in the context block so it anchors interpretation.
  type DocGraph = {
    themes?: string[];
    insights?: string[];
    keyTakeaways?: string[];
    openQuestions?: string[];
  };
  const aiGraph = (data as { ai_graph?: DocGraph | null }).ai_graph;
  if (aiGraph && typeof aiGraph === "object") {
    const summary = (data as { summary?: string | null }).summary || null;
    if (summary && summary.trim().length > 0) {
      contextLines.push("## Summary");
      contextLines.push(summary.trim());
      contextLines.push("");
    }
    if (Array.isArray(aiGraph.themes) && aiGraph.themes.length > 0) {
      contextLines.push("## Themes");
      contextLines.push(aiGraph.themes.map((t) => `- ${t}`).join("\n"));
      contextLines.push("");
    }
    if (Array.isArray(aiGraph.keyTakeaways) && aiGraph.keyTakeaways.length > 0) {
      contextLines.push("## Key takeaways");
      contextLines.push(aiGraph.keyTakeaways.map((t) => `- ${t}`).join("\n"));
      contextLines.push("");
    }
    if (Array.isArray(aiGraph.insights) && aiGraph.insights.length > 0) {
      contextLines.push("## Insights");
      contextLines.push(aiGraph.insights.map((t) => `- ${t}`).join("\n"));
      contextLines.push("");
    }
    if (Array.isArray(aiGraph.openQuestions) && aiGraph.openQuestions.length > 0) {
      contextLines.push("## Open questions / gaps");
      contextLines.push(aiGraph.openQuestions.map((t) => `- ${t}`).join("\n"));
      contextLines.push("");
    }
  }

  if (concepts.length > 0) {
    contextLines.push("## Concepts in this document");
    for (const c of concepts) {
      const meta = c.concept_type ? ` _(${c.concept_type})_` : "";
      contextLines.push(`- **${c.label}**${meta}`);
      if (c.description) contextLines.push(`  ${c.description.split("\n")[0].slice(0, 200)}`);
    }
  }
  if (relations.length > 0) {
    contextLines.push("");
    contextLines.push("## Concept relations (within this doc's concepts)");
    for (const r of relations) {
      const src = conceptLabelById.get(r.source_concept_id);
      const tgt = conceptLabelById.get(r.target_concept_id);
      if (!src || !tgt) continue;
      contextLines.push(`- **${src}** ${(r.relation_label || "→").trim()} **${tgt}**`);
    }
  }
  if (parentBundles.length > 0) {
    contextLines.push("");
    contextLines.push("## Bundles containing this document");
    for (const b of parentBundles.slice(0, 10)) {
      const t = (b.title || "Untitled bundle").replace(/[\r\n]+/g, " ");
      contextLines.push(`- [${t}](https://memory.wiki/b/${b.id})`);
      if (b.description) contextLines.push(`  > ${b.description.split("\n")[0].slice(0, 200)}`);
    }
  }
  if (hubSlug) {
    contextLines.push("");
    contextLines.push(`_Hub canonical:_ https://memory.wiki/hub/${hubSlug} · _Concept digest:_ https://memory.wiki/raw/hub/${hubSlug}?digest=1&compact=1`);
  }
  const contextBlock = contextLines.length > 0 ? `\n\n---\n\n${contextLines.join("\n")}\n` : "";

  // Frontmatter first, then the raw markdown body. The body usually starts
  // with its own H1; we don't repeat the title to avoid duplicate headings.
  const frontmatter = [
    "---",
    `title: "${title}"`,
    `url: https://memory.wiki/${id}`,
    updated ? `updated: ${updated}` : null,
    hubSlug ? `hub: https://memory.wiki/hub/${hubSlug}` : null,
    parentBundles.length > 0 ? `bundle_count: ${parentBundles.length}` : null,
    concepts.length > 0 ? `concept_count: ${concepts.length}` : null,
    `source: "${source}"`,
    "---",
    "",
  ].filter(Boolean).join("\n");

  const compact = isCompactRequested(request.url);
  const rawMarkdown = data.markdown || "";
  const md = compact ? compactMarkdown(rawMarkdown) : rawMarkdown;
  const body = `${frontmatter}\n${md}${contextBlock}`;

  const sig = extractRequestSignals(request);
  logRawFetch({
    route: "doc",
    resource: id,
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
      // Short edge cache + revalidate so renames / edits propagate within a
      // minute. AIs that re-fetch on subsequent prompts pick up new content
      // without forcing them to bust caches.
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      // Tell crawlers the canonical browser URL so search ranks the human
      // page, not the raw markdown.
      "Link": `<https://memory.wiki/${id}>; rel="canonical"`,
      "X-Document-ID": id,
      ...tokenEconomyHeaders(body, { compact }),
    },
  });
}
