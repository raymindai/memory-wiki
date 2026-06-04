// LLM reranker for hub retrieval.
//
// First-pass retrieval (pgvector + hybrid RRF) gives us a top-K
// candidate set ordered by lexical / vector similarity. A
// cross-encoder rerank step closes the precision gap.
//
// Routes through the shared callAI cascade (lite tier — short JSON
// scoring task). Provider + model selection comes from the admin's
// site_config, same as every other AI surface.

import { callAI } from "@/lib/ai-providers";

interface CandidateInput {
  /** Stable id the caller cares about. We hand it back unchanged. */
  id: string | number;
  /** Text to score against the query. Trimmed/clipped here so a
   *  pathological 50KB chunk doesn't blow the prompt. */
  text: string;
}

export interface RerankedCandidate<T extends CandidateInput> {
  candidate: T;
  /** Higher = more relevant. 0..1 normalized. */
  score: number;
}

const PROMPT = `You score how well each passage answers a query.

Return ONLY a JSON array — no prose, no fences:
[{"id": "<id>", "score": <0..100>}, ...]

Higher score = better answer to the query. The passages may be
loosely related; reserve scores ≥80 for passages that directly
address the query, 40-79 for partial / supportive, ≤39 for tangential.`;

const MAX_TEXT_PER_CANDIDATE = 1500;
const MAX_CANDIDATES_PER_CALL = 30;

/**
 * Rerank `candidates` against `query` using an LLM cross-encoder.
 * Returns candidates sorted descending by score. When no provider
 * is configured (no ANTHROPIC_API_KEY) the input order is preserved
 * with `score: 0` so callers can treat the helper as a transparent
 * pass-through during local dev.
 *
 * Idempotent: call multiple times with the same inputs and you get
 * the same ordering (LLM determinism is approximate, but adequate
 * for top-N retrieval).
 */
export async function rerank<T extends CandidateInput>(
  query: string,
  candidates: T[],
  userId?: string,
): Promise<RerankedCandidate<T>[]> {
  if (candidates.length === 0) return [];

  // Cap the candidate set sent to the LLM. Above ~30 the prompt gets
  // big enough to hurt latency with diminishing precision gains;
  // first-pass retrieval already filtered to a reasonable top-K.
  const head = candidates.slice(0, MAX_CANDIDATES_PER_CALL);
  const tail = candidates.slice(MAX_CANDIDATES_PER_CALL);

  const corpus = head
    .map((c) => `--- id: ${c.id} ---\n${(c.text || "").slice(0, MAX_TEXT_PER_CANDIDATE)}`)
    .join("\n\n");

  const result = await callAI({
    prompt: `You return ONLY valid JSON matching the requested array shape. No prose, no fences.\n\n${PROMPT}\n\nQuery: ${query}\n\nPassages:\n${corpus}\n\nScores (JSON array):`,
    useLiteModel: true,
    temperature: 0.1,
    maxOutputTokens: 2048,
    userId,
    action: "rerank",
  });
  if (!result.ok) {
    console.warn("rerank: callAI failed", result.status, result.error);
    return candidates.map((c) => ({ candidate: c, score: 0 }));
  }
  const scores = parseScores(result.text);
  if (!scores) return candidates.map((c) => ({ candidate: c, score: 0 }));

  const scoreById = new Map<string, number>();
  for (const s of scores) {
    if (typeof s.id !== "undefined" && typeof s.score === "number") {
      scoreById.set(String(s.id), Math.max(0, Math.min(100, s.score)) / 100);
    }
  }

  const ranked = head
    .map((c) => ({ candidate: c, score: scoreById.get(String(c.id)) ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // Tail (anything beyond the rerank window) keeps its original
  // order at the bottom with score 0.
  for (const c of tail) ranked.push({ candidate: c, score: 0 });
  return ranked;
}

function parseScores(text: string): Array<{ id: unknown; score: unknown }> | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) s = fence[1].trim();
  const first = s.indexOf("[");
  const last = s.lastIndexOf("]");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return null;
    return parsed as Array<{ id: unknown; score: unknown }>;
  } catch {
    return null;
  }
}
