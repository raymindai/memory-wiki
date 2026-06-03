import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

// GET /api/docs/recent?limit=10&source=chrome
//
// Returns the authenticated user's most recently created documents,
// optionally filtered by source. Used by the Chrome extension's
// Recent list so it stays in sync across browsers / devices instead
// of relying on chrome.storage.local (which resets per-profile).
//
// Auth: Authorization: Bearer <token> OR x-user-id header.
// Returns 401 when neither resolves to a real user.

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10) || 10));
  const sourcePrefix = url.searchParams.get("source") || "";

  let query = supabase
    .from("documents")
    .select("id, title, source, created_at, updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourcePrefix) {
    // Filter by source prefix — e.g. "chrome" matches chrome, chrome-intent, chrome-auto.
    query = query.ilike("source", `${sourcePrefix}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || []).map((d) => ({
    id: d.id,
    url: `https://memory.wiki/${d.id}`,
    title: d.title || "Untitled",
    source: d.source || "",
    ts: new Date(d.created_at).getTime(),
  }));

  return NextResponse.json({ items });
}
