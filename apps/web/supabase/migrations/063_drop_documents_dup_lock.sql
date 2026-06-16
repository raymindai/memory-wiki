-- Drop the strict owner-scoped duplicate lock (migration 029).
--
-- Why: 029 added a UNIQUE index on (user_id, COALESCE(title,''),
-- md5(markdown)) over all live authenticated docs to close a rare
-- concurrent-CREATE race. But a UNIQUE index is timeless — it also
-- fires on UPDATE. The moment a user edits one doc to match another
-- (duplicate a doc, paste the same content into two drafts, converge
-- two notes), the auto-save UPDATE hits 23505 and the editor shows
-- "Failed to save" — i.e. the user CANNOT save their edit. That is
-- data loss, and "two docs with the same content" is legitimate for a
-- notes tool.
--
-- Trade-off: the create-race this guarded is rare and already caught
-- by the application-layer dedup (lib/doc-dedup.ts) on the common
-- path; the residual sub-second double-insert produces a harmless
-- duplicate row that the dedupe script reconciles. A benign duplicate
-- beats blocking a real edit.

DROP INDEX IF EXISTS documents_owner_strict_dup_lock;
