import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

// POST /api/docs/transform
//
// Body: { markdown, intent, userId?, source?, title? }
//
// Run the captured `markdown` through an LLM using `intent` as the
// user's instruction ("extract pricing", "summarize in 5 bullets",
// "translate to Korean", etc.). Save the AI's output as a new doc
// and return its id + editToken just like /api/docs does.
//
// Used by the chrome extension's "capture with intent" textarea —
// the popup captures the full page/conversation, posts here, and
// publishes the transformed result to a memory.wiki URL the user
// can paste into any AI.
//
// Requires auth. Intent runs ARE explicitly the user's own AI
// request, so we don't honor anon flows here.

const SYSTEM = `You are memory.wiki's capture transformer. The user has just clipped a page or AI conversation and given you a short instruction in their own words about what to do with it.

Your job:
- Follow the instruction. Don't ask clarifying questions.
- Return well-formed markdown. Use headings, lists, blockquotes, code blocks where they help.
- Open with a single H1 title that names the transformed output (not the source page). The title should make the document scannable on a hub of saved memories.
- Preserve concrete facts, names, numbers, URLs, quotes. Don't hallucinate.
- If the instruction is "summarize", be ruthless — short, structured, lossless on the key facts.
- If the instruction is "extract X", drop everything that isn't X.
- If the instruction is "translate", translate the body but keep the H1 in the target language too.
- If the instruction is unclear or empty, return the source as-is with a brief one-line note.
- No preamble like "Here is the transformed content:". Just the markdown.`;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: {
    markdown?: string;
    intent?: string;
    userId?: string;
    source?: string;
    title?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";
  if (!markdown) return NextResponse.json({ error: "markdown is required" }, { status: 400 });
  if (!intent)  return NextResponse.json({ error: "intent is required" }, { status: 400 });
  if (markdown.length > 200_000) {
    return NextResponse.json({ error: "markdown too large (max 200K chars)" }, { status: 413 });
  }

  // Resolve user — body.userId, JWT, or x-user-id header.
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = body.userId || verified?.userId || req.headers.get("x-user-id") || "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run the transform.
  let transformed: string;
  try {
    transformed = await callTransformer(intent, markdown);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: `AI: ${msg}` }, { status: 502 });
  }
  if (!transformed || transformed.trim().length === 0) {
    return NextResponse.json({ error: "AI returned empty output" }, { status: 502 });
  }

  // Prepend AI prompt as a quoted note above the H1 so future
  // readers see what the user asked for. The H1 the LLM produced
  // stays as the doc title.
  const finalMd = `> **AI prompt:** ${intent}\n\n${transformed.trim()}\n`;
  const title = extractTitleFromMd(finalMd) || "AI transform";

  // Insert. Single-attempt nanoid; collisions on 8-char are practically zero.
  const id = nanoid(8);
  const editToken = nanoid(32);
  const { error } = await supabase.from("documents").insert({
    id,
    markdown: finalMd,
    title,
    edit_token: editToken,
    user_id: userId,
    edit_mode: "account",
    is_draft: true,
    source: body.source || "chrome-intent",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id, editToken, title, markdown: finalMd });
}

function extractTitleFromMd(md: string): string {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim().slice(0, 100) : "";
}

async function callTransformer(intent: string, sourceMd: string): Promise<string> {
  const userMsg =
    `Instruction:\n${intent}\n\n---\n\nSource markdown (clipped from a webpage or AI chat):\n\n${sourceMd}`;

  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    type Block = { type: string; text?: string };
    const blocks: Block[] = data.content || [];
    return blocks.filter((b) => b.type === "text").map((b) => b.text || "").join("").trim();
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  }

  throw new Error("No LLM provider configured");
}
