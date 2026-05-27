-- 053: v8 Plan W3 — attribution + AI bundle namespace + bundle visibility.
--
-- Schema-only pass. UI surfaces (My / AI sidebar split, 4-state
-- visibility picker, attribution badges) land in the same week but
-- iterate against the columns this migration creates.
--
-- Sidecar pattern (per 044): the original bundle / document row
-- stays untouched. Attribution + AI generation metadata live in
-- their own tables so background AI work never mutates user-facing
-- content. The one exception is `bundles.visibility` — that's a
-- structural fact about the bundle (drives RLS / API gating / sort
-- order) so it belongs on the main row, not a sidecar.

-- ─────────────────────────────────────────────────────────────
-- 1. Bundle visibility — explicit 4-state enum
-- ─────────────────────────────────────────────────────────────
-- Today visibility is inferred from a combination of is_draft +
-- password_hash + allowed_emails — easy to derive wrong, easy to
-- end up with weird intermediate states (e.g. is_draft=false +
-- password_hash set + allowed_emails empty = "shared by link with
-- password"; not really a 4-state model).
-- Make the four states explicit. Existing flags stay for backward
-- compat and continue to gate writes / fetches; visibility is the
-- new user-facing dropdown value.

DO $$ BEGIN
  CREATE TYPE bundle_visibility AS ENUM ('public', 'unlisted', 'private', 'restricted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS visibility bundle_visibility;

UPDATE bundles SET visibility = CASE
  WHEN is_draft = TRUE                                      THEN 'private'::bundle_visibility
  WHEN password_hash IS NOT NULL                            THEN 'restricted'::bundle_visibility
  WHEN cardinality(coalesce(allowed_emails, '{}'::text[])) > 0 THEN 'restricted'::bundle_visibility
  ELSE 'public'::bundle_visibility
END
WHERE visibility IS NULL;

ALTER TABLE bundles
  ALTER COLUMN visibility SET NOT NULL,
  ALTER COLUMN visibility SET DEFAULT 'private';

COMMENT ON COLUMN bundles.visibility IS
  'v8 visibility model (one of 4). Existing flags (is_draft,
   password_hash, allowed_emails) continue to drive enforcement —
   this column is the user-picked intent that the UI surfaces and
   serialise back into those flags. Default ''private'' so a newly
   created bundle never accidentally leaks.';

-- ─────────────────────────────────────────────────────────────
-- 2. Collaborator cap — bundle.allowed_editors max 5
-- ─────────────────────────────────────────────────────────────
-- v8 Tier A caps collaborators at 5 per bundle so the
-- "everyone-edits" UX stays sane. Trigger lets us emit a clear
-- error message instead of a generic CHECK violation, and runs
-- only when the column actually changes.

CREATE OR REPLACE FUNCTION enforce_bundles_allowed_editors_cap()
RETURNS TRIGGER AS $$
BEGIN
  IF cardinality(coalesce(NEW.allowed_editors, '{}'::text[])) > 5 THEN
    RAISE EXCEPTION 'bundles.allowed_editors capped at 5 per v8 collaboration model'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bundles_allowed_editors_cap ON bundles;
CREATE TRIGGER trg_bundles_allowed_editors_cap
  BEFORE INSERT OR UPDATE OF allowed_editors ON bundles
  FOR EACH ROW EXECUTE FUNCTION enforce_bundles_allowed_editors_cap();

-- ─────────────────────────────────────────────────────────────
-- 3. Bundle attribution / AI sidecar (mirrors 044's pattern)
-- ─────────────────────────────────────────────────────────────
-- 1:1 with bundles. Absent row implies user-created with no AI
-- touchpoint. Present row carries who / what / when, plus the
-- same lock toggle so the user can pin attribution after a manual
-- override.

CREATE TABLE IF NOT EXISTS bundle_ai_metadata (
  bundle_id TEXT PRIMARY KEY REFERENCES bundles(id) ON DELETE CASCADE,

  -- 'user' | 'ai'. When 'ai', the bundle was auto-promoted from
  -- a cluster (cluster_id ≥ 5 docs threshold) by the background
  -- organize job. User can convert ai → user with a 1-tap flip
  -- which then sets creator_type = 'user' and freezes AI from
  -- further auto-edits on this bundle.
  creator_type TEXT NOT NULL DEFAULT 'user',

  -- Which agent generated this. Mirrors document_ai_metadata.agent.
  --   memory-wiki-background | claude-sonnet-4-6 | gpt-4o |
  --   custom-gpt-<id> | cursor-mcp
  creator_agent TEXT,

  -- What triggered the AI to create / touch this bundle.
  --   auto-cluster | user-explicit | weekly-digest | user-on-demand
  triggered_by TEXT,

  -- AI-written 1-2 sentence overview, surfaced in BundleOverview.
  ai_summary TEXT,

  -- Background job picks the oldest generated_at to refresh.
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- User edit counter — once non-zero, treat the bundle as
  -- partially user-owned even if creator_type stays 'ai'. UI
  -- shows "originated from AI" instead of "AI bundle" once the
  -- user has touched it.
  user_edits_count INTEGER NOT NULL DEFAULT 0,
  last_edited_by_user_at TIMESTAMPTZ,

  -- Freeze background AI from re-touching this bundle.
  locked BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bundle_ai_metadata_creator_type
  ON bundle_ai_metadata (creator_type);

CREATE INDEX IF NOT EXISTS idx_bundle_ai_metadata_generated_at
  ON bundle_ai_metadata (generated_at)
  WHERE locked = FALSE;

COMMENT ON TABLE bundle_ai_metadata IS
  'v8 attribution + AI metadata layer for bundles. Sidecar to
   bundles, never mutates the bundle row itself. Absent row =
   user-created, no AI involvement; present row carries who/what/
   when. Mirror of document_ai_metadata at the bundle scope.';

-- ─────────────────────────────────────────────────────────────
-- 4. Document attribution sidecar
-- ─────────────────────────────────────────────────────────────
-- document_ai_metadata (044) holds AI-generated content
-- (tags / summary / related / entities). It does NOT cover
-- attribution — who made the doc, what tool, why. Add a
-- dedicated sidecar so weekly-digest synthesis docs, About
-- drafts, and other AI-authored docs carry an explicit
-- provenance record. Absent row = user-typed.

CREATE TABLE IF NOT EXISTS document_attribution (
  document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,

  -- 'user' | 'ai'. 'ai' for synthesis docs / weekly digests /
  -- About drafts; 'user' once user edits (or always when typed).
  creator_type TEXT NOT NULL DEFAULT 'user',
  creator_agent TEXT,
  triggered_by TEXT,

  -- Edit counter — once > 0 the badge shifts from "AI-generated"
  -- to "Edited by you · originated from AI" so the user knows
  -- attribution lineage even after they've made it theirs.
  user_edits_count INTEGER NOT NULL DEFAULT 0,
  last_edited_by_user_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_attribution_creator_type
  ON document_attribution (creator_type);

COMMENT ON TABLE document_attribution IS
  'v8 attribution sidecar for documents. Separate from
   document_ai_metadata (044) which holds AI-generated content —
   this row tracks WHO created the document and how. Absent row =
   user-typed with no AI involvement.';
