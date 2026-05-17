-- Background-extraction job queue.
--
-- Replaces process-local "fire-and-forget" patterns that lost work
-- whenever a Vercel function instance got recycled mid-flight. Each
-- ingest path enqueues a row; a cron-driven worker (or the same
-- request's `after()` hook) picks pending rows and runs the work.
-- Failures stay visible — `last_error` is human-readable, retries
-- bump `attempts` and reset `next_run_at` with exponential backoff.

CREATE TABLE IF NOT EXISTS extraction_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  -- Kind of work. Adding new kinds: extend the CHECK + handle in
  -- the worker. Keep the names noun-shaped so they read in logs.
  kind            text NOT NULL CHECK (kind IN (
    'doc_ontology',
    'bundle_graph',
    'concept_embeddings',
    'bundle_embedding',
    'doc_embedding'
  )),
  -- One of target_doc_id / target_bundle_id is populated per kind.
  -- Both null is allowed for hub-wide jobs (e.g. concept_embeddings).
  target_doc_id   text,
  target_bundle_id text,
  -- Saved input the worker needs so it doesn't re-query at run time
  -- (e.g. markdown + title). Keeps the worker idempotent vs editor
  -- saves between enqueue and run.
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts        int NOT NULL DEFAULT 0,
  last_error      text,
  enqueued_at     timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  -- When the worker should pick this row up. Exponential backoff
  -- writes future timestamps here on failure.
  next_run_at     timestamptz NOT NULL DEFAULT now()
);

-- Dedup: only one pending/running job per (user, kind, target).
-- Editor autosaves don't pile up — they collapse into one queued run.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_extraction_job_active_target
  ON extraction_jobs (user_id, kind, COALESCE(target_doc_id, target_bundle_id, ''))
  WHERE status IN ('pending', 'running');

-- Worker picks the oldest ready row.
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_pending_ready
  ON extraction_jobs (next_run_at)
  WHERE status = 'pending';

-- Status endpoint: count per-user per-status quickly.
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user_status
  ON extraction_jobs (user_id, status);

-- Last-built lookup: pull most recent done row per (user, kind, target).
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user_kind_target_finished
  ON extraction_jobs (user_id, kind, COALESCE(target_doc_id, target_bundle_id, ''), finished_at DESC)
  WHERE status = 'done';
