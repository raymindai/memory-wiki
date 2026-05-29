-- 061: add `bundle_documents` to the supabase_realtime publication.
-- BundleEmbed.tsx subscribes to bundle_documents membership changes
-- so adding/removing a member doc on iOS / CLI / another tab is
-- reflected on the currently-open bundle without a manual reload.
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bundle_documents'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bundle_documents';
  END IF;
END
$$;
