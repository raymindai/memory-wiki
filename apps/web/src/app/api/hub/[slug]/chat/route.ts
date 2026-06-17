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
import { verifyAuthToken } from "@/lib/verify-auth";
import { bridgeConcepts } from "@/lib/concept-bridge";

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

  // 3-4. Concept bridge: resolve the query to the user's ontology — direct
  //      concept hits (vector recall + exact-label augment) plus their 1-hop
  //      neighbors in concept_relations. Shared verbatim with
  //      /api/search?deep=1 via lib/concept-bridge, so web hub-chat and the
  //      agent-facing (MCP) search ground in the exact same graph.
  const { concepts: conceptHits, neighbors: neighborConcepts } = await bridgeConcepts(
    supabase,
    profile.id,
    queryVecSql,
    message,
  );

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
  // Opportunistic identity resolution for billing. Hub chat is a
  // public surface, but signed-in callers must be billed for their
  // tokens (otherwise visitors-querying-their-own-hub would drop the
  // attribution). Anon callers fall through and the row is dropped
  // by logUsage on the way to ai_usage.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = req.headers.get("x-anonymous-id") || undefined;

  const result = await streamText({
    prompt: fullPrompt,
    useLiteModel: false,
    maxOutputTokens: 64000,
    temperature: 0.5,
    userId,
    anonymousId,
    action: "chat-hub",
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
