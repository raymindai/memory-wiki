import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { ACCENT_KEYS } from "@/lib/_accent.generated";

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

/**
 * PATCH /api/user/profile
 *
 * Native clients (iOS / Android / Desktop / VSCode / CLI) write
 * profile prefs through this endpoint because they auth with a
 * bearer token and can't run the browser-side Supabase SDK that
 * the web client uses (see SettingsEmbed.syncPrefToProfile).
 *
 * Without this handler PATCH falls through to Next.js's default
 * 405, and Android's `runCatching { api.updateProfile(...) }`
 * swallows the failure — the accent picker indicator never moves
 * even though the tap landed and the network request fired.
 *
 * Accepts any subset of { accent_color, color_scheme, display_name }.
 * Empty body is a no-op (200, profile unchanged) — keeps the client
 * resilient to dropping all known fields.
 */
export async function PATCH(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  const accent = body.accent_color;
  if (typeof accent === "string" && ACCENT_KEYS.has(accent)) {
    patch.accent_color = accent;
  } else if (accent !== undefined) {
    return NextResponse.json({ error: "Invalid accent_color" }, { status: 400 });
  }
  const scheme = body.color_scheme;
  if (typeof scheme === "string" && scheme.length > 0 && scheme.length <= 32) {
    patch.color_scheme = scheme;
  } else if (scheme !== undefined) {
    return NextResponse.json({ error: "Invalid color_scheme" }, { status: 400 });
  }
  const displayName = body.display_name;
  if (typeof displayName === "string") {
    const trimmed = displayName.trim();
    if (trimmed.length > 100) {
      return NextResponse.json({ error: "display_name too long" }, { status: 400 });
    }
    patch.display_name = trimmed;
  } else if (displayName !== undefined && displayName !== null) {
    return NextResponse.json({ error: "Invalid display_name" }, { status: 400 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ profile: null, updated: [] });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("display_name, avatar_url, avatar_style, plan, hub_slug, hub_public, hub_description, curator_settings, accent_color, color_scheme")
    .maybeSingle();
  if (error) {
    console.error("user/profile PATCH error:", error);
    return NextResponse.json({ error: "Profile update failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data || null, updated: Object.keys(patch) });
}
