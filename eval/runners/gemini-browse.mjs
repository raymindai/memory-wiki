// Gemini browse runner — same shape as claude/openai-browse: model
// receives URL + question, must call fetch_url tool. Uses Gemini
// generateContent + functionDeclarations.

const MODEL = process.env.MWBENCH_GEMINI_MODEL || "gemini-3.5-flash";
const MAX_TOOL_TURNS = 4;
const MAX_RETRIES = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOOL_SPEC = [
  {
    functionDeclarations: [
      {
        name: "fetch_url",
        description:
          "Fetch the markdown content at the given URL. Use this for any Memory.Wiki URL the user gives you, and for any related URL you discover in the fetched content.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Absolute URL to fetch" },
          },
          required: ["url"],
        },
      },
    ],
  },
];

async function fetchUrl(url) {
  try {
    const r = await fetch(url, { headers: { Accept: "text/markdown" } });
    if (!r.ok) return `HTTP ${r.status} fetching ${url}`;
    const t = await r.text();
    return t.length > 200_000 ? t.slice(0, 200_000) + "\n\n[...truncated]" : t;
  } catch (err) {
    return `FETCH ERROR: ${err.message}`;
  }
}

async function callGemini(endpoint, body) {
  let attempt = 0;
  let r;
  while (true) {
    r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r;
    if (attempt >= MAX_RETRIES) return r;
    if (r.status !== 429 && r.status < 500) return r;
    attempt++;
    await sleep(13_000 + Math.floor(Math.random() * 2_000));
  }
}

export async function run({ query, url }) {
  const key = process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `A user pasted a Memory.Wiki URL into a chat with you and asked a question. Use the fetch_url tool to retrieve the URL, then answer.

URL: ${url}
Question: ${query.q}

Keep your answer under 200 words.`,
        },
      ],
    },
  ];

  const t0 = Date.now();
  let totalIn = 0;
  let totalOut = 0;
  let toolCalls = 0;
  let answer = "";
  let lastError = null;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const body = {
      systemInstruction: {
        parts: [
          {
            text: "You answer the user's question using Memory.Wiki content fetched via the fetch_url tool. If the URL gives you a hub or bundle, you can follow links inside it to fetch specific docs you need.",
          },
        ],
      },
      contents,
      tools: TOOL_SPEC,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 1024 },
      },
    };
    const r = await callGemini(endpoint, body);
    if (!r.ok) {
      lastError = `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`;
      break;
    }
    const data = await r.json();
    totalIn += data.usageMetadata?.promptTokenCount || 0;
    totalOut += data.usageMetadata?.candidatesTokenCount || 0;

    const cand = data.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const fnCalls = parts.filter((p) => p.functionCall);
    const textParts = parts.filter((p) => p.text);

    if (fnCalls.length === 0) {
      answer = textParts.map((p) => p.text || "").join("").trim();
      break;
    }

    // Append model's response, then function-response messages.
    contents.push({ role: "model", parts });
    const responseParts = [];
    for (const p of fnCalls) {
      const fc = p.functionCall;
      toolCalls++;
      let result;
      if (fc.name === "fetch_url") {
        result = await fetchUrl(fc.args?.url || "");
      } else {
        result = `Unknown tool: ${fc.name}`;
      }
      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: { content: result },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    runner: "gemini",
    query_id: query.id,
    answer,
    tokens_in: totalIn,
    tokens_out: totalOut,
    latency_ms: Date.now() - t0,
    tool_calls: toolCalls,
    error: lastError,
  };
}
