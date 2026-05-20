import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { verifyAuthToken } from "@/lib/verify-auth";
import { embedText, prepareEmbeddingInput, vectorToSql } from "@/lib/embeddings";

/**
 * v6 — AI Bundle Generation.
 *
 * POST /api/bundles/ai-generate
 *
 * Body: {
 *   prompt: string;          natural-language request, e.g. "Acme 프로젝트
 *                            관련 답변들 묶어줘", "show my notes on LLM memory"
 *   limit?: number;          how many candidates to seed the AI with (def 12, max 25)
 *   userId?: string;         caller; resolved via JWT if absent
 *   anonymousId?: string;    fallback for non-logged-in users
 * }
 *
 * Flow:
 *   1. Embed the prompt and run match_documents_by_embedding scoped to
 *      the caller's hub (top-K candidates, K = limit).
 *   2. Hand the top candidates to an LLM with a strict JSON schema
 *      instruction: pick which belong, suggest a title + 1-line
 *      annotation per chosen doc.
 *   3. Return both the AI's pick AND the full candidate list so the
 *      client can show "AI suggested these — adjust if you want."
 *
 * Response: {
 *   suggestion: {
 *     title: string;
 *     description: string;     1-2 sentence summary of what this bundle is
 *     documents: Array<{ id; title; annotation }>;  AI's curated picks
 *   };
 *   candidates: Array<{ id; title; snippet; score }>;  full top-K, AI-ranked
 * }
 *
 * No bundle row is created here — the client confirms / edits, then POSTs
 * to /api/bundles to actually persist.
 */

const SYSTEM_PROMPT = `You are Memory.Wiki's bundle curator. The user asked you to assemble a "bundle" — a themed collection of their existing documents — from their personal knowledge hub.

You will receive:
- The user's natural-language request
- A ranked list of CANDIDATE documents (already pre-filtered by semantic similarity)

Your job:
1. Decide which candidates actually belong in the bundle. Be selective — exclude weakly-related docs even if they appeared in the candidates list.
2. Suggest a clear, concise title for the bundle (max 60 chars, no quotes).
3. Suggest a 1-2 sentence description (under 200 chars) explaining what this bundle is.
4. For each chosen document, write a single-line annotation (under 120 chars) explaining why it belongs.

Respond ONLY with valid JSON in this exact shape — no prose, no markdown fences:

{
  "title": "...",
  "description": "...",
  "documents": [
    { "id": "<docId>", "annotation": "..." }
  ]
}

Constraints:
- documents[].id MUST be one of the candidate IDs you were given.
- Order documents by relevance (most relevant first).
- If the candidates don't reasonably support the user's request, return an empty documents array AND a description that explains what's missing.
- Never invent document IDs.
- Keep annotations under 120 chars; trim aggressively.`;

interface CandidateRow {
  id: string;
  title: string | null;
  markdown: string | null;
  updated_at: string;
  source: string | null;
  distance: number;
}

interface AISuggestion {
  title: string;
  description: string;
  documents: Array<{ id: string; annotation: string }>;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  let body: { prompt?: string; limit?: number; userId?: string; anonymousId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Identify caller — bundle generation is user-scoped (uses their docs only).
  const verified = await verifyAuthToken(req.headers.get("authorization"));
  const userId = verified?.userId || body.userId || req.headers.get("x-user-id") || undefined;
  const anonymousId = body.anonymousId || req.headers.get("x-anonymous-id") || undefined;
  if (!userId && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "prompt too long (max 2000 chars)" }, { status: 400 });
  }
  const limit = Math.max(3, Math.min(25, body.limit ?? 12));

  // Step 1: embed prompt, find candidate documents.
  let queryVec: number[];
  try {
    queryVec = await embedText(prepareEmbeddingInput(null, prompt));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "embed failed";
    return NextResponse.json({ error: `embedding failed: ${msg}` }, { status: 500 });
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc("match_documents_by_embedding", {
    query_embedding: vectorToSql(queryVec),
    match_count: limit,
    p_user_id: userId ?? null,
    p_anonymous_id: anonymousId ?? null,
  });

  if (rpcErr) {
    return NextResponse.json({ error: `search failed: ${rpcErr.message}` }, { status: 500 });
  }

  const candidates: CandidateRow[] = (rpcData as CandidateRow[] | null) || [];

  if (candidates.length === 0) {
    // Empty hub or no embeddings yet — return graceful empty suggestion.
    return NextResponse.json({
      suggestion: {
        title: "No matching documents",
        description: "Your hub doesn't have any documents that match this prompt yet. Try a broader phrasing, or capture more docs first.",
        documents: [],
      },
      candidates: [],
    });
  }

  // Step 2: assemble candidate context for the AI.
  const candidateBlock = candidates.map((c, i) => {
    const title = c.title || "Untitled";
    const snippet = (c.markdown || "").slice(0, 800).replace(/\s+/g, " ").trim();
    return `[${i + 1}] id=${c.id} title="${title}"\n${snippet}`;
  }).join("\n\n");

  const userMessage = `USER REQUEST:\n${prompt}\n\nCANDIDATE DOCUMENTS (ranked by similarity, most-similar first):\n\n${candidateBlock}`;

  // Step 3: call the LLM. Prefer Anthropic for structured-output reliability;
  // fall back to OpenAI if not configured. Both are accessed through the
  // same HTTP shape so the response handling is uniform.
  let aiText = "";
  try {
    aiText = await callBundleCurator(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI call failed";
    return NextResponse.json({ error: `AI: ${msg}` }, { status: 502 });
  }

  // Step 4: parse the JSON response. The model is instructed to emit pure
  // JSON; defensive parsing handles the case where it slipped a fence.
  const suggestion = parseSuggestion(aiText, candidates);

  return NextResponse.json({
    suggestion,
    candidates: candidates.map(c => ({
      id: c.id,
      title: c.title || "Untitled",
      snippet: (c.markdown || "").slice(0, 240),
      score: typeof c.distance === "number" ? 1 - c.distance : null,
    })),
  });
}

async function callBundleCurator(system: string, user: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${text || "unknown"}`);
    }
    const data = await res.json();
    type Block = { type: string; text?: string };
    const blocks: Block[] = data.content || [];
    return blocks.filter(b => b.type === "text").map(b => b.text || "").join("");
  }

  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${text || "unknown"}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (process.env.GEMINI_API_KEY) {
    // Gemini fallback. responseMimeType + responseSchema enforces
    // structured JSON without relying on the model to obey "no fences"
    // in the system prompt. Schema mirrors the {title,description,
    // documents:[{id,annotation}]} shape parseSuggestion expects.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              documents: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    annotation: { type: "string" },
                  },
                  required: ["id"],
                },
              },
            },
            required: ["title", "description", "documents"],
          },
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${text || "unknown"}`);
    }
    const data = await res.json();
    type Part = { text?: string };
    const parts: Part[] = data.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p.text || "").join("");
  }

  throw new Error("No AI provider configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY)");
}

function parseSuggestion(text: string, candidates: CandidateRow[]): AISuggestion {
  // Strip code fences if the model wrapped its output despite the
  // instruction.
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    // Model didn't comply with the JSON-only contract. Salvage what we
    // can — return an empty bundle with the raw text as description so
    // the client can surface the issue.
    return {
      title: "Bundle suggestion",
      description: "AI returned an unparseable response. Adjust your prompt and try again.",
      documents: [],
    };
  }

  const candidateIds = new Set(candidates.map(c => c.id));

  const obj = parsed as { title?: unknown; description?: unknown; documents?: unknown };
  const title = typeof obj.title === "string" ? obj.title.slice(0, 80) : "Bundle";
  const description = typeof obj.description === "string" ? obj.description.slice(0, 280) : "";

  const rawDocs = Array.isArray(obj.documents) ? obj.documents : [];
  const documents: AISuggestion["documents"] = [];
  const seen = new Set<string>();
  for (const d of rawDocs) {
    if (!d || typeof d !== "object") continue;
    const dr = d as { id?: unknown; annotation?: unknown };
    if (typeof dr.id !== "string") continue;
    // Reject IDs the model invented — must match a real candidate.
    if (!candidateIds.has(dr.id)) continue;
    if (seen.has(dr.id)) continue;
    seen.add(dr.id);
    documents.push({
      id: dr.id,
      annotation: typeof dr.annotation === "string" ? dr.annotation.slice(0, 160) : "",
    });
  }

  return { title, description, documents };
}
