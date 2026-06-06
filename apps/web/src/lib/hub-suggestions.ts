import type { SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { callAI } from "@/lib/ai-providers";

/**
 * Proactive bundle suggestion generator (W6 exceed move 3).
 *
 * Karpathy's pattern is reactive: the user prompts, the LLM responds.
 * Graphify is the same: run `/graphify` and get a snapshot. memory.wiki
 * watches activity and proposes actions on its own.
 *
 * v1 surfaces one signal: clusters of recent unbundled docs that
 * embed close together in semantic space. ("You've added 4 docs
 * about pricing this week. Bundle them?")
 *
 * Algorithm:
 *   1. Pull docs created in the last RECENT_WINDOW_DAYS, with
 *      embedding, not in any existing bundle, not yet covered by an
 *      open suggestion.
 *   2. Pairwise cluster via greedy walk: for each unvisited doc find
 *      neighbors within DISTANCE_THRESHOLD via the existing
 *      match_documents_by_embedding RPC; if 3+ qualify, that's a
 *      cluster.
 *   3. For each cluster ask the LLM for a 3-6 word title and a
 *      one-sentence rationale.
 *   4. Persist as hub_suggestions rows with status = 'open'.
 *
 * Throttled per-user: hub_suggestion_runs.last_run_at < THROTTLE
 * skips the run.
 */

const RECENT_WINDOW_DAYS = 14;
// Empirical: tightly-related docs on the same topic land at cosine
// distance 0.33-0.45 with text-embedding-3-small. Below 0.30 only
// near-duplicates qualify. Above 0.50 unrelated topics start mixing.
// 0.45 picks up "same theme, different angle".
const DISTANCE_THRESHOLD = 0.45;
const MIN_CLUSTER_SIZE = 3;
const MAX_CLUSTERS_PER_RUN = 4;
const NEIGHBOR_FETCH = 8;
const THROTTLE_MS = 12 * 60 * 60 * 1000; // 12h per user

interface DocSeed {
  id: string;
  title: string | null;
  markdown: string | null;
  embedding: number[] | string;
  created_at: string;
}

interface MatchRow {
  id: string;
  title: string | null;
  distance: number;
}

interface ClusterCandidate {
  rootId: string;
  docIds: string[];
}

export interface SuggestionRow {
  id: string;
  type: string;
  title: string | null;
  reason: string | null;
  doc_ids: string[];
  status: "open" | "accepted" | "dismissed";
  accepted_bundle_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function maybeRefreshSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ran: boolean; created: number; reason?: string }> {
  // Throttle.
  const { data: throttle } = await supabase
    .from("hub_suggestion_runs")
    .select("last_run_at")
    .eq("user_id", userId)
    .single();
  if (throttle?.last_run_at) {
    const elapsed = Date.now() - new Date(throttle.last_run_at).getTime();
    if (elapsed < THROTTLE_MS) return { ran: false, created: 0, reason: "throttled" };
  }

  const created = await runSuggestionPass(supabase, userId);
  await supabase
    .from("hub_suggestion_runs")
    .upsert({ user_id: userId, last_run_at: new Date().toISOString() });
  return { ran: true, created };
}

export async function runSuggestionPass(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 86400_000).toISOString();

  // Recent embedded docs.
  const { data: recentDocs } = await supabase
    .from("documents")
    .select("id, title, markdown, embedding, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_draft", false)
    .gte("created_at", since)
    .not("embedding", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const docs = (recentDocs as DocSeed[] | null) ?? [];
  if (docs.length < MIN_CLUSTER_SIZE) return 0;

  // Docs already in any bundle. Exclude.
  const allIds = docs.map((d) => d.id);
  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id")
    .in("document_id", allIds);
  const inBundle = new Set((bundleDocs as { document_id: string }[] | null ?? []).map((r) => r.document_id));

  // Docs already part of an open suggestion. Exclude (we don't want to
  // repropose the same cluster while the user hasn't decided yet).
  const { data: openSuggs } = await supabase
    .from("hub_suggestions")
    .select("doc_ids")
    .eq("user_id", userId)
    .eq("status", "open");
  const inOpenSuggestion = new Set<string>();
  for (const r of (openSuggs as { doc_ids: string[] }[] | null ?? [])) {
    for (const id of r.doc_ids || []) inOpenSuggestion.add(id);
  }

  const candidates = docs.filter((d) => !inBundle.has(d.id) && !inOpenSuggestion.has(d.id));
  if (candidates.length < MIN_CLUSTER_SIZE) return 0;

  // Greedy clustering.
  const visited = new Set<string>();
  const clusters: ClusterCandidate[] = [];
  const candidateIds = new Set(candidates.map((d) => d.id));

  for (const doc of candidates) {
    if (visited.has(doc.id)) continue;
    if (clusters.length >= MAX_CLUSTERS_PER_RUN) break;
    // Supabase returns the vector as either a JSON-encoded array or a
    // pgvector string literal "[v1,v2,...]" depending on the column
    // type and serializer. The RPC's query_embedding param expects the
    // string form. Normalize both shapes.
    const embeddingLiteral = Array.isArray(doc.embedding)
      ? `[${doc.embedding.join(",")}]`
      : (doc.embedding as string);
    const { data: neighbors } = await supabase.rpc("match_documents_by_embedding", {
      query_embedding: embeddingLiteral,
      match_count: NEIGHBOR_FETCH + 1,
      p_user_id: userId,
      p_anonymous_id: null,
    });
    const closeIds: string[] = [];
    for (const n of (neighbors as MatchRow[] | null ?? [])) {
      if (n.id === doc.id) continue;
      if (n.distance > DISTANCE_THRESHOLD) continue;
      if (!candidateIds.has(n.id)) continue;
      if (visited.has(n.id)) continue;
      closeIds.push(n.id);
    }
    if (closeIds.length + 1 < MIN_CLUSTER_SIZE) continue;
    const cluster = [doc.id, ...closeIds];
    clusters.push({ rootId: doc.id, docIds: cluster });
    cluster.forEach((id) => visited.add(id));
  }
  if (clusters.length === 0) return 0;

  // Generate title + reason for each cluster via LLM.
  const docsById = new Map(candidates.map((d) => [d.id, d]));
  let inserted = 0;
  for (const c of clusters) {
    const cdocs = c.docIds.map((id) => docsById.get(id)).filter(Boolean) as DocSeed[];
    if (cdocs.length < MIN_CLUSTER_SIZE) continue;
    const { title, reason } = await summarizeCluster(cdocs, userId);
    if (!title || !reason) continue;
    const id = nanoid(10);
    const now = new Date().toISOString();
    const { error } = await supabase.from("hub_suggestions").insert({
      id,
      user_id: userId,
      type: "bundle_topic",
      title,
      reason,
      doc_ids: c.docIds,
      status: "open",
      created_at: now,
      updated_at: now,
    });
    if (!error) inserted++;
  }
  return inserted;
}

async function summarizeCluster(docs: DocSeed[], userId?: string): Promise<{ title: string | null; reason: string | null }> {
  const summaryInput = docs
    .map((d, i) => {
      const t = d.title || "Untitled";
      const snip = (d.markdown || "").slice(0, 400).replace(/\s+/g, " ").trim();
      return `${i + 1}. ${t}\n   ${snip}`;
    })
    .join("\n");

  const prompt = `These ${docs.length} documents from the user's hub were created in the last two weeks and aren't bundled yet. Suggest a bundle that would group them.

Documents:
${summaryInput}

Output strict JSON only, no fences:
{"title":"<3-6 word bundle name>","reason":"<one sentence explaining why these belong together>"}`;

  const result = await callAI({
    prompt,
    useLiteModel: true,
    temperature: 0.2,
    maxOutputTokens: 256,
    userId,
    action: "hub-suggestions",
  });
  if (!result.ok) return { title: null, reason: null };
  return parseJsonResponse(result.text);
}

function parseJsonResponse(text: string): { title: string | null; reason: string | null } {
  const stripped = text.replace(/```json|```/g, "").trim();
  try {
    const obj = JSON.parse(stripped);
    if (obj && typeof obj === "object" && typeof obj.title === "string" && typeof obj.reason === "string") {
      return { title: obj.title.trim().slice(0, 80), reason: obj.reason.trim().slice(0, 280) };
    }
  } catch {
    // Fall through; some models put extra prose around the JSON.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const obj = JSON.parse(match[0]);
        if (typeof obj.title === "string" && typeof obj.reason === "string") {
          return { title: obj.title.trim().slice(0, 80), reason: obj.reason.trim().slice(0, 280) };
        }
      } catch { /* give up */ }
    }
  }
  return { title: null, reason: null };
}

// Provider-specific runners removed — all routes through callAI now.
