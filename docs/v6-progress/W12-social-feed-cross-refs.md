# W12: social hub feed · cross-reference graph · launch readiness

**Commit.** `9e4c8413`. *W12: /hubs activity feed + cross-reference rollup*

> W12 is the last development week before the public launch. The
> public flip from `/` editor to `/v6-landing` is held until end of
> August 2026; everything below ships to staging behind the existing
> public routes.

## Activity feed on `/hubs`

### What ships

`/hubs` already had a static gallery of public hubs (W3d / earlier).
W12 adds a "Recently active" panel above the gallery — the latest
12 captures and bundles across *all* public hubs, sorted by
`updated_at`. Each row links to the doc/bundle and the owner's hub
in two distinct anchors so accidental clicks don't navigate twice.

Filters mirror the per-hub query: drafts, soft-deletes, password
docs, and email-restricted bundles never appear.

### Verified live

- `GET /hubs` → 200, ~99 KB.
- "Recently active" header present, "across all public hubs"
  caption present.
- 12 row entries (verified via the `kind` label count).

### Files

| Path | Role |
|------|------|
| `apps/web/src/app/hubs/page.tsx` | New `getActivityFeed()` + Recently active section |

## Cross-reference graph

### What ships

`lib/cross-refs.ts` extracts internal mdfy URL references from a
markdown corpus and rolls them up by target. A reference is any
`/{docId}`, `/d/{docId}`, `/b/{bundleId}`, or `/hub/{slug}` URL,
with or without the `https://(staging.)?memory.wiki` host prefix.
Self-citations are dropped. Targets that aren't themselves in the
public corpus are dropped (no way to game the count by linking to
random ids).

`/api/social/cross-refs` (public GET) returns the most-cited
public docs, bundles, and hubs alongside `totals.sources` and
`totals.targets`. Cached via `revalidate: 300` and edge-cached for
2 min with stale-while-revalidate.

`/hubs` surfaces the top 5 docs + top 3 bundles in a "Most cited"
panel above the gallery. The panel shows the citation count as
`×N` and links to both the cited resource and its owner's hub.

### Caveats

The extractor scans the 300 most-recently-updated public docs.
Older docs simply don't contribute (or get cited) until they're
touched again. That's an honest tradeoff — keeps the regex pass
under a second and the cited-set fresh.

### Verified

`scripts/test-cross-refs.ts` (added as `pnpm test:cross-refs`) —
15 unit assertions covering:

- doc / bundle / hub citation extraction
- self-reference exclusion
- both `https://staging.memory.wiki/<id>` and bare `/<id>` syntax
- `/b/<id>` not double-counted as `/<id>`
- unknown targets dropped
- multiple sources rolled up into a per-target unique-source set
- `rankCitations` ordering by count

`scripts/cross-refs-integration.mjs` (added as
`pnpm test:cross-refs:integration`) — 5 live assertions against
the running dev server: seeds three test docs (one target, two
sources linking to it), confirms target surfaces in the API with
`citationCount >= 2` and `hub_slug = "yc-demo"`, then cleans up.

### Files

| Path | Role |
|------|------|
| `apps/web/src/lib/cross-refs.ts` | Regex extractor + ranking helper |
| `apps/web/src/app/api/social/cross-refs/route.ts` | Public rollup endpoint |
| `apps/web/src/app/hubs/page.tsx` | "Most cited" panel + Activity feed |
| `apps/web/scripts/test-cross-refs.ts` | Unit harness (`pnpm test:cross-refs`) |
| `apps/web/scripts/cross-refs-integration.mjs` | Live harness (`pnpm test:cross-refs:integration`) |

## Test status (cumulative)

`test:share` 56/56, `test:bookmarklet` 30/30, `test:diff` 13/13,
`test:perm` 10/10, `test:discover` 9/9, `test:cross-refs` 15/15,
`test:cross-refs:integration` 5/5 — all pass.

## Deferred (post-launch)

- **Per-hub cross-ref panel**. Each `/hub/<slug>` could surface its
  own "Cited by" panel showing other hubs that reference its docs.
  Reuses the same extractor.
- **Cross-ref bidirectional graph view**. Today's surface is a
  ranked list; an actual graph (extending W9's hub-graph) would
  show inter-hub edges across all public hubs.
- **Public flip to /v6-landing**. The two-door landing has been
  live at `/v6-landing` since W10. The flip from `/` (editor) to
  this landing is the launch lever; deliberately deferred until
  end of August 2026 per the single-ship plan.
- **`/mdfy` skill teaches X-Mdfy-Permission recovery**. SKILL.md
  and the agent-prompt.md don't yet instruct agents to read the
  W11 permission headers and re-prompt the user for an email.
  Easy follow-up; doesn't block launch.
