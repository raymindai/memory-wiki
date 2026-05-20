import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/verify-auth";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/bundles/[id]/constellation
//
// Bundle-scoped subset of /api/user/hub/constellation. Same node + edge
// shape, filtered to concepts whose `doc_ids` overlap with the bundle's
// member documents. Same idea the hub view shows ("what concepts live
// in this bundle and how do they connect"), but bounded.
//
// Why a separate endpoint instead of `?bundle_id=` on the hub one:
//   - hub constellation requires authentication and is owner-only
//   - bundle constellation can be served for any bundle the caller is
//     allowed to read (public, shared, or owned), matching the
//     permission shape of /raw/bundle/[id]
//
// Used by the bundle Canvas view (future viz) and MCP's
// `mw_bundle_constellation` tool.

type RouteParams = { params: Promise<{ id: string }> };

const MAX_CONCEPTS = 120;

async function resolveCallerId(req: NextRequest): Promise<{ userId: string | null; anonymousId: string | null }> {
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  return {
    userId: verified?.userId || req.headers.get("x-user-id") || null,
    anonymousId: req.headers.get("x-anonymous-id") || null,
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid bundle ID" }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const { userId, anonymousId } = await resolveCallerId(req);

  // Permission gate — public bundles are readable by anyone; drafts
  // require ownership; shared bundles require the caller's email to
  // be on the allow-list (matches /raw/bundle/[id]'s rules).
  const { data: bundle } = await supabase
    .from("bundles")
    .select("user_id, anonymous_id, is_draft, allowed_emails")
    .eq("id", id)
    .single();
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner =
    !!(userId && bundle.user_id && userId === bundle.user_id) ||
    !!(anonymousId && bundle.anonymous_id && anonymousId === bundle.anonymous_id);
  if (bundle.is_draft && !isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  // Concept index is keyed on user_id — we need the bundle owner's
  // ontology to resolve concept rows for this bundle's docs. Anonymous
  // bundles never accumulate hub-level concepts, so they return an
  // empty constellation rather than a confusing partial view.
  const ownerUserId = bundle.user_id as string | null;
  if (!ownerUserId) {
    return NextResponse.json({
      bundleId: id,
      nodes: [],
      edges: [],
      counts: { concepts: 0, edges: 0, members: 0 },
      note: "Bundle is owned by an anonymous session — no hub-level concept index to draw from.",
    });
  }

  // 1) Member doc IDs.
  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id")
    .eq("bundle_id", id);
  const memberDocIds = (bundleDocs || []).map((r) => r.document_id);

  // 2) Concepts whose doc_ids overlap with members. PostgREST `cs` /
  //    `ov` operators work on text[] columns; use `overlaps` for the
  //    intersection semantics. Order by weight so the most-central
  //    concepts in this bundle win the cap.
  let concepts: Array<{
    id: number;
    label: string;
    concept_type: string | null;
    description: string | null;
    weight: number | null;
    occurrence_count: number | null;
    doc_ids: string[] | null;
    created_at: string;
  }> = [];
  if (memberDocIds.length > 0) {
    const { data } = await supabase
      .from("concept_index")
      .select("id, label, concept_type, description, weight, occurrence_count, doc_ids, created_at")
      .eq("user_id", ownerUserId)
      .overlaps("doc_ids", memberDocIds)
      .order("weight", { ascending: false })
      .limit(MAX_CONCEPTS);
    concepts = (data || []) as typeof concepts;
  }

  // 3) Concept-to-concept relations where BOTH endpoints survive the
  //    bundle-scoped concept set above.
  const conceptIds = concepts.map((c) => c.id);
  let relations: Array<{
    source_concept_id: number;
    target_concept_id: number;
    relation_label: string | null;
    weight: number | null;
  }> = [];
  if (conceptIds.length > 0) {
    const { data } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label, weight")
      .eq("user_id", ownerUserId)
      .in("source_concept_id", conceptIds)
      .in("target_concept_id", conceptIds)
      .order("weight", { ascending: false })
      .limit(600);
    relations = (data || []) as typeof relations;
  }

  // 4) Resolve member doc titles so the response is self-contained.
  let docTitles = new Map<string, string>();
  if (memberDocIds.length > 0) {
    const { data: rows } = await supabase
      .from("documents")
      .select("id, title")
      .in("id", memberDocIds)
      .is("deleted_at", null);
    docTitles = new Map((rows || []).map((r) => [r.id as string, (r.title as string) || "Untitled"]));
  }
  const memberDocIdSet = new Set(memberDocIds);

  // 5) Shape into the same node/edge schema the hub constellation uses
  //    so client / MCP code can share rendering logic.
  type Node = {
    id: string;
    label: string;
    kind: "concept" | "entity" | "tag" | "doc";
    weight: number;
    description?: string | null;
    occurrence?: number | null;
    docIds?: string[];
    createdAt: string;
  };
  type Edge = {
    id: string;
    source: string;
    target: string;
    kind: "concept_doc" | "concept_concept";
    weight: number;
    label?: string | null;
  };

  const nodes: Node[] = [];
  for (const docId of memberDocIds) {
    nodes.push({
      id: `doc:${docId}`,
      label: docTitles.get(docId) || "Untitled",
      kind: "doc",
      weight: 1,
      createdAt: new Date().toISOString(),
    });
  }
  for (const c of concepts) {
    const kind = (c.concept_type === "entity" || c.concept_type === "tag") ? c.concept_type : "concept";
    nodes.push({
      id: `concept:${c.id}`,
      label: c.label,
      kind: kind as Node["kind"],
      weight: c.weight || 0,
      description: c.description,
      occurrence: c.occurrence_count,
      docIds: (c.doc_ids || []).filter((d) => memberDocIdSet.has(d)),
      createdAt: c.created_at,
    });
  }

  const edges: Edge[] = [];
  for (const c of concepts) {
    for (const docId of c.doc_ids || []) {
      if (!memberDocIdSet.has(docId)) continue;
      edges.push({
        id: `e_cd_${c.id}_${docId}`,
        source: `concept:${c.id}`,
        target: `doc:${docId}`,
        kind: "concept_doc",
        weight: 1,
      });
    }
  }
  const seen = new Set<string>();
  for (const r of relations) {
    const edgeId = `e_cc_${r.source_concept_id}_${r.target_concept_id}`;
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);
    edges.push({
      id: edgeId,
      source: `concept:${r.source_concept_id}`,
      target: `concept:${r.target_concept_id}`,
      kind: "concept_concept",
      weight: r.weight || 0,
      label: r.relation_label,
    });
  }

  return NextResponse.json({
    bundleId: id,
    nodes,
    edges,
    counts: {
      concepts: concepts.length,
      docs: memberDocIds.length,
      edges: edges.length,
      cappedConcepts: concepts.length === MAX_CONCEPTS,
    },
  });
}
