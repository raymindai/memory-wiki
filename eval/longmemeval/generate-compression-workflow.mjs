#!/usr/bin/env node
// Generate a per-question workflow that compares RAW haystack vs a
// mdfy-style COMPACT digest, on a single LongMemEval-S question.
// All agents return plain text (no schemas) — schemas proved unreliable
// for parallel long-context calls in Claude Code Workflow.
//
// Stages (sequential to avoid concurrency-related flakiness):
//   1. Compress: one agent reads raw haystack, emits compact digest
//   2. Answer:   two agents in parallel — one uses raw, one uses compact
//   3. Grade:    two agents in parallel — each judges its candidate vs gold
//
// Usage: node generate-compression-workflow.mjs <q.json> <out.ts>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inRel = process.argv[2];
const outRel = process.argv[3];
if (!inRel || !outRel) {
  console.error("Usage: node generate-compression-workflow.mjs <q.json> <out.ts>");
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
  name: 'longmemeval-compression',
  description: 'Compare RAW haystack vs mdfy-style COMPACT digest on a single LongMemEval-S question. All agents return plain text; verdicts parsed from a fixed marker line.',
  phases: [
    { title: 'Compress' },
    { title: 'Answer' },
    { title: 'Grade' },
  ],
}

const Q = ${qJSON};

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
log(\`Type: \${Q.question_type} | Raw: ~\${RAW_TOKENS} tokens\`)

// ---- Phase 1: Compress (sequential, single agent, plain text) ----
const compactPrompt = \`You are building a memory-system digest for an AI assistant. Read the chat sessions below carefully, then output a structured COMPACT digest of everything the user mentioned. Use these markdown sections in this order:

## Entities
(people, products, places, organizations the user mentioned, each with one-line context)

## Facts
(atomic facts about the user: preferences, possessions, decisions, quantities, dates the user stated)

## Timeline
(dated events from the user's life in chronological order)

## Topics
(high-level themes the user discussed across sessions)

Be EXHAUSTIVE about facts and quantities — another AI will use ONLY this digest (not the raw sessions) to answer a question about the user. If you omit a small detail, the AI will fail to answer. Aim for 2000-4000 tokens of digest. Do not include any preamble or commentary outside the four markdown sections.

CHAT SESSIONS:
\${RAW}\`

const compact = (await agent(compactPrompt, { label: 'compress:compact', phase: 'Compress' })) || ''
const COMPACT_TOKENS = approxTokens(compact)
log(\`Compact digest: ~\${COMPACT_TOKENS} tokens (\${(COMPACT_TOKENS / Math.max(1, RAW_TOKENS) * 100).toFixed(1)}% of raw)\`)

// ---- Phase 2: Answer (2 conditions, sequential to avoid parallel flakiness) ----
function answerPrompt(label, context) {
  return \`Below is what you know about a user. Answer the question using only this information. Be concise — one short sentence is best. If the context does not contain the answer, say so explicitly.

The question is being asked on: \${Q.question_date || 'unknown'}

CONTEXT (\${label}):
\${context}

QUESTION:
\${Q.question}

Answer:\`
}

const rawAns = ((await agent(answerPrompt('raw', RAW), { label: 'answer:raw', phase: 'Answer' })) || '').trim()
log(\`Raw answer:     \${rawAns.slice(0, 100)}\`)

const compactAns = ((await agent(answerPrompt('compact', compact), { label: 'answer:compact', phase: 'Answer' })) || '').trim()
log(\`Compact answer: \${compactAns.slice(0, 100)}\`)

// ---- Phase 3: Grade (sequential, plain-text verdicts parsed from VERDICT line) ----
function judgePrompt(candidate) {
  return \`Grade an AI's answer against the gold answer for a memory-retrieval test.

QUESTION:
\${Q.question}

GOLD ANSWER:
\${Q.answer}

CANDIDATE ANSWER:
\${candidate || '<no answer>'}

Rules:
- Accept paraphrases and equivalent statements.
- correct = the candidate conveys the same key fact / number / entity as gold.
- incorrect = candidate contradicts gold, fabricates a different fact, refuses incorrectly, or omits the key answer.
- For abstention gold (e.g. "the user did not mention"), candidate is correct only if it also acknowledges absence.

Output EXACTLY two lines, no preamble:
VERDICT: CORRECT
REASON: <one short sentence>

Replace CORRECT with INCORRECT if it fails the rules.\`
}

function parseVerdict(text) {
  const m = (text || '').match(/VERDICT:\\s*(CORRECT|INCORRECT)/i)
  const r = (text || '').match(/REASON:\\s*(.+)/i)
  return {
    correct: !!(m && m[1].toUpperCase() === 'CORRECT'),
    reason: r ? r[1].trim() : (text || '').trim().slice(0, 200),
    raw: (text || '').trim().slice(0, 400),
  }
}

const rawGradeText = (await agent(judgePrompt(rawAns), { label: 'grade:raw', phase: 'Grade' })) || ''
const compactGradeText = (await agent(judgePrompt(compactAns), { label: 'grade:compact', phase: 'Grade' })) || ''
const rawGrade = parseVerdict(rawGradeText)
const compactGrade = parseVerdict(compactGradeText)

const summary = {
  bench: 'LongMemEval-S',
  mode: 'raw-vs-compact',
  question_id: Q.question_id,
  question_type: Q.question_type,
  question: Q.question,
  gold: Q.answer,
  raw: {
    tokens: RAW_TOKENS,
    candidate: rawAns,
    correct: rawGrade.correct,
    reason: rawGrade.reason,
  },
  compact: {
    tokens: COMPACT_TOKENS,
    digest: compact.slice(0, 4000),
    candidate: compactAns,
    correct: compactGrade.correct,
    reason: compactGrade.reason,
  },
}

log(\`Result \${Q.question_id} (\${Q.question_type}):\`)
log(\`  RAW     \${summary.raw.correct ? '✓' : '✗'}  (~\${RAW_TOKENS} tokens)\`)
log(\`  COMPACT \${summary.compact.correct ? '✓' : '✗'}  (~\${COMPACT_TOKENS} tokens, \${(COMPACT_TOKENS / Math.max(1, RAW_TOKENS) * 100).toFixed(1)}% of raw)\`)

return summary
`;

fs.writeFileSync(outPath, tpl);
const bytes = fs.statSync(outPath).size;
console.error(`[gen-comp] wrote ${(bytes / 1024).toFixed(1)} KB → ${outPath}`);
if (bytes > 524_000) {
  console.error(`[gen-comp] WARNING: ${bytes} > Workflow cap 524288.`);
}
