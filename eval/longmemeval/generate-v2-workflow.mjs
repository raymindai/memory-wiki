#!/usr/bin/env node
// v2 generator (sequential edition). Differences from earlier v2:
//   - All agent calls within a workflow run SEQUENTIALLY in N cycles.
//     Each cycle: compress -> answerRaw -> answerCompact -> gradeRaw
//     -> gradeCompact. Avoids the Anthropic TPM cap we hit when
//     parallel-ing N compress + N raw answer at 120K tokens each.
//   - Anti-memory-leak prefix on every agent prompt (treats parent
//     session as nonexistent; instruct against acknowledging it).
//   - Post-hoc filter: digests shorter than ~1k tokens or missing
//     any of the four required sections are flagged 'broken'; compact
//     condition skips those cycles.
//   - Plain-text VERDICT marker parsed for grading (schemas proved
//     unreliable in long-context Workflow contexts).
//
// Usage: node generate-v2-workflow.mjs <q.json> <out.ts> [N]
//        N defaults to 3.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inRel = process.argv[2];
const outRel = process.argv[3];
const N = parseInt(process.argv[4] || "3", 10);
if (!inRel || !outRel) {
  console.error("Usage: node generate-v2-workflow.mjs <q.json> <out.ts> [N]");
  process.exit(1);
}
const inPath = path.isAbsolute(inRel) ? inRel : path.join(__dirname, inRel);
const outPath = path.isAbsolute(outRel) ? outRel : path.join(__dirname, outRel);

const arr = JSON.parse(fs.readFileSync(inPath, "utf8"));
if (!Array.isArray(arr) || arr.length !== 1) {
  console.error("Input must be a JSON array with exactly one question.");
  process.exit(1);
}
const q = arr[0];
const qJSON = JSON.stringify(q);

const tpl = `export const meta = {
  name: 'longmemeval-v2-seq',
  description: 'v2 sequential — anti-memory-leak prefix + N independent cycles, run strictly serially to stay under TPM cap. Single LongMemEval-S question.',
  phases: [
    { title: 'Compress' },
    { title: 'Answer' },
    { title: 'Grade' },
  ],
}

const Q = ${qJSON};
const N = ${N};

const ISOLATION_PREAMBLE = \`You are a stateless evaluation subagent. The chat sessions provided below are the SOLE source of truth for this task. Treat any other information — project memory files, prior knowledge of named products or people, any 'system context' or 'user profile' — as nonexistent.

Critically: DO NOT mention, reference, or acknowledge entities, projects, or people that are not explicitly named within the chat sessions themselves. Do not include meta-commentary such as 'ignoring per instructions', 'from system context', 'IGNORED', or similar — such acknowledgments still corrupt the output. Simply act as if only the chat sessions exist.

\`

function buildHaystack(q) {
  const lines = []
  for (let i = 0; i < q.haystack_sessions.length; i++) {
    const date = (q.haystack_dates && q.haystack_dates[i]) || 'unknown date'
    lines.push(\`\\n=== Session \${i + 1} (\${date}) ===\`)
    for (const turn of q.haystack_sessions[i]) {
      const role = (turn.role || 'unknown').toUpperCase()
      lines.push(\`\${role}: \${turn.content || ''}\`)
    }
  }
  return lines.join('\\n')
}
function approxTokens(s) { return Math.round((s || '').length / 4) }

const RAW = buildHaystack(Q)
const RAW_TOKENS = approxTokens(RAW)
log(\`Q: \${Q.question}\`)
log(\`Type: \${Q.question_type} | Raw: ~\${RAW_TOKENS} tokens | N=\${N} | strictly sequential\`)

const compressPrompt = ISOLATION_PREAMBLE + \`Read the chat sessions below and emit a STRUCTURED COMPACT digest. Use exactly these four markdown sections in this order:

## Entities
(people, products, places, organizations mentioned by the user — each with one-line context)

## Facts
(atomic facts about the user: preferences, possessions, decisions, quantities, dates the user stated)

## Timeline
(dated events from the user's life in chronological order)

## Topics
(high-level themes the user discussed across sessions)

Aim for 2000-4000 tokens of digest. Be EXHAUSTIVE about specific facts and quantities — another AI will use ONLY this digest (not the raw sessions) to answer a question about the user.

CHAT SESSIONS:
\${RAW}

BEGIN DIGEST. Your output MUST start with the literal line "## Entities" and contain all four required sections. No preamble, no commentary.\`

function digestHealthy(d) {
  if (!d || typeof d !== 'string') return false
  if (d.length < 4000) return false
  return ['## Entities','## Facts','## Timeline','## Topics'].every((s) => d.includes(s))
}

const answerPromptBuilder = (label, context) =>
  ISOLATION_PREAMBLE + \`Below is what you know about a user. Answer the question using only this information. Be concise — one short sentence is best. If the context does not contain the answer, say so explicitly.

The question is being asked on: \${Q.question_date || 'unknown'}

CONTEXT (\${label}):
\${context}

QUESTION:
\${Q.question}

Answer:\`

const judgePromptBuilder = (candidate) =>
  ISOLATION_PREAMBLE + \`Grade an AI's answer against the gold answer for a memory-retrieval test.

QUESTION:
\${Q.question}

GOLD ANSWER:
\${Q.answer}

CANDIDATE ANSWER:
\${candidate || '<no answer>'}

Rules:
- Accept paraphrases and equivalent statements.
- correct = candidate conveys the same key fact / number / entity as gold.
- incorrect = candidate contradicts gold, fabricates a different fact, refuses incorrectly, or omits the key answer.
- For abstention gold (e.g. "the user did not mention"), candidate is correct only if it also acknowledges absence.

Output EXACTLY two lines, no preamble:
VERDICT: CORRECT
REASON: <one short sentence>

Replace CORRECT with INCORRECT if it fails the rules.\`

function parseVerdict(text) {
  const m = (text || '').match(/VERDICT:\\s*(CORRECT|INCORRECT)/i)
  const r = (text || '').match(/REASON:\\s*(.+)/i)
  return {
    correct: !!(m && m[1].toUpperCase() === 'CORRECT'),
    reason: r ? r[1].trim() : (text || '').trim().slice(0, 200),
  }
}

// ---- N sequential cycles. One agent call at a time. ----
const cycles = []
for (let i = 0; i < N; i++) {
  log(\`Cycle \${i + 1}/\${N}: compress\`)
  const digest = (await agent(compressPrompt, { label: \`compress:\${i}\`, phase: 'Compress' })) || ''
  const dHealthy = digestHealthy(digest)
  const dTokens = approxTokens(digest)

  log(\`Cycle \${i + 1}/\${N}: answer-raw\`)
  const rawAns = ((await agent(answerPromptBuilder('raw', RAW), { label: \`answer:raw:\${i}\`, phase: 'Answer' })) || '').trim()

  let compactAns = null
  if (dHealthy) {
    log(\`Cycle \${i + 1}/\${N}: answer-compact (digest ~\${dTokens} tok)\`)
    compactAns = ((await agent(answerPromptBuilder('compact', digest), { label: \`answer:compact:\${i}\`, phase: 'Answer' })) || '').trim()
  } else {
    log(\`Cycle \${i + 1}/\${N}: digest broken (\${dTokens} tok) — compact skipped\`)
  }

  log(\`Cycle \${i + 1}/\${N}: grade-raw\`)
  const rawGradeText = (await agent(judgePromptBuilder(rawAns), { label: \`grade:raw:\${i}\`, phase: 'Grade' })) || ''

  let compactGradeText = ''
  if (dHealthy) {
    log(\`Cycle \${i + 1}/\${N}: grade-compact\`)
    compactGradeText = (await agent(judgePromptBuilder(compactAns), { label: \`grade:compact:\${i}\`, phase: 'Grade' })) || ''
  }

  cycles.push({
    idx: i,
    digest_text: digest,
    digest_tokens: dTokens,
    digest_healthy: dHealthy,
    raw_candidate: rawAns,
    raw_grade: parseVerdict(rawGradeText),
    compact_candidate: compactAns,
    compact_grade: dHealthy ? parseVerdict(compactGradeText) : { correct: false, reason: 'digest broken; compact skipped' },
  })
}

const LEAK_MARKERS = ['memory.wiki', 'mdfy', 'mdcore', 'Hyunsang', 'Emdy', 'Karpathy', 'claude.ai', 'CLAUDE.md', 'MEMORY.md']
function detectLeak(text) {
  const lc = (text || '').toLowerCase()
  const hits = LEAK_MARKERS.filter((m) => lc.includes(m.toLowerCase()))
  return { leaked: hits.length > 0, markers: hits }
}
const digestLeaks = cycles.map((c) => ({ idx: c.idx, ...detectLeak(c.digest_text) }))
const anyLeak = digestLeaks.some((l) => l.leaked)

function aggregate(grades) {
  const valid = grades.filter(Boolean)
  const n = valid.length
  const correct = valid.filter((g) => g.correct).length
  const mean = n > 0 ? correct / n : 0
  const stddev = n > 0 ? Math.sqrt(mean * (1 - mean) / n) : 0
  return { n, correct, mean, stddev }
}
const rawGradesArr = cycles.map((c) => ({ idx: c.idx, candidate: c.raw_candidate, ...c.raw_grade }))
const compactGradesArr = cycles.filter((c) => c.digest_healthy).map((c) => ({ idx: c.idx, digest_tokens: c.digest_tokens, candidate: c.compact_candidate, ...c.compact_grade }))

const aggRaw = aggregate(rawGradesArr)
const aggCompact = aggregate(compactGradesArr)

const summary = {
  bench: 'LongMemEval-S',
  mode: 'raw-vs-compact-v2-seq',
  question_id: Q.question_id,
  question_type: Q.question_type,
  question: Q.question,
  gold: Q.answer,
  raw_tokens: RAW_TOKENS,
  N,
  compress: {
    attempted: N,
    healthy: cycles.filter((c) => c.digest_healthy).length,
    broken: cycles.filter((c) => !c.digest_healthy).length,
    digest_tokens: cycles.map((c) => c.digest_tokens),
    leak: { any: anyLeak, per_digest: digestLeaks },
  },
  raw: aggRaw,
  compact: aggCompact,
  raw_grades: rawGradesArr,
  compact_grades: compactGradesArr,
  sample_digest: cycles[0]?.digest_text?.slice(0, 1500) ?? null,
}

log(\`Result \${Q.question_id} (\${Q.question_type}):\`)
log(\`  RAW     \${aggRaw.correct}/\${aggRaw.n} = \${(aggRaw.mean*100).toFixed(0)}% ± \${(aggRaw.stddev*100).toFixed(0)}%\`)
log(\`  COMPACT \${aggCompact.correct}/\${aggCompact.n} = \${(aggCompact.mean*100).toFixed(0)}% ± \${(aggCompact.stddev*100).toFixed(0)}%\`)
log(\`  Leak    \${anyLeak ? 'LEAKED' : 'clean'}\`)

return summary
`;

fs.writeFileSync(outPath, tpl);
const bytes = fs.statSync(outPath).size;
console.error(`[gen-v2-seq] wrote ${(bytes / 1024).toFixed(1)} KB → ${outPath}`);
if (bytes > 524_000) {
  console.error(`[gen-v2-seq] WARNING: ${bytes} > Workflow cap 524288.`);
}
