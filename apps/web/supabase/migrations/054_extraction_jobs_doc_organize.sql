-- 054: extend extraction_jobs.kind CHECK with 'doc_organize'.
--
-- v8 Plan W4-6 Type 1 (Auto-organize metadata) — background AI
-- fills document_ai_metadata (tags / cluster_id / ai_summary /
-- related_doc_ids / entities) per doc. Reuses the existing
-- extraction_jobs queue so retries, backoff, dedup, and the cron
-- worker all come for free.

ALTER TABLE extraction_jobs DROP CONSTRAINT IF EXISTS extraction_jobs_kind_check;

ALTER TABLE extraction_jobs ADD CONSTRAINT extraction_jobs_kind_check
  CHECK (kind IN (
    'doc_ontology',
    'doc_organize',
    'bundle_graph',
    'concept_embeddings',
    'bundle_embedding',
    'doc_embedding'
  ));
