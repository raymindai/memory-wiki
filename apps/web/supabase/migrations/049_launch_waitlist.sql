-- Launch waitlist for the v8 public launch (Aug 2026).
--
-- Anonymous visitors on the /about page can drop their email to
-- get a single update when the public launch ships. Self-hosted
-- so we own the list and don't depend on a third-party service —
-- consistent with the "your data" manifesto.

CREATE TABLE IF NOT EXISTS launch_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  locale      text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ko')),
  source      text NOT NULL DEFAULT 'about',
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per email; idempotent re-submit is a no-op via ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS launch_waitlist_email_lower_idx
  ON launch_waitlist (lower(email));

-- RLS: only the server (service role) can read. Anonymous insert is
-- allowed via the /api/waitlist route handler (which validates the
-- email shape and rate-limits per-IP before writing).
ALTER TABLE launch_waitlist ENABLE ROW LEVEL SECURITY;

-- No SELECT policy — reads happen only via service role from admin
-- tooling.  No anon INSERT policy either; the route handler uses the
-- service role key, which bypasses RLS. This keeps the table opaque
-- to the public anon key even if someone tries to hit it directly.
