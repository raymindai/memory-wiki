// Concept-bridge retrieval — the ontology-grounding step.
//
// Given a query (its embedding + text) and a user, find the concepts the
// query touches (vector match against concept_index, augmented by exact
// label hits) and walk ONE hop of concept_relations to surface neighbor
// concepts. This is what makes retrieval "Graph RAG": a query about
// "memory" also reaches docs about concepts the ontology says are related
// to memory, which plain FTS/vector recall miss.
//
// Extracted from hub-chat (apps/web/src/app/api/hub/[slug]/chat/route.ts)
// so the agent-facing search (/api/search?deep=1, used by MCP mw_search)
// grounds in the SAME ontology the web hub-chat already uses. One source
// of truth for the bridge.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConceptHit {
  id: number;
  label: string;
  description: string | null;
  doc_ids: string[];
  weight: number;
  occurrence_count: number;
}

export interface NeighborConcept {
  id: number;
  label: string;
  description: string | null;
  doc_ids: string[];
  relation_label?: string;
}

export interface ConceptBridge {
  /** Concepts the query directly touches (vector + literal label match). */
  concepts: ConceptHit[];
  /** Concepts one hop away in concept_relations (graph expansion). */
  neighbors: NeighborConcept[];
}

/**
 * Resolve the query to the user's concept graph: direct concept hits plus
 * their 1-hop neighbors. Pass the query embedding as a pgvector SQL literal
 * (caller embeds once and reuses for doc recall too).
 *
 * Best-effort: every step degrades gracefully (RPC missing → weight-ranked
 * fallback; any query error → fewer results) so it can never break the
 * caller's primary retrieval.
 */
export async function bridgeConcepts(
  supabase: SupabaseClient,
  userId: string,
  queryVecSql: string,
  queryText: string,
  opts?: { conceptCount?: number; neighborLimit?: number },
): Promise<ConceptBridge> {
  const conceptCount = opts?.conceptCount ?? 8;
  const neighborLimit = opts?.neighborLimit ?? 15;

  // 1. Direct concept recall: HNSW vector match against concept_index,
  //    falling back to weight-ranked top concepts if the RPC isn't present.
  let concepts: ConceptHit[] = [];
  try {
    const { data: vectorHits } = await supabase.rpc("match_user_concepts", {
      query_embedding: queryVecSql,
      p_user_id: userId,
      match_count: conceptCount,
    });
    concepts = (vectorHits || []) as ConceptHit[];
  } catch {
    const { data: top } = await supabase
      .from("concept_index")
      .select("id, label, description, doc_ids, weight, occurrence_count")
      .eq("user_id", userId)
      .order("weight", { ascending: false })
      .limit(conceptCount);
    concepts = (top || []) as ConceptHit[];
  }

  // 2. Augment with exact-label textual matches the vector recall may miss
  //    (e.g. an obvious literal mention with a weak embedding cosine).
  const queryLower = queryText.toLowerCase();
  const labelProbe = queryText.split(/\s+/).slice(0, 4).join(" ");
  if (labelProbe) {
    const { data: literalHits } = await supabase
      .from("concept_index")
      .select("id, label, description, doc_ids, weight, occurrence_count")
      .eq("user_id", userId)
      .ilike("label", `%${labelProbe}%`)
      .limit(5);
    const seen = new Set(concepts.map((c) => c.id));
    for (const c of (literalHits || []) as ConceptHit[]) {
      if (!seen.has(c.id) && queryLower.includes(c.label.toLowerCase())) {
        concepts.push(c);
        seen.add(c.id);
      }
    }
  }
  concepts = concepts.slice(0, 10);

  // 3. One-hop neighbor walk via concept_relations.
  let neighbors: NeighborConcept[] = [];
  if (concepts.length > 0) {
    const conceptIds = concepts.map((c) => c.id);
    const { data: rels } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label, weight")
      .eq("user_id", userId)
      .or(`source_concept_id.in.(${conceptIds.join(",")}),target_concept_id.in.(${conceptIds.join(",")})`)
      .order("weight", { ascending: false })
      .limit(60);
    const neighborMap = new Map<number, string>();
    for (const r of rels || []) {
      if (conceptIds.includes(r.source_concept_id) && !conceptIds.includes(r.target_concept_id)) {
        if (!neighborMap.has(r.target_concept_id)) neighborMap.set(r.target_concept_id, r.relation_label);
      }
      if (conceptIds.includes(r.target_concept_id) && !conceptIds.includes(r.source_concept_id)) {
        if (!neighborMap.has(r.source_concept_id)) neighborMap.set(r.source_concept_id, r.relation_label);
      }
    }
    if (neighborMap.size > 0) {
      const { data: nbrs } = await supabase
        .from("concept_index")
        .select("id, label, description, doc_ids")
        .in("id", [...neighborMap.keys()])
        .limit(neighborLimit);
      neighbors = (nbrs || []).map((n) => ({
        id: n.id,
        label: n.label,
        description: n.description,
        doc_ids: n.doc_ids || [],
        relation_label: neighborMap.get(n.id),
      }));
    }
  }

  return { concepts, neighbors };
}

/**
 * Turn a concept bridge into a ranked list of doc ids the ontology says are
 * about the query, each tagged with the concept it came through. Direct
 * concepts rank ahead of neighbors. Used by search to surface docs that
 * graph-match the query even when text/vector recall doesn't.
 */
export function conceptBridgedDocIds(
  bridge: ConceptBridge,
  opts?: { perConcept?: number; limit?: number },
): Array<{ id: string; concept: string; hop: 0 | 1 }> {
  const perConcept = opts?.perConcept ?? 4;
  const limit = opts?.limit ?? 12;
  const out: Array<{ id: string; concept: string; hop: 0 | 1 }> = [];
  const seen = new Set<string>();
  const take = (ids: string[], concept: string, hop: 0 | 1) => {
    for (const id of (ids || []).slice(0, perConcept)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push({ id, concept, hop });
      }
    }
  };
  for (const c of bridge.concepts) take(c.doc_ids, c.label, 0);
  for (const n of bridge.neighbors) take(n.doc_ids, n.label, 1);
  return out.slice(0, limit);
}

/** Compact human/LLM-readable summary of the bridge for tool output. */
export function describeConceptBridge(bridge: ConceptBridge): string | null {
  if (bridge.concepts.length === 0) return null;
  const direct = bridge.concepts
    .map((c) => c.label)
    .slice(0, 8)
    .join(", ");
  const related = bridge.neighbors
    .map((n) => n.label)
    .slice(0, 8)
    .join(", ");
  let s = `Concepts matched: ${direct}`;
  if (related) s += `\nRelated (1 hop): ${related}`;
  return s;
}
