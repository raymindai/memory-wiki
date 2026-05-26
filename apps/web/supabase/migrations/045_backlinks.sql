-- 045_backlinks.sql
--
-- Self-wiring knowledge graph: references between documents, bundles, and
-- hubs extracted from markdown at write time. Zero LLM cost — pure regex
-- pattern matching on `memory.wiki/<id>`, `memory.wiki/d/<id>`,
-- `memory.wiki/b/<id>`, `memory.wiki/hub/<slug>`, and `[[<id>]]` wikilinks
-- inside the source's markdown body.
--
-- Used by:
--   - /d/<id> viewer "Referenced by" section
--   - /b/<id> viewer "Referenced by" section
--   - /hub/<slug> viewer aggregate external-reference count
--
-- Cascade behaviour: when a target is deleted, we leave the dead row in
-- place and filter at query time. Cheaper than triggers and lets the
-- backlink auto-reappear if the target gets re-created at the same id.

-- Three entity kinds in the Memory.Wiki graph.
CREATE TYPE backlink_entity_type AS ENUM ('document', 'bundle', 'hub');

CREATE TABLE backlinks (
  id BIGSERIAL PRIMARY KEY,

  -- The entity whose markdown contains the reference.
  source_type backlink_entity_type NOT NULL,
  source_id   TEXT                 NOT NULL,

  -- The entity being referenced.
  target_type backlink_entity_type NOT NULL,
  target_id   TEXT                 NOT NULL,

  -- Optional ~120 chars of context around the link (for hover previews
  -- and richer Referenced-by displays). Null when extractor doesn't
  -- bother (e.g. machine-generated bodies, very dense link clusters).
  context TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each source→target pair is at most one row. Re-extraction on save
  -- replaces the row's context but does not duplicate the edge.
  UNIQUE (source_type, source_id, target_type, target_id)
);

-- "Find everything that references me" — the load-bearing query for
-- viewer "Referenced by" sections.
CREATE INDEX backlinks_target_idx ON backlinks (target_type, target_id);

-- "What does this entity link to" — used by editors and the graph view.
CREATE INDEX backlinks_source_idx ON backlinks (source_type, source_id);

-- Public read: viewer pages need to render the Referenced-by list for
-- anyone, including unauthenticated visitors. Source/target visibility
-- is enforced at JOIN time by the existing documents/bundles/profiles
-- RLS — a backlink row alone reveals nothing because both ends are
-- already gated by their own tables' policies.
ALTER TABLE backlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backlinks_public_read" ON backlinks
  FOR SELECT USING (true);

-- Writes happen exclusively from the server-side extractor running with
-- the service role key. No client-facing INSERT/UPDATE/DELETE policies
-- needed — service_role bypasses RLS.
