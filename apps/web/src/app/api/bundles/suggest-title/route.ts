import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

// POST /api/bundles/suggest-title
//
// Body: { documentIds: string[] }   — 1..25 ids of the user's own docs
// Returns: { title: string }
//
// Given the docs the user is about to bundle, ask the LLM to read
// their titles + snippets and return a short, specific bundle title.
// Used by the BundleCreator modal's "✨ AI" button — title field is
// empty by default, AI fills it on demand.

const SYSTEM = `You are Memory.Wiki's bundle namer. The user is about to group a small set of their own documents into one "bundle" (a themed sub-folder of their knowledge hub). Read what the docs have in common, then return a short title.

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
  // Routed through the shared cost-first cascade — title suggestion
  // is a short text reply that the lite tier handles perfectly.
  const result = await callAI({
    prompt: `${system}\n\n${user}`,
    useLiteModel: true,
    temperature: 0.5,
    maxOutputTokens: 60,
  });
  if (!result.ok) {
    throw new Error(result.error || "AI call failed");
  }
  return result.text.trim().replace(/^["']|["']$/g, "").replace(/[.,;:!?]+$/, "");
}
