// v8 W4 Type 2 — auto-promote document_ai_metadata clusters into
// AI bundles.
//
// Rule: when >=5 docs owned by the same user share a non-misc
// cluster_id, and no AI bundle already represents that cluster
// (bundle_ai_metadata.source_cluster_id), create one. The new
// bundle is owned by the user, is_draft=true so it stays private
// until they look at it, and carries:
//   - bundles row (with our auto-generated title from cluster slug)
//   - bundle_documents rows for each member doc
//   - bundle_ai_metadata row with creator_type='ai' +
//     source_cluster_id=cluster + triggered_by='auto-cluster'

import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const PROMOTE_MIN_DOCS = 5;
// Skip clusters the user pinned as "misc" (the librarian prompt's
// catch-all). Those aren't real groupings.
const SKIP_CLUSTERS = new Set(["misc", "uncategorized", ""]);

interface ClusterCandidate {
  userId: string;
  clusterId: string;
  docIds: string[];
}

/**
 * Scan every cluster_id grouped by user across the table. Returns
 * candidates that hit the threshold AND don't already have an AI
 * bundle. Memory pressure scales with row count; for tens of
 * thousands of docs this is fine, larger tenants should chunk.
 */
export async function findPromotionCandidates(supabase: SupabaseClient): Promise<ClusterCandidate[]> {
  // Pull the (user, cluster) -> [docIds] graph by joining
  // document_ai_metadata onto documents (for user_id). Limit large
  // tenant rows; the cron is daily so we don't need to drain all
  // candidates in one tick.
  const { data: meta } = await supabase
    .from("document_ai_metadata")
    .select("document_id, cluster_id")
    .not("cluster_id", "is", null)
    .limit(20_000);
  if (!Array.isArray(meta) || meta.length === 0) return [];

  const docIds = (meta as Array<{ document_id: string; cluster_id: string }>).map((r) => r.document_id);
  const { data: docs } = await supabase
    .from("documents")
    .select("id, user_id, deleted_at")
    .in("id", docIds);
  const ownerByDoc = new Map<string, string>();
  for (const d of (docs as Array<{ id: string; user_id: string | null; deleted_at: string | null }> | null) ?? []) {
    if (d.deleted_at) continue;
    if (d.user_id) ownerByDoc.set(d.id, d.user_id);
  }

  // (user, cluster) -> Set<docId>
  const grouped = new Map<string, Set<string>>();
  for (const r of meta as Array<{ document_id: string; cluster_id: string }>) {
    const owner = ownerByDoc.get(r.document_id);
    if (!owner) continue;
    const cluster = (r.cluster_id || "").trim().toLowerCase();
    if (!cluster || SKIP_CLUSTERS.has(cluster)) continue;
    const key = `${owner}::${cluster}`;
    let set = grouped.get(key);
    if (!set) { set = new Set(); grouped.set(key, set); }
    set.add(r.document_id);
  }

  // Drop clusters under threshold, and ones already promoted.
  const candidatesPreFilter: ClusterCandidate[] = [];
  for (const [key, ids] of grouped) {
    if (ids.size < PROMOTE_MIN_DOCS) continue;
    const [userId, clusterId] = key.split("::");
    candidatesPreFilter.push({ userId, clusterId, docIds: Array.from(ids) });
  }
  if (candidatesPreFilter.length === 0) return [];

  // Dedupe against existing AI bundles by source_cluster_id.
  const existing = new Set<string>();
  const { data: existingRows } = await supabase
    .from("bundle_ai_metadata")
    .select("source_cluster_id")
    .not("source_cluster_id", "is", null);
  for (const r of (existingRows as Array<{ source_cluster_id: string }> | null) ?? []) {
    if (r.source_cluster_id) existing.add(r.source_cluster_id);
  }
  return candidatesPreFilter.filter((c) => !existing.has(c.clusterId));
}

function titleFromCluster(slug: string): string {
  // Cluster slugs are kebab-case ('product-strategy' -> 'Product strategy').
  return slug
    .split("-")
    .filter(Boolean)
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(" ");
}

/**
 * Promote ONE candidate into an AI bundle. Inserts the bundle row,
 * bundle_documents rows, and the bundle_ai_metadata sidecar with
 * source_cluster_id set so subsequent sweeps dedupe it.
 */
export async function promoteCluster(
  supabase: SupabaseClient,
  c: ClusterCandidate,
): Promise<string | null> {
  const editToken = nanoid(32);
  let bundleId = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    bundleId = nanoid(8);
    const { error } = await supabase.from("bundles").insert({
      id: bundleId,
      title: titleFromCluster(c.clusterId),
      description: null,
      edit_token: editToken,
      user_id: c.userId,
      is_draft: true,
      visibility: "private",
    });
    if (!error) break;
    if (error.code !== "23505") {
      console.warn("promote-cluster: bundles insert failed", JSON.stringify({ cluster: c.clusterId, err: error.message }));
      return null;
    }
    bundleId = "";
  }
  if (!bundleId) return null;

  const docsPayload = c.docIds.map((id, i) => ({ bundle_id: bundleId, document_id: id, sort_order: i }));
  const { error: docsErr } = await supabase.from("bundle_documents").insert(docsPayload);
  if (docsErr) {
    await supabase.from("bundles").delete().eq("id", bundleId);
    console.warn("promote-cluster: bundle_documents insert failed", JSON.stringify({ cluster: c.clusterId, err: docsErr.message }));
    return null;
  }

  const { error: metaErr } = await supabase.from("bundle_ai_metadata").insert({
    bundle_id: bundleId,
    creator_type: "ai",
    creator_agent: "memory-wiki-background",
    triggered_by: "auto-cluster",
    source_cluster_id: c.clusterId,
  });
  if (metaErr) {
    // Bundle still exists, just attribution is missing. Log and move
    // on — the next sweep won't try to re-promote because the
    // source_cluster_id dedupe would fire only if the row existed,
    // so it actually WILL retry. Clean up to keep semantics tight:
    await supabase.from("bundles").delete().eq("id", bundleId);
    console.warn("promote-cluster: bundle_ai_metadata insert failed", JSON.stringify({ cluster: c.clusterId, err: metaErr.message }));
    return null;
  }
  return bundleId;
}

/**
 * Cron entry — scan, promote, return per-tick stats. Caps the batch
 * so one tick stays under the function budget even on a busy
 * tenant.
 */
export async function runClusterPromotionSweep(
  supabase: SupabaseClient,
  maxPerTick = 10,
): Promise<{ scanned: number; promoted: number; errors: number }> {
  const candidates = await findPromotionCandidates(supabase);
  const batch = candidates.slice(0, maxPerTick);
  let promoted = 0, errors = 0;
  for (const c of batch) {
    try {
      const id = await promoteCluster(supabase, c);
      if (id) promoted++; else errors++;
    } catch (err) {
      errors++;
      console.warn("promote-cluster threw", JSON.stringify({ cluster: c.clusterId, err: err instanceof Error ? err.message : String(err) }));
    }
  }
  return { scanned: candidates.length, promoted, errors };
}
