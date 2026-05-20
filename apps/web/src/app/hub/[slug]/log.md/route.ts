// GET /hub/[slug]/log.md
//
// Append-only activity stream for a public hub, surfaced as plain
// markdown. Mirrors the Hermes "log.md" affordance — anyone with
// the URL can see "what's happened here lately" without scraping.
//
// We pull from the `hub_log` table the backend writes to whenever
// docs are imported, bundles are created, ontology refreshes run,
// etc. The log is the owner's view in the editor; here we publish
// a public-safe slice of it: events that mention public-only IDs
// (no draft docs, no email-restricted bundles).
//
// Restricted hubs (hub_public=false) return 404.

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { estimateTokens } from "@/lib/markdown-compact";

const MAX_EVENTS = 200;

interface LogRow {
  id: number;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Event types that publish safely (no PII, no private state hints).
// Anything not in this set gets dropped from the public log.
const PUBLIC_EVENT_TYPES = new Set([
  "doc.published",
  "doc.imported",
  "bundle.created",
  "bundle.published",
  "hub.public_toggled",
  "ontology.refreshed",
]);

function formatDayHeading(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function formatTime(iso: string): string {
  return iso.slice(11, 16); // HH:MM
}

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
    .select("id, display_name, hub_slug, hub_public")
    .eq("hub_slug", slug)
    .single();

  if (!profile || !profile.hub_public) {
    return new NextResponse("Hub not found", { status: 404 });
  }

  // Pull recent events. We over-fetch and then filter so the
  // public-safe slice still has enough rows to show after we drop
  // events that reference private docs/bundles.
  const { data: rows } = await supabase
    .from("hub_log")
    .select("id, event_type, target_type, target_id, summary, metadata, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(MAX_EVENTS * 2);

  const events = (rows || []) as LogRow[];

  // For each event that points at a doc/bundle, confirm the target
  // is public (so we don't leak a draft title through the summary).
  const docIds = new Set<string>();
  const bundleIds = new Set<string>();
  for (const e of events) {
    if (!e.target_id) continue;
    if (e.target_type === "document") docIds.add(e.target_id);
    if (e.target_type === "bundle") bundleIds.add(e.target_id);
  }

  const [{ data: publicDocs }, { data: publicBundles }] = await Promise.all([
    docIds.size > 0
      ? supabase
          .from("documents")
          .select("id, allowed_emails, password_hash, is_draft, deleted_at")
          .in("id", [...docIds])
      : Promise.resolve({ data: [] as { id: string; allowed_emails: string[] | null; password_hash: string | null; is_draft: boolean | null; deleted_at: string | null }[] }),
    bundleIds.size > 0
      ? supabase
          .from("bundles")
          .select("id, allowed_emails, password_hash, is_draft")
          .in("id", [...bundleIds])
      : Promise.resolve({ data: [] as { id: string; allowed_emails: string[] | null; password_hash: string | null; is_draft: boolean | null }[] }),
  ]);

  const publicDocSet = new Set(
    (publicDocs || [])
      .filter((d) => !d.is_draft && !d.password_hash && !d.deleted_at && !(Array.isArray(d.allowed_emails) && d.allowed_emails.length > 0))
      .map((d) => d.id),
  );
  const publicBundleSet = new Set(
    (publicBundles || [])
      .filter((b) => !b.is_draft && !b.password_hash && !(Array.isArray(b.allowed_emails) && b.allowed_emails.length > 0))
      .map((b) => b.id),
  );

  const publishable = events.filter((e) => {
    if (!PUBLIC_EVENT_TYPES.has(e.event_type)) return false;
    if (e.target_type === "document" && e.target_id && !publicDocSet.has(e.target_id)) return false;
    if (e.target_type === "bundle" && e.target_id && !publicBundleSet.has(e.target_id)) return false;
    return true;
  }).slice(0, MAX_EVENTS);

  // Group by day for readability.
  const groups = new Map<string, LogRow[]>();
  for (const e of publishable) {
    const day = formatDayHeading(e.created_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(e);
  }
  const dayKeys = [...groups.keys()]; // already sorted desc by query order

  const author = profile.display_name || slug;
  const lines: string[] = [];
  lines.push(`# ${author}'s hub — activity log`);
  lines.push("");
  lines.push(
    publishable.length === 0
      ? `_No public activity yet._`
      : `Last ${publishable.length} public event${publishable.length === 1 ? "" : "s"}. Companion files: [index.md](/hub/${slug}/index.md) · [SCHEMA.md](/hub/${slug}/SCHEMA.md) · [llms.txt](/hub/${slug}/llms.txt).`,
  );
  lines.push("");

  for (const day of dayKeys) {
    lines.push(`## ${day}`);
    lines.push("");
    for (const e of groups.get(day) || []) {
      const t = formatTime(e.created_at);
      const summary = (e.summary || e.event_type).replace(/[\r\n]+/g, " ").trim();
      const link =
        e.target_type === "document" && e.target_id
          ? ` ([open](https://memory.wiki/${e.target_id}))`
          : e.target_type === "bundle" && e.target_id
            ? ` ([open](https://memory.wiki/b/${e.target_id}))`
            : "";
      lines.push(`- \`${t}\` — ${summary}${link}`);
    }
    lines.push("");
  }

  const body = lines.join("\n");
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      "Link": `<https://memory.wiki/hub/${slug}>; rel="canonical"`,
      "X-Hub-Slug": slug,
      "X-Token-Estimate": String(estimateTokens(body)),
    },
  });
}
