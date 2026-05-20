// POST /api/hooks/bundle-membership-changed
//
// Supabase Database Webhook target. Fires on INSERT and DELETE of
// `bundle_documents` rows. Re-runs the bundle's embedding + graph
// because both signals depend on the current member set.
//
// We *don't* react to UPDATEs on bundle_documents because only
// sort_order and annotation change there, neither of which affect
// embedding or graph content.
//
// Configure in Supabase Dashboard → Database → Webhooks:
//   - Table: bundle_documents
//   - Events: Insert, Delete
//   - URL: https://memory.wiki/api/hooks/bundle-membership-changed
//   - HTTP headers: Authorization: Bearer ${WEBHOOK_SECRET}

import { NextRequest, NextResponse, after } from "next/server";
import { isWebhookAuthorized, type SupabaseWebhookPayload } from "@/lib/webhook-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

interface BundleDocRow {
  bundle_id: string;
  document_id: string;
}

export async function POST(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload<BundleDocRow>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "INSERT" && payload.type !== "DELETE") {
    return NextResponse.json({ ok: true, skipped: "non-insert-delete" });
  }

  // INSERT carries record, DELETE carries old_record — either one
  // points at the affected bundle.
  const row = payload.record || payload.old_record;
  if (!row?.bundle_id) {
    return NextResponse.json({ error: "Missing bundle_id" }, { status: 400 });
  }
  const bundleId = row.bundle_id;

  const origin = req.nextUrl.origin;

  after(async () => {
    // Look up the bundle owner once — we need x-user-id for the
    // ownership check on the embed + graph endpoints.
    let ownerId: string | null = null;
    let memberCount = 0;
    try {
      const { getSupabaseClient } = await import("@/lib/supabase");
      const supa = getSupabaseClient();
      if (!supa) return;
      const { data: bundle } = await supa
        .from("bundles")
        .select("user_id")
        .eq("id", bundleId)
        .single();
      ownerId = (bundle?.user_id as string | null) || null;
      if (!ownerId) return;          // anonymous — skip
      const { count } = await supa
        .from("bundle_documents")
        .select("document_id", { count: "exact", head: true })
        .eq("bundle_id", bundleId);
      memberCount = count || 0;
    } catch (err) {
      console.warn(`[hook:bundle-membership] lookup failed for ${bundleId}`, err);
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      "x-user-id": ownerId,
    };

    // Embed: always rerun. New / removed members shift the bundle's
    // semantic signal even when the title / description didn't change.
    void fetch(`${origin}/api/embed/bundle/${bundleId}`, { method: "POST", headers })
      .catch((err) => console.warn(`[hook:bundle-membership] embed failed for ${bundleId}`, err));

    // Graph: only when ≥2 members. If the change dropped below 2 we
    // leave the previous graph in place; the staleness flag will fire
    // and the user can manually re-run if they want it cleared.
    if (memberCount >= 2) {
      void fetch(`${origin}/api/bundles/${bundleId}/graph`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      }).catch((err) => console.warn(`[hook:bundle-membership] graph failed for ${bundleId}`, err));
    }
  });

  return NextResponse.json({
    ok: true,
    bundleId,
    eventType: payload.type,
    queued: ["embed", "graph-if-≥2"],
  });
}
