// LLM reranker for hub retrieval.
//
// First-pass retrieval (pgvector + hybrid RRF) gives us a top-K
// candidate set ordered by lexical / vector similarity. That's a
// strong recall signal but a weak precision signal — "X mentions
// the word in the query" doesn't mean "X is the best answer to the
// query." A cross-encoder rerank step closes the gap.
//
// We don't need a dedicated rerank API for v1: a single Anthropic
// Haiku call rates every candidate against the query and returns
// JSON scores. ~1s latency, ~$0.001 per call. The provider can be
// swapped later (Voyage / Cohere / BGE) by replacing this module's
// internals — callers see the same `rerank(query, candidates)`
// interface.

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
): Promise<RerankedCandidate<T>[]> {
  if (candidates.length === 0) return [];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return candidates.map((c) => ({ candidate: c, score: 0 }));

  // Cap the candidate set sent to the LLM. Above ~30 the prompt gets
  // big enough to hurt latency with diminishing precision gains;
  // first-pass retrieval already filtered to a reasonable top-K.
  const head = candidates.slice(0, MAX_CANDIDATES_PER_CALL);
  const tail = candidates.slice(MAX_CANDIDATES_PER_CALL);

  const corpus = head
    .map((c) => `--- id: ${c.id} ---\n${(c.text || "").slice(0, MAX_TEXT_PER_CANDIDATE)}`)
    .join("\n\n");

  let body;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
        system: "You return ONLY valid JSON matching the requested array shape. No prose, no fences.",
        messages: [{
          role: "user",
          content: `${PROMPT}\n\nQuery: ${query}\n\nPassages:\n${corpus}\n\nScores (JSON array):`,
        }],
      }),
    });
    if (!res.ok) {
      console.warn("rerank: Anthropic API error", res.status);
      return candidates.map((c) => ({ candidate: c, score: 0 }));
    }
    body = await res.json();
  } catch (err) {
    console.warn("rerank: fetch failed", err instanceof Error ? err.message : err);
    return candidates.map((c) => ({ candidate: c, score: 0 }));
  }

  const text: string = body?.content?.[0]?.text || "";
  const scores = parseScores(text);
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
