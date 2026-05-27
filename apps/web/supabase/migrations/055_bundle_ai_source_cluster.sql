-- 055: v8 W4 Type 2 — track which document_ai_metadata.cluster_id
-- promoted into a given AI bundle, so the next promotion sweep
-- doesn't create duplicate AI bundles for the same cluster.

ALTER TABLE bundle_ai_metadata
  ADD COLUMN IF NOT EXISTS source_cluster_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bundle_ai_metadata_source_cluster
  ON bundle_ai_metadata (source_cluster_id)
  WHERE source_cluster_id IS NOT NULL;

COMMENT ON COLUMN bundle_ai_metadata.source_cluster_id IS
  'Set when the bundle was auto-promoted from a Type 1 cluster
   (document_ai_metadata.cluster_id). Used by the promotion sweep
   to dedupe — a cluster already represented by an AI bundle is
   skipped on subsequent runs.';
