import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { estimateTokens } from "@/lib/markdown-compact";

/**
 * GET /hub/[slug]/llms.txt — LLM crawl manifest for the hub.
 *
 * Standard llms.txt shape (https://llmstxt.org). Plain text + a few
 * markdown links so any LLM can ingest it without parsing. Tells the
 * model exactly which raw URLs to fetch and which `?compact=1` /
 * `?digest=1` variants minimize token spend.
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

  const [{ data: docs }, { data: bundles }] = await Promise.all([
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
      .from("bundles")
      .select("id, title, description, updated_at, password_hash, allowed_emails")
      .eq("user_id", profile.id)
      .eq("is_draft", false)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const visibleDocs = (docs || []).filter((d) => {
    const ae = (d as { allowed_emails?: string[] | null }).allowed_emails;
    return !(Array.isArray(ae) && ae.length > 0);
  });
  const visibleBundles = (bundles || []).filter(
    (b) => !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0)
  );

  const totalTokens = visibleDocs.reduce((sum, d) => sum + estimateTokens(d.markdown || ""), 0);

  const author = profile.display_name || slug;
  const description = (profile.hub_description || "").trim();

  const lines: string[] = [];
  lines.push(`# ${author}'s knowledge hub`);
  if (description) lines.push("");
  if (description) lines.push(`> ${description}`);
  lines.push("");
  lines.push(
    `Canonical hub URL: https://memory.wiki/hub/${slug}`
  );
  lines.push(
    `Wiki manifest (concept-grouped TOC): https://memory.wiki/hub/${slug}/index.md`
  );
  lines.push(
    `Wiki schema (what URLs are available + how to use them): https://memory.wiki/hub/${slug}/SCHEMA.md`
  );
  lines.push(
    `Activity log (public events only): https://memory.wiki/hub/${slug}/log.md`
  );
  lines.push(
    `Lint report (orphan + duplicate findings): https://memory.wiki/raw/hub/${slug}/lint.md`
  );
  lines.push(
    `Index (full markdown listing): https://memory.wiki/raw/hub/${slug}?compact=1`
  );
  lines.push(
    `Concept digest (densest summary): https://memory.wiki/raw/hub/${slug}?digest=1&compact=1`
  );
  lines.push(
    `Full text (every doc concatenated, capped to fit a context window): https://memory.wiki/hub/${slug}/llms-full.txt`
  );
  lines.push("");
  lines.push(`Hub size: ~${totalTokens.toLocaleString()} tokens across ${visibleDocs.length} public documents.`);
  lines.push(
    "Every document below is also available as `https://memory.wiki/raw/<id>?compact=1` for token-economical fetches."
  );

  if (visibleDocs.length > 0) {
    lines.push("");
    lines.push("## Documents");
    for (const d of visibleDocs.slice(0, 200)) {
      const tokens = estimateTokens(d.markdown || "");
      lines.push(`- [${d.title || "Untitled"}](https://memory.wiki/${d.id}) — ~${tokens} tokens`);
    }
    if (visibleDocs.length > 200) {
      lines.push(`- …and ${visibleDocs.length - 200} more documents.`);
    }
  }

  if (visibleBundles.length > 0) {
    lines.push("");
    lines.push("## Bundles");
    for (const b of visibleBundles.slice(0, 50)) {
      const desc = (b.description || "").trim().split("\n")[0];
      const suffix = desc ? `: ${desc.slice(0, 120)}` : "";
      lines.push(`- [${b.title || "Untitled Bundle"}](https://memory.wiki/b/${b.id})${suffix}`);
    }
  }

  lines.push("");
  lines.push("## Optional");
  lines.push(`- [Owner page](https://memory.wiki/hub/${slug}): rendered HTML view`);

  const body = lines.join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      "Link": `<https://memory.wiki/hub/${slug}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
    },
  });
}
