// Admin route: one-shot backfill for doc-level KG.
//
// `extractDocOntology` only runs on save going forward, so every doc
// authored before the `doc_ontology` job kind shipped has no entries
// in concept_index / concept_relations — and the raw appendix on
// /raw/{id} comes back empty for them.
//
// This route enqueues doc_ontology jobs (status=pending) for every
// public doc that doesn't already have one, then lets the existing
// every-minute cron (`/api/jobs/run`, 5 jobs/tick) drain them. We do
// NOT run the extractor inline here — bulk LLM calls inside a single
// request would blow past serverless time budgets and rate limits.
//
// Usage:
//   curl -X POST /api/admin/backfill-doc-ontology \
//        -H "x-user-email: hi@raymind.ai"
//   curl -X POST '/api/admin/backfill-doc-ontology?force=1'
//
// Body / query params (optional):
//   batch_size  default 200 — docs scanned per tick (NOT jobs enqueued)
//   force       default false — re-enqueue even docs that already
//               have a done/pending job for doc_ontology. Use sparingly.
//
// Response:
//   { scanned, enqueued, skipped, already_done, already_pending,
//     skipped_short, last_updated_at, has_more }

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { enqueueJob } from "@/lib/jobs";

const ADMIN_EMAIL = "hi@raymind.ai";
const MIN_DELTA_CHARS = 200;       // mirror ontology-refresh.ts
const DEFAULT_BATCH = 200;
const MAX_BATCH = 1000;

export const runtime = "nodejs";
export const maxDuration = 60;

type DocRow = {
  id: string;
  title: string | null;
  markdown: string | null;
  user_id: string | null;
  updated_at: string | null;
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
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(1, parseInt(url.searchParams.get("batch_size") || `${DEFAULT_BATCH}`, 10) || DEFAULT_BATCH),
  );
  // Cursor — process older docs after newer ones land in subsequent
  // calls. Pass the prior response's `last_updated_at` back here.
  const beforeUpdatedAt = url.searchParams.get("before") || null;

  // 1. Pull a batch of eligible public docs newest-first.
  let q = supabase
    .from("documents")
    .select("id, title, markdown, user_id, updated_at")
    .is("deleted_at", null)
    .eq("is_draft", false)
    .not("user_id", "is", null)
    .not("markdown", "is", null)
    .order("updated_at", { ascending: false })
    .limit(batchSize);
  if (beforeUpdatedAt) {
    q = q.lt("updated_at", beforeUpdatedAt);
  }
  const { data: docs, error: docsErr } = await q;
  if (docsErr) {
    return NextResponse.json({ error: "doc query failed", detail: docsErr.message }, { status: 500 });
  }
  const rows = (docs as DocRow[] | null) ?? [];

  let scanned = 0;
  let enqueued = 0;
  let skippedShort = 0;
  let alreadyDone = 0;
  let alreadyPending = 0;
  let lastUpdatedAt: string | null = null;

  // 2. Check existing doc_ontology jobs in one go for this batch.
  const ids = rows.map((r) => r.id);
  const existing = new Map<string, "done" | "pending" | "running" | "failed">();
  if (ids.length > 0) {
    const { data: jobs } = await supabase
      .from("extraction_jobs")
      .select("target_doc_id, status, finished_at")
      .eq("kind", "doc_ontology")
      .in("target_doc_id", ids)
      .order("finished_at", { ascending: false, nullsFirst: false });
    if (Array.isArray(jobs)) {
      for (const j of jobs as Array<{ target_doc_id: string | null; status: string }>) {
        if (!j.target_doc_id || existing.has(j.target_doc_id)) continue;
        existing.set(j.target_doc_id, j.status as "done" | "pending" | "running" | "failed");
      }
    }
  }

  // 3. Enqueue. We loop sequentially — INSERTs are cheap, parallel
  // here would just thrash the connection pool without speedup.
  for (const r of rows) {
    scanned++;
    lastUpdatedAt = r.updated_at;

    const md = (r.markdown || "").trim();
    if (md.length < MIN_DELTA_CHARS) { skippedShort++; continue; }

    const status = existing.get(r.id);
    if (!force) {
      if (status === "done") { alreadyDone++; continue; }
      if (status === "pending" || status === "running") { alreadyPending++; continue; }
    }

    if (!r.user_id) continue;
    const jobId = await enqueueJob({
      supabase,
      userId: r.user_id,
      kind: "doc_ontology",
      targetDocId: r.id,
      payload: {
        title: r.title || "Untitled",
        markdown: md,
      },
    });
    if (jobId) enqueued++;
  }

  return NextResponse.json({
    scanned,
    enqueued,
    skipped: skippedShort + alreadyDone + alreadyPending,
    already_done: alreadyDone,
    already_pending: alreadyPending,
    skipped_short: skippedShort,
    last_updated_at: lastUpdatedAt,
    has_more: rows.length === batchSize,
    next_call: rows.length === batchSize && lastUpdatedAt
      ? `?before=${encodeURIComponent(lastUpdatedAt)}&batch_size=${batchSize}${force ? "&force=1" : ""}`
      : null,
  });
}

export async function GET(req: NextRequest) {
  // Convenience: read-only summary of remaining work so the admin
  // can see how much is left before triggering POST.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const email = verified?.email || req.headers.get("x-user-email");
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  const [{ count: totalDocs }, { count: doneJobs }, { count: pendingJobs }] = await Promise.all([
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("is_draft", false)
      .not("user_id", "is", null),
    supabase
      .from("extraction_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "doc_ontology")
      .eq("status", "done"),
    supabase
      .from("extraction_jobs")
      .select("id", { count: "exact", head: true })
      .eq("kind", "doc_ontology")
      .in("status", ["pending", "running"]),
  ]);

  return NextResponse.json({
    total_public_docs: totalDocs ?? 0,
    doc_ontology_done: doneJobs ?? 0,
    doc_ontology_pending: pendingJobs ?? 0,
    estimated_remaining: Math.max(0, (totalDocs ?? 0) - (doneJobs ?? 0) - (pendingJobs ?? 0)),
    cron_rate: "5 jobs / minute (≈ 300 / hour)",
    usage: "POST this endpoint repeatedly (use next_call from each response) until has_more=false.",
  });
}
