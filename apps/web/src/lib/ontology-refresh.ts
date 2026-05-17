// Ontology refresh entry point — now backed by the extraction_jobs
// queue. Previously this ran the extractor inline in a `after()`
// closure which silently lost work whenever the Vercel instance got
// recycled mid-flight. New behaviour:
//
//   1. enqueueOntologyRefresh() INSERTs a queue row (idempotent —
//      unique partial index dedupes pending/running per doc).
//   2. The caller wraps `runOntologyJobInline(jobId)` in `after()`
//      so the happy-path runs the extractor immediately, in-process.
//      If `after()` survives → done in seconds, queue row marked
//      complete. If `after()` dies → cron worker picks the row up
//      from `extraction_jobs` later (with retry backoff).
//
// Same idempotency guarantees as before: extractDocOntology is safe
// to re-run for the same doc; the underlying concept_index rows are
// upserted on (user_id, name).

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob, claimNextJob, completeJob, failJob, type JobRow } from "@/lib/jobs";
import { extractDocOntology } from "@/lib/extract-doc-ontology";

const MIN_DELTA_CHARS = 200;
// Per-(user, doc) re-extract throttle. Old in-process Map enforced
// this at 30 min; we now check the most recent `done` row in the
// queue. Autosave bursts plus the per-target unique index already
// dedupe pending/running, but without this throttle a back-and-
// forth edit pattern (save → extract → done → save → extract → done)
// would re-run Haiku every few seconds. `force: true` bypasses for
// explicit rebuild CTAs.
const RE_EXTRACT_COOLDOWN_MS = 30 * 60 * 1000;

export interface OntologyRefreshArgs {
  supabase: SupabaseClient;
  userId: string | null | undefined;
  docId: string;
  title: string | null | undefined;
  markdown: string | null | undefined;
  /** Force-bypass any pre-checks. Reserved for explicit rebuild
   *  paths — has no effect on the queue (dedup is at the DB
   *  level) but kept for backwards compat. */
  force?: boolean;
}

/** Enqueue an ontology refresh for a single doc, then immediately
 *  attempt to run it in-process (fast-path). Existing callers were
 *  all wrapped in `after()` — they keep that pattern; this just adds
 *  durability on top:
 *
 *    1. INSERT job row (idempotent — DB-level dedup)
 *    2. Try to run inline: most invocations succeed here, user sees
 *       Compact light up within seconds.
 *    3. If the serverless instance dies before step 2 completes,
 *       the cron worker (`/api/jobs/run`) sweeps the pending row.
 *
 *  Returns the queued job id (or null on enqueue failure). */
export async function enqueueOntologyRefresh(args: OntologyRefreshArgs): Promise<string | null> {
  const { supabase, userId, docId, title, markdown, force } = args;
  if (!userId) return null;
  const md = (markdown || "").trim();
  if (md.length < MIN_DELTA_CHARS) return null;

  // Throttle re-extraction of the same doc. Pending/running is
  // already deduped by the unique index; this layer prevents
  // back-to-back `done → save → done` LLM bursts on actively-
  // edited docs. One small SELECT per save is cheap relative to
  // the LLM call we're guarding.
  if (!force) {
    const { data: recent } = await supabase
      .from("extraction_jobs")
      .select("finished_at")
      .eq("user_id", userId)
      .eq("kind", "doc_ontology")
      .eq("target_doc_id", docId)
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.finished_at) {
      const sinceMs = Date.now() - new Date(recent.finished_at).getTime();
      if (sinceMs < RE_EXTRACT_COOLDOWN_MS) {
        return null;
      }
    }
  }

  const jobId = await enqueueJob({
    supabase,
    userId,
    kind: "doc_ontology",
    targetDocId: docId,
    payload: {
      title: title || "Untitled",
      // Inline the markdown so the worker doesn't have to re-fetch
      // (and gets the exact bytes the user just saved, not whatever
      // landed in the next autosave between enqueue and run).
      markdown: md,
    },
  });
  if (!jobId) return null;

  // Fast-path. Failures here are swallowed — the cron worker will
  // see the row still in 'pending' and retry with backoff.
  try {
    await runQueuedJobNow(supabase, jobId);
  } catch { /* cron retry */ }
  return jobId;
}

/** Run a single ontology job. Used by both the inline fast-path
 *  (after()) and the cron worker. Marks the row done/failed at the
 *  end. Safe to call with a row that's already been picked by a
 *  concurrent worker — DB transitions are idempotent enough that
 *  the worst case is one extra LLM call. */
export async function runOntologyJob(
  supabase: SupabaseClient,
  job: JobRow,
): Promise<void> {
  try {
    const userId = job.user_id;
    const docId = job.target_doc_id;
    if (!userId || !docId) {
      await failJob(supabase, job, new Error("missing user_id or target_doc_id"));
      return;
    }
    const title = (job.payload?.title as string) || "Untitled";
    const markdown = (job.payload?.markdown as string) || "";
    if (!markdown || markdown.length < MIN_DELTA_CHARS) {
      // Payload lost or trimmed away — fall back to re-fetching
      // the doc body from the DB. Worth the round-trip so the job
      // doesn't silently no-op.
      const { data: row } = await supabase
        .from("documents")
        .select("title, markdown")
        .eq("id", docId)
        .maybeSingle();
      const fbMd = (row?.markdown || "").trim();
      if (fbMd.length < MIN_DELTA_CHARS) {
        await completeJob(supabase, job.id);
        return;
      }
      const result = await extractDocOntology({
        supabase, userId, docId, title: row?.title || title, markdown: fbMd,
      });
      await backfillIntent(supabase, docId, result.inferredIntent);
    } else {
      const result = await extractDocOntology({
        supabase, userId, docId, title, markdown,
      });
      await backfillIntent(supabase, docId, result.inferredIntent);
    }
    await completeJob(supabase, job.id);
  } catch (err) {
    console.warn("ontology job failed", JSON.stringify({
      jobId: job.id,
      docId: job.target_doc_id,
      userId: job.user_id,
      attempt: job.attempts,
      err: err instanceof Error ? err.message : String(err),
    }));
    await failJob(supabase, job, err);
  }
}

async function backfillIntent(
  supabase: SupabaseClient,
  docId: string,
  inferred: string | null | undefined,
): Promise<void> {
  if (!inferred) return;
  try {
    const { data: row } = await supabase
      .from("documents")
      .select("intent")
      .eq("id", docId)
      .single();
    if (row && (row.intent === null || row.intent === undefined)) {
      await supabase.from("documents").update({ intent: inferred }).eq("id", docId);
    }
  } catch {
    /* best-effort */
  }
}

/** Inline fast-path: load a freshly-enqueued row by id and run it.
 *  Use inside `after(() => runQueuedJobNow(supabase, jobId))`.
 *  If the call survives (common case on Vercel), the user sees
 *  Compact light up within seconds. If the function gets killed,
 *  the cron worker still has the row to retry. */
export async function runQueuedJobNow(
  supabase: SupabaseClient,
  jobId: string | null,
): Promise<void> {
  if (!jobId) return;
  // Claim only if still pending+ready (no other worker grabbed it).
  const { data: claimed, error } = await supabase
    .from("extraction_jobs")
    .update({
      status: "running",
      attempts: 1,
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error || !claimed) return; // worker already has it, or row vanished
  await runOntologyJob(supabase, claimed as JobRow);
}

/** Used by the cron worker — process up to `max` ready jobs. */
export async function drainJobs(
  supabase: SupabaseClient,
  max = 5,
): Promise<{ processed: number; ok: number; failed: number }> {
  let processed = 0, ok = 0, failed = 0;
  for (let i = 0; i < max; i++) {
    const job = await claimNextJob(supabase);
    if (!job) break;
    processed++;
    const before = await snapshotStatus(supabase, job.id);
    if (job.kind === "doc_ontology") {
      await runOntologyJob(supabase, job);
    } else {
      // Other kinds aren't handled yet — mark failed so they don't
      // sit pending forever.
      await failJob(supabase, job, new Error(`worker has no handler for kind=${job.kind}`));
    }
    const after = await snapshotStatus(supabase, job.id);
    if (after?.status === "done") ok++;
    else if (after?.status === "failed") failed++;
    void before;
  }
  return { processed, ok, failed };
}

async function snapshotStatus(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("extraction_jobs")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  return data;
}
