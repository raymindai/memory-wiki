// OpenAI browse runner — same shape as claude-browse: model receives
// URL + question, must call fetch_url tool to retrieve content, then
// answer. Uses OpenAI Chat Completions function calling.

const MODEL = process.env.MWBENCH_OPENAI_MODEL || "gpt-5.5";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MAX_TOOL_TURNS = 4;

const TOOL_SPEC = [
  {
    type: "function",
    function: {
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

export async function run({ query, url }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const messages = [
    {
      role: "system",
      content:
        "You answer the user's question using Memory.Wiki content fetched via the fetch_url tool. If the URL gives you a hub or bundle, you can follow links inside it to fetch specific docs you need.",
    },
    {
      role: "user",
      content: `A user pasted a Memory.Wiki URL into a chat with you and asked a question. Use the fetch_url tool to retrieve the URL, then answer.

URL: ${url}
Question: ${query.q}

Keep your answer under 200 words.`,
    },
  ];

  const t0 = Date.now();
  let totalIn = 0;
  let totalOut = 0;
  let toolCalls = 0;
  let answer = "";
  let lastError = null;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: TOOL_SPEC,
        max_completion_tokens: 2048,
      }),
    });
    if (!r.ok) {
      lastError = `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`;
      break;
    }
    const data = await r.json();
    totalIn += data.usage?.prompt_tokens || 0;
    totalOut += data.usage?.completion_tokens || 0;

    const msg = data.choices?.[0]?.message;
    if (!msg) {
      lastError = "no message in response";
      break;
    }

    const toolCallsArr = msg.tool_calls || [];
    if (toolCallsArr.length === 0) {
      answer = (msg.content || "").trim();
      break;
    }

    // Echo assistant message (with tool_calls) then tool results.
    messages.push(msg);
    for (const tc of toolCallsArr) {
      toolCalls++;
      const fn = tc.function?.name;
      let result;
      try {
        const args = JSON.parse(tc.function?.arguments || "{}");
        if (fn === "fetch_url") {
          result = await fetchUrl(args.url);
        } else {
          result = `Unknown tool: ${fn}`;
        }
      } catch (err) {
        result = `Tool call parse error: ${err.message}`;
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return {
    runner: "openai",
    query_id: query.id,
    answer,
    tokens_in: totalIn,
    tokens_out: totalOut,
    latency_ms: Date.now() - t0,
    tool_calls: toolCalls,
    error: lastError,
  };
}
