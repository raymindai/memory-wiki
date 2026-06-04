import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

/**
 * v6 — Auto-suggest bundle prompts based on the caller's hub content.
 *
 * GET /api/bundles/suggestions → returns 3-5 short, specific natural-
 * language prompts the user can click to invoke /api/bundles/ai-generate
 * with no typing.
 *
 * Why prompts and not pre-built bundles: pre-building means burning AI
 * tokens on every visit to surface stale suggestions. Generating just
 * the prompts (one cheap LLM call against doc titles) keeps the
 * surface fresh, cheap, and lets the user pick which threads to pull.
 *
 * Provider: Claude > GPT-4o > Gemini fallback (same chain as
 * ai-generate). Uses titles only, never bodies — token-cheap.
 */
const SYSTEM_PROMPT = `You are Memory.Wiki's bundle suggester. You will receive a list of document titles from a user's personal knowledge hub. Your job is to propose 3 to 5 short prompts the user could click to ask the bundle curator to assemble themed collections from their hub.

Each prompt should:
- Be 4-12 words. No quotes, no trailing punctuation.
- Reference a topic, project, or theme present in the titles.
- Read as a natural, casual instruction ("notes on X", "everything about Y", "Z-related answers").
- Not invent topics absent from the titles.

Output ONLY valid JSON in this exact shape — no prose, no markdown fences:

{
  "prompts": [
    "...",
    "...",
    "..."
  ]
}`;

interface ProviderResponse { prompts: string[] }

export async function GET(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ prompts: [] });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = req.headers.get("x-anonymous-id") || undefined;
  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull the most-recent 40 titles. Just titles — no markdown — keeps
  // the AI input under 1k tokens even for verbose users.
  let q = supabase
    .from("documents")
    .select("title")
    .is("deleted_at", null)
    .eq("is_draft", false)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (userId) q = q.eq("user_id", userId);
  else if (anonymousId) q = q.eq("anonymous_id", anonymousId);

  const { data: rows } = await q;
  const titles = (rows || []).map(r => r.title).filter(Boolean) as string[];
  if (titles.length < 3) {
    // Hub is too thin to surface meaningful suggestions.
    return NextResponse.json({ prompts: [] });
  }

  const userMessage = `Document titles in this user's hub (most recent first):\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;

  let raw = "";
  try {
    raw = await callSuggester(SYSTEM_PROMPT, userMessage);
  } catch {
    // AI unavailable — return empty list rather than error so the UI
    // can quietly hide the suggestions row.
    return NextResponse.json({ prompts: [] });
  }

  const parsed = parseSuggestions(raw);
  return NextResponse.json(parsed);
}

async function callSuggester(system: string, user: string): Promise<string> {
  // Routed through the unified cost-first cascade. Prompt instructs
  // JSON output; parseSuggestions handles both raw JSON and fenced
  // ```json``` blocks so the absence of Gemini's responseSchema
  // enforcement here is fine — the downstream parser is already
  // tolerant.
  const result = await callAI({
    prompt: `${system}\n\n${user}`,
    useLiteModel: true,
    temperature: 0.6,
    maxOutputTokens: 400,
  });
  if (!result.ok) throw new Error(result.error || "AI call failed");
  return result.text;
}

function parseSuggestions(text: string): ProviderResponse {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(stripped) as { prompts?: unknown };
    const list = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    const cleaned = list
      .filter((p): p is string => typeof p === "string")
      .map(p => p.trim().replace(/^["']|["']$/g, "").replace(/\.$/, ""))
      .filter(p => p.length > 0 && p.length <= 80)
      .slice(0, 5);
    return { prompts: cleaned };
  } catch {
    return { prompts: [] };
  }
}
