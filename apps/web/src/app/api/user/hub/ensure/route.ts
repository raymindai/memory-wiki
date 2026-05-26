import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

/**
 * POST /api/user/hub/ensure
 *
 * Idempotent: every signed-in user has a hub. If the profile row
 * already has a `hub_slug`, return it unchanged. Otherwise generate
 * a unguessable nanoid slug, set `hub_public = true`, and persist.
 *
 * Why nanoid and not the email prefix:
 *  - emails collide constantly (alice@one.com / alice@two.com /
 *    alice@three.com all want "alice"). A nanoid is unique by
 *    construction and the user can still rename it in Settings.
 *  - the slug constraint in migration 018 is /^[a-z0-9_-]{3,32}$/ so
 *    we restrict the nanoid alphabet to lowercase letters + digits.
 *
 * Returns { slug, created }. `created` is true the FIRST time the
 * slug is assigned, so the client can fire a one-off "Your hub is
 * ready — customize in Settings" notice without re-firing on every
 * page load.
 */
const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_LENGTH = 8;
const genSlug = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

export async function POST(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("hub_slug, hub_public")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.hub_slug) {
      return NextResponse.json({ slug: profile.hub_slug, created: false });
    }

    // Try up to 5 attempts — nanoid collisions at 8 lowercase chars
    // are astronomically rare (36^8 = 2.8e12) but the unique index
    // protects us anyway. Retry on 23505 just in case.
    //
    // UPSERT (not UPDATE) so a missing profile row gets inserted with
    // the new slug instead of the UPDATE silently affecting zero
    // rows. We saw users whose handle_new_user trigger never fired
    // (OAuth edge cases, manual user creation) end up in a state
    // where the API claimed `created: true` but no DB row existed.
    // Verify with .select() so we KNOW a row landed.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = genSlug();
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: userId, hub_slug: slug, hub_public: true }, { onConflict: "id" })
        .select("hub_slug");
      if (!error && data && data.length > 0 && data[0].hub_slug === slug) {
        return NextResponse.json({ slug, created: true });
      }
      if (error && error.code !== "23505") {
        console.error("hub/ensure upsert failed:", error);
        return NextResponse.json({ error: "Failed to assign hub slug", detail: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ error: "Slug collision retry exhausted" }, { status: 500 });
  } catch (err) {
    console.error("hub/ensure error:", err);
    return NextResponse.json({ error: "Ensure failed", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
