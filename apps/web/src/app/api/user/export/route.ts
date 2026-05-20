import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/user/export
 *
 * Returns a single JSON file containing every artifact the
 * signed-in user owns: profile, documents (including soft-deleted
 * trash), bundles + their document membership, folders, hub
 * metadata, and concept index. Soft-deleted rows are included so
 * the user can recover from trash off-platform if they ever need
 * to.
 *
 * The endpoint exists so users can:
 *   - leave with their data intact (GDPR right-to-portability)
 *   - back up before destructive operations
 *   - audit what the platform actually stores about them
 *
 * No streaming (Vercel response size limit is generous for typical
 * users — even 1000 docs averaging 5kB each is only 5MB JSON).
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

  try {
    const [profileRes, docsRes, bundlesRes, foldersRes, conceptsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, plan, hub_slug, hub_public, hub_description, curator_settings, color_scheme, accent_color, storage_used_bytes, created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("documents")
        .select("id, title, markdown, source, is_draft, edit_mode, folder_id, sort_order, intent, password_hash, allowed_emails, embedding_updated_at, created_at, updated_at, deleted_at")
        .eq("user_id", userId),
      supabase
        .from("bundles")
        .select("id, title, description, is_draft, edit_mode, graph_data, graph_generated_at, password_hash, allowed_emails, folder_id, created_at, updated_at, deleted_at")
        .eq("user_id", userId),
      supabase
        .from("user_folders")
        .select("id, name, section, collapsed, sort_order, created_at, updated_at")
        .eq("user_id", userId),
      supabase
        .from("concept_index")
        .select("id, name, occurrence, doc_count, intent, created_at, updated_at")
        .eq("user_id", userId),
    ]);

    // Strip the password hash from the snapshot — we never want
    // to hand the user back their own bcrypt blob in a downloaded
    // file. The presence/absence flag is preserved.
    const docs = (docsRes.data || []).map((d) => ({
      ...d,
      password_hash: undefined,
      has_password: !!d.password_hash,
    }));
    const bundles = (bundlesRes.data || []).map((b) => ({
      ...b,
      password_hash: undefined,
      has_password: !!b.password_hash,
    }));

    // Fetch bundle_documents membership rows so the export
    // round-trips: a future reimport can rebuild the bundle's doc
    // ordering without the user re-curating.
    const bundleIds = bundles.map((b) => b.id);
    let bundleDocsRows: { bundle_id: string; document_id: string; sort_order: number }[] = [];
    if (bundleIds.length > 0) {
      const { data } = await supabase
        .from("bundle_documents")
        .select("bundle_id, document_id, sort_order")
        .in("bundle_id", bundleIds);
      bundleDocsRows = data || [];
    }

    const exportPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedFor: userId,
      profile: profileRes.data || null,
      counts: {
        documents: docs.length,
        bundles: bundles.length,
        folders: foldersRes.data?.length || 0,
        concepts: conceptsRes.data?.length || 0,
      },
      documents: docs,
      bundles,
      bundleDocuments: bundleDocsRows,
      folders: foldersRes.data || [],
      concepts: conceptsRes.data || [],
      notice: "This file contains a complete snapshot of your data on Memory.Wiki. Re-import support is planned; for now this is a portable backup you fully own. Password hashes for protected docs/bundles are intentionally stripped (only a has_password flag is included).",
    };

    const json = JSON.stringify(exportPayload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mw-export-${date}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("User export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
