import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { runClusterPromotionSweep } from "@/lib/promote-clusters";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily sweep — promote document_ai_metadata clusters into AI
 * bundles when >=5 docs share a non-misc cluster_id and no AI
 * bundle already represents that cluster (dedupe via
 * bundle_ai_metadata.source_cluster_id). Caps at 10 promotions per
 * tick so a runaway tenant doesn't burn the function budget.
 *
 * Hand-call also supported. Gated by CRON_SECRET when configured.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
    if (got !== `Bearer ${secret}` && got !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  const result = await runClusterPromotionSweep(supabase, 10);
  return NextResponse.json({ ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
