# W6: proactive bundle suggestions (exceed move 3)

**Commit.** `4368d47c`. *W6: proactive bundle suggestions (exceed move 3)*

## Why this is the third exceed

Karpathy's pattern is reactive: the user asks, the LLM responds.
Graphify is the same: the user runs `/graphify`. memory.wiki now watches
hub activity and proposes actions on its own ("you've added 4 docs
about pricing this week, want a bundle?"). This is the third
structural capability memory.wiki ships at launch that's outside what the
source patterns cover.

Combined with W4 (diff/accept synthesis) and W5a (PDF ingest), the
launch claim "we exceed Karpathy's LLM Wiki and Graphify on day one"
is honest.

## What ships

### Storage

`hub_suggestions` table with id, user_id, type, title, reason,
doc_ids, status (open / accepted / dismissed), accepted_bundle_id,
timestamps. Never hard-deleted. The generator avoids reproposing
docs that are already part of any non-dismissed suggestion.

`hub_suggestion_runs` table tracks the last analysis run per user
for throttling.

### Detector

`lib/hub-suggestions.ts` runs a per-user pass:

1. Pull docs created in the last 14 days, with embedding, not in any
   existing bundle, not already in an open suggestion.
2. Greedy cluster via `match_documents_by_embedding` RPC. Distance
   threshold 0.45 (empirically: same-topic docs land at 0.33-0.45
   with text-embedding-3-small; below 0.30 catches only
   near-duplicates, above 0.50 mixes topics).
3. Min cluster size 3, max 4 clusters per pass.
4. For each cluster, the provider chain (Anthropic > OpenAI > Gemini)
   generates a 3-6 word title and a one-sentence rationale.
5. Persist as `hub_suggestions` rows with `status = 'open'`.

Throttle: 12 hours per user via `hub_suggestion_runs.last_run_at`.

### API

- `GET /api/user/hub/suggestions`. List open suggestions, newest
  first.
- `POST /api/user/hub/suggestions`. Force a refresh (bypasses
  throttle for explicit user-initiated refreshes).
- `DELETE /api/user/hub/suggestions/[id]`. Mark dismissed.
- `POST /api/user/hub/suggestions/[id]/accept`. Materialize as a
  real bundle. Mirrors `/api/bundles` POST behavior: creates the
  bundle row, links docs, schedules W4 auto-synthesis via `after()`.
  Suggestion row flips to `status='accepted'` with the new
  `accepted_bundle_id`.

### Hook

`/api/docs` POST schedules `maybeRefreshSuggestions` via `after()`
on every authenticated, non-draft, non-auto-synthesis create. The
12h throttle inside the helper short-circuits frequent doc bursts
so we don't pay for the LLM call on every save.

## Files

| Path | Role |
|------|------|
| `apps/web/supabase/migrations/021_hub_suggestions.sql` | Tables + RLS |
| `apps/web/src/lib/hub-suggestions.ts` | Cluster detection + LLM summarizer |
| `apps/web/src/app/api/user/hub/suggestions/route.ts` | GET + POST |
| `apps/web/src/app/api/user/hub/suggestions/[id]/route.ts` | DELETE |
| `apps/web/src/app/api/user/hub/suggestions/[id]/accept/route.ts` | Materialize as bundle |
| `apps/web/src/app/api/docs/route.ts` | Hook on doc create |

## Verified end-to-end

Live on yc-demo:

- Created 4 pricing-related docs, embedded each via `/api/embed/[id]`.
- Suggestion pass clustered all 4. LLM produced title
  "SaaS Pricing Strategy Research" and a coherent rationale ("All four
  documents focus on analyzing and developing pricing strategies for
  SaaS products...").
- `POST .../accept` created bundle `X2n2G4px` with the 4 docs in
  correct sort order. Suggestion flipped to `status='accepted'` with
  the bundle id wired up. Auto-synthesis (W4) fired and a wiki doc
  for the bundle appeared.
- `DELETE .../suggestions/<id>` flipped a temp suggestion to
  `status='dismissed'`; row preserved.
- All previous suites still pass: test:share 56/56,
  test:bookmarklet 30/30, test:diff 13/13.

## Threshold tuning notes

`text-embedding-3-small` produces these cosine distances for the test
cluster (4 pricing docs):

| Pair | Distance |
|---|---|
| Vlkn4CaB <> HFqDLwk2 | 0.34 |
| Vlkn4CaB <> jqYSWWVo | 0.40 |
| Vlkn4CaB <> ybAfPRUe | 0.43 |
| any of these <> "Project Acme Milestones" | 0.62+ |
| any of these <> "Welcome to memory.wiki" | 0.66+ |

So 0.45 cleanly separates "same-topic" from "different-topic." Bumping
to 0.50 would still work but starts admitting tangentially-related
docs (like a YC application doc that mentions pricing in passing).

## Deferred

- **UI panel.** A "Suggestions" tab on the hub page that lists open
  suggestions, with Accept / Dismiss buttons. Backend is wired; the
  React component is the next chunk.
- **Background re-clustering.** Right now suggestions only refresh on
  doc create + manual force. A nightly cron pass would catch
  clusters that form across longer time windows.
- **Other suggestion types.** v1 ships only `bundle_topic`. Future:
  "delete suggestion" (ancient unused docs), "merge suggestion"
  (likely duplicates).

## Test status

All previous regression suites still pass (`test:share` 56,
`test:bookmarklet` 30, `test:diff` 13). No new test suite for W6 yet
since the cluster detector depends on real embeddings and AI calls;
synthetic mocks would test the wiring but not the end-to-end signal.
The live yc-demo verification above is the regression baseline.
