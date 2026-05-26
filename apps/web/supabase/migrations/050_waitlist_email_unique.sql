-- Fix 049: the unique index was on lower(email) (functional), which
-- PostgREST's upsert(onConflict: "email") can't target. Switch to a
-- plain unique constraint on `email`; the API lowercases input
-- before insert so case-insensitivity still holds.

DROP INDEX IF EXISTS launch_waitlist_email_lower_idx;

ALTER TABLE launch_waitlist
  ADD CONSTRAINT launch_waitlist_email_key UNIQUE (email);
