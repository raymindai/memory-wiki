#!/usr/bin/env node
// Generate a self-contained workflow script with the dataset embedded
// as a `const DATASET = ...`. Lets us run via Workflow({scriptPath})
// instead of passing huge args (which hits Read/tool input limits).
//
// Usage: node generate-workflow.mjs <sample.json> <out.ts>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inRel = process.argv[2] || "data/sample-1.json";
const outRel = process.argv[3] || `generated-${Date.now()}.workflow.ts`;
const inPath = path.isAbsolute(inRel) ? inRel : path.join(__dirname, inRel);
const outPath = path.isAbsolute(outRel) ? outRel : path.join(__dirname, outRel);

const dataset = JSON.parse(fs.readFileSync(inPath, "utf8"));
const datasetJSON = JSON.stringify(dataset);

const tpl = `export const meta = {
  name: 'longmemeval-s',
  description: 'LongMemEval-S baseline run (raw haystack -> AI answer -> AI grade).',
  phases: [
    { title: 'Answer' },
    { title: 'Grade' },
  ],
}

const DATASET = ${datasetJSON};

const ANSWER_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
  additionalProperties: false,
}

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['correct', 'reason'],
  additionalProperties: false,
}

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

log(\`Running \${DATASET.length} question(s) on LongMemEval-S baseline.\`)

const results = await pipeline(
  DATASET,
  async (q) => {
    const haystack = buildHaystack(q)
    const prompt = \`Below is a long chat history between a user and an assistant, organised into dated sessions. Read it carefully, then answer the question using only information found in this history. Be concise: answer directly with no preamble.

The question is being asked on: \${q.question_date || 'unknown'}

CHAT HISTORY:
\${haystack}

QUESTION:
\${q.question}

Answer in one sentence. If the history does not contain the answer, say so explicitly.\`
    const ans = await agent(prompt, {
      label: \`answer:\${q.question_id}\`,
      phase: 'Answer',
      schema: ANSWER_SCHEMA,
    })
    return { q, candidate: ans?.answer ?? null }
  },
  async ({ q, candidate }) => {
    const judgePrompt = \`Grade an AI's answer against the gold answer for a memory-retrieval test.

QUESTION:
\${q.question}

GOLD ANSWER:
\${q.answer}

CANDIDATE ANSWER:
\${candidate ?? '<no answer>'}

Rules:
- Accept paraphrases and equivalent statements; the candidate need not match word for word.
- correct = true when the candidate conveys the same key fact / number / entity as the gold answer.
- correct = false when the candidate contradicts gold, fabricates a different fact, refuses incorrectly, or omits the key answer.
- For abstention gold (e.g. "the user did not mention this"), the candidate is correct only if it also acknowledges absence.

Output JSON.\`
    const grade = await agent(judgePrompt, {
      label: \`grade:\${q.question_id}\`,
      phase: 'Grade',
      schema: GRADE_SCHEMA,
    })
    return {
      question_id: q.question_id,
      question_type: q.question_type,
      question: q.question,
      gold: q.answer,
      candidate,
      correct: !!grade?.correct,
      reason: grade?.reason ?? '',
    }
  },
)

const valid = results.filter(Boolean)
const byType = {}
for (const r of valid) {
  const t = r.question_type
  byType[t] ||= { total: 0, correct: 0 }
  byType[t].total++
  if (r.correct) byType[t].correct++
}

const overall_correct = valid.filter((r) => r.correct).length
const summary = {
  bench: 'LongMemEval-S',
  mode: 'baseline-raw-haystack',
  n_input: DATASET.length,
  n_valid: valid.length,
  overall: {
    total: valid.length,
    correct: overall_correct,
    accuracy: valid.length ? overall_correct / valid.length : 0,
  },
  by_type: Object.fromEntries(
    Object.entries(byType).map(([t, s]) => [
      t,
      { total: s.total, correct: s.correct, accuracy: s.total ? s.correct / s.total : 0 },
    ]),
  ),
  details: valid,
}

log(\`Overall: \${overall_correct}/\${valid.length} (\${(summary.overall.accuracy * 100).toFixed(1)}%)\`)
for (const [t, s] of Object.entries(summary.by_type)) {
  log(\`  \${t.padEnd(28)} \${s.correct}/\${s.total} (\${(s.accuracy * 100).toFixed(0)}%)\`)
}

return summary
`;

fs.writeFileSync(outPath, tpl);
const bytes = fs.statSync(outPath).size;
console.error(
  `[gen] wrote ${dataset.length} question(s), ${(bytes / 1024).toFixed(1)} KB → ${outPath}`,
);
if (bytes > 524_000) {
  console.error(
    `[gen] WARNING: script size ${bytes} > Workflow cap 524288. Reduce sample.`,
  );
}
