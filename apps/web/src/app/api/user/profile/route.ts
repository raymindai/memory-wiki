import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

/**
 * GET /api/user/profile
 *
 * Server-side profile fetch using the service role key so the
 * response is authoritative — bypasses any browser-side RLS or
 * session-cookie issues that were leaving the editor with a
 * profile shape missing `hub_slug` even when the row in DB had
 * one. Use this as the source of truth in useAuth when the
 * browser-side SELECT comes back empty.
 *
 * Returns the FULL profile shape (display_name, avatar_url,
 * avatar_style, plan, hub_*, curator_settings, accent_color,
 * color_scheme). Auth: Bearer token preferred; `x-user-id` fallback
 * matches the rest of the user endpoints.
 */
export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_style, plan, hub_slug, hub_public, hub_description, curator_settings, accent_color, color_scheme")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("user/profile error:", error);
    return NextResponse.json({ error: "Profile fetch failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data || null });
}
