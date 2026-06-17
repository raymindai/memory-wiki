// Auto-refresh of a bundle's graph_data when one of its member docs changes.
//
// graph_data is otherwise a one-shot manual "Analyze". Once a member doc is
// edited the shipped /b/<id> payload graph rots (the raw route only flags
// `analysis_stale: true`). This re-runs the analysis in the background,
// throttled so an autosave burst doesn't re-bill the LLM on every keystroke.
//
// Policy hook: per the pricing policy, auto-analyze is intended to be a Pro
// feature ("free tier stays on the explicit Re-analyze click"). Plan billing
// isn't implemented yet, so the gate is the site_config flag
// `auto_analyze_enabled` (default ON in beta, which matches the existing
// concept_index auto-refresh that already runs for everyone). When plans
// land, ALSO gate on the bundle owner's plan in autoAnalyzeEnabled / here.

import type { SupabaseClient } from "@supabase/supabase-js";

const AUTO_REGRAPH_COOLDOWN_MS = 15 * 60 * 1000; // per-bundle throttle
const MAX_BUNDLES_PER_EDIT = 5; // bound fan-out for a doc that's in many bundles

/** Default ON unless an admin explicitly disables it in site_config. Any
 *  read failure also defaults ON (the intended beta behavior). */
async function autoAnalyzeEnabled(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", "auto_analyze_enabled")
      .maybeSingle();
    const v = (data?.value ?? "").toString().trim().toLowerCase();
    return v !== "false" && v !== "0" && v !== "off";
  } catch {
    return true;
  }
}

export interface BundleGraphRefreshArgs {
  supabase: SupabaseClient;
  /** req.nextUrl.origin — used to call the graph route server-to-server. */
  origin: string;
  /** Forward the caller's Authorization header when present. */
  authHeader?: string | null;
  /** The doc that just changed. */
  docId: string;
}

/**
 * Re-analyze the changed doc's bundles that (a) were already analyzed and
 * (b) are past the per-bundle cooldown. Best-effort: never throws. Returns
 * the bundle ids whose re-analysis was kicked off.
 *
 * Call inside `after()` so the expensive LLM pass never blocks the save.
 */
export async function refreshBundleGraphsForDoc(args: BundleGraphRefreshArgs): Promise<string[]> {
  const { supabase, origin, authHeader, docId } = args;
  try {
    if (!(await autoAnalyzeEnabled(supabase))) return [];

    const { data: members } = await supabase
      .from("bundle_documents")
      .select("bundle_id")
      .eq("document_id", docId);
    const bundleIds = [...new Set((members || []).map((m) => m.bundle_id))];
    if (bundleIds.length === 0) return [];

    // Only bundles that were ALREADY analyzed (graph_generated_at set). Never
    // auto-analyze a never-analyzed bundle — the owner hasn't opted in for it.
    const { data: bundles } = await supabase
      .from("bundles")
      .select("id, user_id, graph_generated_at")
      .in("id", bundleIds)
      .not("graph_generated_at", "is", null);

    const now = Date.now();
    const eligible = (bundles || []).filter((b) => {
      const ts = b.graph_generated_at ? new Date(b.graph_generated_at).getTime() : 0;
      return now - ts > AUTO_REGRAPH_COOLDOWN_MS;
    });
    if (eligible.length === 0) return [];

    const capped = eligible.slice(0, MAX_BUNDLES_PER_EDIT);
    if (eligible.length > capped.length) {
      console.warn(
        `[bundle-graph-refresh] doc ${docId}: ${eligible.length} eligible bundles, refreshing first ${capped.length} (cost cap)`,
      );
    }

    const done: string[] = [];
    for (const b of capped) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authHeader) headers.Authorization = authHeader;
        else if (b.user_id) headers["x-user-id"] = b.user_id;
        const res = await fetch(`${origin}/api/bundles/${b.id}/graph`, {
          method: "POST",
          headers,
          body: JSON.stringify({ userId: b.user_id ?? undefined }),
        });
        if (res.ok) done.push(b.id);
      } catch {
        // one bundle's failure shouldn't block the others
      }
    }
    return done;
  } catch {
    return [];
  }
}
