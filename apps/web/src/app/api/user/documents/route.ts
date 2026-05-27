import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

export async function GET(req: NextRequest) {
  // JWT verification first, then header fallback (web app uses x-user-id)
  const verified = await verifyAuthToken(req.headers.get("authorization"));

  let userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");
  const userEmail = verified?.email || req.headers.get("x-user-email");

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  // Resolve email → userId if email provided without userId
  if (!userId && userEmail) {
    try {
      const { data } = await supabase.auth.admin.listUsers();
      const user = data?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (user) userId = user.id;
    } catch { /* ignore */ }
  }

  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pass ?includeDeleted=1 to also receive soft-deleted docs (so the sidebar's
  // Trash section can show them). Without this flag the realtime sync would
  // strip locally-marked-deleted tabs from state and Trash would always be empty.
  const includeDeleted = req.nextUrl.searchParams.get("includeDeleted") === "1";

  let query = supabase
    .from("documents")
    .select("id, title, created_at, updated_at, deleted_at, view_count, is_draft, edit_mode, allowed_emails, password_hash, source, folder_id, sort_order")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (!includeDeleted) query = query.is("deleted_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (anonymousId) {
    query = query.eq("anonymous_id", anonymousId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  // Side-fetch v8 auto-organize metadata for the same set so the
  // sidebar can render cluster dots + summary tooltips without a
  // second round-trip per row. Absent metadata = pre-W4 doc (or
  // backfill not run yet) and the sidebar simply omits the dot.
  const ids = (data || []).map((d) => (d as { id: string }).id);
  let metaByDoc: Record<string, { tags: string[]; cluster_id: string | null; ai_summary: string | null }> = {};
  if (ids.length > 0) {
    const { data: metaRows } = await supabase
      .from("document_ai_metadata")
      .select("document_id, tags, cluster_id, ai_summary")
      .in("document_id", ids);
    if (Array.isArray(metaRows)) {
      metaByDoc = Object.fromEntries(
        (metaRows as Array<{ document_id: string; tags: string[] | null; cluster_id: string | null; ai_summary: string | null }>)
          .map((r) => [r.document_id, { tags: r.tags || [], cluster_id: r.cluster_id, ai_summary: r.ai_summary }]),
      );
    }
  }

  // Transform: never leak the actual password_hash to the client. The
  // sidebar only needs to know IF a password exists, to drive the
  // shared-vs-private icon decision in DocStatusIcon.
  const documents = (data || []).map((d) => {
    const { password_hash, ...rest } = d as { password_hash?: string | null; id: string } & Record<string, unknown>;
    const meta = metaByDoc[(d as { id: string }).id];
    return {
      ...rest,
      hasPassword: !!password_hash,
      ai_tags: meta?.tags ?? [],
      ai_cluster_id: meta?.cluster_id ?? null,
      ai_summary: meta?.ai_summary ?? null,
    };
  });

  return NextResponse.json({ documents });
}
