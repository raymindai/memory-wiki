// POST /api/hooks/bundle-created
//
// Supabase Database Webhook target. Fires on INSERT into `bundles`.
// Triggers the bundle-lifecycle pipeline:
//   1. Embedding (title + description + member doc titles)
//   2. Graph analysis (themes / insights / connections) when the
//      bundle has ≥2 members at fire time.
//
// Membership change (bundle_documents INSERT / DELETE) has its own
// hook at /api/hooks/bundle-membership-changed since a bundle's
// member set can grow / shrink after creation.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   - Table: bundles
//   - Events: Insert
//   - URL: https://memory.wiki/api/hooks/bundle-created
//   - HTTP headers: Authorization: Bearer ${WEBHOOK_SECRET}

import { NextRequest, NextResponse, after } from "next/server";
import { isWebhookAuthorized, type SupabaseWebhookPayload } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BundleRow {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
}

export async function POST(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload<BundleRow>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "INSERT") {
    return NextResponse.json({ ok: true, skipped: "non-insert" });
  }

  const row = payload.record;
  if (!row?.id) {
    return NextResponse.json({ error: "Missing record.id" }, { status: 400 });
  }
  if (!row.user_id) {
    return NextResponse.json({ ok: true, skipped: "anonymous" });
  }

  const origin = req.nextUrl.origin;
  const headers = {
    "Content-Type": "application/json",
    "x-user-id": row.user_id,
  };

  // The hook fires on INSERT bundles, but bundle_documents inserts
  // can race ahead of OR lag behind this hook depending on the
  // caller's order. Defer the work into after() and check member
  // count inside — that way the inserts have time to land first.
  after(async () => {
    // Embed always — only needs title + description + (now zero, soon
    // some) member titles.
    void fetch(`${origin}/api/embed/bundle/${row.id}`, { method: "POST", headers })
      .catch((err) => console.warn(`[hook:bundle-created] embed failed for ${row.id}`, err));

    // Graph: gate on member count to avoid the LLM call when there's
    // nothing to analyse.
    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const supa = getSupabaseClient();
      if (supa) {
        const { count } = await supa
          .from("bundle_documents")
          .select("document_id", { count: "exact", head: true })
          .eq("bundle_id", row.id);
        if ((count || 0) >= 2) {
          void fetch(`${origin}/api/bundles/${row.id}/graph`, {
            method: "POST",
            headers,
            body: JSON.stringify({}),
          }).catch((err) => console.warn(`[hook:bundle-created] graph failed for ${row.id}`, err));
        }
      }
    } catch (err) {
      console.warn(`[hook:bundle-created] member-count check failed for ${row.id}`, err);
    }
  });

  return NextResponse.json({
    ok: true,
    bundleId: row.id,
    queued: ["embed", "graph-if-≥2-members"],
  });
}
