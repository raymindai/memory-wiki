# W3: anonymous capture, claim flow, hub schema, demo CTA

W3 is four sub-pieces. They land independently but all serve the same
goal: a casual visitor can capture and own knowledge without ever
signing up, and the hub the LLM eventually maintains has a per-user
config to follow.

| Sub | Title | Commit |
|-----|-------|--------|
| W3a | Cross-origin anonymous capture cookie + CORS | `22dd6d4e` |
| W3b | Auto-claim anonymous captures on sign-in | `1598c2a1` |
| W3c | Signed-out demo hub CTA on landing | `075e413f` |
| W3d | `MDFY.md` hub schema (foundation for W4 / W5) | `e4113c90` |

## W3a. Cross-origin anonymous capture cookie

**Problem.** The bookmarklet runs on `chatgpt.com` / `claude.ai` /
`gemini.google.com` and POSTs to `memory.wiki/api/docs`. localStorage on
Memory.Wiki is unreachable from those origins, so anonymous captures had
no way to be grouped together for later claiming.

**Fix.** Server issues an `mw_anon` cookie:

```
mw_anon=<uuid>; Max-Age=31536000; Path=/; SameSite=None; Secure
```

`SameSite=None; Secure` is required so the bookmarklet's cross-origin
fetch (with `credentials: "include"`) sends and receives it. The
cookie is intentionally not `HttpOnly` so the in-app sign-in flow can
read it.

CORS preflight handler added to `/api/docs` with a trusted-origin
allowlist (the four AI hosts plus Memory.Wiki and local dev). Bookmarklet
flips to `credentials: "include"` so the cookie round-trips.

**Files.**

| Path | Role |
|------|------|
| `apps/web/src/lib/anonymous-cookie.ts` | Server-side issue/read + CORS helper |
| `apps/web/src/app/api/docs/route.ts` | OPTIONS handler, body→header→cookie cascade, Set-Cookie on POST |
| `apps/web/public/bookmarklet.js` | `credentials: "include"` flip |

**Verified.**

- POST without cookie → cookie issued, doc inserted with new `anonymous_id`.
- POST with cookie → no `Set-Cookie`, doc inserted with same `anonymous_id`.
- Authenticated POST → no cookie issued, doc owned by `user_id`.
- OPTIONS preflight from `https://chatgpt.com` returns 204 with full
  CORS headers (allow-origin echoed, allow-credentials true,
  allow-methods POST/OPTIONS).

## W3b. Auto-claim on sign-in

**Behavior.** When a user signs in, `useAuth.ts` fires a best-effort
`POST /api/user/migrate` with whatever anonymous ids the browser has
(legacy localStorage `mw-anon-id` plus the new `mw_anon` cookie).
Idempotent. Running it twice is harmless.

`/api/user/migrate` now claims **bundles** as well as documents. The
endpoint reads the cookie itself as a final fallback.

After a successful claim, both ids are cleared client-side and a
`mw-anon-claimed` event is dispatched with `{documents, bundles}`
counts so future UI can show a toast.

**Files.**

| Path | Role |
|------|------|
| `apps/web/src/lib/anonymous-cookie-client.ts` | Browser-side `readMdfyAnonCookie` / `clearMdfyAnonCookie` |
| `apps/web/src/lib/useAuth.ts` | SIGNED_IN auto-migrate + clear |
| `apps/web/src/app/api/user/migrate/route.ts` | Multi-id claim, bundles included |

**Verified.**

- Anonymous capture → demo signin → migrate → doc.user_id flips,
  anonymous_id null, edit_mode "account". Cookie cleared.

## W3c. Signed-out demo hub CTA

The first slide of `WelcomeOverlay` now carries
*"See a real hub →"* linking to `/hub/yc-demo`. Visitors can preview
what a hub looks like without signing up.

**Files.**

| Path | Role |
|------|------|
| `apps/web/src/components/WelcomeOverlay.tsx` | `demoLink` field on slide 0 |

## W3d. `MDFY.md` hub schema

**Why.** Karpathy's LLM-Wiki pattern has three layers (raw sources,
the wiki, the schema). The schema tells the LLM how to maintain the
wiki: tone, topics, cross-references, lint rules. This is the
foundation W4 synthesis and W5 lint will read.

**Storage.** Plain markdown column on `profiles` (`hub_schema_md`
plus an `hub_schema_updated_at` marker). Default is null; the helper
substitutes a sensible seed when reading. 32KB cap.

**API.**

- `GET /api/user/hub/schema` returns current schema (or default) plus
  `isDefault`, `updatedAt`, and the `defaultMarkdown` for client preview.
- `PATCH /api/user/hub/schema` accepts body `{markdown}`. Empty string resets
  to default.

Auth required, owner-only. The schema is private; only the synthesis
pipeline reads it server-side.

**Files.**

| Path | Role |
|------|------|
| `apps/web/supabase/migrations/019_hub_schema.sql` | DB columns (applied to staging+prod via `supabase db push`) |
| `apps/web/src/lib/hub-schema.ts` | `DEFAULT_HUB_SCHEMA_MD`, `readHubSchema`, `writeHubSchema` |
| `apps/web/src/app/api/user/hub/schema/route.ts` | GET / PATCH |

**Verified.**

- GET returns default for fresh user.
- PATCH custom → GET returns custom.
- PATCH empty → reset to default.
- 401 unauthenticated GET.
- 413 oversized body (32KB cap).

## Deferred

- UI for editing the schema in Settings. Synthesis can already consume
  it via `readHubSchema`; manual editing comes later or via a hub-page
  editor in W7+.
- Showing the user a toast after auto-claim. Event is dispatched;
  consumer to render it lives wherever post-launch.
