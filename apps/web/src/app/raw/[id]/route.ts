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

  // Frontmatter first, then the raw markdown body. The body usually starts
  // with its own H1; we don't repeat the title to avoid duplicate headings.
  const frontmatter = [
    "---",
    `title: "${title}"`,
    `url: https://memory.wiki/${id}`,
    updated ? `updated: ${updated}` : null,
    `source: "${source}"`,
    "---",
    "",
  ].filter(Boolean).join("\n");

  const compact = isCompactRequested(request.url);
  const rawMarkdown = data.markdown || "";
  const md = compact ? compactMarkdown(rawMarkdown) : rawMarkdown;
  const body = `${frontmatter}\n${md}`;

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
