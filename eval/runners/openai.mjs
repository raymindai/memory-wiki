// OpenAI runner — calls /v1/chat/completions via fetch.

const MODEL = process.env.MWBENCH_OPENAI_MODEL || "gpt-5.5";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export async function run({ query, context }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      // GPT-5.x reasoning family: uses `max_completion_tokens`, not
      // the legacy `max_tokens`. Temperature is also not supported on
      // these models — let the default sampling stand.
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You answer questions using ONLY the provided Memory.Wiki hub content. If the answer is not in the content, say so. Keep answers under 200 words.",
        },
        {
          role: "user",
          content: `Hub content:\n\n${context}\n\nQuestion: ${query.q}`,
        },
      ],
    }),
  });
  const latency_ms = Date.now() - t0;

  if (!r.ok) {
    const txt = await r.text();
    return {
      runner: "openai",
      query_id: query.id,
      answer: "",
      tokens_in: 0,
      tokens_out: 0,
      latency_ms,
      error: `HTTP ${r.status}: ${txt.slice(0, 300)}`,
    };
  }

  const data = await r.json();
  return {
    runner: "openai",
    query_id: query.id,
    answer: data.choices?.[0]?.message?.content ?? "",
    tokens_in: data.usage?.prompt_tokens ?? 0,
    tokens_out: data.usage?.completion_tokens ?? 0,
    latency_ms,
    error: null,
  };
}
