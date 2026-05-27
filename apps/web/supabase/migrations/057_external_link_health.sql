-- 057: external link health cache + per-doc index.
--
-- v8 W4-6 Citation rot signal — last shipped of the 5 Coming-soon
-- toggles. We never re-fetch a URL on every lint pass; instead a
-- daily cron HEAD-checks a bounded batch per tick and writes the
-- status here. The lint surface reads from this cache to know which
-- URLs are 4xx/5xx, then joins to the user's docs that reference
-- those URLs via the per-doc index table below.

CREATE TABLE IF NOT EXISTS external_link_health (
  url             TEXT PRIMARY KEY,
  status_code     INTEGER,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Counts so we don't bounce flaky transient 5xx into Citation rot
  -- the moment one check fails. The lint thresholds (in citation-rot.ts)
  -- gate on consecutive_fail_count to avoid noise.
  consecutive_fail_count INTEGER NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drain order for the cron — oldest-checked first.
CREATE INDEX IF NOT EXISTS idx_external_link_health_recheck
  ON external_link_health (last_checked_at ASC);

-- Per-doc external URL index. Each (doc, url) pair = one row. Refreshed
-- on doc save (extractor walks the new markdown). Without this index
-- the lint would re-parse every doc's markdown on every pass — too
-- expensive at scale.
CREATE TABLE IF NOT EXISTS document_external_links (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  PRIMARY KEY (document_id, url)
);

CREATE INDEX IF NOT EXISTS idx_document_external_links_url
  ON document_external_links (url);

COMMENT ON TABLE external_link_health IS
  'v8 W4-6 Citation rot cache. One row per unique URL; the cron HEAD-
   checks a bounded batch per tick (oldest-first). Lint joins this
   against document_external_links to surface broken links per doc.';

COMMENT ON TABLE document_external_links IS
  'Per-doc index of external URLs the doc references. Refreshed on
   doc save by extractExternalUrls(markdown). The join target for
   Citation rot lint output.';
