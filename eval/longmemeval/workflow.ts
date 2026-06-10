export const meta = {
  name: 'longmemeval-s',
  description: 'Run LongMemEval-S questions through Claude Code subagents (no API cost). Baseline = raw haystack passed verbatim, AI must retrieve and answer.',
  phases: [
    { title: 'Answer', detail: 'one subagent per question reads haystack and answers' },
    { title: 'Grade', detail: 'one subagent per (q, candidate) judges vs gold' },
  ],
}

const dataset = args?.dataset
if (!Array.isArray(dataset) || dataset.length === 0) {
  throw new Error('workflow args.dataset must be a non-empty array of LongMemEval questions')
}

log(`Running ${dataset.length} questions through baseline (raw haystack → AI answer).`)

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string', description: 'Direct concise answer to the question, using only the chat history.' },
  },
  required: ['answer'],
  additionalProperties: false,
}

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    correct: { type: 'boolean', description: 'true if candidate answer conveys the same key fact as gold (paraphrase OK).' },
    reason: { type: 'string', description: 'One short sentence explaining the verdict.' },
  },
  required: ['correct', 'reason'],
  additionalProperties: false,
}

function buildHaystack(q) {
  const lines = []
  for (let i = 0; i < q.haystack_sessions.length; i++) {
    const date = (q.haystack_dates && q.haystack_dates[i]) || 'unknown date'
    lines.push(`\n=== Session ${i + 1} (${date}) ===`)
    for (const turn of q.haystack_sessions[i]) {
      const role = (turn.role || 'unknown').toUpperCase()
      lines.push(`${role}: ${turn.content || ''}`)
    }
  }
  return lines.join('\n')
}

const results = await pipeline(
  dataset,
  async (q) => {
    const haystack = buildHaystack(q)
    const prompt = `Below is a long chat history between a user and an assistant, organised into dated sessions. Read it carefully, then answer the question using only information found in this history. Be concise: answer directly with no preamble.

The question is being asked on: ${q.question_date || 'unknown'}

CHAT HISTORY:
${haystack}

QUESTION:
${q.question}

Answer concisely (1 sentence is usually enough). If the history does not contain the answer, say so explicitly.`
    const ans = await agent(prompt, {
      label: `answer:${q.question_id}`,
      phase: 'Answer',
      schema: ANSWER_SCHEMA,
    })
    return { q, candidate: ans?.answer ?? null }
  },
  async ({ q, candidate }) => {
    const judgePrompt = `Grade an AI's answer against the gold answer for a memory-retrieval test.

QUESTION:
${q.question}

GOLD ANSWER:
${q.answer}

CANDIDATE ANSWER:
${candidate ?? '<no answer>'}

Rules:
- Accept paraphrases and equivalent statements. The candidate need not match word-for-word.
- correct = true when the candidate conveys the same key fact / number / entity as the gold answer.
- correct = false when the candidate contradicts gold, fabricates a different fact, refuses incorrectly, or omits the key answer.
- For "abstention" style gold answers (e.g. "the user did not mention this"), the candidate is correct only if it also acknowledges absence.

Output JSON.`
    const grade = await agent(judgePrompt, {
      label: `grade:${q.question_id}`,
      phase: 'Grade',
      schema: GRADE_SCHEMA,
    })
    return {
      question_id: q.question_id,
      question_type: q.question_type,
      question_date: q.question_date,
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
const overall = {
  total: valid.length,
  correct: overall_correct,
  accuracy: valid.length ? overall_correct / valid.length : 0,
}

const summary = {
  bench: 'LongMemEval-S',
  mode: 'baseline-raw-haystack',
  n_input: dataset.length,
  n_valid: valid.length,
  overall,
  by_type: Object.fromEntries(
    Object.entries(byType).map(([t, s]) => [
      t,
      { total: s.total, correct: s.correct, accuracy: s.total ? s.correct / s.total : 0 },
    ]),
  ),
  details: valid,
}

log(`Pilot done — overall accuracy: ${(overall.accuracy * 100).toFixed(1)}% (${overall.correct}/${overall.total})`)
for (const [t, s] of Object.entries(summary.by_type)) {
  log(`  ${t.padEnd(28)} ${s.correct}/${s.total} (${(s.accuracy * 100).toFixed(0)}%)`)
}

return summary
