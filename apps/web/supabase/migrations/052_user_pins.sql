-- 052_user_pins.sql
--
-- "Starred" sidebar section. A small, hot list of doc/bundle ids the
-- user pins for quick recall. Lives in its own table (not a JSON column
-- on profiles) so we can index lookups, support per-row created_at for
-- ordering, and add per-pin metadata (color, label) later without
-- migrating a JSON blob.

DO $$ BEGIN
  CREATE TYPE user_pin_kind AS ENUM ('document', 'bundle');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_pins (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind user_pin_kind NOT NULL,
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, target_id)
);

CREATE INDEX IF NOT EXISTS user_pins_user_idx ON user_pins (user_id, created_at DESC);

ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_pins_owner_select" ON user_pins;
CREATE POLICY "user_pins_owner_select" ON user_pins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_pins_owner_insert" ON user_pins;
CREATE POLICY "user_pins_owner_insert" ON user_pins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_pins_owner_delete" ON user_pins;
CREATE POLICY "user_pins_owner_delete" ON user_pins
  FOR DELETE USING (auth.uid() = user_id);
