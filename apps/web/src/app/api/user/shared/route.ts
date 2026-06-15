import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

/**
 * "Shared with me" — documents explicitly shared WITH the requester
 * (their email is on allowed_emails or allowed_editors) that they do NOT
 * own. This is the authoritative source for the sidebar's Shared-with-me
 * section. It is deliberately NOT derived from visit_history (which also
 * holds public docs the user merely opened) — so a public doc never
 * shows here, opening a shared doc never drops it, and leaving a share
 * (removing your email) removes it for good.
 *
 * The email MUST come from a verified JWT — listing docs shared with an
 * arbitrary email would leak who-can-see-what, so the x-user-email header
 * fallback is intentionally not honored here.
 */
export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId;
  const email = (verified?.email || "").trim().toLowerCase();
  if (!userId || !email) {
    // No verified identity → nothing we can safely list.
    return NextResponse.json({ shared: [] });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // allowed_emails / allowed_editors are text[] of lowercased emails.
  // `cs` (contains) does an array-contains match. OR across both lists.
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, updated_at, user_id, edit_mode, allowed_editors")
    .or(`allowed_emails.cs.{${email}},allowed_editors.cs.{${email}}`)
    .is("deleted_at", null)
    .neq("is_draft", true)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Shared-with-me error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  const rows = (data || []).filter((d) => d.user_id !== userId);

  // Resolve owner emails for display.
  const ownerIds = Array.from(new Set(rows.map((d) => d.user_id).filter(Boolean)));
  const ownerEmailMap = new Map<string, string>();
  for (const ownerId of ownerIds) {
    try {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(ownerId);
      if (ownerAuth?.user?.email) ownerEmailMap.set(ownerId, ownerAuth.user.email);
    } catch { /* ignore */ }
  }

  const shared = rows.map((d) => ({
    id: d.id,
    title: d.title,
    updatedAt: d.updated_at,
    isOwner: false,
    sharedWithMe: true,
    canEdit: (d.allowed_editors || []).some((e: string) => (e || "").toLowerCase() === email),
    editMode: d.edit_mode,
    ownerEmail: ownerEmailMap.get(d.user_id) || undefined,
  }));

  return NextResponse.json({ shared });
}
