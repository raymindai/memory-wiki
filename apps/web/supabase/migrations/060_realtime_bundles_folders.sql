-- 060: ensure bundles + folders are members of the supabase_realtime
-- publication so the web sidebar's postgres_changes channel receives
-- INSERT / UPDATE / DELETE events. Without this, the iOS app could
-- create a bundle and the web sidebar wouldn't reflect it until the
-- user hit Refresh manually.
--
-- Idempotent: the DO blocks first check pg_publication_tables and
-- only run ALTER PUBLICATION ADD TABLE if the table isn't already
-- a member (ALTER PUBLICATION ADD on a duplicate raises an error).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bundles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bundles';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'folders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.folders';
  END IF;
END
$$;

-- Also make sure the documents table is a member (it should already
-- be — the editor has been using realtime for the sidebar — but
-- keeping the check here documents the dependency).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'documents'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.documents';
  END IF;
END
$$;
