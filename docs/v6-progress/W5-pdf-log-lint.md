# W5: PDF ingest, hub log.md, hub lint v1

W5 ships three sub-pieces that round out the wiki-layer foundation
the rest of the launch builds on. PDF ingest is the second
*exceed move* in the 12-week plan; log.md and lint are the two
supporting Karpathy-pattern files.

| Sub | Title | Commit |
|-----|-------|--------|
| W5a | PDF ingest end-to-end (exceed move 2) | `a6851d67` |
| W5b | Hub-wide append-only log.md | `7c3e3019` |
| W5c | Hub lint v1 (orphans + likely duplicates) | `9631b878` |

## W5a. PDF ingest end-to-end

Karpathy hand-waves source ingestion as "raw documents" and Graphify
scopes its multi-format reader to project folders. memory.wiki brings
multi-modal source ingest into the personal hub.

`/api/import/pdf` gains a `?save=1` mode. Same multipart upload as
the existing raw mode. The flow:

1. Extract text with `pdf-parse`.
2. Hand the result to the LLM cleaner (`lib/llm-clean.ts`) which runs
   the provider chain Anthropic > OpenAI > Gemini, restoring heading
   hierarchy, lists, code blocks, blockquotes, and inline emphasis.
3. Persist as a normal `documents` row with `source = "pdf:<filename>"`.
4. Honor the same auth ladder as `/api/docs` (JWT, x-user-id,
   x-user-email, body anonymousId, x-anonymous-id header,
   `mdfy_anon` cookie). Issue / refresh the cookie for anonymous
   captures so they can be claimed at sign-in.
5. Return `{id, editToken, title, pages, cleanedByAi, source}`.

Raw mode (no `?save=1`) keeps working for callers that want their
own cleanup pipeline.

**Files.**

| Path | Role |
|------|------|
| `apps/web/src/app/api/import/pdf/route.ts` | Endpoint with raw + save modes |
| `apps/web/src/lib/llm-clean.ts` | Provider-chained markdown structuring |

**Verified.** Real 5-page paper PDF (~80KB):

- Raw mode: 20213 chars text, title from PDF metadata, 5 pages.
- Save mode: 18700 chars of structured markdown, recovered heading
  hierarchy (`# Turk J Med Sci` -> `## ORIGINAL ARTICLE` ->
  `# Acute effect of speed exercise` -> `## Abstract`), bold author
  metadata, intact references list. Set-Cookie issued for anonymous
  captures.

**Deferred.** Synchronous Anthropic call is the slow path (~120s on
~20k chars). Backgrounding via Next.js `after()` is a follow-up;
the API contract already supports it (return id immediately, upgrade
markdown later).

## W5b. Hub-wide append-only log.md

Karpathy names `log.md` alongside the wiki itself: a chronological
record of every meaningful mutation. memory.wiki now writes one per user
and surfaces it both as in-app JSON and as a Karpathy-shaped
markdown URL that AI fetchers can pull alongside the hub.

**Storage.** `hub_log` table with `user_id`, `event_type`,
`target_type`, `target_id`, `summary`, `metadata`, `created_at`. RLS
restricts reads to the owner; service role bypasses for writes.
Append-only by convention (no UPDATE / DELETE in the API).

**Hooks.** Write entries on:

- `/api/docs` POST: `doc.created` (or `synthesis.created` when source
  is `auto-synthesis`).
- `/api/bundles` POST: `bundle.created`.
- `/api/import/pdf?save=1`: `doc.imported`.
- `/api/user/hub/schema` PATCH: `schema.updated`.

Anonymous docs aren't logged because there's no user to attribute
them to. After claim via `/api/user/migrate`, future activity on
those docs gets logged normally.

**Surfaces.**

- `GET /api/user/hub/log?limit=N`. Returns `{entries, count}`. JSON
  feed for the in-app activity panel.
- `/raw/hub/<slug>/log.md`. Karpathy-shaped public surface for AI
  fetchers. 60s cache. Public hubs only.
- `vercel.json` rewrite makes `/hub/<slug>/log.md` the canonical
  user-facing URL.

**Files.**

| Path | Role |
|------|------|
| `apps/web/supabase/migrations/020_hub_log.sql` | Table + indexes + RLS |
| `apps/web/src/lib/hub-log.ts` | appendHubLog, readHubLog, formatHubLogMarkdown |
| `apps/web/src/app/api/user/hub/log/route.ts` | JSON feed |
| `apps/web/src/app/raw/hub/[slug]/log.md/route.ts` | Markdown surface |

**Verified.** Doc creation produces a `doc.created` entry with title
and id; schema PATCH produces `schema.updated`; markdown surface
renders timestamps and inline `memory.wiki/<id>` links.

## W5c. Hub lint v1

Karpathy lists lint as one of the three core wiki operations
alongside ingest and query. v1 ships the two highest-signal checks.

**Orphan docs.** Published docs that aren't in any bundle AND aren't
referenced from any other doc's markdown. The check searches each
doc's markdown for `/<id>` and `/d/<id>` substrings.

**Likely duplicates.** Pairs of docs whose embeddings are within
cosine distance 0.18 of each other. Reuses the existing
`match_documents_by_embedding` RPC; iterates per doc to find close
neighbors. Symmetric pairs are deduped and ordered by id (proxy for
oldest first).

Other Karpathy lint signals (contradictions, stale claims, missing
cross-references) need fresh AI analysis per doc and are heavier.
They follow up post-launch.

**Surfaces.**

- `GET /api/user/hub/lint`. Owner-only, computed on demand.
- `/raw/hub/<slug>/lint.md`. Public surface for AI fetchers. 60s
  cache. Public hubs only.

**Files.**

| Path | Role |
|------|------|
| `apps/web/src/lib/hub-lint.ts` | computeLintReport, formatLintMarkdown |
| `apps/web/src/app/api/user/hub/lint/route.ts` | JSON endpoint |
| `apps/web/src/app/raw/hub/[slug]/lint.md/route.ts` | Markdown surface |

**Verified live on yc-demo hub.**

- 25 live docs total.
- 5 orphans correctly identified (docs not in any bundle and not
  linked from any other doc).
- 0 duplicates (yc-demo content is intentionally diverse).
- Markdown surface renders correctly with inline links.

## Test status

All previous regression suites still pass:

- `pnpm --filter web test:share` 56/56
- `pnpm --filter web test:bookmarklet` 30/30
- `pnpm --filter web test:diff` 13/13
