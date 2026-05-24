// Gemini runner — calls generativelanguage.googleapis.com via fetch.

const MODEL = process.env.MWBENCH_GEMINI_MODEL || "gemini-3.5-flash";
// Free-tier preview models hit 5 RPM. The bench fires this runner in a
// tight loop; without spacing the last few queries 429. Auto-retry up to
// 2x with 13s backoff (12s aligns to 5 RPM, +1s jitter).
const MAX_RETRIES = 2;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function run({ query, context }) {
  // Prefer the secondary key (GEMINI_API_KEY_2) when set — primary
  // tier-1 is often quota-exhausted by earlier bench runs in the same
  // day, but the secondary key has fresh daily allowance.
  const key = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY (or _2) missing");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const body = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text: "You answer questions using ONLY the provided Memory.Wiki hub content. If the answer is not in the content, say so. Keep answers under 200 words.",
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `Hub content:\n\n${context}\n\nQuestion: ${query.q}` }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      // Gemini Pro burns budget on internal thinking tokens before
      // emitting user-visible text. 1024 max got fully consumed by
      // thoughts and returned empty answers. 8192 leaves headroom.
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });

  const t0 = Date.now();
  let attempt = 0;
  let r;
  while (true) {
    r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (r.ok) break;
    if (attempt >= MAX_RETRIES) break;
    // Retry only on rate limit (429) and transient server errors.
    if (r.status !== 429 && r.status < 500) break;
    attempt++;
    await sleep(13_000 + Math.floor(Math.random() * 2_000));
  }
  const latency_ms = Date.now() - t0;

  if (!r.ok) {
    const txt = await r.text();
    return {
      runner: "gemini",
      query_id: query.id,
      answer: "",
      tokens_in: 0,
      tokens_out: 0,
      latency_ms,
      error: `HTTP ${r.status}: ${txt.slice(0, 300)}`,
    };
  }

  const data = await r.json();
  const answer =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ?? "";
  return {
    runner: "gemini",
    query_id: query.id,
    answer,
    tokens_in: data.usageMetadata?.promptTokenCount ?? 0,
    tokens_out: data.usageMetadata?.candidatesTokenCount ?? 0,
    latency_ms,
    error: null,
  };
}
