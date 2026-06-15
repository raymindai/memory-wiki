import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

export async function GET(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // Requester email — needed to mark which visited docs were genuinely
  // SHARED WITH the user (their email is on allowed_emails/allowed_editors)
  // vs. merely public docs they happened to open. The sidebar uses this to
  // keep "Shared with me" to real shares and route public reads to Recent.
  const requesterEmail = (verified?.email || req.headers.get("x-user-email") || "").trim().toLowerCase();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Get last 30 visited documents, joined with document details
  const { data, error } = await supabase
    .from("visit_history")
    .select("document_id, last_visited_at, documents(id, title, updated_at, user_id, edit_mode, allowed_emails, allowed_editors)")
    .eq("user_id", userId)
    .order("last_visited_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Recent visits error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  // Resolve owner emails for non-owned documents
  const ownerIds = new Set(
    (data || [])
      .filter(r => r.documents)
      .map(r => (r.documents as unknown as { user_id: string }).user_id)
      .filter(uid => uid && uid !== userId)
  );
  const ownerEmailMap = new Map<string, string>();
  for (const ownerId of ownerIds) {
    try {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(ownerId);
      if (ownerAuth?.user?.email) ownerEmailMap.set(ownerId, ownerAuth.user.email);
    } catch { /* ignore */ }
  }

  // Format response
  const recent = (data || [])
    .filter((r) => r.documents)
    .map((r) => {
      const doc = r.documents as unknown as { id: string; title: string; updated_at: string; user_id: string; edit_mode: string; allowed_emails: string[] | null; allowed_editors: string[] | null };
      const isOwner = doc.user_id === userId;
      // Genuinely shared WITH this user = their email is explicitly on the
      // doc's allowed_emails / allowed_editors (and they don't own it).
      // A public doc the user merely opened has neither, so it stays out
      // of "Shared with me" and only shows under Recent.
      const sharedWithMe = !isOwner && !!requesterEmail && (
        (doc.allowed_emails || []).some((e) => (e || "").toLowerCase() === requesterEmail) ||
        (doc.allowed_editors || []).some((e) => (e || "").toLowerCase() === requesterEmail)
      );
      return {
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updated_at,
        visitedAt: r.last_visited_at,
        isOwner,
        sharedWithMe,
        editMode: doc.edit_mode,
        ownerEmail: !isOwner ? ownerEmailMap.get(doc.user_id) || undefined : undefined,
      };
    });

  return NextResponse.json({ recent });
}
