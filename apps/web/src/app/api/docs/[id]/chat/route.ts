// POST /api/docs/[id]/chat
//
// Single-doc chat surface. Same shape + streaming contract as
// /api/hub/<slug>/chat and /api/bundles/<id>/chat (raw text token
// stream, Anthropic Haiku 4.5, max_tokens 4096) so the iOS
// ChatSheet can plug in via the same APIClient.streamChat path.
//
// Body: { message: string, history?: [{role,content}] }
// Response: text/plain stream (raw token chunks)

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { streamText } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

const SYSTEM_PROMPT = `You are an AI assistant answering questions about ONE specific document.

Rules:
1. Ground every claim in the provided document. Don't invent facts.
2. Cite the source as [doc:<the document id>] when referring back to it.
3. Use markdown — short paragraphs, lists where helpful, code blocks for code.
4. Lead with the answer, then evidence.
5. If the document doesn't contain enough info, say so honestly.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), { status: 503 });
  }

  let body: { message?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 }); }
  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
  }

  // Pull the doc. Drafts require the auth'd owner; public docs
  // are open to anyone with the link (matches the doc viewer).
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const requesterId = verified?.userId || req.headers.get("x-user-id");
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, markdown, user_id, is_draft, allowed_emails")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!doc) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  const ownerMatch = doc.user_id && doc.user_id === requesterId;
  if (doc.is_draft && !ownerMatch) {
    return new Response(JSON.stringify({ error: "Not authorised" }), { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
  }

  const docContent = doc.markdown.length > 80000
    ? doc.markdown.slice(0, 80000) + "\n\n[document truncated]"
    : doc.markdown;
  const fullPrompt = `${SYSTEM_PROMPT}\n\nDocument: "${doc.title || "Untitled"}" (id: doc:${doc.id})\n\n${docContent}\n\n${
    history.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n")
  }\n\nUser: ${message}\n\nAssistant:`;

  // Routed through the shared streamText helper. Provider order +
  // model selection come from admin's site_config — chat picks the
  // same cascade as the rest of the AI surfaces. Long-form reply, so
  // useLiteModel is false (admin can flip primary to a stronger model
  // if quality matters).
  const result = await streamText({
    prompt: fullPrompt,
    useLiteModel: false,
    maxOutputTokens: 64000,
    temperature: 0.7,
  });
  if (!result.ok || !result.stream) {
    return NextResponse.json({ error: result.error || "AI request failed" }, { status: result.status || 502 });
  }
  // Re-encode the text chunks back to bytes for the HTTP response.
  // The client reads this as text/plain and renders incrementally.
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
  return new Response(byteStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
