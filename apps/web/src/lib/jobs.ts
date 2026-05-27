// Persistent job queue helpers. Replaces process-local "after()
// fire-and-forget" patterns with rows in the extraction_jobs table
// so failures stay visible, retries are scheduled, and a cron worker
// picks up anything the request-scoped fast-path missed.
//
// Two callers per ingest path:
//   1. Mutation route (POST /api/docs, etc.) → enqueueJob(...)
//      then optionally `after(() => runJob(jobId))` for fast-path.
//   2. Cron worker (/api/jobs/run) → claimNextJob() in a loop.
//
// The unique partial index `uniq_extraction_job_active_target`
// guarantees only one pending|running row per (user, kind, target).
// Concurrent autosaves collapse into a single queued run.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JobKind =
  | "doc_ontology"
  | "doc_organize"
  | "bundle_graph"
  | "concept_embeddings"
  | "bundle_embedding"
  | "doc_embedding";

export interface JobRow {
  id: string;
  user_id: string;
  kind: JobKind;
  target_doc_id: string | null;
  target_bundle_id: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  enqueued_at: string;
  started_at: string | null;
  finished_at: string | null;
  next_run_at: string;
}

export interface EnqueueArgs {
  supabase: SupabaseClient;
  userId: string;
  kind: JobKind;
  targetDocId?: string | null;
  targetBundleId?: string | null;
  payload?: Record<string, unknown>;
}

/** Insert a pending job row. If a matching active row already exists,
 *  ON CONFLICT DO NOTHING — the existing pending/running row covers
 *  this work. Returns the row id whether new or existing. */
export async function enqueueJob(args: EnqueueArgs): Promise<string | null> {
  const { supabase, userId, kind, targetDocId, targetBundleId, payload } = args;
  // INSERT with onConflict on the partial unique index. PostgREST
  // doesn't expose partial indexes directly, so we do a two-step:
  // try insert, on dup grab the existing row.
  const { data: inserted, error: insErr } = await supabase
    .from("extraction_jobs")
    .insert({
      user_id: userId,
      kind,
      target_doc_id: targetDocId ?? null,
      target_bundle_id: targetBundleId ?? null,
      payload: payload ?? {},
    })
    .select("id")
    .single();
  if (!insErr && inserted) return inserted.id;
  // Duplicate active row — fetch the existing one.
  if (insErr && (insErr.code === "23505" || /duplicate/i.test(insErr.message))) {
    const { data: existing } = await supabase
      .from("extraction_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", kind)
      .or(`target_doc_id.eq.${targetDocId ?? ""},target_bundle_id.eq.${targetBundleId ?? ""}`)
      .in("status", ["pending", "running"])
      .limit(1)
      .maybeSingle();
    if (existing) return existing.id;
  }
  if (insErr) {
    console.warn("enqueueJob failed:", JSON.stringify({ kind, userId, code: insErr.code, msg: insErr.message }));
  }
  return null;
}

/** Atomically claim a single pending+ready job (status→running,
 *  attempts++, started_at=now()). Returns null if nothing ready. */
export async function claimNextJob(supabase: SupabaseClient): Promise<JobRow | null> {
  // Use an RPC for the atomic claim if available; otherwise UPDATE
  // … WHERE id = (SELECT id … FOR UPDATE SKIP LOCKED) via a single
  // SQL string would be needed. Postgrest doesn't expose locking, so
  // we do a best-effort optimistic update keyed on the row's id +
  // status — a concurrent worker losing the race will just see 0
  // rows updated and try the next candidate.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: candidates } = await supabase
      .from("extraction_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at", { ascending: true })
      .limit(1);
    const row = candidates?.[0] as JobRow | undefined;
    if (!row) return null;
    const { data: claimed, error } = await supabase
      .from("extraction_jobs")
      .update({
        status: "running",
        attempts: row.attempts + 1,
        started_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (claimed && !error) return claimed as JobRow;
    // Another worker grabbed it — try again.
  }
  return null;
}

/** Mark a claimed job done. */
export async function completeJob(supabase: SupabaseClient, jobId: string): Promise<void> {
  await supabase
    .from("extraction_jobs")
    .update({ status: "done", finished_at: new Date().toISOString(), last_error: null })
    .eq("id", jobId);
}

/** Mark a claimed job failed and schedule the next retry with
 *  exponential backoff. After MAX_ATTEMPTS the row goes to status
 *  'failed' and stays there until something explicitly retries. */
const MAX_ATTEMPTS = 4;
export async function failJob(
  supabase: SupabaseClient,
  job: JobRow,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const exhausted = job.attempts >= MAX_ATTEMPTS;
  if (exhausted) {
    await supabase
      .from("extraction_jobs")
      .update({ status: "failed", finished_at: new Date().toISOString(), last_error: message })
      .eq("id", job.id);
    return;
  }
  // Exponential backoff: 1m, 4m, 9m, 16m, …
  const backoffMin = Math.max(1, job.attempts * job.attempts);
  const nextRunAt = new Date(Date.now() + backoffMin * 60_000).toISOString();
  await supabase
    .from("extraction_jobs")
    .update({
      status: "pending",
      next_run_at: nextRunAt,
      last_error: message,
    })
    .eq("id", job.id);
}

/** Convenience helper for the Hub Compact CTA — does this user have
 *  a pending/running doc_ontology job? */
export async function hasPendingOntology(supabase: SupabaseClient, userId: string): Promise<{
  pending: number;
  running: number;
  failed: number;
  lastBuiltAt: string | null;
}> {
  const { data } = await supabase
    .from("extraction_jobs")
    .select("status, finished_at")
    .eq("user_id", userId)
    .eq("kind", "doc_ontology");
  const rows = data || [];
  let pending = 0, running = 0, failed = 0;
  let lastBuiltAt: string | null = null;
  for (const r of rows) {
    if (r.status === "pending") pending++;
    else if (r.status === "running") running++;
    else if (r.status === "failed") failed++;
    else if (r.status === "done" && r.finished_at) {
      if (!lastBuiltAt || r.finished_at > lastBuiltAt) lastBuiltAt = r.finished_at;
    }
  }
  return { pending, running, failed, lastBuiltAt };
}
