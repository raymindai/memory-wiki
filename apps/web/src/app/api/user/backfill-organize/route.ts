import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { enqueueOrganizeDoc } from "@/lib/organize-doc";

/**
 * One-shot backfill of v8 Type 1 auto-organize metadata. Walks every
 * document owned by the caller that does NOT already have a row in
 * document_ai_metadata, and enqueues a `doc_organize` job for each.
 *
 * Owner-only. Safe to call repeatedly — already-organized docs are
 * skipped via the LEFT JOIN filter below. The /api/jobs/run minute
 * cron drains the queue at ~5 jobs/min.
 *
 * Optional `?limit=N` caps per-call enqueues so a user with thousands
 * of docs can paginate without blowing the LLM budget in one click.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "200", 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(500, limitParam)) : 200;

  // Pull doc ids that don't already have an ai-metadata row. Done in
  // two passes (existing ids, then anti-join in JS) because PostgREST
  // doesn't expose NOT EXISTS subqueries cleanly.
  const [docsRes, metaRes] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, markdown")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit + 200), // overfetch — anti-join below trims
    supabase
      .from("document_ai_metadata")
      .select("document_id"),
  ]);

  if (docsRes.error) return NextResponse.json({ error: docsRes.error.message }, { status: 500 });

  const haveMeta = new Set((metaRes.data || []).map((r: { document_id: string }) => r.document_id));
  const candidates = (docsRes.data || [])
    .filter((d: { id: string }) => !haveMeta.has(d.id))
    .slice(0, limit);

  let enqueued = 0;
  for (const d of candidates as Array<{ id: string; title: string | null; markdown: string | null }>) {
    const jobId = await enqueueOrganizeDoc({
      supabase,
      userId,
      docId: d.id,
      title: d.title || "Untitled",
      markdown: d.markdown || "",
    });
    if (jobId) enqueued++;
  }

  return NextResponse.json({
    enqueued,
    inspected: candidates.length,
    totalMissingApprox: candidates.length === limit ? `${limit}+` : candidates.length,
  });
}
