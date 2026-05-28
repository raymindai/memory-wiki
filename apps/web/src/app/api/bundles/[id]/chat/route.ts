import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

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

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
  }

  // Build conversation
  const fullPrompt = `${SYSTEM_PROMPT}\n\nBundle: "${bundle.title}"\nDocuments:\n${documentsContext}\n\n${
    history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
  }\n\nUser: ${message}\n\nAssistant:`;

  // Anthropic Haiku — same provider + model the hub chat uses so
  // the two surfaces have identical voice + latency + citation
  // format. Streams raw text chunks (no SSE framing) for parity
  // with /api/hub/<slug>/chat — the iOS ChatSheet expects that.
  if (process.env.ANTHROPIC_API_KEY) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 64000,
              stream: true,
              messages: [{ role: "user", content: fullPrompt }],
            }),
          });
          if (!res.ok || !res.body) {
            controller.enqueue(encoder.encode(`Error: AI request failed (${res.status})`));
            controller.close();
            return;
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const obj = JSON.parse(payload);
                if (obj.type === "content_block_delta" && obj.delta?.text) {
                  controller.enqueue(encoder.encode(obj.delta.text));
                }
              } catch { /* skip malformed */ }
            }
          }
          controller.close();
        } catch (err) {
          console.error("Bundle chat stream error:", err);
          controller.enqueue(encoder.encode(`\n[Error: ${(err as Error).message}]`));
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  // Fallback: Gemini (kept for parity but not preferred; the
  // response framing is SSE here, not raw text).
  if (process.env.GEMINI_API_KEY) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: { maxOutputTokens: 2048, temperature: 0.6 },
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("Gemini chat error:", res.status, errText);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "AI error" })}\n\n`));
            controller.close();
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) { controller.close(); return; }
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              try {
                const data = JSON.parse(line.slice(6));
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch { /* skip malformed line */ }
            }
          }

          // Send doc IDs map for citation resolution
          const docMap = orderedDocs.reduce((acc, d, i) => { acc[i + 1] = { id: d.id, title: d.title || "Untitled" }; return acc; }, {} as Record<number, { id: string; title: string }>);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, docMap })}\n\n`));
          controller.close();
        } catch (err) {
          console.error("Chat stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  return new Response(JSON.stringify({ error: "Gemini key required for streaming" }), { status: 503 });
}
