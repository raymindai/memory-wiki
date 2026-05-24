-- 048_hub_readiness.sql
--
-- Per-hub AI-readability score, populated by running MWBench against the
-- hub and storing the per-runner per-URL-shape per-mode breakdown. The
-- hub viewer reads `headline` for the badge ("100% across Claude /
-- OpenAI / Gemini") and lets the user expand to the full breakdown.
--
-- Schema choice — one row per hub, payload in jsonb. Lets us version the
-- bench (round_label) without schema churn, and the UI joins on
-- profiles.hub_slug for fast lookup.

-- hub_slug is FK-style by convention but profiles.hub_slug isn't UNIQUE
-- (it can be NULL for users who haven't set one), so we keep this PK
-- standalone. Cleanup happens via the populate script when a slug is
-- renamed or freed.
CREATE TABLE IF NOT EXISTS hub_readiness (
  hub_slug TEXT PRIMARY KEY,
  round_label TEXT NOT NULL,
  -- Headline numbers for the badge — kept top-level for query/index ease.
  -- scope ∈ ('hub','bundle','doc'); mode ∈ ('paste_full','paste_compact','browse').
  -- accuracy is 0..1; tool_use_rate only meaningful for browse.
  -- {"hub":{"paste_full":1.0,"paste_compact":1.0,"browse":0.983},...}
  scores JSONB NOT NULL,
  -- Full per-runner breakdown: {"hub":{"browse":{"claude":1.0,"openai":1.0,"gemini":0.95}},...}
  breakdown JSONB,
  -- "100% paste · 95% browse · 100% tool-use across Claude/OpenAI/Gemini"
  headline TEXT,
  -- queries × runners × modes summed
  total_cells INTEGER NOT NULL DEFAULT 0,
  passing_cells INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  judge_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public can read readiness (it's a public hub feature).
ALTER TABLE hub_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hub_readiness_select_all"
  ON hub_readiness FOR SELECT
  USING (true);

-- Only service role writes (bench script).
CREATE POLICY "hub_readiness_service_write"
  ON hub_readiness FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE hub_readiness IS
  'Per-hub MWBench AI-readability snapshot. Populated by eval/populate-readiness.mjs after each bench round. Surfaced on hub viewer as the readiness badge.';
