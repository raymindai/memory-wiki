# LongMemEval-S pilot

memory.wiki internal eval against the LongMemEval-S benchmark
(arxiv 2410.10813). Compares two delivery strategies for the same
long chat history:

- **RAW**  — full haystack (~120K tokens) inlined verbatim
- **COMPACT** — a structured digest the compress agent produced from
  the same haystack (~3-7K tokens; ~20-40x compression)

Run via Claude Code Workflow on the user's subscription. No API spend.

## What lives where

```
.
├── HEADLINE.md                    one-page summary of the v3 result
├── data/
│   ├── longmemeval_s.json         265 MB dataset (500 questions)
│   │                              source: huggingface.co/datasets/xiaowu0162/longmemeval-cleaned
│   ├── per-q/                     one JSON per pilot question
│   ├── sample-1.json              smoke-test slice
│   └── sample-6.json              the 6 cherry-picked smallest-haystack questions
├── sample.mjs                     N-per-type sampler
├── generate-v2-workflow.mjs       v2 (sequential, anti-leak prefix, N independent cycles)
├── generate-v3-workflow.mjs       v3 (adds AssistantRecommendations, stricter isolation) — RECOMMENDED
├── generate-compression-workflow.mjs    one-shot raw vs compact (v1, kept for reference)
├── generate-workflow.mjs          baseline raw-only generator (v0)
├── generated/v3/                  current v3 workflow scripts (one per question)
└── results/
    ├── pilot-6-baseline.json      original 6-question raw-only baseline
    ├── pilot-compression-v1.json  v1 result (broken methodology, kept for context)
    ├── pilot-v2-final.json        v2 result
    └── pilot-v3-final.json        v3 result (canonical)
```

The v1 and v2 generated scripts were deleted on 2026-06-10 because
they're throwaway. v3 scripts remain because v3 is the canonical
methodology.

## How to run

```bash
# 1. Sample (already done — data/per-q/ exists)
node sample.mjs 1 data/sample-6.json   # one question per type, smallest haystack

# 2. Generate a workflow script for one question, N=3 cycles
node generate-v3-workflow.mjs data/per-q/q03-temporal-reasoning.json generated/v3/q3.workflow.ts 3

# 3. Run via Claude Code Workflow (subscription, $0)
#    From the main Claude Code session:
#    Workflow({ scriptPath: "<absolute path to q3.workflow.ts>" })
#    Wait for completion notification.
```

For more than ~2 workflows in parallel, the Anthropic TPM cap kicks
in. Use 1-2 at a time and the smoke completes in ~5 minutes per
workflow.

## v3 methodology, in 5 bullets

1. Each agent prompt is prefixed with an isolation block telling the
   subagent to ignore parent-session memory, prior knowledge of
   memory.wiki / Hyunsang / Karpathy / etc., and "system context"
   without acknowledging it. Without this, ~15% of digests leak
   parent-session entities. With it, ~11% still leak (Workflow
   subagent system prompt is sticky).
2. **N=3 independent runs per question per condition.** Each run does
   compress → raw-answer → compact-answer → grade-raw → grade-compact,
   sequentially within a workflow. Sequential cycles avoid the TPM cap
   we hit when bursting N=5 parallel compress calls.
3. Compress digest uses five sections: Entities, UserFacts,
   AssistantRecommendations, Timeline, Topics. The
   AssistantRecommendations section (added in v3) flips q5 snapper
   from 0/3 → 2/3 — the v2 prompt was user-fact-centric and lost
   answers that came from the assistant side.
4. Grade verdicts are plain text (`VERDICT: CORRECT` line parsed by
   regex). Workflow's schema enforcement is unreliable on long-context
   parallel calls.
5. Digest health filter: drop digests <1000 tokens or missing any of
   the five required sections.

## v3 result (n=18 per condition)

| Condition | Correct | Accuracy |
| --- | --- | --- |
| RAW | 7 / 18 | 38.9% |
| COMPACT | 11 / 18 | 61.1% |
| **Delta** | +4 | **+22.2 pp** |

See `HEADLINE.md` for the full breakdown, comparison to published
numbers, and what we proved vs. did not prove.

## Strategic note

Per [[strategy_pivot_2026_06]] (in user memory), we are NOT competing
on this leaderboard. The eval still matters as a methodology shake-out
and a portability-axis benchmark seed. The real competitive axis is
cross-AI portability + user ownership, which LongMemEval does not
measure.

## Next-session backlog (what to do next when resuming this eval)

Tier 1 (cheap, high value):
1. Switch from Workflow `agent()` to `claude -p` headless to zero out
   the ~11% memory leak. Same JSON, same N, no Workflow subagent
   system prompt.
2. Random sampling instead of smallest-per-type. Currently selection
   bias toward easy questions; fix requires args-passing or chunked
   workflow input.

Tier 2:
3. Full 500-question v3 run, target ~150M tokens, ~10 hr wall on
   subscription with TPM-respecting pacing.
4. Add Sonnet 4.6 runner alongside Opus 4.7 for cross-model parity.

Tier 3:
5. Digest schema sweep — which extra section flips the q0 painting
   case? (We hypothesized `## OwnershipAndValuation`; in 2026-06-10
   we shipped equivalent behavioral dimensions to production
   concept_index — see strategy_pivot memory.)
6. N=10 on borderline questions.

## Run timestamp

Last canonical run: 2026-06-10 v3 pilot. See
`results/pilot-v3-final.json` for the structured record.
