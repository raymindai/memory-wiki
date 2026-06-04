import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { callAI } from "@/lib/ai-providers";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/user/concepts/[id]/define
 *
 * Body: { label, occurrences: [{docTitle, snippet, chunkType}, ...] }
 *
 * The client passes the concept's label + every occurrence snippet it has,
 * and we ask the AI to synthesize a single-paragraph "canonical definition"
 * — what does THIS concept mean *in this user's library*, given how it's
 * used across the docs that mention it. Caller-supplied input keeps this
 * endpoint stateless (no per-user concept table needed); the client caches
 * results in localStorage.
 *
 * The route is auth-gated (any signed-in or anonymous-id user) but doesn't
 * need to look up docs server-side, since the client already has the
 * occurrences from /api/user/concepts.
 */

const PROMPT = `You are writing a one-paragraph canonical definition of a concept based on how it appears in a single user's knowledge library.

You will be given:
- The concept's name
- A list of excerpts from documents in their library where this concept appears (each with its source doc title and chunk type)

Synthesize what THIS concept means *in this user's specific context* — not a generic dictionary entry. Capture:
- The user's working definition (how they use the term)
- The frame they're operating in (technical / strategic / personal / etc.)
- Any tensions or evolution visible across occurrences

Output ONLY the paragraph as plain markdown. No headings, no lists, no preamble. 60-120 words. Conversational but precise. Do not cite docs by name in the output (the UI shows citations separately).`;

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || req.headers.get("x-user-id");
  const anonymousId = req.headers.get("x-anonymous-id");
  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string; occurrences?: Array<{ docTitle?: string; snippet?: string; chunkType?: string }> };
  try { body = await req.json(); } catch { body = {}; }
  const label = body.label?.trim();
  const occurrences = Array.isArray(body.occurrences) ? body.occurrences : [];
  if (!label || occurrences.length === 0) {
    return NextResponse.json({ error: "label + occurrences required" }, { status: 400 });
  }

  // Light input cap — most concepts have <30 occurrences and we want the AI
  // call to stay fast. Take top 12 (longest snippets first to maximize signal).
  const ranked = [...occurrences]
    .filter(o => o.snippet && o.snippet.trim())
    .sort((a, b) => (b.snippet?.length || 0) - (a.snippet?.length || 0))
    .slice(0, 12);

  void id; // concept id is supplied for telemetry / future caching, not needed for the call

  const prompt = `${PROMPT}\n\nConcept name: "${label}"\n\nOccurrences:\n${
    ranked.map((o, i) =>
      `${i + 1}. [${o.chunkType || "concept"}] from "${o.docTitle || "Untitled"}":\n   ${(o.snippet || "").slice(0, 360)}`
    ).join("\n\n")
  }`;

  try {
    const result = await callAI({
      prompt,
      useLiteModel: true,
      temperature: 0.3,
      maxOutputTokens: 512,
      userId: userId || undefined,
      anonymousId: anonymousId || undefined,
      action: "concept-define",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "AI define failed" }, { status: result.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ definition: result.text.trim() });
  } catch (err) {
    console.error("Concept define AI error:", err);
    return NextResponse.json({ error: "AI define failed" }, { status: 500 });
  }
}
