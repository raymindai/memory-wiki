// Claude browse runner — receives ONLY the URL + question, must call
// fetch_url tool to retrieve the markdown, then answer. Measures the
// real-world "user pastes a Memory.Wiki URL into Claude" scenario.
//
// Tool-use loop:
//   1. Send messages with `tools` declaration.
//   2. If response contains tool_use blocks → execute each → append
//      tool_result message → loop again.
//   3. If response is plain text → that's the answer.

const MODEL = process.env.MWBENCH_CLAUDE_MODEL || "claude-sonnet-4-6";
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MAX_TOOL_TURNS = 6;

const TOOL_SPEC = [
  {
    name: "fetch_url",
    description:
      "Fetch the markdown content at the given URL. Use this for any Memory.Wiki URL the user gives you, and for any related URL you discover in the fetched content (links to other docs, bundles, or hubs).",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute URL to fetch" },
      },
      required: ["url"],
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
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const messages = [
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
    // Last turn: drop tools so the model is forced to produce a final
    // text answer instead of issuing yet another tool_use that would
    // never get serviced. Without this, exhausting MAX_TOOL_TURNS
    // leaves us with no answer at all.
    const isLastTurn = turn === MAX_TOOL_TURNS - 1;
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: isLastTurn
          ? "You answer the user's question using the Memory.Wiki content already fetched in the conversation above. No more tool calls — produce the final answer now."
          : "You answer the user's question using Memory.Wiki content fetched via the fetch_url tool. If the URL gives you a hub or bundle, you can follow links inside it to fetch specific docs you need. Aim to answer in 2-3 fetches.",
        ...(isLastTurn ? {} : { tools: TOOL_SPEC }),
        messages,
      }),
    });
    if (!r.ok) {
      lastError = `HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`;
      break;
    }
    const data = await r.json();
    totalIn += data.usage?.input_tokens || 0;
    totalOut += data.usage?.output_tokens || 0;

    const blocks = data.content || [];
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    const textBlocks = blocks.filter((b) => b.type === "text");

    if (toolUses.length === 0) {
      // Pure text response — that's the final answer.
      answer = textBlocks.map((b) => b.text).join("\n").trim();
      break;
    }

    if (isLastTurn) {
      // Model tried to call a tool on the forced-final turn. Salvage any
      // accompanying text; otherwise leave answer empty.
      answer = textBlocks.map((b) => b.text).join("\n").trim();
      break;
    }

    // Echo assistant's tool_use blocks, then return tool_result blocks.
    messages.push({ role: "assistant", content: blocks });
    const toolResults = [];
    for (const tu of toolUses) {
      toolCalls++;
      if (tu.name === "fetch_url") {
        const result = await fetchUrl(tu.input.url);
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unknown tool: ${tu.name}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    runner: "claude",
    query_id: query.id,
    answer,
    tokens_in: totalIn,
    tokens_out: totalOut,
    latency_ms: Date.now() - t0,
    tool_calls: toolCalls,
    error: lastError,
  };
}
