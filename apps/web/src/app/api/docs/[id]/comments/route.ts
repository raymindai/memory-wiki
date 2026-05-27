import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

// v8 W8 — doc-level comments API.
//
// The service-role client bypasses RLS, so the access check has to
// live here: a comment is readable iff the doc is readable. That
// mirrors the document RLS without re-encoding it in policy SQL.
//
// Identity: JWT first (so logged-in browser sessions just work),
// header fallback for legacy x-user-id callers (CLI / MCP).
async function resolveCaller(req: NextRequest) {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || null;
  const email = (verified?.email || req.headers.get("x-user-email") || "").toLowerCase();
  return { userId, email };
}

type DocAccess = {
  ok: boolean;
  isOwner: boolean;
  status: number;
  reason?: string;
};

async function checkDocAccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  docId: string,
  userId: string | null,
  email: string,
): Promise<DocAccess> {
  if (!supabase) return { ok: false, isOwner: false, status: 503, reason: "service_unavailable" };
  const { data: doc, error } = await supabase
    .from("documents")
    .select("user_id, is_draft, allowed_emails, deleted_at")
    .eq("id", docId)
    .single();
  if (error || !doc) return { ok: false, isOwner: false, status: 404, reason: "not_found" };
  if (doc.deleted_at) return { ok: false, isOwner: false, status: 404, reason: "not_found" };

  const isOwner = !!(userId && doc.user_id && userId === doc.user_id);
  if (isOwner) return { ok: true, isOwner: true, status: 200 };
  if (!doc.is_draft) return { ok: true, isOwner: false, status: 200 };
  if (Array.isArray(doc.allowed_emails) && doc.allowed_emails.length > 0 && email) {
    const allow = doc.allowed_emails.map((e: string) => e.toLowerCase());
    if (allow.includes(email)) return { ok: true, isOwner: false, status: 200 };
  }
  return { ok: false, isOwner: false, status: 403, reason: "forbidden" };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { userId, email } = await resolveCaller(req);
  const access = await checkDocAccess(supabase, id, userId, email);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const { data: rows, error } = await supabase
    .from("doc_comments")
    .select("id, document_id, user_id, body, created_at, updated_at")
    .eq("document_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });

  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id))).filter(Boolean);
  let profiles: Record<string, { display_name: string | null; avatar_url: string | null; hub_slug: string | null }> = {};
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, hub_slug")
      .in("id", userIds);
    profiles = Object.fromEntries(
      (profileRows || []).map((p) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url, hub_slug: p.hub_slug }]),
    );
  }

  // Author email is owner-only — leak surface otherwise.
  const comments = (rows || []).map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    updated_at: r.updated_at,
    edited: r.updated_at && r.created_at && new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 1000,
    author: {
      id: r.user_id,
      display_name: profiles[r.user_id]?.display_name || null,
      avatar_url: profiles[r.user_id]?.avatar_url || null,
      hub_slug: profiles[r.user_id]?.hub_slug || null,
      is_me: userId === r.user_id,
    },
  }));

  return NextResponse.json({ comments, viewer: { isOwner: access.isOwner, userId } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { userId, email } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Sign in to comment" }, { status: 401 });

  const access = await checkDocAccess(supabase, id, userId, email);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "Comment body required" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "Comment too long (4000 char limit)" }, { status: 400 });

  const { data, error } = await supabase
    .from("doc_comments")
    .insert({ document_id: id, user_id: userId, body: text })
    .select("id, body, created_at, updated_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });

  return NextResponse.json({ ok: true, comment: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { userId, email } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const access = await checkDocAccess(supabase, id, userId, email);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const commentId = typeof body.commentId === "string" ? body.commentId : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "Comment too long" }, { status: 400 });

  const { data: row } = await supabase
    .from("doc_comments")
    .select("user_id, document_id")
    .eq("id", commentId)
    .single();
  if (!row || row.document_id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.user_id !== userId) return NextResponse.json({ error: "Only the author can edit a comment" }, { status: 403 });

  const { error } = await supabase
    .from("doc_comments")
    .update({ body: text })
    .eq("id", commentId);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { userId, email } = await resolveCaller(req);
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const access = await checkDocAccess(supabase, id, userId, email);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: access.status });

  const url = new URL(req.url);
  const commentId = url.searchParams.get("commentId") || "";
  if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });

  const { data: row } = await supabase
    .from("doc_comments")
    .select("user_id, document_id")
    .eq("id", commentId)
    .single();
  if (!row || row.document_id !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Author or doc-owner may delete. We've already established access.isOwner
  // covers the doc-owner case; the author case is a direct user_id match.
  if (row.user_id !== userId && !access.isOwner) {
    return NextResponse.json({ error: "Only the author or doc owner can delete" }, { status: 403 });
  }

  const { error } = await supabase
    .from("doc_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
