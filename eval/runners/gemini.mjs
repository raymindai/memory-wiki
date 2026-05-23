// Gemini runner — calls generativelanguage.googleapis.com via fetch.

const MODEL = process.env.MWBENCH_GEMINI_MODEL || "gemini-2.5-pro";

export async function run({ query, context }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const t0 = Date.now();
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
        maxOutputTokens: 1024,
      },
    }),
  });
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
