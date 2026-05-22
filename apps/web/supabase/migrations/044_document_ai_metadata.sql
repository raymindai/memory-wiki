-- 044: v8 dual-layer storage — AI-generated metadata per document.
--
-- v8 framework (Capture → Organize → Use) requires a strict
-- separation between the user's original markdown (immutable after
-- first save) and AI-generated organization (tags, clusters,
-- summaries, related links). The original document row stays
-- untouched while this side table holds everything AI produces,
-- so background jobs can regenerate AI metadata without ever
-- mutating user content.
--
-- 1:1 join to documents. PK is document_id so an INSERT ... ON
-- CONFLICT (document_id) DO UPDATE pattern keeps the row in sync
-- on each AI pass.

CREATE TABLE IF NOT EXISTS document_ai_metadata (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,

  -- AI-extracted free-form labels (5-10 per doc). Used for sidebar
  -- filter, search facets, and cluster bootstrapping.
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Soft grouping key. When ≥5 docs share a cluster the background
  -- job promotes the cluster to an AI bundle (see migration 045 for
  -- bundles.creator_type). Null = unclustered.
  cluster_id TEXT,

  -- 1–2 sentence AI summary surfaced in timeline card view.
  ai_summary TEXT,

  -- Semantically related document ids, recomputed nightly. Bounded
  -- to ~10 entries so the array column stays cheap.
  related_doc_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Entity extraction. Array of { type: 'person'|'place'|'topic'|...,
  --                               value: string,
  --                               confidence?: number }.
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Which agent generated this row. Examples:
  --   memory-wiki-background (default background job)
  --   claude-sonnet-4-6
  --   gpt-4o
  --   custom-gpt-<id>
  --   cursor-mcp
  agent TEXT NOT NULL DEFAULT 'memory-wiki-background',

  -- When AI last regenerated this row. Lets the background job
  -- skip rows that were just updated and prioritise stale ones.
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- User can lock a doc so background AI never touches its
  -- metadata. Useful when the auto-tags are wrong and the user
  -- has manually fixed them — set lock to preserve their edits.
  locked BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tag faceting: sidebar will query "all my docs with tag X". GIN
-- on the array column gives constant-time tag containment lookups.
CREATE INDEX IF NOT EXISTS idx_document_ai_metadata_tags
  ON document_ai_metadata USING GIN (tags);

-- Cluster aggregation: "show all docs in cluster X". Partial index
-- skips the large majority of rows that have no cluster yet.
CREATE INDEX IF NOT EXISTS idx_document_ai_metadata_cluster
  ON document_ai_metadata (cluster_id)
  WHERE cluster_id IS NOT NULL;

-- Staleness scan: background job picks the oldest generated_at rows
-- to refresh on each pass.
CREATE INDEX IF NOT EXISTS idx_document_ai_metadata_generated_at
  ON document_ai_metadata (generated_at)
  WHERE locked = FALSE;

COMMENT ON TABLE document_ai_metadata IS
  'v8 AI-generated metadata layer for documents. 1:1 with documents.
   Never modifies the original document row. Background AI regenerates
   periodically; user can lock individual rows to freeze AI activity.';

COMMENT ON COLUMN document_ai_metadata.locked IS
  'When TRUE, the background AI skips this row on every pass. Set by
   the user after manually editing AI-generated tags/summary/etc.';

COMMENT ON COLUMN document_ai_metadata.cluster_id IS
  'Soft cluster grouping. Promoted to an AI bundle (bundles.creator_type
   = ''ai'') once ≥5 docs share the cluster.';
