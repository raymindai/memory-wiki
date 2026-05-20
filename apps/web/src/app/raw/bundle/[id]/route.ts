import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { permissionResponse } from "@/lib/permission-response";
import { compactMarkdown, estimateTokens, isCompactRequested, isFullRequested, tokenEconomyHeaders } from "@/lib/markdown-compact";
import { extractRequestSignals, logRawFetch } from "@/lib/raw-telemetry";

/**
 * v6 — Bundle URL → Bundle Spec v1.0 conformant markdown payload.
 *
 * One URL paste, full bundle context. Hit by:
 *   - "Copy as context" button in Bundle viewer (fetches → clipboard)
 *   - /b/{id}.md and /b/{id}.txt suffix URLs
 *   - middleware-rewritten /b/{id} requests where the caller signaled
 *     "I want markdown" (Accept: text/markdown / text/plain, or known
 *     AI bot UA)
 *
 * Output (Bundle Spec v1.0 draft):
 *
 *   ---
 *   mdfy_bundle: 1
 *   id: <bundleId>
 *   title: "..."
 *   url: https://memory.wiki/b/<id>
 *   document_count: N
 *   updated: <ISO>
 *   source: "Memory.Wiki"
 *   ---
 *
 *   # <bundle title>
 *
 *   > <bundle description, if any>
 *
 *   ## 1. <doc title>  (https://memory.wiki/<docId>)
 *
 *   <doc markdown body>
 *
 *   ## 2. <next doc title>  ...
 *
 * Restricted bundles (draft / soft-deleted / password / restricted)
 * intentionally 404 here so the AI never receives content the user
 * didn't make public.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const canonicalUrl = `https://memory.wiki/b/${id}`;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return permissionResponse({ reason: "service_unavailable", canonicalUrl, resourceKind: "bundle", resourceId: id });
  }

  // bundles table doesn't have a deleted_at column. Soft-delete is
  // handled via is_draft + the absence from /api/bundles listings. So
  // we only need draft/password/allowed_emails gating here.
  const { data: bundle } = await supabase
    .from("bundles")
    .select("id, title, description, is_draft, password_hash, allowed_emails, updated_at, user_id, graph_data, graph_generated_at, intent")
    .eq("id", id)
    .single();

  if (!bundle) return permissionResponse({ reason: "not_found", canonicalUrl, resourceKind: "bundle", resourceId: id });
  if (bundle.is_draft) return permissionResponse({ reason: "draft", canonicalUrl, resourceKind: "bundle", resourceId: id });
  if (bundle.password_hash) {
    return permissionResponse({ reason: "password_protected", canonicalUrl, resourceKind: "bundle", resourceId: id });
  }

  // W7 shared bundles. allowed_emails on a bundle means: only people in
  // the list (or the owner) can fetch it. AI agents acting on behalf of
  // a person should pass that person's email via the X-User-Email header.
  // Owner is identified separately via JWT (Authorization).
  if (Array.isArray(bundle.allowed_emails) && bundle.allowed_emails.length > 0) {
    const verified = await verifyAuthToken(request.headers.get("authorization"));
    const requesterEmail = (verified?.email || request.headers.get("x-user-email") || "").toLowerCase();
    const allowed = (bundle.allowed_emails as string[]).map((e) => e.toLowerCase());
    const isOwner = verified?.userId && verified.userId === bundle.user_id;
    if (!isOwner && (!requesterEmail || !allowed.includes(requesterEmail))) {
      return permissionResponse({ reason: "email_restricted", canonicalUrl, resourceKind: "bundle", resourceId: id });
    }
  }

  // Resolve bundle's documents in sort_order. Fetch only the columns we
  // need; titles + markdown bodies are the payload, the rest is metadata.
  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, sort_order, annotation")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });

  const docIds = (bundleDocs || []).map(d => d.document_id);

  type DocRow = { id: string; title: string | null; markdown: string; updated_at: string; is_draft: boolean | null; deleted_at: string | null; password_hash: string | null; allowed_emails: string[] | null };
  let docs: DocRow[] = [];
  if (docIds.length > 0) {
    const res = await supabase
      .from("documents")
      .select("id, title, markdown, updated_at, is_draft, deleted_at, password_hash, allowed_emails")
      .in("id", docIds);
    docs = (res.data as DocRow[] | null) || [];
  }
  const byId = new Map(docs.map(d => [d.id, d]));

  // Filter out docs that shouldn't be exposed via the raw fetch path.
  // Mirrors the per-doc /raw/[id] gating: protected/restricted/draft/
  // deleted docs are hidden from the AI fetch payload even when included
  // in a public bundle. Replaces the body with a neutral notice so the
  // bundle structure stays intact.
  const isFetchable = (d: DocRow | undefined): boolean =>
    !!d && !d.deleted_at && !d.is_draft && !d.password_hash &&
    !(Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0);

  const title = (bundle.title || "Untitled Bundle").replace(/"/g, '\\"');
  const updated = bundle.updated_at ? new Date(bundle.updated_at).toISOString() : "";
  const description = (bundle.description || "").trim();
  const intent = (bundle.intent as string | null | undefined) || "";

  const includedCount = (bundleDocs || []).filter(bd => isFetchable(byId.get(bd.document_id))).length;

  // ─── Graph analysis ───────────────────────────────────────────
  // ai_graph stores the canvas's cross-doc analysis: themes,
  // insights, gaps, connections, per-doc summaries, and a
  // node-edge sub-graph. v6 thesis is that THIS analysis is the
  // bundle URL's real value over a plain doc list — paste the URL
  // into Claude/ChatGPT/Cursor and the AI receives the prior AI's
  // work alongside the doc inventory, instead of having to redo it.
  // Vector embeddings stay server-side (numerics aren't useful to
  // an LLM); the markdown serialization below carries only the
  // text outputs the analysis produced.
  //
  // Toggle off with ?graph=0 if the caller wants the doc-list-only
  // digest (analysis can be heavy for some bundles).
  type Graph = {
    summary?: string;
    themes?: string[];
    insights?: string[];
    gaps?: string[];
    keyTakeaways?: string[];
    connections?: Array<{ doc1?: string; doc2?: string; relationship?: string }>;
    documentSummaries?: Record<string, string>;
    nodes?: Array<{ id: string; label: string; type: string; weight?: number; documentId?: string }>;
    edges?: Array<{ source: string; target: string; label?: string; type?: string }>;
  };
  const graph = (bundle.graph_data as Graph | null) || null;
  const graphParam = new URL(request.url).searchParams.get("graph");
  const graphRequested = graphParam !== "0" && graphParam !== "false" && graphParam !== "off";
  const graphGeneratedAt = bundle.graph_generated_at as string | null | undefined;
  // Stale check: if any member doc was edited after the graph was
  // generated, the analysis reflects an old snapshot. Surface that
  // as a warning so the AI can weigh the analysis appropriately
  // (a stale theme of "doc X is the canonical version" is misleading
  // if doc X has since been rewritten).
  const latestDocMs = docs.reduce((m, d) => {
    const t = d.updated_at ? new Date(d.updated_at).getTime() : 0;
    return t > m ? t : m;
  }, 0);
  const isAnalysisStale = !!(graphGeneratedAt && latestDocMs > new Date(graphGeneratedAt).getTime());

  const frontmatter = [
    "---",
    "mdfy_bundle: 1",
    `id: ${bundle.id}`,
    `title: "${title}"`,
    `url: https://memory.wiki/b/${bundle.id}`,
    `document_count: ${includedCount}`,
    updated ? `updated: ${updated}` : null,
    graphGeneratedAt && graphRequested ? `analysis_generated_at: ${new Date(graphGeneratedAt).toISOString()}` : null,
    graphRequested && isAnalysisStale ? "analysis_stale: true" : null,
    'source: "Memory.Wiki"',
    "---",
    "",
  ].filter(Boolean).join("\n");

  const sections: string[] = [];
  sections.push(`# ${bundle.title || "Untitled Bundle"}`);
  if (description) sections.push(`> ${description.split("\n").join("\n> ")}`);
  if (intent) sections.push(`**Intent:** ${intent}`);

  // ─── Graph analysis serialization (markdown, default-on) ───
  // Pure-text outputs of the canvas's AI analysis. Pasted with
  // the bundle URL, the consuming AI gets the prior AI's narrative
  // + a concept sub-graph it can navigate. Embeddings stay
  // server-side; this is the digest of what the embeddings + LLM
  // analysis already produced.
  const renderGraphSections = (g: Graph): string[] => {
    const out: string[] = [];
    if (isAnalysisStale) {
      out.push(`> ⚠ _Analysis may be stale — one or more member docs were edited after the last analysis run. Re-run the canvas to refresh._`);
    }
    if (g.summary && g.summary.trim()) {
      out.push("## Summary");
      out.push(g.summary.trim());
    }
    if (Array.isArray(g.themes) && g.themes.length > 0) {
      out.push("## Themes");
      out.push(g.themes.map((t) => `- ${t}`).join("\n"));
    }
    if (Array.isArray(g.insights) && g.insights.length > 0) {
      out.push("## Cross-document insights");
      out.push(g.insights.map((s) => `- ${s}`).join("\n"));
    }
    if (Array.isArray(g.keyTakeaways) && g.keyTakeaways.length > 0) {
      out.push("## Key takeaways");
      out.push(g.keyTakeaways.map((s) => `- ${s}`).join("\n"));
    }
    if (Array.isArray(g.gaps) && g.gaps.length > 0) {
      out.push("## Open questions / gaps");
      out.push(g.gaps.map((s) => `- ${s}`).join("\n"));
    }
    if (Array.isArray(g.connections) && g.connections.length > 0) {
      out.push("## Notable connections");
      const docTitleById = new Map<string, string>();
      for (const d of docs) docTitleById.set(d.id, d.title || "Untitled");
      const lines: string[] = [];
      for (const c of g.connections.slice(0, 12)) {
        const a = docTitleById.get(c.doc1 || "") || c.doc1 || "?";
        const b = docTitleById.get(c.doc2 || "") || c.doc2 || "?";
        const rel = (c.relationship || "").trim();
        lines.push(`- **${a}** ↔ **${b}**${rel ? ` — ${rel}` : ""}`);
      }
      out.push(lines.join("\n"));
    }
    // Concept sub-graph: nodes typed as concept + edges between
    // concepts, rendered as bullets. This is the bundle-scope
    // ontology — distinct from the hub-wide concept_index.
    if (Array.isArray(g.nodes) && g.nodes.length > 0) {
      const conceptNodes = g.nodes.filter((n) => n.type === "concept");
      if (conceptNodes.length > 0) {
        out.push("## Concepts (this bundle)");
        const docTitleById = new Map<string, string>();
        for (const d of docs) docTitleById.set(d.id, d.title || "Untitled");
        const conceptLines: string[] = [];
        for (const n of conceptNodes.slice(0, 25)) {
          const docTitle = n.documentId ? docTitleById.get(n.documentId) : null;
          const src = docTitle ? ` (from **${docTitle}**)` : "";
          conceptLines.push(`- **${n.label}**${src}`);
        }
        out.push(conceptLines.join("\n"));
        // Edges restricted to concept↔concept for narrative weight.
        const conceptIds = new Set(conceptNodes.map((n) => n.id));
        const conceptEdges = (g.edges || []).filter((e) => conceptIds.has(e.source) && conceptIds.has(e.target));
        if (conceptEdges.length > 0) {
          out.push("## Concept relations");
          const labelById = new Map(conceptNodes.map((n) => [n.id, n.label] as const));
          const edgeLines: string[] = [];
          for (const e of conceptEdges.slice(0, 25)) {
            const a = labelById.get(e.source) || e.source;
            const b = labelById.get(e.target) || e.target;
            edgeLines.push(`- **${a}** ↔ **${b}**${e.label ? ` — ${e.label}` : ""}`);
          }
          out.push(edgeLines.join("\n"));
        }
      }
    }
    return out;
  };

  if (graphRequested && graph) {
    const graphMd = renderGraphSections(graph);
    if (graphMd.length > 0) sections.push(...graphMd);
  }

  const compact = isCompactRequested(request.url);
  // Digest-first: by default the bundle's raw payload is the
  // analysis + the doc list (titles + annotations + links). The
  // AI follows the links per-doc as needed. ?full=1 returns the
  // legacy behaviour where every doc body is concatenated inline.
  const fullMode = isFullRequested(request.url);

  let visibleIdx = 0;
  for (const bd of bundleDocs || []) {
    const d = byId.get(bd.document_id);
    if (!isFetchable(d)) continue;
    visibleIdx++;
    const docTitle = d!.title || "Untitled";
    const docUrl = `https://memory.wiki/${d!.id}`;
    const annotation = (bd.annotation || "").trim();
    if (fullMode) {
      sections.push(`## ${visibleIdx}. ${docTitle}`);
      sections.push(`*Source: ${docUrl}*`);
      if (annotation) sections.push(`> ${annotation.split("\n").join("\n> ")}`);
      const docMd = d!.markdown || "";
      sections.push(compact ? compactMarkdown(docMd) : docMd);
    } else {
      // Digest row — single line per doc with the title as a link
      // and the annotation (if any) as a continuation. Mirrors the
      // hub digest's terse shape; AI follows the link for the body.
      const annotationSuffix = annotation ? ` — ${annotation.replace(/\s+/g, " ")}` : "";
      sections.push(`${visibleIdx}. [${docTitle}](${docUrl})${annotationSuffix}`);
    }
  }

  if (visibleIdx === 0) {
    sections.push("_This bundle currently exposes no public documents._");
  }

  if (!fullMode && visibleIdx > 0) {
    sections.push("\n_Digest view — follow any link above to fetch that doc's full markdown. Add `?full=1` to this URL for the concatenated payload._");
  }

  const joined = `${frontmatter}\n${sections.join("\n\n")}`;
  const body = compact ? compactMarkdown(joined) : joined;

  const sig = extractRequestSignals(request);
  logRawFetch({
    route: "bundle",
    resource: bundle.id,
    compact,
    digest: !fullMode,
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
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      "Link": `<https://memory.wiki/b/${bundle.id}>; rel="canonical"`,
      "X-Bundle-ID": bundle.id,
      "X-Document-Count": String(includedCount),
      "X-Mdfy-Mode": fullMode ? "full" : "digest",
      ...tokenEconomyHeaders(body, { compact, digest: !fullMode }),
    },
  });
}
