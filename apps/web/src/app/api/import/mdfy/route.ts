import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI API key not configured" }, { status: 503 });
  }

  let body: { text: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { text, filename } = body;
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // Hard cap: 3 MB of text. Provider context windows comfortably
  // handle this (Anthropic Sonnet = 200k tokens, OpenAI gpt-4o =
  // 128k, Gemini 3.1 = 1M). 3MB ≈ 750k tokens at 4 chars/token, so
  // Gemini is the only one that fits the full budget — the
  // failover helper picks whoever is up; if Anthropic/OpenAI get
  // the call they'll error on length and the helper falls through.
  const MAX_INPUT_BYTES = 3 * 1024 * 1024;
  const truncated = text.length > MAX_INPUT_BYTES;
  const trimmed = truncated ? text.slice(0, MAX_INPUT_BYTES) : text;

  const prompt = `You are an expert at converting raw text into well-structured Markdown.

The following text was extracted from a file${filename ? ` named "${filename}"` : ""}. The extraction process lost all formatting — headings, bold, lists, tables, code blocks, etc. are all flattened into plain text.

Your job is to reconstruct the original document structure as clean Markdown:

Rules:
- Detect headings from context (titles, section names) and use # ## ### appropriately
- Detect lists (bullet points, numbered steps) and format as - or 1. 2. 3.
- Detect tables and format as Markdown tables
- Detect code snippets and wrap in \`\`\` code blocks with language hints
- Detect emphasis (key terms, important phrases) and use **bold** or *italic*
- Detect blockquotes and use >
- Preserve all original content — do NOT summarize, skip, or rephrase
- Output ONLY the Markdown — no explanations, no wrapping, no \`\`\`markdown fences
- If the text is already well-structured, just clean it up minimally
- For non-English text, preserve the original language

Raw text:
---
${trimmed}
---

Structured Markdown:`;

  try {
    const result = await callAI({
      prompt,
      temperature: 0.1,
      maxOutputTokens: 65536,
      useLiteModel: true,
    });

    if (!result.ok) {
      console.error("memory.wiki formatter failover exhausted:", result.status, result.error);
      return NextResponse.json(
        { error: result.error },
        { status: result.rateLimited ? 429 : result.status >= 500 ? 502 : result.status },
      );
    }

    return NextResponse.json({
      markdown: result.text,
      truncated,
      provider: result.provider,
      ...(result.finishReason && result.finishReason !== "STOP" && result.finishReason !== "end_turn" && result.finishReason !== "stop"
        ? { finishReason: result.finishReason }
        : {}),
    });
  } catch (err) {
    console.error("memory.wiki API error:", err);
    return NextResponse.json({ error: "AI service unreachable. Check your connection." }, { status: 500 });
  }
}
