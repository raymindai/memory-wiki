// Claude runner — calls Anthropic Messages API directly via fetch.
// Anthropic SDK isn't installed; raw HTTP keeps the eval tree dependency-free.

const MODEL = process.env.MWBENCH_CLAUDE_MODEL || "claude-opus-4-7";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

export async function run({ query, context }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const t0 = Date.now();
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      // temperature is deprecated for opus-4-7 / sonnet-4-6 reasoning
      // models — omit it and let the model's default sampling stand.
      system: [
        "You answer questions using ONLY the provided Memory.Wiki hub content.",
        "If the answer is not in the content, say so. Keep answers under 200 words.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Hub content:\n\n${context}` },
            { type: "text", text: `\n\nQuestion: ${query.q}` },
          ],
        },
      ],
    }),
  });
  const latency_ms = Date.now() - t0;

  if (!r.ok) {
    const txt = await r.text();
    return {
      runner: "claude",
      query_id: query.id,
      answer: "",
      tokens_in: 0,
      tokens_out: 0,
      latency_ms,
      error: `HTTP ${r.status}: ${txt.slice(0, 300)}`,
    };
  }

  const data = await r.json();
  const answer = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return {
    runner: "claude",
    query_id: query.id,
    answer,
    tokens_in: data.usage?.input_tokens ?? 0,
    tokens_out: data.usage?.output_tokens ?? 0,
    latency_ms,
    error: null,
  };
}
