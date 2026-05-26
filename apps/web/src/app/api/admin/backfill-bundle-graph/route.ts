// Admin route: one-shot backfill for bundle-level graph_data.
//
// The daily lifecycle-sweep cron (`/api/cron/lifecycle-sweep`) only
// picks up bundles created within the last 30 days and caps at 3
// per run. Bundles older than that, or created during a quiet period,
// can sit forever with `graph_data = NULL` — which means their raw
// markdown (`/raw/b/{id}`) has no themes / insights / concept-graph
// sections at all.
//
// This route walks every bundle missing graph_data and synchronously
// invokes the canonical extractor (`POST /api/bundles/{id}/graph`).
// Synchronous because that endpoint is itself synchronous (LLM call
// inline, no job-queue indirection like docs have). We cap at a
// small per-call batch so we stay inside the function budget — the
// admin POSTs repeatedly using the returned `next_call` cursor.
//
// Usage:
//   curl -X POST /api/admin/backfill-bundle-graph \
//        -H "x-user-email: hi@raymind.ai"
//
// Each invocation processes up to `batch_size` (default 3) bundles.
// Loop with the returned `next_call` until `has_more=false`.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

const ADMIN_EMAIL = "hi@raymind.ai";
const DEFAULT_BATCH = 3;       // each = one LLM call, ~10-30s
const MAX_BATCH = 6;
const SCAN_LIMIT = 50;         // over-fetch candidates per call

export const runtime = "nodejs";
export const maxDuration = 60;

type BundleRow = {
  id: string;
  user_id: string | null;
  created_at: string | null;
};

export async function POST(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const email = verified?.email || req.headers.get("x-user-email");
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  const url = new URL(req.url);
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(1, parseInt(url.searchParams.get("batch_size") || `${DEFAULT_BATCH}`, 10) || DEFAULT_BATCH),
  );
  // Cursor — pass last response's `last_created_at` back here to
  // continue scanning older bundles.
  const beforeCreatedAt = url.searchParams.get("before") || null;

  let q = supabase
    .from("bundles")
    .select("id, user_id, created_at")
    .is("graph_data", null)
    .not("user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);
  if (beforeCreatedAt) {
    q = q.lt("created_at", beforeCreatedAt);
  }
  const { data: bundles, error: bundlesErr } = await q;
  if (bundlesErr) {
    return NextResponse.json({ error: "bundle query failed", detail: bundlesErr.message }, { status: 500 });
  }
  const rows = (bundles as BundleRow[] | null) ?? [];

  const origin = req.nextUrl.origin;
  let scanned = 0;
  let processed = 0;
  let skippedFewMembers = 0;
  let failed = 0;
  const errors: string[] = [];
  let lastCreatedAt: string | null = null;

  for (const b of rows) {
    if (processed >= batchSize) break;
    scanned++;
    lastCreatedAt = b.created_at;

    // Need ≥2 members for the graph to be meaningful — single-doc
    // bundles render fine without it.
    const { count: memberCount } = await supabase
      .from("bundle_documents")
      .select("document_id", { count: "exact", head: true })
      .eq("bundle_id", b.id);
    if ((memberCount || 0) < 2) { skippedFewMembers++; continue; }

    try {
      const res = await fetch(`${origin}/api/bundles/${b.id}/graph`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": b.user_id as string,
        },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        processed++;
      } else {
        failed++;
        const t = await res.text().catch(() => "");
        errors.push(`${b.id} → ${res.status} ${t.slice(0, 120)}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${b.id} → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // has_more = either we hit batch cap before finishing the candidate
  // list, OR we exhausted candidates but the SCAN_LIMIT was full
  // (meaning more bundles may live beyond `lastCreatedAt`).
  const hitBatchCap = processed >= batchSize;
  const exhaustedScan = rows.length === SCAN_LIMIT;
  const hasMore = hitBatchCap || exhaustedScan;

  return NextResponse.json({
    scanned,
    processed,
    failed,
    skipped_few_members: skippedFewMembers,
    errors: errors.slice(0, 5),
    last_created_at: lastCreatedAt,
    has_more: hasMore,
    next_call: hasMore && lastCreatedAt
      ? `?before=${encodeURIComponent(lastCreatedAt)}&batch_size=${batchSize}`
      : null,
  });
}

export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const email = verified?.email || req.headers.get("x-user-email");
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  const [{ count: totalBundles }, { count: withGraph }, { count: withoutGraph }] = await Promise.all([
    supabase
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .not("user_id", "is", null),
    supabase
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .not("user_id", "is", null)
      .not("graph_data", "is", null),
    supabase
      .from("bundles")
      .select("id", { count: "exact", head: true })
      .not("user_id", "is", null)
      .is("graph_data", null),
  ]);

  return NextResponse.json({
    total_bundles: totalBundles ?? 0,
    with_graph_data: withGraph ?? 0,
    missing_graph_data: withoutGraph ?? 0,
    note: "Some 'missing' bundles may have <2 docs — those are skipped during backfill (graph has nothing to extract).",
    cron_rate: "lifecycle-sweep does 3/day, ≤30d old only. Use POST here to drain everything else.",
    usage: "POST this endpoint repeatedly (use next_call from each response) until has_more=false.",
  });
}
