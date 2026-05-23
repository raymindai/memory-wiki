# MWBench — Memory.Wiki cross-AI benchmark

Measures how Memory.Wiki content is consumed by external AIs when you
paste a hub URL into a chat. Three numbers per run:

- **Accuracy** — does the AI answer the question correctly (LLM-judged)?
- **Cross-AI consistency** — do different AIs give the same answer for
  the same query + URL pair? Pairwise agreement rate.
- **Token economy** — input + output tokens per query, per AI.

Same wedge gbrain BrainBench can't measure: gbrain tests internal
retrieval; MWBench tests external delivery into agents.

## Corpus

`https://memory.wiki/hub/raymindai` — 71 public docs, 9 bundles. The
hub's `llms-full.txt` is fetched once and inlined into each AI call as
the "context the user pasted". Future modes will test true browse-mode
fetching (AI fetches the URL itself).

## Queries

`queries/v1.jsonl` — newline-delimited JSON. Each row:

```json
{
  "id": "q-001",
  "q": "What is Memory.Wiki's wedge?",
  "expected_doc": "<doc-id>",
  "expected_keywords": ["cross-AI", "URL", "paste"],
  "category": "single-doc"
}
```

Categories:

- `single-doc` — answer is in exactly one doc
- `cross-doc` — answer requires reading 2+ docs
- `backlink` — answer requires following an inline `memory.wiki/<id>` ref
- `synthesis` — open-ended summary across the hub

## Runners

`runners/{claude,openai,gemini}.ts` — each exports a `run(query, context)
→ { answer, tokensIn, tokensOut, latencyMs }` function. Provider auth
via env: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

Models (defaults, override via env):
- Claude: `claude-sonnet-4-6`
- OpenAI: `gpt-5`
- Gemini: `gemini-2.5-pro`

## Judge

`judge.ts` — Claude Sonnet scores each answer against
`expected_keywords` (substring match) + an LLM-judged accuracy boolean.

## Run

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GEMINI_API_KEY=...
node --experimental-strip-types run-bench.ts        # runs all runners × all queries
node --experimental-strip-types agg.ts results/<timestamp>.json
```

Results dump to `results/<ISO date>.json`. The aggregator computes the
three numbers and prints a table.

## Cost

Estimate ~$0.05–0.20 per full run (20 queries × 3 AIs). Cheap enough
for nightly cron.
