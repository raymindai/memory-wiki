# W11: permission-aware AI fetching · shared bundles discoverable mode

**Commit.** `dfcb0f0a`. *W11: permission-aware /raw/* + discoverable bundles feed*

## Permission-aware `/raw/*`

### What ships

`lib/permission-response.ts` returns a structured markdown body for
every "you can't read this" case on the AI fetch path, replacing the
old plain-text `Not found` / `password-protected` strings:

- Frontmatter block (`mw_error: 1`, `mw_permission: <reason>`,
  `kind`, `id`, `url`) so an AI client can parse the cause without
  scraping the body.
- Markdown body with a short instructions block — for `email_restricted`
  it tells the agent to retry with `Authorization: Bearer …` or
  `X-User-Email: …`. For `password_protected` it tells the agent the
  raw endpoint can't accept a password and points at the browser URL.
  For `expired` / `not_found` / `draft` / `deleted` it tells the agent
  there's no retry path.
- Headers: `X-Mdfy-Permission: <reason>`, `X-Mdfy-Resource: doc|bundle`,
  `Cache-Control: no-store`, `Link: <canonicalUrl>; rel="canonical"`.

`/raw/[id]` and `/raw/bundle/[id]` route through the helper for every
permission denial. Both routes now also accept `Authorization: Bearer`
or `X-User-Email` for email-restricted resources, with a case-insensitive
allow-list match. Owner-via-JWT short-circuits the email check.

Reasons covered: `not_found`, `draft`, `deleted`, `password_protected`,
`expired`, `email_restricted`, `service_unavailable`. Status codes
preserve the prior surface (404 / 401 / 403 / 410 / 503) so existing
clients don't see a regression — only the body and headers got richer.

### Verified live on yc-demo

`scripts/perm-test.mjs` (added as `pnpm test:perm`):

- public doc → 200 / no permission header
- restricted doc, no auth → 403 / `email_restricted` / markdown body
- restricted doc, wrong `X-User-Email` → 403 / `email_restricted`
- restricted doc, right `X-User-Email` → 200
- restricted doc, mixed-case email → 200 (case-insensitive match)
- missing doc → 404 / `not_found`
- public bundle → 200 / no permission header
- restricted bundle, no auth → 403 / `email_restricted`
- restricted bundle, right email → 200
- missing bundle → 404 / `not_found`

10/10 pass against the running dev server. Each error path's body
starts with `---` and includes the frontmatter block.

### Files

| Path | Role |
|------|------|
| `apps/web/src/lib/permission-response.ts` | Helper that builds the markdown error body + headers |
| `apps/web/src/app/raw/[id]/route.ts` | `/raw/<docId>` rewired through the helper, now accepts auth/X-User-Email |
| `apps/web/src/app/raw/bundle/[id]/route.ts` | `/raw/bundle/<id>` rewired through the helper |
| `apps/web/scripts/perm-test.mjs` | Permission test harness (`pnpm test:perm`) |

## Discoverable bundles + `/shared` feed

### What ships

Migration `022_bundle_discoverable.sql` adds `bundles.is_discoverable`
(boolean, default false) and a partial index covering rows where
`is_discoverable = TRUE AND is_draft = FALSE AND password_hash IS NULL`.
Most bundles will never opt in, so the partial index keeps the
discovery query cheap.

`/api/bundles/[id]` gains a `set-discoverable` action. It rejects
the flip-on if the bundle is draft, password-protected, or has an
`allowed_emails` allow-list. When an owner later adds an allow-list
or unpublishes the bundle, the API auto-flips `is_discoverable` back
off so the discovery feed never leaks a now-restricted bundle.

`/api/bundles/discover` (public GET) returns the most recently
updated discoverable bundles with owner attribution (display name +
hub slug, or just the slug if the hub is private). Cursor-paginated
on `updated_at`.

`/shared` is the SSR feed page — same visual language as `/hub/<slug>`,
shows up to 60 bundles with title, description, doc count, owner
label, and a link to the owner's hub when the hub is public. The
bundle owner controls whether their bundle appears here.

### Verified live on yc-demo

`scripts/discover-test.mjs` (added as `pnpm test:discover`):

- After flipping `is_discoverable=true` on yc-demo's
  *Weekly Reviews — March 2026* bundle:
  - `GET /api/bundles/discover` returns 200 and the bundle is in
    the list with owner `hub_slug=yc-demo`.
  - `GET /shared` returns 200 and the HTML references `/b/<id>`.
  - Page heading "Shared by people on Memory.Wiki" renders.
- After locking the bundle behind `allowed_emails`, the discover
  endpoint no longer surfaces it — both the safety filter in the
  API and the auto-flip rule in `set-allowed-emails` collaborate to
  enforce that.

9/9 pass against the running dev server.

### Files

| Path | Role |
|------|------|
| `apps/web/supabase/migrations/022_bundle_discoverable.sql` | Adds `is_discoverable` + partial index |
| `apps/web/src/app/api/bundles/[id]/route.ts` | `set-discoverable` action, auto-strip on lock-down/unpublish |
| `apps/web/src/app/api/bundles/discover/route.ts` | Public GET for the discovery feed (cursor-paginated) |
| `apps/web/src/app/shared/page.tsx` | SSR `/shared` listing |
| `apps/web/scripts/discover-test.mjs` | Discoverable bundles test harness (`pnpm test:discover`) |

## Test status

`test:share` 56/56, `test:bookmarklet` 30/30, `test:diff` 13/13,
`test:perm` 10/10, `test:discover` 9/9 all pass.

## Deferred

- **In-app toggle for `is_discoverable`**. The API surface and
  validation are in place; the bundle Share menu still needs a UI
  switch and a "List on /shared" affordance. W12 work, paired with
  the launch landing.
- **Per-AI client UX for permission errors**. The structured error
  body is uniform; SKILL.md / cursor-rule.mdc don't yet teach the
  agent to read `X-Mdfy-Permission` and prompt the user to set
  `X-User-Email` automatically. Easy follow-up.
- **Discover feed signals beyond recency**. We only sort by
  `updated_at` for now. Surface trending / most-paste-into-AI later
  once we have the analytics signal.
