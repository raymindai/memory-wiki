import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

/**
 * GET /api/user/hub/freshness
 *
 * Returns hub-level concept-index freshness for the signed-in user.
 *
 *   { conceptsBuiltAt, docsTouchedAt, isStale, staleDocCount }
 *
 * - conceptsBuiltAt: most recent finished_at on a `done` doc_ontology
 *   job for this user. NULL = ontology never extracted.
 * - docsTouchedAt: max(documents.embedding_updated_at, documents.created_at)
 *   across the user's owned docs. We use embedding_updated_at because
 *   it only bumps when the markdown's content hash actually changes
 *   (mirrors how /api/bundles/[id] computes isAnalysisStale — see the
 *   long explanation there). Falls back to created_at so a brand-new
 *   doc that hasn't been embedded yet still counts.
 * - isStale: true iff docsTouchedAt > conceptsBuiltAt.
 * - staleDocCount: how many of the user's docs were touched after
 *   conceptsBuiltAt (drives the "Re-analyze (N)" button label).
 *
 * Owner-only; no caching — the UI re-fetches when the hub view opens.
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
    const { data: lastJob } = await supabase
      .from("extraction_jobs")
      .select("finished_at")
      .eq("user_id", userId)
      .eq("kind", "doc_ontology")
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const conceptsBuiltAt: string | null = lastJob?.finished_at ?? null;

    const { data: docs } = await supabase
      .from("documents")
      .select("id, embedding_updated_at, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);

    let docsTouchedMs = 0;
    let staleDocCount = 0;
    const conceptsBuiltMs = conceptsBuiltAt ? new Date(conceptsBuiltAt).getTime() : 0;
    for (const d of docs ?? []) {
      const stamp = d.embedding_updated_at || d.created_at;
      if (!stamp) continue;
      const t = new Date(stamp).getTime();
      if (t > docsTouchedMs) docsTouchedMs = t;
      if (conceptsBuiltMs > 0 && t > conceptsBuiltMs) staleDocCount++;
      // If concepts have never been built, every doc counts as stale.
      else if (conceptsBuiltMs === 0) staleDocCount++;
    }

    const docsTouchedAt = docsTouchedMs > 0 ? new Date(docsTouchedMs).toISOString() : null;
    const isStale = !conceptsBuiltAt
      ? (docs?.length ?? 0) > 0
      : docsTouchedMs > conceptsBuiltMs;

    return NextResponse.json({
      conceptsBuiltAt,
      docsTouchedAt,
      isStale,
      staleDocCount,
    });
  } catch (err) {
    console.error("Hub freshness error:", err);
    return NextResponse.json({ error: "Freshness check failed" }, { status: 500 });
  }
}
