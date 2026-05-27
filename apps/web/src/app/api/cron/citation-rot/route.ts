import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { runCitationCheckSweep } from "@/lib/citation-rot";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily Citation rot sweep. Drains up to 50 URLs from
 * external_link_health (oldest-checked first; never-checked rows
 * sort first because last_checked_at defaults to epoch 0 on first
 * insert via refreshDocExternalLinks). HEAD-checks each with a 7s
 * timeout, updates consecutive_fail_count so transient blips don't
 * tip a URL into Citation rot on the first probe.
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
  const result = await runCitationCheckSweep(supabase, 50);
  return NextResponse.json({ ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
