// Hub-scoped chat — ontology-grounded RAG.
//
// Differs from /api/bundles/[id]/chat in two ways:
//   1. Scope spans the user's ENTIRE hub, not one bundle.
//   2. Retrieval is concept-bridged. Vector recall over chunks finds
//      paragraphs that look textually similar; a concept-aware step
//      additionally pulls in concepts that the query mentions, then
//      walks 1 hop of concept_relations to surface NEIGHBOR concepts +
//      their evidence chunks. So a query about "memory" returns docs
//      that mention "memory" AND docs that mention concepts the
//      ontology says are related to memory.
//
// Streams the LLM response with [doc:<id>] citations the client UI can
// resolve to clickable chunks.

import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { embedText, vectorToSql } from "@/lib/embeddings";
import { streamText } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ slug: string }> };

const SYSTEM_PROMPT = `You are an AI assistant that answers questions grounded in the user's personal knowledge hub — a collection of their docs, organized into bundles.

Rules:
1. Ground every claim in the provided ontology + chunks. Don't invent facts.
2. Cite using the format [doc:<id>] where <id> is the document ID shown in the context.
3. Use markdown (lists, bold, code blocks) where appropriate.
4. Be concise but thorough — lead with the answer, then evidence.
5. If the hub doesn't have enough info, say so honestly.
6. When the user asks about a concept, prefer naming the concept's neighbors from the ontology when relevant.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  const supabase = getSupabaseClient();
  if (!supabase) return new Response(JSON.stringify({ error: "Storage not configured" }), { status: 503 });

  let body: { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 }); }
  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
  }

  // Resolve hub slug → user_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("hub_slug", slug)
    .single();
  if (!profile) return new Response(JSON.stringify({ error: "Hub not found" }), { status: 404 });

  // ─── Retrieval ──────────────────────────────────────────────────
  // 1. Embed the query for vector recall over chunks + concepts.
  let queryVec: number[];
  try {
    queryVec = await embedText(message.slice(0, 4000));
  } catch {
    return new Response(JSON.stringify({ error: "Embedding failed" }), { status: 503 });
  }
  const queryVecSql = vectorToSql(queryVec);

  // 2. Vector recall over public chunks belonging to this hub.
  //    Returns chunks ranked by cosine distance.
  const { data: hitChunks } = await supabase.rpc("match_public_hub_chunks", {
    query_embedding: queryVecSql,
    p_hub_user_id: profile.id,
    match_count: 10,
  });

  // 3. Concept lookup: HNSW vector recall against concept_index. Falls
  //    back to textual contains for concepts that match by exact label
  //    even when the embedding cosine isn't a top hit.
  let conceptHits: Array<{ id: number; label: string; description: string | null; doc_ids: string[]; weight: number; occurrence_count: number }> = [];
  try {
    const { data: vectorHits } = await supabase.rpc("match_user_concepts", {
      query_embedding: queryVecSql,
      p_user_id: profile.id,
      match_count: 8,
    });
    conceptHits = (vectorHits || []) as typeof conceptHits;
  } catch {
    // RPC unavailable (migration not yet applied somewhere) — fall back to
    // weight-ranked top concepts as a last resort.
    const { data: top } = await supabase
      .from("concept_index")
      .select("id, label, description, doc_ids, weight, occurrence_count")
      .eq("user_id", profile.id)
      .order("weight", { ascending: false })
      .limit(8);
    conceptHits = (top || []) as typeof conceptHits;
  }
  // Augment with exact-label textual matches in case the vector hit
  // missed an obvious literal mention.
  const queryLower = message.toLowerCase();
  const { data: literalHits } = await supabase
    .from("concept_index")
    .select("id, label, description, doc_ids, weight, occurrence_count")
    .eq("user_id", profile.id)
    .ilike("label", `%${message.split(/\s+/).slice(0, 4).join(" ")}%`)
    .limit(5);
  const seen = new Set(conceptHits.map((c) => c.id));
  for (const c of literalHits || []) {
    if (!seen.has(c.id) && queryLower.includes(c.label.toLowerCase())) {
      conceptHits.push(c as (typeof conceptHits)[number]);
      seen.add(c.id);
    }
  }
  conceptHits = conceptHits.slice(0, 10);

  // 4. Multi-hop neighbor walk via concept_relations. 1 hop gives
  //    direct neighbors; 2 hops bridges through a shared concept (e.g.,
  //    "compare A vs B" naturally surfaces concepts that link both).
  let neighborConcepts: Array<{ label: string; description?: string | null; relation_label?: string }> = [];
  if (conceptHits.length > 0) {
    const conceptIds = conceptHits.map((c) => c.id);
    const { data: rels } = await supabase
      .from("concept_relations")
      .select("source_concept_id, target_concept_id, relation_label, weight")
      .eq("user_id", profile.id)
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
        .select("id, label, description")
        .in("id", [...neighborMap.keys()])
        .limit(15);
      neighborConcepts = (nbrs || []).map((n) => ({
        label: n.label,
        description: n.description,
        relation_label: neighborMap.get(n.id),
      }));
    }
  }

  // 5. Assemble context.
  type ChunkHit = {
    chunk_id: number; doc_id: string; heading?: string | null;
    heading_path?: string | null; markdown: string; doc_title?: string | null;
  };
  const chunks: ChunkHit[] = (hitChunks || []) as ChunkHit[];
  const ontologyBlock = conceptHits.length > 0
    ? `Relevant concepts in the hub:\n` +
      conceptHits.map((c) => `- ${c.label}${c.description ? ` — ${c.description}` : ""} (mentions: ${c.occurrence_count})`).join("\n") +
      (neighborConcepts.length > 0
        ? `\n\nRelated concepts (1 hop):\n` + neighborConcepts.map((n) => `- ${n.label}${n.relation_label ? ` (${n.relation_label})` : ""}${n.description ? ` — ${n.description}` : ""}`).join("\n")
        : "")
    : "";
  const chunksBlock = chunks.length > 0
    ? `Relevant chunks:\n` + chunks.map((c, i) => {
        const head = c.heading_path || c.heading || "(no heading)";
        return `[doc:${c.doc_id}] (${head})\n${c.markdown.slice(0, 1200)}`;
      }).join("\n\n")
    : "";

  // No per-provider guard — streamText cascades through every
  // configured provider in admin-defined order. The old check
  // hard-coded gemini-first ordering, diverging from the cost-first
  // cascade defined in lib/ai-providers.
  const fullPrompt = `${SYSTEM_PROMPT}\n\nHub: ${profile.display_name || slug}\n\n${ontologyBlock || "(No matching concepts indexed yet.)"}\n\n${chunksBlock || "(No matching chunks.)"}\n\n${
    history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
  }\n\nUser: ${message}\n\nAssistant:`;

  // Routes through the shared streamText helper. Provider order +
  // model selection come from admin's site_config — hub chat now
  // shares the same cascade as doc chat / bundle chat / the rest of
  // the AI surfaces. Long-form RAG synthesis, so useLiteModel is
  // false (admin can flip primary to a stronger model if quality
  // matters). iOS expects text/plain framing.
  const result = await streamText({
    prompt: fullPrompt,
    useLiteModel: false,
    maxOutputTokens: 64000,
    temperature: 0.5,
  });
  if (!result.ok || !result.stream) {
    return new Response(
      JSON.stringify({ error: result.error || "AI request failed" }),
      { status: result.status || 502, headers: { "Content-Type": "application/json" } },
    );
  }
  const encoder = new TextEncoder();
  const byteStream = new ReadableStream({
    async start(controller) {
      const reader = result.stream!.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[Error: ${err instanceof Error ? err.message : "stream failed"}]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(byteStream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
