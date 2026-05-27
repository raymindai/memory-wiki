import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getOwnerBacklinks } from "@/lib/queryBacklinks";
import type { BacklinkEntityType } from "@/lib/backlinks";

/**
 * GET /api/backlinks/{type}/{id}
 *
 * Owner-side backlink lookup for the in-editor panel. Returns every
 * source the OWNER controls (docs, bundles, hub) that references the
 * given target, including drafts / private / password-protected
 * sources — the public viewer endpoint already excludes those, but
 * the owner needs them for library management.
 *
 * `type` ∈ document | bundle | hub.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (type !== "document" && type !== "bundle" && type !== "hub") {
    return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
  }
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  // Confirm the requester actually owns the target. Without this gate
  // any signed-in user could probe "who references doc X" for a doc
  // they don't own. The owner-side query intentionally returns drafts
  // and private sources — that's safe only because we filter the
  // results to the requester's own sources, but checking target
  // ownership too is the right belt-and-braces guard.
  let isOwner = false;
  if (type === "document") {
    const { data } = await supabase.from("documents").select("user_id").eq("id", id).single();
    isOwner = !!data && data.user_id === userId;
  } else if (type === "bundle") {
    const { data } = await supabase.from("bundles").select("user_id").eq("id", id).single();
    isOwner = !!data && data.user_id === userId;
  } else {
    const { data } = await supabase.from("profiles").select("id").eq("hub_slug", id).single();
    isOwner = !!data && data.id === userId;
  }
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await getOwnerBacklinks(supabase, type as BacklinkEntityType, id, userId, 50);
  return NextResponse.json(result);
}
