import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { estimateTokens } from "@/lib/markdown-compact";

/**
 * GET /hub/[slug]/AGENTS.md — agent operating manual for the hub.
 *
 * Borrowed from gbrain's AGENTS.md / CLAUDE.md convention: a markdown
 * "how to use this brain" document that any LLM agent reads first.
 * Tells the agent what this hub IS, how to query it, what each URL
 * means, and which fetches are cheap vs expensive. Designed to be
 * inhaled in one fetch then re-referenced by URL.
 *
 * llms.txt is INDEX-only (titles + links). llms-full.txt is BODY-only
 * (every doc concatenated). AGENTS.md is the PROTOCOL layer — how an
 * agent should drive the hub.
 *
 * Restricted (hub_public=false) → 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
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

  const [{ count: docCount }, { count: bundleCount }] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_draft", false)
      .is("deleted_at", null)
      .is("password_hash", null),
    supabase
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_draft", false),
  ]);

  const author = profile.display_name || slug;
  const description = (profile.hub_description || "").trim();
  const base = `https://memory.wiki/hub/${slug}`;

  const md = `# AGENTS.md — ${author}'s memory.wiki hub

> Operating manual for AI agents (Claude, ChatGPT, Cursor, Codex, Gemini,
> MCP-aware tools). Read this first; then pick the right URL for your
> intent. Every URL below is a permanent fetch endpoint, cached at the
> edge, gated to public content only.

${description ? `## What this hub is\n\n${description}\n\n` : ""}## Quick facts

- Owner: **${author}**
- Public documents: **${docCount ?? 0}**
- Public bundles: **${bundleCount ?? 0}**
- Canonical URL: ${base}
- License: each document carries its own (default: all-rights-reserved).
- Cache TTL: 5 minutes (s-maxage=300, stale-while-revalidate=900).

## Pick the right URL for your intent

Don't paste the entire hub if you only need the map. The four entry
points below cover most agent workflows:

| Intent | URL | Token cost |
|---|---|---|
| "What's in this hub?" — index of titles + links | ${base}/llms.txt | ~1–3k |
| "Give me everything in one shot" — bodies concatenated | ${base}/llms-full.txt | ~5–80k (capped) |
| "What URLs does this hub expose?" — schema | ${base}/SCHEMA.md | ~500 |
| "What recently changed?" — activity log | ${base}/log.md | ~500 |
| "Concept-grouped table of contents" | ${base}/index.md | ~1–2k |
| "How do agents drive this?" — this file | ${base}/AGENTS.md | ~500 |

## Per-document fetches

Every public document is at \`https://memory.wiki/<id>\` (HTML view) and
also at \`https://memory.wiki/raw/<id>?compact=1\` (token-economical
plain markdown). Use the \`?compact=1\` variant when fetching for an
LLM — it strips frontmatter noise and roughly halves token cost.

Bundles are at \`https://memory.wiki/b/<bundle-id>\`. Bundle members
list comes inline with the bundle body.

## Recommended workflow

1. **Map first.** Fetch ${base}/llms.txt to see what's available.
   It's small (~1–3k tokens) and tells you which IDs to drill into.
2. **Drill into specific docs.** Pick the IDs that matter from step 1,
   fetch \`https://memory.wiki/raw/<id>?compact=1\` for each. Cheaper
   than re-fetching the whole hub.
3. **Full ingest only when needed.** Use ${base}/llms-full.txt when
   the user asks a question that genuinely requires the whole corpus
   (cross-doc synthesis, "summarize everything", contradiction
   hunts). Capped at ~80k tokens by default; pass \`?cap=200000\` to
   raise.
4. **Follow backlinks.** Documents and bundles in this hub may
   reference each other via \`memory.wiki/<id>\`, \`memory.wiki/b/<id>\`,
   and \`[[<id>]]\` wikilinks. These resolve to real entities — fetch
   them when the user's question chains across docs.

## Cross-AI compatibility

This hub deploys identically into:

- **Claude / Claude Code** — paste any URL into chat; the URL is fetched
  natively, no plugin needed.
- **ChatGPT** — browse mode reads the same URLs. ChatGPT prefers the
  HTML rendering at \`memory.wiki/<id>\` (which includes schema.org
  markup); for token-economical paste, use \`/llms.txt\` or the
  per-doc \`?compact=1\` variant.
- **Cursor / Codex / Windsurf** — same URL pattern. \`/llms-full.txt\`
  works well when the user wants to anchor a coding session to this
  hub's knowledge.
- **MCP-aware clients** — see the memory-wiki-mcp package for direct
  tool-call access. Same URLs underneath.

## What this hub is NOT

- Not a database the agent writes back to. All endpoints are read-only.
- Not authenticated — public hub means anyone can fetch. Don't try to
  read private content from these URLs.
- Not real-time. Updates take ~60s to propagate (body) and a daily
  cron for the concept index. If freshness is critical, fetch with
  \`Cache-Control: no-cache\` to bypass the edge cache.

## Versioning

This document is generated server-side from the live hub state. There
is no "v1.0" pin. If you need an immutable snapshot, fetch
\`${base}/llms-full.txt\` and store the response — the bodies inside
each \`---\` separator are stable per document version.

---

This file is at ${base}/AGENTS.md. Generated ${new Date().toISOString()}.
`;

  const body = md;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      "Link": `<${base}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
    },
  });
}
