import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { enqueueOntologyRefresh } from "@/lib/ontology-refresh";

/**
 * POST /api/user/hub/reanalyze
 *
 * Force-refresh the hub's concept index for every doc that's been
 * touched since the last successful ontology build. Body is empty.
 *
 * Efficiency contract (the part the user pays for):
 *  - We only enqueue jobs for docs where embedding_updated_at (or
 *    created_at) is newer than the most recent doc_ontology
 *    finished_at. Unchanged docs are skipped — no Haiku call.
 *  - Hard cap of 50 docs per click; if more are stale, the rest stay
 *    pending and the cron worker picks them up over the next minutes.
 *    Prevents a single click from kicking off hundreds of LLM calls.
 *  - force=true bypasses the per-doc 30-min cooldown so a deliberate
 *    "Re-analyze" click actually re-runs, but only for the stale set.
 *  - Each job is fast-path-attempted (after()) and cron-backstop'd —
 *    same durability as the autosave-triggered path.
 *
 * Response: { enqueued, skipped, totalStale, capped }
 */
const MAX_PER_CLICK = 50;

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
    const { data: lastJob } = await supabase
      .from("extraction_jobs")
      .select("finished_at")
      .eq("user_id", userId)
      .eq("kind", "doc_ontology")
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conceptsBuiltMs = lastJob?.finished_at
      ? new Date(lastJob.finished_at).getTime()
      : 0;

    const { data: docs } = await supabase
      .from("documents")
      .select("id, title, markdown, embedding_updated_at, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);

    // Filter to actually-stale docs. Sort by most-recently-touched
    // first so when we hit the cap the user-visible recent edits land
    // in this batch and the older stragglers wait for the worker.
    const stale = (docs ?? [])
      .map((d) => {
        const stamp = d.embedding_updated_at || d.created_at;
        const t = stamp ? new Date(stamp).getTime() : 0;
        return { ...d, touchedMs: t };
      })
      .filter((d) => conceptsBuiltMs === 0 ? true : d.touchedMs > conceptsBuiltMs)
      .sort((a, b) => b.touchedMs - a.touchedMs);

    const totalStale = stale.length;
    const batch = stale.slice(0, MAX_PER_CLICK);
    const capped = totalStale > MAX_PER_CLICK;

    // Fire enqueues in the after() closure so the HTTP response
    // returns immediately. Each enqueue is independent — one slow
    // enqueue can't block the others (the helper is sequential, but
    // the entire chain runs post-response).
    after(async () => {
      for (const d of batch) {
        try {
          await enqueueOntologyRefresh({
            supabase,
            userId,
            docId: d.id,
            title: d.title,
            markdown: d.markdown,
            force: true,
          });
        } catch (err) {
          console.warn("[hub/reanalyze] enqueue failed", { docId: d.id, err: err instanceof Error ? err.message : err });
        }
      }
    });

    return NextResponse.json({
      enqueued: batch.length,
      skipped: 0,
      totalStale,
      capped,
    });
  } catch (err) {
    console.error("Hub reanalyze error:", err);
    return NextResponse.json({ error: "Reanalyze failed" }, { status: 500 });
  }
}
