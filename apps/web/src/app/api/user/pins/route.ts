import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

/**
 * Starred / pinned items. Owner-only — every action gates on the
 * resolved user id matching the row's user_id (RLS also enforces).
 *
 *   GET                       → { pins: [{ kind, id, created_at }] }
 *   POST  { kind, id }        → toggle on
 *   DELETE ?kind=…&id=…       → remove
 */

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  if (verified?.userId) return verified.userId;
  const headerId = req.headers.get("x-user-id");
  if (headerId) return headerId;
  return null;
}

function isValidKind(s: unknown): s is "document" | "bundle" {
  return s === "document" || s === "bundle";
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("user_pins")
    .select("kind, target_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  const pins = (data || []).map((r) => ({ kind: r.kind, id: r.target_id, createdAt: r.created_at }));
  return NextResponse.json({ pins });
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const kind = body.kind;
  const id = body.id;
  if (!isValidKind(kind) || typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // Upsert keyed on (user_id, kind, target_id) — second POST of the
  // same triple is a no-op, not an error.
  const { error } = await supabase
    .from("user_pins")
    .upsert({ user_id: userId, kind, target_id: id }, { onConflict: "user_id,kind,target_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!isValidKind(kind) || !id) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_pins")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("target_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
