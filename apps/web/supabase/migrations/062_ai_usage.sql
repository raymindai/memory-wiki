-- 062_ai_usage.sql
--
-- Per-call AI usage log. One row per callAI / streamText invocation
-- (success OR failure), tagged with the action that triggered it,
-- the provider + model that served the response, the token counts
-- the provider reported, and a USD cost computed at write time.
--
-- This is the data substrate for Pro billing:
--   - "How many tokens did this user spend this month?"
--   - "Which action (polish / chat / transform / format / etc.) is
--      the biggest cost driver for this user?"
--   - "Which provider tier landed each request? (cost-first cascade
--      means most requests should hit cheap-tier; failover-heavy
--      patterns are a smoke signal.)"
--
-- Insert is fire-and-forget from lib/ai-providers — a failure to log
-- never affects the user's request. Indexed for fast per-user time
-- range scans.

create table if not exists ai_usage (
  id            uuid           primary key default gen_random_uuid(),
  -- Who. Exactly one of user_id / anonymous_id should be set;
  -- anonymous_id covers the small surface where unsigned-in flows
  -- (anon chrome-ext captures + their AI transforms) still bill back
  -- to a pseudo-identity for migration when the user signs up later.
  user_id       uuid           references auth.users(id) on delete cascade,
  anonymous_id  text,
  -- What. Free-form action label set by the call site
  -- (polish / translate / format / chat / chat-doc / chat-hub /
  -- chat-bundle / transform / bundle-graph / hub-suggestion /
  -- doc-ontology / etc.). Aggregate / group by this for the
  -- per-feature breakdown chart.
  action        text           not null,
  -- Who served the response.
  provider      text           not null check (provider in ('anthropic','openai','gemini')),
  model         text           not null,
  -- Token counts as REPORTED BY THE PROVIDER. Zero on failure.
  input_tokens  int            not null default 0,
  output_tokens int            not null default 0,
  -- USD at write time. We store the computed cost rather than recomputing
  -- on every billing read because per-token pricing changes — the cost
  -- the user actually accrued at request time is the authoritative number.
  cost_usd      numeric(12, 6) not null default 0,
  -- Result. 'ok' / 'error' / 'rate_limited' / 'no_provider'.
  status        text           not null default 'ok',
  -- Convenience: which tier was requested (lite vs primary). Lets the
  -- admin see if Pro callers are upgrading to primary often enough
  -- to warrant a separate "premium" SKU.
  tier          text           not null default 'lite' check (tier in ('lite','primary')),
  -- Optional: round-trip duration in ms, for latency dashboards.
  duration_ms   int,
  created_at    timestamptz    not null default now(),
  -- A user OR anonymous identifier must be present — never both null.
  constraint ai_usage_has_identity check (user_id is not null or anonymous_id is not null)
);

-- Primary access pattern: "show me {this user}'s usage for {this
-- month}". Time-DESC index makes the typical 'recent first' read fast.
create index if not exists ai_usage_user_created_idx
  on ai_usage (user_id, created_at desc)
  where user_id is not null;

create index if not exists ai_usage_anon_created_idx
  on ai_usage (anonymous_id, created_at desc)
  where anonymous_id is not null;

-- Admin "top users by spend this month" needs a covering index on
-- (created_at, user_id, cost_usd).
create index if not exists ai_usage_created_idx on ai_usage (created_at desc);

-- RLS — users see only their own rows. Service role (admin route,
-- the insert from lib/ai-providers via supabase-server) sees all.
alter table ai_usage enable row level security;

create policy "users read own ai_usage"
  on ai_usage for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies — only the service-role client
-- writes here. Direct browser inserts are not allowed.
