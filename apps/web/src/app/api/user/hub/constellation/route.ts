import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/user/hub/constellation
//
// Returns the user's whole hub as a graph payload — concepts +
// docs + edges + bundle-as-cluster — used by the Start screen's
// Layer 2 visual. Lightweight: capped at ~200 concepts + 200 docs
// so the front-end render stays fluid. Larger hubs get the top-
// occurrence concepts and most-recent docs first.
//
// Time slider on the client filters by `createdAt` on every node;
// edges keep the older endpoint's date so an edge appears at the
// later of its two endpoints' dates.

const MAX_CONCEPTS = 200;
const MAX_DOCS = 200;

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  return verified?.userId || req.headers.get("x-user-id") || null;
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  // ─── Concepts ───
  const { data: concepts } = await supabase
    .from("concept_index")
    .select("id, label, concept_type, weight, description, doc_ids, occurrence_count, created_at")
    .eq("user_id", userId)
    .order("occurrence_count", { ascending: false })
    .limit(MAX_CONCEPTS);

  // ─── Documents ───
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, created_at, intent")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS);

  // ─── Bundles → clusters ───
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: bundleLinks } = await supabase
    .from("bundle_documents")
    .select("bundle_id, document_id");

  // ─── Concept-to-concept edges ───
  // concept_index uses BIGINT ids; we expose them as strings to the
  // client to keep node ids uniform with the doc nanoids.
  const conceptIds = (concepts || []).map((c) => c.id);
  let relations: Array<{ source_concept_id: number; target_concept_id: number; relation_label: string; weight: number }> = [];
  if (conceptIds.length > 0) {
    const { data } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label, weight")
      .eq("user_id", userId)
      .in("source_concept_id", conceptIds)
      .in("target_concept_id", conceptIds)
      .limit(800);
    relations = data || [];
  }

  // ─── Shape the response ───
  const docSet = new Set((docs || []).map((d) => d.id));

  type Node = {
    id: string;
    label: string;
    kind: "concept" | "entity" | "tag" | "doc";
    weight: number;
    description?: string | null;
    occurrence?: number;
    createdAt: string;
    docIds?: string[];
    bundleId?: string | null;
    intent?: string | null;
  };

  type Edge = {
    id: string;
    source: string;
    target: string;
    kind: "concept_doc" | "concept_concept";
    weight: number;
    label?: string;
    /** Edge "appears" at the later of its two endpoints' createdAt
     *  values — keeps the time-slider replay consistent. */
    createdAt: string;
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const dateOf = new Map<string, string>();

  // doc node id → bundle id (first one wins, used for cluster colour)
  const docToBundle = new Map<string, string>();
  for (const link of bundleLinks || []) {
    if (!docToBundle.has(link.document_id)) {
      docToBundle.set(link.document_id, link.bundle_id);
    }
  }

  for (const d of docs || []) {
    nodes.push({
      id: `doc:${d.id}`,
      label: d.title || "Untitled",
      kind: "doc",
      weight: 1,
      createdAt: d.created_at,
      bundleId: docToBundle.get(d.id) || null,
      intent: d.intent || null,
    });
    dateOf.set(`doc:${d.id}`, d.created_at);
  }

  for (const c of concepts || []) {
    const id = `concept:${c.id}`;
    const kind = (c.concept_type === "entity" || c.concept_type === "tag") ? c.concept_type : "concept";
    nodes.push({
      id,
      label: c.label,
      kind: kind as Node["kind"],
      weight: c.weight,
      description: c.description,
      occurrence: c.occurrence_count,
      createdAt: c.created_at,
      docIds: c.doc_ids || [],
    });
    dateOf.set(id, c.created_at);

    // concept → doc edges (one per doc id present in the window)
    for (const docId of c.doc_ids || []) {
      if (!docSet.has(docId)) continue; // doc outside the window
      const conceptDate = c.created_at;
      const docDate = dateOf.get(`doc:${docId}`) || conceptDate;
      const later = conceptDate > docDate ? conceptDate : docDate;
      edges.push({
        id: `e_cd_${c.id}_${docId}`,
        source: id,
        target: `doc:${docId}`,
        kind: "concept_doc",
        weight: 1,
        createdAt: later,
      });
    }
  }

  for (const r of relations) {
    const sourceId = `concept:${r.source_concept_id}`;
    const targetId = `concept:${r.target_concept_id}`;
    const a = dateOf.get(sourceId);
    const b = dateOf.get(targetId);
    if (!a || !b) continue;
    edges.push({
      id: `e_cc_${r.source_concept_id}_${r.target_concept_id}`,
      source: sourceId,
      target: targetId,
      kind: "concept_concept",
      weight: r.weight,
      label: r.relation_label,
      createdAt: a > b ? a : b,
    });
  }

  // Clusters (bundles)
  const clusters = (bundles || []).map((b) => ({
    id: b.id,
    label: b.title || "Untitled Bundle",
    createdAt: b.created_at,
  }));

  // Pick the earliest node date as the "hub start" so the client can
  // anchor the time slider. Fallback to today.
  let earliest = new Date().toISOString();
  for (const n of nodes) {
    if (n.createdAt && n.createdAt < earliest) earliest = n.createdAt;
  }

  // Dedupe edges by id — the relations table can hold multiple rows for
  // the same (source, target) pair (different labels, historical entries),
  // which produced duplicate React keys in the client and a warning that
  // can also drop edges silently. First-seen wins.
  const seenEdgeIds = new Set<string>();
  const dedupedEdges = edges.filter((e) => {
    if (seenEdgeIds.has(e.id)) return false;
    seenEdgeIds.add(e.id);
    return true;
  });

  return NextResponse.json({
    nodes,
    edges: dedupedEdges,
    clusters,
    hubStart: earliest.slice(0, 10),
    hubEnd: new Date().toISOString().slice(0, 10),
    counts: {
      nodes: nodes.length,
      edges: dedupedEdges.length,
      clusters: clusters.length,
      cappedConcepts: (concepts || []).length === MAX_CONCEPTS,
      cappedDocs: (docs || []).length === MAX_DOCS,
    },
  });
}
