import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { streamText } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `You are an AI assistant that answers questions about a collection of documents (a "bundle").

Rules for your answers:
1. Ground every claim in the provided documents. Don't invent facts.
2. Cite sources using this exact format: [doc:N] where N is the document number.
3. If multiple documents support a point, cite all: [doc:1][doc:3]
4. Use markdown formatting (lists, bold, code blocks) where appropriate.
5. Be concise but thorough. Lead with the answer, then provide supporting detail.
6. If the documents don't contain enough info to answer, say so honestly.
7. When asked to compare or contrast, organize your answer with clear sections.
8. When asked for action items or next steps, format as a checklist.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), { status: 503 });
  }

  let body: { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
  }

  // Fetch bundle and documents
  const { data: bundle } = await supabase
    .from("bundles")
    .select("id, title, is_draft")
    .eq("id", id)
    .single();

  if (!bundle) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  // For now, allow access to all non-draft bundles. Drafts require auth (skipped for chat MVP)

  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, sort_order")
    .eq("bundle_id", id)
    .order("sort_order", { ascending: true });

  if (!bundleDocs || bundleDocs.length === 0) {
    return new Response(JSON.stringify({ error: "Bundle has no documents" }), { status: 400 });
  }

  const docIds = bundleDocs.map(d => d.document_id);
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown")
    .in("id", docIds)
    .is("deleted_at", null);

  if (!docs || docs.length === 0) {
    return new Response(JSON.stringify({ error: "No accessible documents" }), { status: 400 });
  }

  // Sort by bundle order
  const orderedDocs = docIds.map(did => docs.find(d => d.id === did)).filter(Boolean) as typeof docs;

  // Build context for AI
  const documentsContext = orderedDocs.map((doc, i) => {
    // Truncate long docs to keep context manageable (16K chars per doc max)
    const content = doc.markdown.length > 16000 ? doc.markdown.slice(0, 16000) + "\n\n[document truncated]" : doc.markdown;
    return `--- Document ${i + 1}: "${doc.title || "Untitled"}" (id: doc:${doc.id}) ---\n${content}`;
  }).join("\n\n");

  // No per-provider guard — streamText cascades through every
  // configured provider in admin-defined order. The old check
  // hard-coded its own ordering (anthropic > gemini > openai) which
  // diverged from the cost-first cascade.

  // Build conversation
  const fullPrompt = `${SYSTEM_PROMPT}\n\nBundle: "${bundle.title}"\nDocuments:\n${documentsContext}\n\n${
    history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
  }\n\nUser: ${message}\n\nAssistant:`;

  // Streams plain text chunks via the shared streamText helper.
  // Provider order + model selection come from admin's site_config —
  // bundle chat picks the same cascade as doc chat / hub chat / the
  // rest of the AI surfaces. iOS ChatSheet + web reader expect
  // text/plain framing (not SSE), so we re-encode the unified text
  // stream to bytes here.
  const result = await streamText({
    prompt: fullPrompt,
    useLiteModel: false,
    maxOutputTokens: 64000,
    temperature: 0.7,
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
        controller.enqueue(encoder.encode(`\n[Error: ${(err as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });
  // Citation map for [1] / [2] references in the assistant's reply
  // — the SYSTEM_PROMPT instructs the model to use 1-indexed doc
  // numbers, the client resolves them back to (id, title) via this
  // header. Previously interleaved into an SSE `data: {docMap:...}`
  // final event; now sent up-front as a header so the stream body
  // can stay pure text/plain (matches doc-chat / hub-chat framing).
  const docMap: Record<number, { id: string; title: string }> = {};
  orderedDocs.forEach((d, i) => { docMap[i + 1] = { id: d.id, title: d.title || "Untitled" }; });
  // Base64 so the header is HTTP-safe regardless of titles (CJK,
  // emoji, quotes). Client decodes back to JSON.
  const docMapB64 = Buffer.from(JSON.stringify(docMap), "utf8").toString("base64");
  return new Response(byteStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Bundle-Doc-Map": docMapB64,
    },
  });
}
