// POST /api/hooks/doc-created
//
// Supabase Database Webhook target. Fires on every INSERT into
// `documents`. Triggers the doc-lifecycle pipeline:
//   1. Embedding (OpenAI text-embedding-3-small)
//   2. Ontology / concept extraction (Anthropic Haiku)
//
// Why a webhook instead of inline auto-queue: any path that writes
// a row — POST /api/docs, /api/import/*, MCP server, GitHub Action,
// direct Supabase REST, future integrations — fires this hook
// automatically. The lifecycle is guaranteed regardless of caller.
// The previously-shipped cron sweep stays as a once-daily safety net
// for webhook delivery failures.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   - Table: documents
//   - Events: Insert
//   - URL: https://memory.wiki/api/hooks/doc-created
//   - HTTP headers: Authorization: Bearer ${WEBHOOK_SECRET}
//   - Method: POST

import { NextRequest, NextResponse, after } from "next/server";
import { isWebhookAuthorized, type SupabaseWebhookPayload } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface DocumentRow {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  is_draft: boolean | null;
  deleted_at: string | null;
  title: string | null;
  markdown: string | null;
}

export async function POST(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload<DocumentRow>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "INSERT") {
    // Webhook config should only send INSERT, but tolerate misconfig.
    return NextResponse.json({ ok: true, skipped: "non-insert" });
  }

  const row = payload.record;
  if (!row?.id) {
    return NextResponse.json({ error: "Missing record.id" }, { status: 400 });
  }

  // Skip soft-deleted (rare: webhook fires before app cleanup) and
  // docs without an owner. Anonymous docs get a 7-day cleanup cron
  // anyway; spending LLM credits on them isn't worth it.
  if (row.deleted_at) {
    return NextResponse.json({ ok: true, skipped: "deleted" });
  }
  if (!row.user_id) {
    return NextResponse.json({ ok: true, skipped: "anonymous" });
  }

  const origin = req.nextUrl.origin;
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": row.user_id,
  };

  // Fire-and-forget both lifecycle calls in the after() pass so the
  // webhook returns to Supabase quickly. Supabase retries on non-2xx
  // — keep the response cheap and let the actual work continue past
  // the response.
  after(async () => {
    await Promise.all([
      fetch(`${origin}/api/embed/${row.id}`, { method: "POST", headers })
        .catch((err) => console.warn(`[hook:doc-created] embed failed for ${row.id}`, err)),
      // Ontology refresh — we call it directly via the helper since
      // there's no public endpoint for it. Same module the inline
      // path uses.
      (async () => {
        try {
          const { enqueueOntologyRefresh } = await import("@/lib/ontology-refresh");
          const { getSupabaseClient } = await import("@/lib/supabase");
          const supa = getSupabaseClient();
          if (supa && row.user_id) {
            await enqueueOntologyRefresh({
              supabase: supa,
              userId: row.user_id,
              docId: row.id,
              title: row.title || "",
              markdown: row.markdown || "",
            });
          }
        } catch (err) {
          console.warn(`[hook:doc-created] ontology failed for ${row.id}`, err);
        }
      })(),
    ]);
  });

  return NextResponse.json({
    ok: true,
    docId: row.id,
    queued: ["embed", "ontology"],
  });
}
