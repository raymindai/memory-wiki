-- 058: v8 W8 — doc-level comments (Tier A Sharing primitive).
--
-- Flat thread per document. The MVP is intentionally small:
--   - one row per comment, no reply nesting
--   - the doc's existing read-access model gates read access
--   - author can edit/delete; doc owner can delete anyone's comment
--   - no realtime broadcast (clients poll on open / focus)
--   - no notifications (separate W14 scope)
--
-- Threading and reactions are deferred. The body column already
-- holds markdown so a reply convention (@<id>) can layer on later
-- without a schema change.

CREATE TABLE IF NOT EXISTS doc_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS doc_comments_document_id_created_at_idx
  ON doc_comments (document_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS doc_comments_user_id_idx
  ON doc_comments (user_id)
  WHERE deleted_at IS NULL;

-- Auto-bump updated_at on UPDATE so the UI's "edited" badge has a
-- reliable signal that doesn't depend on the client passing the
-- right timestamp.
CREATE OR REPLACE FUNCTION bump_doc_comments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doc_comments_bump_updated_at ON doc_comments;
CREATE TRIGGER doc_comments_bump_updated_at
  BEFORE UPDATE ON doc_comments
  FOR EACH ROW
  WHEN (OLD.body IS DISTINCT FROM NEW.body)
  EXECUTE FUNCTION bump_doc_comments_updated_at();

-- RLS — gate against the same access model the doc uses.
ALTER TABLE doc_comments ENABLE ROW LEVEL SECURITY;

-- READ: comment is visible if the doc is readable by the requester
-- (mirrors the document RLS). Service role bypasses RLS so the
-- API route can use the existing per-request access checks instead
-- of trying to express them all in policy SQL.
CREATE POLICY doc_comments_read ON doc_comments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = doc_comments.document_id
        AND (
          d.is_draft = FALSE
          OR d.user_id = auth.uid()
          OR (
            d.allowed_emails IS NOT NULL
            AND cardinality(d.allowed_emails) > 0
            AND lower((SELECT email FROM auth.users WHERE id = auth.uid())) = ANY (
              SELECT lower(e) FROM unnest(d.allowed_emails) AS e
            )
          )
        )
    )
  );

-- WRITE: anyone who can read the doc can post a comment. The
-- user_id MUST match the authenticated user — clients can't
-- impersonate.
CREATE POLICY doc_comments_insert ON doc_comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = doc_comments.document_id
        AND (
          d.is_draft = FALSE
          OR d.user_id = auth.uid()
          OR (
            d.allowed_emails IS NOT NULL
            AND cardinality(d.allowed_emails) > 0
            AND lower((SELECT email FROM auth.users WHERE id = auth.uid())) = ANY (
              SELECT lower(e) FROM unnest(d.allowed_emails) AS e
            )
          )
        )
    )
  );

-- UPDATE: only the author can edit their own comment body.
CREATE POLICY doc_comments_update ON doc_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: author OR doc owner. Hard delete is fine here — the
-- application path always soft-deletes via UPDATE deleted_at,
-- and a hard delete is a moderator escape hatch. RLS allows both
-- so the API has a choice.
CREATE POLICY doc_comments_delete ON doc_comments
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = doc_comments.document_id
        AND d.user_id = auth.uid()
    )
  );
