import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";

// POST /api/bundles/suggest-title
//
// Body: { documentIds: string[] }   — 1..25 ids of the user's own docs
// Returns: { title: string }
//
// Given the docs the user is about to bundle, ask the LLM to read
// their titles + snippets and return a short, specific bundle title.
// Used by the BundleCreator modal's "✨ AI" button — title field is
// empty by default, AI fills it on demand.

const SYSTEM = `You are memory.wiki's bundle namer. The user is about to group a small set of their own documents into one "bundle" (a themed sub-folder of their knowledge hub). Read what the docs have in common, then return a short title.

Rules:
- 2 to 6 words.
- Capture the SHARED topic, project, decision, or entity — not a generic noun like "Notes" or "Documents".
- Specific beats clever. "Auth + Stripe migration" beats "The big refactor".
- Capitalize proper nouns and the first word. Lowercase the rest.
- No surrounding quotes, no trailing punctuation, no markdown.
- Respond with the title only. No prose, no explanations.`;

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }
  let body: { documentIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ids = (body.documentIds || []).filter(
    (id: unknown): id is string => typeof id === "string" && /^[\w-]{4,40}$/.test(id),
  );
  if (ids.length === 0) {
    return NextResponse.json({ error: "documentIds is required" }, { status: 400 });
  }
  if (ids.length > 25) {
    return NextResponse.json({ error: "too many documents (max 25)" }, { status: 400 });
  }

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = req.headers.get("x-anonymous-id") || undefined;
  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, markdown, user_id, anonymous_id")
    .in("id", ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Owner-only — drop anything the caller doesn't own.
  const owned = (data || []).filter((d) =>
    (userId && d.user_id === userId) ||
    (anonymousId && d.anonymous_id === anonymousId),
  );
  if (owned.length === 0) {
    return NextResponse.json({ error: "no accessible documents" }, { status: 404 });
  }

  // Cap at 10 docs and 600 chars per doc to keep the prompt small —
  // bundle titles don't need full context, just the gist.
  const ctx = owned.slice(0, 10).map((d, i) => {
    const title = d.title || "Untitled";
    const snippet = (d.markdown || "").slice(0, 600).replace(/\s+/g, " ").trim();
    return `[${i + 1}] "${title}"\n${snippet}`;
  }).join("\n\n");

  try {
    const title = await callTitleSuggester(SYSTEM, `Documents to bundle:\n\n${ctx}`);
    return NextResponse.json({ title });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: `AI: ${msg}` }, { status: 502 });
  }
}

async function callTitleSuggester(system: string, user: string): Promise<string> {
  // Haiku — short output, fast turnaround, cheap. Falls back to
  // OpenAI / Gemini if Anthropic isn't configured.
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${t || "unknown"}`);
    }
    const data = await res.json();
    type Block = { type: string; text?: string };
    const blocks: Block[] = data.content || [];
    return blocks.filter((b) => b.type === "text").map((b) => b.text || "").join("").trim().replace(/^["']|["']$/g, "").replace(/[.,;:!?]+$/, "");
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
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
        max_tokens: 60,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${t || "unknown"}`);
    }
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content || "";
    return text.trim().replace(/^["']|["']$/g, "").replace(/[.,;:!?]+$/, "");
  }

  if (process.env.GEMINI_API_KEY) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 60 },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${t || "unknown"}`);
    }
    const data = await res.json();
    type Part = { text?: string };
    const parts: Part[] = data.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || "").join("").trim().replace(/^["']|["']$/g, "").replace(/[.,;:!?]+$/, "");
  }

  throw new Error("No AI provider configured (ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY)");
}
