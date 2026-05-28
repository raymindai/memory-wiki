// POST /api/docs/[id]/chat
//
// Single-doc chat surface. Same shape + streaming contract as
// /api/hub/<slug>/chat and /api/bundles/<id>/chat (raw text token
// stream, Anthropic Haiku 4.5, max_tokens 4096) so the iOS
// ChatSheet can plug in via the same APIClient.streamChat path.
//
// Body: { message: string, history?: [{role,content}] }
// Response: text/plain stream (raw token chunks)

import { NextRequest } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

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
        controller.enqueue(encoder.encode(`\n[Error: ${(err as Error).message}]`));
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" }
  });
}
