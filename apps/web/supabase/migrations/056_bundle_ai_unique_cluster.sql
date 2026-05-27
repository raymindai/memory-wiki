-- 056: dedup AI bundles by source cluster.
--
-- The promotion cron (v8 W4 Type 2) checks for an existing
-- bundle_ai_metadata.source_cluster_id row before creating a new AI
-- bundle, but the read + write isn't atomic. When two backfill
-- runs (or two browser clicks) fire promotion concurrently both
-- can see "no existing row" and INSERT, producing duplicate AI
-- bundles for the same cluster. Letting the DB enforce uniqueness
-- closes the race — the loser's INSERT raises, the promoteCluster
-- helper deletes the orphaned bundle row in the existing
-- error-handling branch, and the user only sees one AI bundle
-- per cluster.

-- One-shot cleanup of existing duplicates. Keep the earliest
-- created_at row per cluster; cascade deletes the bundle rows via
-- the bundle_documents → bundles FK chain (bundle_ai_metadata is
-- PK'd on bundle_id with ON DELETE CASCADE, so deleting the bundle
-- also removes its metadata).
DO $$
DECLARE
  dup_bundle_id TEXT;
BEGIN
  FOR dup_bundle_id IN
    SELECT bundle_id
    FROM (
      SELECT bundle_id,
             ROW_NUMBER() OVER (PARTITION BY source_cluster_id ORDER BY created_at ASC, bundle_id ASC) AS rn
      FROM bundle_ai_metadata
      WHERE source_cluster_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  LOOP
    DELETE FROM bundles WHERE id = dup_bundle_id;
  END LOOP;
END $$;

-- Partial unique index — NULL source_cluster_id is allowed
-- (manual AI bundles or future creator_type variants that don't
-- come from cluster promotion), but any non-null value must be
-- unique across the table.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bundle_ai_source_cluster
  ON bundle_ai_metadata (source_cluster_id)
  WHERE source_cluster_id IS NOT NULL;
