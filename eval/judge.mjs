// LLM judge — Claude scores each answer for accuracy vs the gold answer.
// Also runs a cheap substring check for expected_keywords.

const JUDGE_MODEL = process.env.MWBENCH_JUDGE_MODEL || "claude-sonnet-4-6";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

/**
 * @param {{ query: any, run: any, corpusForDocLookup: string }} args
 */
export async function judge({ query, run }) {
  const lowerAnswer = (run.answer || "").toLowerCase();
  const keyword_hits = (query.expected_keywords || []).filter((k) =>
    lowerAnswer.includes(String(k).toLowerCase()),
  ).length;
  const keyword_total = (query.expected_keywords || []).length;

  if (run.error || !run.answer.trim()) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: false,
      keyword_hits,
      keyword_total,
      reason: run.error ? `runner error: ${run.error}` : "empty answer",
    };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: keyword_hits >= Math.ceil(keyword_total / 2),
      keyword_hits,
      keyword_total,
      reason: "no ANTHROPIC_API_KEY — keyword-only judgment",
    };
  }

  const prompt = `You are grading an AI answer for a knowledge-hub Q&A test.

QUESTION:
${query.q}

EXPECTED DOCUMENT (in the hub): memory.wiki/${query.expected_doc}
EXPECTED KEYWORDS (any subset should appear in a correct answer): ${JSON.stringify(query.expected_keywords)}

CANDIDATE ANSWER:
${run.answer}

Reply STRICTLY as one JSON object:
{ "accurate": true|false, "reason": "<one short sentence>" }

"accurate" means: the candidate answer addresses the question with content that the expected document would supply. Hallucinated content that doesn't match the expected source is NOT accurate even if it sounds plausible.`;

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
        max_tokens: 200,
        // temperature deprecated for sonnet-4-6 — model default suffices.
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return {
        query_id: query.id,
        runner: run.runner,
        accurate: keyword_hits >= Math.ceil(keyword_total / 2),
        keyword_hits,
        keyword_total,
        reason: `judge HTTP ${r.status} — fell back to keyword: ${txt.slice(0, 150)}`,
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
        keyword_hits,
        keyword_total,
        reason: `judge non-JSON: ${text.slice(0, 150)}`,
      };
    }
    const parsed = JSON.parse(m[0]);
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: !!parsed.accurate,
      keyword_hits,
      keyword_total,
      reason: String(parsed.reason || ""),
    };
  } catch (err) {
    return {
      query_id: query.id,
      runner: run.runner,
      accurate: keyword_hits >= Math.ceil(keyword_total / 2),
      keyword_hits,
      keyword_total,
      reason: `judge exception: ${err.message} — fell back to keyword`,
    };
  }
}
