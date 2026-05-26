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
    .select("id, markdown, title, is_draft, deleted_at, password_hash, expires_at, allowed_emails, updated_at, source, user_id")
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

  // Pull doc-level AI metadata + extracted concepts + within-doc concept
  // relations. Each query is wrapped so a failure on the side metadata
  // never blocks the main body response.
  type RelRow = {
    relation_label: string;
    weight: number;
    source_concept: { label: string } | null;
    target_concept: { label: string } | null;
  };
  type ConceptRow = { id: number; label: string; description: string | null; weight: number };
  type AiMetaRow = { tags?: string[] | null; ai_summary?: string | null };

  const [aiMeta, conceptsInDoc, relationsInDoc] = await Promise.all([
    (async (): Promise<AiMetaRow | null> => {
      try {
        const { data: m } = await supabase
          .from("document_ai_metadata")
          .select("tags, ai_summary")
          .eq("document_id", id)
          .maybeSingle();
        return (m as AiMetaRow | null) ?? null;
      } catch { return null; }
    })(),
    (async (): Promise<ConceptRow[]> => {
      try {
        const { data: c } = await supabase
          .from("concept_index")
          .select("id, label, description, weight")
          .eq("user_id", data.user_id)
          .contains("doc_ids", [id])
          .order("weight", { ascending: false })
          .limit(30);
        return (c as ConceptRow[] | null) ?? [];
      } catch { return []; }
    })(),
    (async (): Promise<RelRow[]> => {
      try {
        const { data: r } = await supabase
          .from("concept_relations")
          .select("relation_label, weight, source_concept:source_concept_id ( label ), target_concept:target_concept_id ( label )")
          .eq("user_id", data.user_id)
          .contains("evidence_doc_ids", [id])
          .order("weight", { ascending: false })
          .limit(40);
        return (r as unknown as RelRow[] | null) ?? [];
      } catch { return []; }
    })(),
  ]);

  const tagList = Array.isArray(aiMeta?.tags) && aiMeta!.tags!.length > 0
    ? (aiMeta!.tags as string[]).slice(0, 12)
    : [];

  // Frontmatter first, then the raw markdown body. The body usually starts
  // with its own H1; we don't repeat the title to avoid duplicate headings.
  const frontmatter = [
    "---",
    `mw_doc: 1`,
    `title: "${title}"`,
    `url: https://memory.wiki/${id}`,
    updated ? `updated: ${updated}` : null,
    `source: "${source}"`,
    tagList.length > 0 ? `tags: [${tagList.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]` : null,
    conceptsInDoc.length > 0 ? `concept_count: ${conceptsInDoc.length}` : null,
    relationsInDoc.length > 0 ? `relation_count: ${relationsInDoc.length}` : null,
    "---",
    "",
  ].filter(Boolean).join("\n");

  // Build the doc-level KG appendix the AI reader sees AFTER the body.
  // Kept short on purpose — full concept records live at the hub-wide
  // /raw/hub/<slug>/c/<concept> endpoint. Here we just expose what's
  // useful for grounding an answer in this single doc.
  function buildKgAppendix(): string {
    if (conceptsInDoc.length === 0 && relationsInDoc.length === 0 && !aiMeta?.ai_summary) {
      return "";
    }
    const parts: string[] = [""];
    if (aiMeta?.ai_summary) {
      parts.push("## AI summary", aiMeta.ai_summary.trim(), "");
    }
    if (conceptsInDoc.length > 0) {
      parts.push("## Concepts (this doc)");
      for (const c of conceptsInDoc) {
        parts.push(c.description ? `- **${c.label}** — ${c.description}` : `- **${c.label}**`);
      }
      parts.push("");
    }
    if (relationsInDoc.length > 0) {
      parts.push("## Concept relations (this doc)");
      for (const r of relationsInDoc) {
        const a = r.source_concept?.label;
        const b = r.target_concept?.label;
        if (!a || !b) continue;
        parts.push(`- **${a}** → *${r.relation_label}* → **${b}**`);
      }
      parts.push("");
    }
    return parts.join("\n");
  }

  const compact = isCompactRequested(request.url);
  const rawMarkdown = data.markdown || "";
  const md = compact ? compactMarkdown(rawMarkdown) : rawMarkdown;
  // KG appendix is dropped in compact mode (token economy) and on the
  // unauthed public path when there's nothing to add. Otherwise it
  // sits below the body so the AI reads the body first, then sees the
  // structured grounding signal.
  const kg = compact ? "" : buildKgAppendix();
  const body = `${frontmatter}\n${md}${kg}`;

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
