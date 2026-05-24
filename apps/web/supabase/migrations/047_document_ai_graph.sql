-- 047_document_ai_graph.sql
--
-- Add per-doc AI graph analysis — same shape as bundles.graph_data, scoped
-- to a single document. Lets the /raw/<id> response expose themes /
-- insights / takeaways / related-doc connections so an AI fetching the
-- doc URL alone gets the same kind of structural signal a bundle URL
-- already carries.
--
-- Why a new column instead of reusing summary:
--   documents.summary is a 1-2 sentence prose summary. ai_graph is the
--   structured analysis (themes, insights, takeaways, related). Both
--   coexist — summary is the gist line in catalogs, ai_graph drops below
--   the body in single-doc fetches.
--
-- Schema:
--   {
--     "themes":        [string],            -- 3-5 high-level themes
--     "insights":      [string],            -- analytic observations
--     "keyTakeaways":  [string],            -- load-bearing claims (auto-Facts)
--     "openQuestions": [string],            -- what the doc doesn't answer
--     "relatedDocs":   [{ id, title, relationship }]   -- cross-doc pointers
--   }
--
-- Generated via the doc-ai-graph lib (Claude Haiku, cheap), backfilled
-- via eval/backfill-doc-graph.mjs, and refreshed on doc PATCH when the
-- body changes meaningfully.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS ai_graph JSONB,
  ADD COLUMN IF NOT EXISTS ai_graph_model TEXT,
  ADD COLUMN IF NOT EXISTS ai_graph_generated_at TIMESTAMPTZ;

-- Partial index for "needs backfill" queries (NULL ai_graph but published).
CREATE INDEX IF NOT EXISTS idx_documents_ai_graph_missing
  ON documents (user_id)
  WHERE ai_graph IS NULL
    AND is_draft = false
    AND deleted_at IS NULL
    AND password_hash IS NULL;

COMMENT ON COLUMN documents.ai_graph IS
  'Per-doc AI analysis (themes / insights / keyTakeaways / openQuestions / relatedDocs). Mirror of bundles.graph_data scoped to one document. Surfaced in /raw/<id> below the body.';
