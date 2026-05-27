import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hub lint v1. Karpathy's pattern names lint as one of the three
 * core operations alongside ingest and query. We surface two signals
 * to start with:
 *
 *   1. Orphan docs. Published docs that aren't in any bundle AND
 *      aren't referenced by any other doc's markdown. They sit alone
 *      in the hub with no path to discovery.
 *   2. Semantic duplicates. Pairs of docs whose embeddings are close
 *      enough that the user probably meant to merge or supersede one.
 *
 * Other Karpathy lint signals (contradictions, stale claims, missing
 * cross-references) require fresh AI analysis per doc; they're heavier
 * and follow up post-launch.
 *
 * Read by /api/user/hub/lint and surfaced as
 * /raw/hub/<slug>/lint.md for AI fetchers that want to see the
 * health snapshot alongside the hub.
 */

export interface OrphanDoc {
  id: string;
  title: string | null;
  updatedAt: string | null;
}

export interface DuplicatePair {
  /** Older / superseded doc. */
  a: { id: string; title: string | null };
  /** Newer / canonical doc. */
  b: { id: string; title: string | null };
  /** Cosine distance (0 = identical, 2 = opposite). Lower = more similar. */
  distance: number;
}

export interface TitleMismatch {
  id: string;
  title: string | null;
  /** A representative concept the doc IS about but the title
   *  doesn't reflect. Caller can show this as a "consider
   *  renaming to X" hint. */
  topConcept: string;
  /** All concept labels associated with this doc — handy for the
   *  resolve UI to surface alternatives. */
  concepts: string[];
}

export interface StaleClaim {
  id: string;
  title: string | null;
  /** ISO timestamp of the doc's last update. */
  updatedAt: string | null;
  /** Days since last update. */
  ageDays: number;
  /** Count of other docs that reference this one — bundles + raw
   *  markdown link mentions. Heavy references = "this is load-
   *  bearing, please re-verify it's still true." */
  referenceCount: number;
}

export interface MergeSuggestion {
  /** Older / fewer-words doc. */
  a: { id: string; title: string | null };
  /** Newer / longer-words doc. */
  b: { id: string; title: string | null };
  /** Cosine distance (0 = identical, 2 = opposite). Looser than the
   *  duplicate threshold — overlap is real but not so close that
   *  one supersedes the other. The user should decide. */
  distance: number;
}

export interface RollupSuggestion {
  /** Concept label that ties the docs together. */
  concept: string;
  /** Doc ids participating in the concept (capped). */
  docIds: string[];
  /** Total participants — may exceed docIds.length when capped. */
  docCount: number;
}

export interface AutoArchiveCandidate {
  id: string;
  title: string | null;
  updatedAt: string | null;
  ageDays: number;
}

export interface LintReport {
  computedAt: string;
  totalDocs: number;
  orphans: OrphanDoc[];
  duplicates: DuplicatePair[];
  titleMismatches: TitleMismatch[];
  /** v8 W4-6 — docs >= STALE_AGE_DAYS old but still heavily referenced.
   *  Surfaced as Needs Review so the user can re-read + confirm the
   *  claim still holds. Empty when no candidates. */
  staleClaims: StaleClaim[];
  /** v8 W4-6 — embedding-similar doc pairs that aren't close enough
   *  to be duplicates (those go to .duplicates) but overlap enough
   *  that merging them might consolidate the user's library. */
  mergeSuggestions: MergeSuggestion[];
  /** v8 W4-6 — concepts that gather ROLLUP_MIN_DOCS+ docs. Hint that
   *  the user might want to synthesise a single summary doc covering
   *  all of them. */
  rollupSuggestions: RollupSuggestion[];
  /** v8 W4-6 — docs untouched for ARCHIVE_AGE_DAYS+ and not referenced
   *  by anything. Safe to move to an Archive folder. */
  autoArchive: AutoArchiveCandidate[];
}

const DUPLICATE_DISTANCE_THRESHOLD = 0.18; // cosine; tuned for "likely-overlapping content"
const DUPLICATE_NEIGHBORS = 3; // check top-N neighbors per doc

// Stale-claims thresholds. A doc must be at least N days old AND
// referenced from M or more other surfaces (bundles + markdown
// links) before it counts as a stale claim worth re-verifying.
// Heavier references => more "load-bearing" => higher chance the
// user wants to confirm it's still true.
const STALE_AGE_DAYS = 90;
const STALE_MIN_REFERENCES = 2;

// Merge suggestions live in the "between duplicate and stranger"
// band — close enough to overlap, far enough that one isn't
// strictly newer. 0.18-0.30 is empirical on real corpora.
const MERGE_DISTANCE_MIN = 0.18;
const MERGE_DISTANCE_MAX = 0.30;

// Roll-up — a concept shared by this many docs is a good synthesis
// target. 10 is the plan's stated threshold ("when 10+ docs share").
const ROLLUP_MIN_DOCS = 10;

// Auto-archive — docs untouched for this long with zero references
// anywhere. 90 days mirrors the stale threshold; combined with the
// "0 refs" condition (vs stale's ">= 2 refs") the two signals
// partition the old-docs population.
const ARCHIVE_AGE_DAYS = 90;

interface DocRow {
  id: string;
  title: string | null;
  updated_at: string | null;
  is_draft: boolean | null;
}

interface BundleDocRow {
  document_id: string;
}

interface DocMarkdownRow {
  id: string;
  markdown: string | null;
}

interface MatchRow {
  id: string;
  title: string | null;
  distance: number;
}

export async function computeLintReport(
  supabase: SupabaseClient,
  userId: string,
): Promise<LintReport> {
  // Pull live docs (no drafts, no deleted).
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, updated_at, is_draft")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const liveDocs = (docs as DocRow[] | null ?? []).filter((d) => !d.is_draft);
  const liveDocIds = new Set(liveDocs.map((d) => d.id));

  // Collect set of doc ids that are members of at least one bundle.
  const { data: bd } = await supabase
    .from("bundle_documents")
    .select("document_id")
    .in("document_id", liveDocs.map((d) => d.id));
  const inBundle = new Set((bd as BundleDocRow[] | null ?? []).map((r) => r.document_id));

  // Collect set of doc ids that are referenced from other docs' markdown
  // by URL fragment. We accept either /<id> or /d/<id> shapes.
  const { data: others } = await supabase
    .from("documents")
    .select("id, markdown")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const referenced = new Set<string>();
  const otherDocs = (others as DocMarkdownRow[] | null ?? []);
  for (const d of otherDocs) {
    if (!d.markdown) continue;
    for (const candidateId of liveDocIds) {
      if (candidateId === d.id) continue;
      if (referenced.has(candidateId)) continue;
      // Memory.Wiki URL shapes:
      //   memory.wiki/<id>           (canonical, AI-fetcher path)
      //   memory.wiki/d/<id>         (browser route)
      //   /<id>                   (relative link if user wrote one)
      const hay = d.markdown;
      if (
        hay.includes("/" + candidateId) ||
        hay.includes("/d/" + candidateId)
      ) {
        referenced.add(candidateId);
      }
    }
  }

  // Concept-linked: docs that share at least one concept_index row
  // with another doc. v6 thesis is that the concept index IS the
  // implicit cross-link — a doc with concepts present in other docs
  // is reachable via concept neighborhood walks, so it isn't orphan.
  // Without this gate, refresh-concepts (the Resolve action) couldn't
  // remove a doc from the orphan list, because the previous orphan
  // definition ignored concept_index entirely.
  const { data: cx } = await supabase
    .from("concept_index")
    .select("label, doc_ids")
    .eq("user_id", userId);
  type ConceptRow = { label: string; doc_ids: string[] | null };
  const conceptRows = (cx as ConceptRow[] | null) ?? [];
  const conceptCount = new Map<string, number>();
  // Also build a per-doc concept inventory so the title-mismatch
  // check below can ask "does this doc's title cover any of its
  // concepts?" without re-querying.
  const docConcepts = new Map<string, { label: string; coverage: number }[]>();
  for (const row of conceptRows) {
    const ids = row.doc_ids || [];
    if (ids.length >= 2) {
      for (const id of ids) conceptCount.set(id, (conceptCount.get(id) || 0) + 1);
    }
    for (const id of ids) {
      const list = docConcepts.get(id) || [];
      list.push({ label: row.label, coverage: ids.length });
      docConcepts.set(id, list);
    }
  }
  const conceptLinked = new Set<string>([...conceptCount.keys()]);

  const orphans: OrphanDoc[] = liveDocs
    .filter((d) => !inBundle.has(d.id) && !referenced.has(d.id) && !conceptLinked.has(d.id))
    .map((d) => ({ id: d.id, title: d.title, updatedAt: d.updated_at }));

  // Title mismatch — a doc has 2+ concepts but the title contains
  // none of them. Common after AI capture picks a generic header
  // like "Untitled" or "Chat with Claude". We pick the most-
  // distinctive concept (lowest coverage = appears in fewest other
  // docs) as the suggested rename hint. Skip docs with no title or
  // no concepts since there's nothing actionable.
  const titleMismatches: TitleMismatch[] = [];
  for (const d of liveDocs) {
    const concepts = docConcepts.get(d.id);
    if (!concepts || concepts.length < 2) continue;
    const titleLc = (d.title || "").toLowerCase().trim();
    if (!titleLc) continue;
    const anyMatch = concepts.some((c) => titleLc.includes(c.label.toLowerCase()));
    if (anyMatch) continue;
    const sorted = [...concepts].sort((a, b) => a.coverage - b.coverage);
    titleMismatches.push({
      id: d.id,
      title: d.title,
      topConcept: sorted[0].label,
      concepts: sorted.map((c) => c.label),
    });
  }

  // Semantic duplicates. Iterate per doc and look for close neighbors.
  // Symmetric pairs are deduped by always reporting (older, newer).
  const duplicates: DuplicatePair[] = [];
  const seenPairs = new Set<string>();

  // We need each doc's embedding to query nearest neighbors. The RPC
  // takes a query embedding, so we fetch each doc's embedding and call
  // it. For larger hubs a single SQL self-join would be cheaper; v1
  // accepts the N round-trips for clarity.
  const { data: embedded } = await supabase
    .from("documents")
    .select("id, title, embedding")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("embedding", "is", null);

  type EmbeddedRow = { id: string; title: string | null; embedding: number[] | string };
  const embeddings = (embedded as EmbeddedRow[] | null ?? []).filter((d) => d.embedding != null);

  for (const doc of embeddings) {
    const { data: matches } = await supabase.rpc("match_documents_by_embedding", {
      query_embedding: doc.embedding,
      match_count: DUPLICATE_NEIGHBORS + 1, // +1 because the doc itself returns at distance 0
      p_user_id: userId,
      p_anonymous_id: null,
    });
    for (const m of (matches as MatchRow[] | null ?? [])) {
      if (m.id === doc.id) continue;
      if (m.distance > DUPLICATE_DISTANCE_THRESHOLD) continue;
      const pairKey = [doc.id, m.id].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      // Order pair as (older, newer) by sort order of id (proxy for older
      // since nanoid is roughly time-ordered). Good enough for v1.
      const [olderId, newerId] = [doc.id, m.id].sort();
      const olderTitle = olderId === doc.id ? doc.title : m.title;
      const newerTitle = newerId === doc.id ? doc.title : m.title;
      duplicates.push({
        a: { id: olderId, title: olderTitle },
        b: { id: newerId, title: newerTitle },
        distance: m.distance,
      });
    }
  }

  duplicates.sort((p, q) => p.distance - q.distance);

  // Stale claims — reuse the inBundle + referenced sets already
  // computed above so this pass is O(liveDocs) with no extra DB
  // hits. A doc qualifies when it's old AND load-bearing.
  const nowMs = Date.now();
  const refCountByDoc = new Map<string, number>();
  for (const id of inBundle) refCountByDoc.set(id, (refCountByDoc.get(id) || 0) + 1);
  for (const id of referenced) refCountByDoc.set(id, (refCountByDoc.get(id) || 0) + 1);
  const staleClaims: StaleClaim[] = [];
  for (const d of liveDocs) {
    if (!d.updated_at) continue;
    const ageMs = nowMs - new Date(d.updated_at).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays < STALE_AGE_DAYS) continue;
    const refs = refCountByDoc.get(d.id) || 0;
    if (refs < STALE_MIN_REFERENCES) continue;
    staleClaims.push({
      id: d.id,
      title: d.title,
      updatedAt: d.updated_at,
      ageDays,
      referenceCount: refs,
    });
  }
  // Most-referenced first — those are the highest-value
  // re-verification targets.
  staleClaims.sort((a, b) => b.referenceCount - a.referenceCount || b.ageDays - a.ageDays);

  // Merge suggestions — second pass through the same embedding
  // matches we already pulled for duplicates. Skip pairs already
  // counted as duplicates so we don't surface the same pair twice
  // in different sections.
  const mergeSuggestions: MergeSuggestion[] = [];
  const seenMergePairs = new Set<string>(seenPairs);
  for (const doc of embeddings) {
    const { data: matches } = await supabase.rpc("match_documents_by_embedding", {
      query_embedding: doc.embedding,
      match_count: DUPLICATE_NEIGHBORS + 1,
      p_user_id: userId,
      p_anonymous_id: null,
    });
    for (const m of (matches as MatchRow[] | null ?? [])) {
      if (m.id === doc.id) continue;
      if (m.distance < MERGE_DISTANCE_MIN || m.distance > MERGE_DISTANCE_MAX) continue;
      const pairKey = [doc.id, m.id].sort().join("|");
      if (seenMergePairs.has(pairKey)) continue;
      seenMergePairs.add(pairKey);
      const [olderId, newerId] = [doc.id, m.id].sort();
      const olderTitle = olderId === doc.id ? doc.title : m.title;
      const newerTitle = newerId === doc.id ? doc.title : m.title;
      mergeSuggestions.push({
        a: { id: olderId, title: olderTitle },
        b: { id: newerId, title: newerTitle },
        distance: m.distance,
      });
    }
  }
  mergeSuggestions.sort((p, q) => p.distance - q.distance);

  // Roll-up — concepts shared by >= ROLLUP_MIN_DOCS docs. concept_index
  // rows already pulled above; just gather the high-fan-out ones.
  const rollupSuggestions: RollupSuggestion[] = [];
  for (const row of conceptRows) {
    const ids = (row.doc_ids || []).filter((id) => liveDocIds.has(id));
    if (ids.length < ROLLUP_MIN_DOCS) continue;
    rollupSuggestions.push({
      concept: row.label,
      docIds: ids.slice(0, 20),
      docCount: ids.length,
    });
  }
  rollupSuggestions.sort((a, b) => b.docCount - a.docCount);

  // Auto-archive — old AND nothing references this doc. Mirror image
  // of stale: we want untouched dead-weight, not heavily-referenced
  // load-bearing.
  const autoArchive: AutoArchiveCandidate[] = [];
  for (const d of liveDocs) {
    if (!d.updated_at) continue;
    const ageMs = nowMs - new Date(d.updated_at).getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays < ARCHIVE_AGE_DAYS) continue;
    const refs = refCountByDoc.get(d.id) || 0;
    if (refs > 0) continue;
    autoArchive.push({ id: d.id, title: d.title, updatedAt: d.updated_at, ageDays });
  }
  autoArchive.sort((a, b) => b.ageDays - a.ageDays);

  return {
    computedAt: new Date().toISOString(),
    totalDocs: liveDocs.length,
    orphans,
    duplicates,
    titleMismatches,
    staleClaims,
    mergeSuggestions,
    rollupSuggestions,
    autoArchive,
  };
}

export function formatLintMarkdown(report: LintReport): string {
  const lines: string[] = ["# Hub lint", ""];
  lines.push(`> Computed at ${report.computedAt}. ${report.totalDocs} live docs.`);
  lines.push("");

  lines.push(`## Orphans (${report.orphans.length})`);
  lines.push("");
  if (report.orphans.length === 0) {
    lines.push("_No orphans. Every doc is either in a bundle or referenced by another doc._");
  } else {
    lines.push("Docs not in any bundle and not linked from any other doc.");
    lines.push("");
    for (const o of report.orphans) {
      const t = o.title || "Untitled";
      lines.push(`- [${t}](https://memory.wiki/${o.id})`);
    }
  }
  lines.push("");

  lines.push(`## Likely duplicates (${report.duplicates.length})`);
  lines.push("");
  if (report.duplicates.length === 0) {
    lines.push("_No close duplicates detected._");
  } else {
    lines.push("Pairs of docs with overlapping semantic content. Consider merging or marking one as the canonical version.");
    lines.push("");
    for (const p of report.duplicates) {
      const aT = p.a.title || "Untitled";
      const bT = p.b.title || "Untitled";
      lines.push(
        `- [${aT}](https://memory.wiki/${p.a.id}) and [${bT}](https://memory.wiki/${p.b.id}). Distance ${p.distance.toFixed(3)}.`,
      );
    }
  }
  lines.push("");

  lines.push(`## Title mismatches (${report.titleMismatches.length})`);
  lines.push("");
  if (report.titleMismatches.length === 0) {
    lines.push("_No title mismatches. Every doc's title reflects at least one of its concepts._");
  } else {
    lines.push("Docs whose title doesn't mention any of the concepts the doc actually covers. Consider renaming.");
    lines.push("");
    for (const m of report.titleMismatches) {
      const t = m.title || "Untitled";
      lines.push(`- [${t}](https://memory.wiki/${m.id}) — consider mentioning **${m.topConcept}**.`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
