import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { enqueueOrganizeDoc } from "@/lib/organize-doc";
import { runQueuedJobNow } from "@/lib/ontology-refresh";

/**
 * Manual trigger for v8 Type 1 auto-organize on a single doc. Used by
 * the editor "Re-analyze" button and by the backfill cron to walk
 * existing docs that were created before the auto path landed.
 *
 *   POST /api/docs/[id]/organize          → enqueue (respects cool-down)
 *   POST /api/docs/[id]/organize?force=1  → ignore cool-down, re-run
 *
 * Owner-only. Returns the job id (or null if the body was too short /
 * the row is locked / cool-down hasn't elapsed).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: doc } = await supabase
    .from("documents")
    .select("user_id, title, markdown")
    .eq("id", id)
    .single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  const jobId = await enqueueOrganizeDoc({
    supabase,
    userId,
    docId: id,
    title: doc.title || "Untitled",
    markdown: doc.markdown || "",
    force,
  });

  if (jobId) {
    // Inline fast-path so a manual click sees the result within
    // seconds. If the function gets killed mid-LLM-call the cron
    // worker will retry the same row.
    try { await runQueuedJobNow(supabase, jobId); } catch { /* cron retry */ }
  }
  return NextResponse.json({ jobId });
}
