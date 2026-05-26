-- 051: Rename the seeded "Sample Bundle: Tour of …" rows from the old
-- `mdfy-*` ID prefix to `mw-*` so they match the IDs the editor
-- (`lib/editor-samples.ts`) now references after the mdcore→memory-wiki
-- rebrand. Without this, /api/bundles/mw-ex-bundle returns 404 because
-- the rows still live under the legacy `mdfy-ex-*` ids and the in-app
-- "Sample Bundle: Tour of Memory.Wiki" tab opens to nothing.
--
-- We drop the bundle_documents FKs for the duration of the rename
-- (they aren't ON UPDATE CASCADE in the existing schema), remap both
-- sides, and put the FKs back. Wrapped in a single transaction so
-- nothing is unreferenced mid-flight if anything fails.

BEGIN;

ALTER TABLE bundle_documents DROP CONSTRAINT IF EXISTS bundle_documents_document_id_fkey;
ALTER TABLE bundle_documents DROP CONSTRAINT IF EXISTS bundle_documents_bundle_id_fkey;

-- Documents (member docs in the sample bundle).
UPDATE documents SET id = 'mw-ex-fmt'
  WHERE id = 'mdfy-ex-fmt'
    AND NOT EXISTS (SELECT 1 FROM documents WHERE id = 'mw-ex-fmt');
UPDATE documents SET id = 'mw-ex-diag'
  WHERE id = 'mdfy-ex-diag'
    AND NOT EXISTS (SELECT 1 FROM documents WHERE id = 'mw-ex-diag');
UPDATE documents SET id = 'mw-ex-feat'
  WHERE id = 'mdfy-ex-feat'
    AND NOT EXISTS (SELECT 1 FROM documents WHERE id = 'mw-ex-feat');

-- Bundle row.
UPDATE bundles SET id = 'mw-ex-bundle'
  WHERE id = 'mdfy-ex-bundle'
    AND NOT EXISTS (SELECT 1 FROM bundles WHERE id = 'mw-ex-bundle');

-- bundle_documents — remap both sides.
UPDATE bundle_documents
  SET document_id = 'mw-ex-fmt'  WHERE document_id = 'mdfy-ex-fmt';
UPDATE bundle_documents
  SET document_id = 'mw-ex-diag' WHERE document_id = 'mdfy-ex-diag';
UPDATE bundle_documents
  SET document_id = 'mw-ex-feat' WHERE document_id = 'mdfy-ex-feat';
UPDATE bundle_documents
  SET bundle_id = 'mw-ex-bundle' WHERE bundle_id = 'mdfy-ex-bundle';

-- Restore FKs. Match the schema in 022_bundles.sql.
ALTER TABLE bundle_documents
  ADD CONSTRAINT bundle_documents_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE bundle_documents
  ADD CONSTRAINT bundle_documents_bundle_id_fkey
  FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE;

COMMIT;
