import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

// Admin-only AI usage rollups for the Usage tab. Returns last 30
// days of:
//   - totals (calls, tokens, cost)
//   - per-user breakdown (top N by spend)
//   - per-action breakdown (every action that fired)
//   - daily series (cost + tokens for the trend chart)
//
// The auth gate matches the rest of admin (email === ADMIN_EMAIL).
// Reads only — no writes.

const ADMIN_EMAIL = "hi@raymind.ai";
const WINDOW_DAYS = 30;
const TOP_USERS = 50;

export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (!verified || verified.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull every row in the window. ai_usage is small (one row per AI
  // call) so a 30-day window is comfortably under the 1k Supabase
  // default. For larger horizons we'd switch to aggregated SQL.
  const { data: rows, error } = await supabase
    .from("ai_usage")
    .select("user_id, anonymous_id, action, provider, model, input_tokens, output_tokens, cost_usd, status, tier, duration_ms, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50000);

  if (error) {
    console.error("[admin/usage] query failed:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const all = rows || [];

  type Row = (typeof all)[number];

  // Totals
  const totals = all.reduce(
    (acc, r: Row) => {
      acc.calls += 1;
      acc.inputTokens += r.input_tokens || 0;
      acc.outputTokens += r.output_tokens || 0;
      acc.costUsd += Number(r.cost_usd) || 0;
      if (r.status !== "ok") acc.errors += 1;
      return acc;
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, errors: 0 },
  );

  // Per-user breakdown (top N by cost). Anon rows roll up under
  // their anonymous_id with a marker so the admin can spot anon
  // spend (chrome-ext anonymous flows).
  const byUser = new Map<string, { id: string; isAnon: boolean; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>();
  for (const r of all as Row[]) {
    const key = r.user_id ? `u:${r.user_id}` : `a:${r.anonymous_id || "unknown"}`;
    const existing = byUser.get(key) || {
      id: r.user_id || r.anonymous_id || "unknown",
      isAnon: !r.user_id,
      calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
    };
    existing.calls += 1;
    existing.inputTokens += r.input_tokens || 0;
    existing.outputTokens += r.output_tokens || 0;
    existing.costUsd += Number(r.cost_usd) || 0;
    byUser.set(key, existing);
  }
  const topUsers = [...byUser.values()].sort((a, b) => b.costUsd - a.costUsd).slice(0, TOP_USERS);

  // Resolve user_id → email for the signed-in users in topUsers, so
  // the admin can read names instead of opaque uuids.
  const userIds = topUsers.filter((u) => !u.isAnon).map((u) => u.id);
  const idToEmail = new Map<string, string>();
  if (userIds.length > 0) {
    // listUsers caps at 1000 by default — fine for now.
    const { data: authData } = await supabase.auth.admin.listUsers();
    for (const u of authData?.users || []) {
      if (userIds.includes(u.id)) idToEmail.set(u.id, u.email || "");
    }
  }
  const topUsersWithEmail = topUsers.map((u) => ({
    ...u,
    email: u.isAnon ? null : (idToEmail.get(u.id) || ""),
  }));

  // Per-action breakdown.
  const byAction = new Map<string, { action: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>();
  for (const r of all as Row[]) {
    const existing = byAction.get(r.action) || {
      action: r.action, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
    };
    existing.calls += 1;
    existing.inputTokens += r.input_tokens || 0;
    existing.outputTokens += r.output_tokens || 0;
    existing.costUsd += Number(r.cost_usd) || 0;
    byAction.set(r.action, existing);
  }
  const actionRows = [...byAction.values()].sort((a, b) => b.costUsd - a.costUsd);

  // Per-provider breakdown.
  const byProvider = new Map<string, { provider: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }>();
  for (const r of all as Row[]) {
    const existing = byProvider.get(r.provider) || {
      provider: r.provider, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
    };
    existing.calls += 1;
    existing.inputTokens += r.input_tokens || 0;
    existing.outputTokens += r.output_tokens || 0;
    existing.costUsd += Number(r.cost_usd) || 0;
    byProvider.set(r.provider, existing);
  }
  const providerRows = [...byProvider.values()].sort((a, b) => b.costUsd - a.costUsd);

  // Daily series. One bucket per UTC day for the last WINDOW_DAYS,
  // even if empty, so the chart renders without holes.
  const dayBuckets = new Map<string, { date: string; calls: number; costUsd: number }>();
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, { date: key, calls: 0, costUsd: 0 });
  }
  for (const r of all as Row[]) {
    const day = r.created_at.slice(0, 10);
    const b = dayBuckets.get(day);
    if (b) {
      b.calls += 1;
      b.costUsd += Number(r.cost_usd) || 0;
    }
  }
  const dailySeries = [...dayBuckets.values()];

  return NextResponse.json({
    windowDays: WINDOW_DAYS,
    totals,
    topUsers: topUsersWithEmail,
    actionRows,
    providerRows,
    dailySeries,
  });
}
