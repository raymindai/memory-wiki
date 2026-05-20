# Supabase Database Webhooks — setup

mdfy uses Supabase Database Webhooks to fire the AI lifecycle (embed
+ ontology + graph) on every doc / bundle write, regardless of which
code path created the row. The three handlers live at
`apps/web/src/app/api/hooks/*`. This file documents the one-time
Dashboard configuration.

## Why webhooks (vs. cron sweep)

| Path | Latency | Coverage | Notes |
|---|---|---|---|
| Inline auto-queue (`POST /api/bundles`) | instant | only the editor path | best for the common case |
| **Supabase DB Webhook** | <2s | every write, every path | **primary**, structural |
| Cron sweep at `/api/cron/lifecycle-sweep` | up to 24h | catches what webhooks missed | daily safety net |

The webhook is the structural answer — any caller that writes a row
into `documents` / `bundles` / `bundle_documents` fires the same
lifecycle. No per-caller wiring required.

## Required env vars

In Vercel project settings (Production):

```
WEBHOOK_SECRET=<long random string>     # for the /api/hooks/* auth check
CRON_SECRET=<long random string>        # for the /api/cron/* auth check
```

Generate each with `openssl rand -hex 32`.

## Webhook 1 — `doc-created`

**Trigger on:** every INSERT into `documents`.

| Field | Value |
|---|---|
| Name | `mw-doc-created` |
| Table | `public.documents` |
| Events | ✓ Insert (only) |
| Type | HTTP Request |
| Method | POST |
| URL | `https://mdfy.app/api/hooks/doc-created` |
| HTTP Headers | `Authorization: Bearer <WEBHOOK_SECRET>` |
| HTTP Headers | `Content-Type: application/json` |
| HTTP Params | (none) |
| Timeout (ms) | `5000` |

## Webhook 2 — `bundle-created`

**Trigger on:** every INSERT into `bundles`.

| Field | Value |
|---|---|
| Name | `mw-bundle-created` |
| Table | `public.bundles` |
| Events | ✓ Insert (only) |
| Method | POST |
| URL | `https://mdfy.app/api/hooks/bundle-created` |
| Authorization | `Bearer <WEBHOOK_SECRET>` |

## Webhook 3 — `bundle-membership-changed`

**Trigger on:** every INSERT and DELETE on `bundle_documents`.

| Field | Value |
|---|---|
| Name | `mw-bundle-membership-changed` |
| Table | `public.bundle_documents` |
| Events | ✓ Insert, ✓ Delete |
| Method | POST |
| URL | `https://mdfy.app/api/hooks/bundle-membership-changed` |
| Authorization | `Bearer <WEBHOOK_SECRET>` |

## Verifying

After saving each webhook, drag a `.md` file into the editor or call
the REST API directly:

```bash
curl -X POST https://mdfy.app/api/docs \
     -H "Authorization: Bearer <your-access-token>" \
     -H "Content-Type: application/json" \
     -d '{"markdown":"# Hook test","title":"Hook test","isDraft":true}'
```

Within ~10s the new doc should have `embedding IS NOT NULL` in
Supabase. Inspect the row:

```sql
SELECT id, embedding IS NOT NULL AS embedded, created_at
  FROM documents
 WHERE title = 'Hook test'
 ORDER BY created_at DESC
 LIMIT 1;
```

You can also tail webhook delivery logs in the Supabase Dashboard
(Database → Webhooks → the webhook → Recent deliveries) to confirm
HTTP 200 responses.

## What happens if a webhook fires before its env var lands

The `/api/hooks/*` handler rejects with HTTP 401 (`Unauthorized`)
when `WEBHOOK_SECRET` is missing or doesn't match. Supabase logs the
failure but won't retry. The daily `lifecycle-sweep` cron at 04:00
UTC will pick up any row that was missed.

## Rollback

To disable webhooks without removing them, set each webhook to
"Disabled" in Supabase Dashboard. The cron stays running, so the
backfill keeps working — at a 24h-latency degradation.
