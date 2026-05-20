import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { readAnonymousCookie } from "@/lib/anonymous-cookie";

/**
 * Claim every document and bundle this browser created anonymously and
 * attach them to the current user. Idempotent: rows already owned by
 * the user are not double-migrated.
 *
 * Accepts the anonymousId from:
 *   1. body.anonymousId (legacy localStorage path)
 *   2. body.cookieAnonymousId (current cross-origin cookie path)
 *   3. mw_anon cookie on the request itself (fallback)
 *
 * The client may pass both legacy and cookie ids if it has them, and
 * we'll run the migrate for each.
 */
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

  let body: { anonymousId?: string; cookieAnonymousId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Collect every anonymous id we can find that points to docs/bundles
  // this browser owns. De-duplicate so the same id isn't migrated twice.
  const ids = new Set<string>();
  if (body.anonymousId) ids.add(body.anonymousId);
  if (body.cookieAnonymousId) ids.add(body.cookieAnonymousId);
  const cookieId = readAnonymousCookie(req);
  if (cookieId) ids.add(cookieId);

  if (!ids.size) {
    return NextResponse.json({ error: "anonymousId required" }, { status: 400 });
  }

  let migratedDocs = 0;
  let migratedBundles = 0;
  for (const anonymousId of ids) {
    const { data: docs, error: docsErr } = await supabase
      .from("documents")
      .update({ user_id: userId, anonymous_id: null, edit_mode: "account" })
      .eq("anonymous_id", anonymousId)
      .select("id");
    if (docsErr) {
      console.error("Doc migration error:", docsErr);
      continue;
    }
    migratedDocs += docs?.length || 0;

    const { data: bundles, error: bundlesErr } = await supabase
      .from("bundles")
      .update({ user_id: userId, anonymous_id: null, edit_mode: "account" })
      .eq("anonymous_id", anonymousId)
      .select("id");
    if (bundlesErr) {
      // Don't fail the whole call — bundles may not have anonymous capture yet
      console.warn("Bundle migration warning:", bundlesErr.message);
    } else {
      migratedBundles += bundles?.length || 0;
    }
  }

  return NextResponse.json({
    ok: true,
    migrated: migratedDocs,
    bundlesMigrated: migratedBundles,
    documentsMigrated: migratedDocs,
  });
}
