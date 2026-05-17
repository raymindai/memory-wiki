// Cron-triggered worker for the extraction_jobs queue.
//
// Vercel calls this on a schedule (vercel.json `crons`). It drains a
// small batch of ready jobs per invocation so a single tick never
// exceeds the function budget. Failures bump the attempt counter
// inside drainJobs() via failJob() — exponential backoff scheduling
// happens there.
//
// Hand-call is also supported (no auth header from the cron, but we
// gate by the CRON_SECRET env var when present so accidental hits
// from the public internet are 401'd).

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { drainJobs } from "@/lib/ontology-refresh";

export const runtime = "nodejs";
// Pro plan default — give the worker enough headroom for a small
// batch of LLM calls. drainJobs caps itself at 5 jobs per tick.
export const maxDuration = 60;

async function handle(req: NextRequest) {
  // If a secret is configured, require it. Vercel cron sets the
  // standard `x-vercel-cron-signature` header which we don't verify
  // here — the secret env (set in `vercel.json` `headers`) is the
  // simpler bar.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const got = req.headers.get("authorization") || req.headers.get("x-cron-secret") || "";
    if (got !== `Bearer ${secret}` && got !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }
  const result = await drainJobs(supabase, 5);
  return NextResponse.json({ ...result, ranAt: new Date().toISOString() });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
