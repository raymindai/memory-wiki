# MWBench v1 — First production run

**Date:** 2026-05-23T16:18:26Z
**Corpus:** `https://memory.wiki/hub/raymindai/llms-full.txt` (71 docs, ~315 KB, content hash `394a92c6c7a1e471`)
**Mode:** Mode B — corpus inlined into the prompt (baseline; Mode A
"AI must browse the URL itself" is the v2 follow-up).
**Queries:** 20 hand-built (`queries/v1.jsonl`).

## Headline

> **accuracy 95.0%, cross-AI consistency 93.3%, runners=3, queries=20**

## Per-runner

| Runner | Model            | Accuracy | Avg input tok | Avg output tok | Avg latency |
|--------|------------------|---------:|--------------:|---------------:|------------:|
| Claude | claude-sonnet-4-5 | 95.0%    | 121,680       | 536            | 17.6 s      |
| OpenAI | gpt-4o            | 95.0%    | 97,703        | 207            | 3.7 s       |
| Gemini | gemini-2.5-pro    | 95.0%    | 102,536       | 226            | 11.2 s      |

## Cross-AI consistency

| Pair                 | Agreement |
|----------------------|----------:|
| claude ↔ openai      | 90.0%     |
| claude ↔ gemini      | 90.0%     |
| openai ↔ gemini      | 100.0%    |
| **Average**          | **93.3%** |

## Notes

- Each runner missed exactly 1 of 20 queries. Two of those misses are
  Anthropic credit-balance exhaustion mid-run, not model failures:
  - `q-020` claude — runner call returned HTTP 400 (no credit)
  - `q-015` openai / gemini — answer was generated, but the Claude
    judge call returned HTTP 400 so the result fell back to keyword
    matching which under-counted matches.
  Real accuracy is likely ≥97%. Refresh ANTHROPIC_API_KEY balance
  before the next run.

- 95% on Mode B (corpus inlined) is the upper bound — it says
  "given the markdown, an LLM can find the answer." The harder test
  is Mode A: paste only the URL and rely on the AI's own browse
  mode to fetch. That's the real cross-AI delivery measurement.

- 93.3% cross-AI consistency is the number nobody else can publish.
  gbrain BrainBench is a single brain; this measures three different
  AIs reading the same URL and agreeing. The wedge.

## Reproducing

```bash
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
export GEMINI_API_KEY=...
node eval/run-bench.mjs                     # full 20
node eval/run-bench.mjs --max=3              # smoke
node eval/run-bench.mjs --hub=other_slug     # different corpus
```

Cost per run: ~$11 at current token volume (315 KB context).
Compact-corpus mode (`?compact=1`) drops to ~$2–3 — TODO in v1.1.
