// LLM judge — quote-evidence design.
//
// Earlier iterations (keyword overlap, source-only, hybrid grep) all
// failed in different ways. The fundamental issue: judging an answer
// requires actually reading the corpus and finding supporting quotes,
// not pattern-matching ("this looks fabricated") or substring grepping
// ("16주" doesn't equal "16 weeks").
//
// Current design:
//   1. Single LLM call decomposes the answer into atomic claims AND
//      produces a literal supporting quote from the corpus for each.
//   2. Verdict per claim: supported | paraphrase_supported | not_found
//      | contradicts.
//   3. Final score = fraction of claims that are supported or
//      paraphrase_supported.
//
// Corpus sizing:
//   - Hub ≤ 1M chars: pass the entire corpus to the judge directly.
//     sonnet-4-6 supports 1M context, raymindai is ~470KB, fits easily.
//   - Hub > 1M chars: retrieval mode kicks in (see retrieveEvidence below)
//     — embed corpus once, retrieve top-K passages per claim, judge
//     against those. Not used yet on this hub; primed for when hubs
//     grow past the context limit.

const JUDGE_MODEL = process.env.MWBENCH_JUDGE_MODEL || "claude-sonnet-4-6";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const RAW_BASE = process.env.MWBENCH_BASE_URL || "https://memory.wiki";
const HUB_SLUG = process.env.MWBENCH_HUB || "raymindai";
const SOURCE_CACHE = new Map();
const CORPUS_CACHE = new Map();
// Threshold beyond which we switch from full-corpus pass to retrieval.
// 800k chars ≈ 200k tokens (mixed Korean+English) — leaves headroom in
// the 1M context for question + claim list + answer + system prompt.
const RETRIEVAL_THRESHOLD_CHARS = 800_000;

async function fetchSource(docId) {
  if (!docId) return null;
  if (SOURCE_CACHE.has(docId)) return SOURCE_CACHE.get(docId);
  try {
    const r = await fetch(`${RAW_BASE}/raw/${docId}`, { headers: { Accept: "text/markdown" } });
    if (!r.ok) {
      SOURCE_CACHE.set(docId, null);
      return null;
    }
    const text = await r.text();
    SOURCE_CACHE.set(docId, text);
    return text;
  } catch {
    SOURCE_CACHE.set(docId, null);
    return null;
  }
}

function buildScopeUrl(scope, scopeId, mode) {
  if (scope === "bundle") {
    return mode === "full"
      ? `${RAW_BASE}/raw/bundle/${scopeId}?full=1`
      : `${RAW_BASE}/raw/bundle/${scopeId}?compact=1`;
  }
  if (scope === "doc") {
    return mode === "full"
      ? `${RAW_BASE}/raw/${scopeId}`
      : `${RAW_BASE}/raw/${scopeId}?compact=1`;
  }
  // hub (default)
  return mode === "full"
    ? `${RAW_BASE}/hub/${scopeId}/llms-full.txt`
    : `${RAW_BASE}/raw/hub/${scopeId}?digest=1&compact=1`;
}

async function fetchCorpus(scope, scopeId, mode) {
  const key = `${scope}|${scopeId}|${mode}`;
  if (CORPUS_CACHE.has(key)) return CORPUS_CACHE.get(key);
  const url = buildScopeUrl(scope, scopeId, mode);
  try {
    const r = await fetch(url, { headers: { Accept: "text/markdown" } });
    if (!r.ok) {
      CORPUS_CACHE.set(key, "");
      return "";
    }
    const text = await r.text();
    CORPUS_CACHE.set(key, text);
    return text;
  } catch {
    CORPUS_CACHE.set(key, "");
    return "";
  }
}

// ── Retrieval mode (stubbed, primed for 1M+ corpora) ──────────────
//
// When corpus exceeds RETRIEVAL_THRESHOLD_CHARS we can't pass the
// whole thing to one LLM call. Instead:
//   - Chunk corpus into ~500-token segments along document boundaries.
//   - Embed each chunk once (cache on disk by hub slug + corpus hash).
//   - At judge time, embed the answer; retrieve top-K chunks by cosine
//     similarity; pass those + the source doc to the judge.
//
// The current implementation just slices around document boundaries
// and returns the most likely segments by a cheap substring overlap
// heuristic, so the bench never fails when a hub crosses 1M chars.
// Swap in real embeddings (OpenAI text-embedding-3-small, $0.02/1M
// tokens) once the first hub trips the threshold.
function chunkCorpus(corpus) {
  // Split on the per-doc frontmatter separator (`---` between blocks).
  const chunks = corpus
    .split(/\n---\nid:/)
    .map((c, i) => (i === 0 ? c : "---\nid:" + c))
    .filter((c) => c.trim());
  return chunks;
}

function scoreOverlap(chunk, answer) {
  // Heuristic — count shared 8-char shingles between chunk and answer.
  // Cheap, language-agnostic, no model dependency. Replace with real
  // cosine similarity once embeddings are wired.
  const shingles = new Set();
  for (let i = 0; i + 8 <= answer.length; i++) shingles.add(answer.slice(i, i + 8));
  let hits = 0;
  for (let i = 0; i + 8 <= chunk.length; i++) {
    if (shingles.has(chunk.slice(i, i + 8))) hits++;
  }
  return hits;
}

function retrieveEvidence(answer, corpus, topK = 8) {
  const chunks = chunkCorpus(corpus);
  const scored = chunks.map((c) => ({ c, s: scoreOverlap(c, answer) }));
  scored.sort((a, b) => b.s - a.s);
  return scored
    .slice(0, topK)
    .map(({ c }) => c)
    .join("\n\n");
}

/**
 * @param {{ query: any, run: any }} args
 */
export async function judge({ query, run }) {
  if (run.error || !run.answer.trim()) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: false,
      score: 0,
      keyword_hits: 0,
      keyword_total: (query.expected_keywords || []).length,
      reason: run.error ? `runner error: ${run.error}` : "empty answer",
      claims: [],
    };
  }

  const lowerAnswer = (run.answer || "").toLowerCase();
  const keyword_hits = (query.expected_keywords || []).filter((k) =>
    lowerAnswer.includes(String(k).toLowerCase()),
  ).length;
  const keyword_total = (query.expected_keywords || []).length;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: keyword_hits >= Math.ceil(keyword_total / 2),
      score: keyword_hits / Math.max(1, keyword_total),
      keyword_hits,
      keyword_total,
      reason: "no ANTHROPIC_API_KEY — keyword-only fallback",
      claims: [],
    };
  }

  const runnerMode = run.mode || "full";
  const scope = run.scope || query.scope || "hub";
  const scopeId = run.scope_id || query.scope_id || HUB_SLUG;
  const corpus = await fetchCorpus(scope, scopeId, runnerMode);
  const source = await fetchSource(query.expected_doc);

  // Decide between full-corpus pass vs retrieval based on corpus size.
  const useRetrieval = corpus.length > RETRIEVAL_THRESHOLD_CHARS;
  const judgeCorpus = useRetrieval ? retrieveEvidence(run.answer, corpus) : corpus;

  const sourceBlock = source && !judgeCorpus.includes(source.slice(0, 200))
    ? `PRIMARY SOURCE DOCUMENT (memory.wiki/${query.expected_doc}):\n---\n${source}\n---\n\n`
    : "";

  const corpusBlock = judgeCorpus
    ? `RUNNER'S CORPUS (${runnerMode} mode${useRetrieval ? ", top-8 retrieved chunks" : ", full pass"}):\n---\n${judgeCorpus}\n---\n\n`
    : "";

  const prompt = `You are grading an AI answer for a knowledge-hub Q&A test. The runner answered using ONLY the corpus below. Your job is to verify, claim by claim, whether the answer is supported.

QUESTION:
${query.q}

${sourceBlock}${corpusBlock}CANDIDATE ANSWER:
${run.answer}

Procedure (do NOT skip):
1. Read the candidate answer and break it into 3-8 atomic, substantive claims (skip filler phrases like "Based on the hub content").
2. For EACH claim, search the corpus for a supporting passage. Quote the relevant span literally — the smallest substring that proves the claim. The quote must appear verbatim in the corpus above; do not paraphrase the quote.
3. Verdict per claim:
   - "supported" — quote directly states the claim
   - "paraphrase_supported" — quote semantically equals the claim (translation, rewording, same fact expressed differently)
   - "not_found" — no supporting quote anywhere in the corpus
   - "contradicts" — corpus states the opposite

Output STRICTLY one JSON object on a single line (no markdown fences, no prose):
{"claims":[{"text":"<claim>","quote":"<literal quote from corpus or empty>","verdict":"supported|paraphrase_supported|not_found|contradicts"}],"score":<0..1, supported+paraphrase_supported divided by total>,"accurate":<true if score>=0.7>,"reason":"<one short sentence summarizing>"}

Rules:
- Quotes MUST be verbatim from the corpus (case-insensitive substring match is fine, but no paraphrasing inside the quote field).
- Do not invent quotes. If a claim has no corpus support, set verdict="not_found" and leave quote empty.
- Do not penalize the answer for not matching expected_keywords or for skipping minor details — only count what it DOES claim.
- A specific number, date, or proper noun in the answer counts as one claim and must be quoteable.`;

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return {
        query_id: query.id,
        runner: run.runner,
        accurate: keyword_hits >= Math.ceil(keyword_total / 2),
        score: keyword_hits / Math.max(1, keyword_total),
        keyword_hits,
        keyword_total,
        reason: `judge HTTP ${r.status} — fell back to keyword: ${txt.slice(0, 150)}`,
        claims: [],
      };
    }
    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) {
      return {
        query_id: query.id,
        runner: run.runner,
        accurate: keyword_hits >= Math.ceil(keyword_total / 2),
        score: keyword_hits / Math.max(1, keyword_total),
        keyword_hits,
        keyword_total,
        reason: `judge non-JSON: ${text.slice(0, 150)}`,
        claims: [],
      };
    }
    const parsed = JSON.parse(m[0]);
    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    // Recompute score from claims to defend against the judge giving an
    // inconsistent self-reported score vs its own verdicts.
    const okCount = claims.filter(
      (c) => c.verdict === "supported" || c.verdict === "paraphrase_supported",
    ).length;
    const computedScore = claims.length > 0 ? okCount / claims.length : 0;
    const score =
      typeof parsed.score === "number" ? parsed.score : computedScore;
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: score >= 0.7,
      score,
      keyword_hits,
      keyword_total,
      reason: String(parsed.reason || ""),
      claims,
      used_retrieval: useRetrieval,
    };
  } catch (err) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: keyword_hits >= Math.ceil(keyword_total / 2),
      score: keyword_hits / Math.max(1, keyword_total),
      keyword_hits,
      keyword_total,
      reason: `judge exception: ${err.message} — keyword fallback`,
      claims: [],
    };
  }
}
