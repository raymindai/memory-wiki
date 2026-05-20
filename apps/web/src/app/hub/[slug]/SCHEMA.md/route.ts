// GET /hub/[slug]/SCHEMA.md
//
// Self-describing manifest of a hub's surface. Tells the consumer
// (AI agent, scraper, curious human) exactly which URLs are
// reachable, what each one returns, and how to address the
// per-concept and per-doc views.
//
// Inspired by the Hermes Agent "SCHEMA.md" — Karpathy's wiki
// shape needs a description file so the agent knows where to look
// next. We make ours per-hub (substituting the slug) so callers
// don't have to consult the project docs separately.
//
// Restricted hubs (hub_public=false) return 404.

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { estimateTokens } from "@/lib/markdown-compact";

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
    .select("display_name, hub_slug, hub_public, hub_description")
    .eq("hub_slug", slug)
    .single();

  if (!profile || !profile.hub_public) {
    return new NextResponse("Hub not found", { status: 404 });
  }

  const author = profile.display_name || slug;
  const description = (profile.hub_description || "").trim();
  const base = `https://memory.wiki`;

  const body = `# SCHEMA — ${author}'s hub
${description ? `\n> ${description}\n` : ""}
This file describes the public surface of \`memory.wiki/hub/${slug}\`. Every URL
below returns plain markdown unless noted; cacheable; no auth required.

## Manifest files

- [\`/hub/${slug}/index.md\`](${base}/hub/${slug}/index.md) — concept-grouped table of contents.
- [\`/hub/${slug}/log.md\`](${base}/hub/${slug}/log.md) — append-only activity log (public events only).
- [\`/hub/${slug}/SCHEMA.md\`](${base}/hub/${slug}/SCHEMA.md) — this file.
- [\`/hub/${slug}/llms.txt\`](${base}/hub/${slug}/llms.txt) — llmstxt.org manifest with token estimates per doc.
- [\`/hub/${slug}/llms-full.txt\`](${base}/hub/${slug}/llms-full.txt) — every public doc concatenated, capped to fit a context window. Override the cap with \`?cap=200000\`.

## Content URLs

- [\`/raw/hub/${slug}\`](${base}/raw/hub/${slug}) — whole-hub markdown listing.
- [\`/raw/hub/${slug}?digest=1\`](${base}/raw/hub/${slug}?digest=1) — concept-clustered summary (fewer tokens).
- [\`/raw/hub/${slug}/c/<concept>\`](${base}/raw/hub/${slug}/c/example) — per-concept passages across docs.
- [\`/raw/hub/${slug}/lint.md\`](${base}/raw/hub/${slug}/lint.md) — orphan docs + likely-duplicate pairs (the wiki's health snapshot).
- [\`/raw/<doc-id>\`](${base}/raw/abc123) — plain markdown for a single document.
- [\`/raw/b/<bundle-id>\`](${base}/raw/b/abc123) — concatenated markdown for a bundle.

Every \`/raw/\` URL accepts \`?compact=1\` to strip whitespace + emojis + redundant
headings for a token-economical fetch (typically 30-50% savings, same answer).

## Query API

- \`POST ${base}/api/hub/${slug}/recall\` — semantic + keyword search across this hub's public docs.
  Body: \`{ "query": string, "k"?: number, "rerank"?: boolean }\`.
  Returns top-k matches with snippet, score, and source doc URL.
  Setting \`rerank: true\` runs a Haiku-based cross-encoder pass for higher precision (one extra Anthropic call).

## Page criteria (when to create vs. update)

When the owner ingests a new source, it lands as a new page if it satisfies any of:
- introduces a **central concept** not already covered;
- the concept **recurs** across two or more sources;
- the topic is **independent** — gluing it onto an existing page would dilute that page's focus.

Otherwise the new content merges into an existing page and the concept index updates.

## Provenance

Documents tagged with \`source: github:<owner>/<repo>\` or \`source: obsidian\` carry their
origin in the \`compile_from.external\` field. Use that to round-trip a doc back to its
original surface or to detect imported (vs. authored) content.
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "Link": `<${base}/hub/${slug}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
    },
  });
}
