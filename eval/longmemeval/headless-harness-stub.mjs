#!/usr/bin/env node
// B1 — claude -p headless harness for the LongMemEval eval.
//
// STATUS: STUB. Designed and partially scaffolded but NOT validated
// end-to-end. The intent is to replace the Workflow agent() path so
// the ~11% memory-leak floor (parent-session inheritance into Workflow
// subagents) goes to 0%. `claude -p` is a one-shot process; the system
// prompt of a Workflow subagent is not in scope, so the leak vector
// disappears.
//
// Usage (when complete):
//   node headless-harness-stub.mjs --questions=data/random-30.json --N=3 --out=results/headless-v1.json
//
// What's done:
//   - Process-level invocation skeleton
//   - Plain-text VERDICT parser reused from v3 generator
//   - Backoff + TPM pacer plumbed in from lib/backoff.mjs
//
// What's left:
//   - Real spawn() call to `claude -p`, model flag, system flag
//   - Concurrency control (process pool, default 2-3)
//   - Streamed stdout parsing
//   - Sanity check vs Workflow run on same questions to confirm
//     leak goes to 0% AND scores match within ±3pp
//
// Why a stub: full implementation is ~200 lines of process management
// + a few hours of validation. Worth dedicating its own session
// against the next-eval backlog (see README.md "Tier 1").

import { withBackoff, TPMPacer } from "./lib/backoff.mjs";
import fs from "node:fs";
import { spawn } from "node:child_process";

const pacer = new TPMPacer({ tpm: 200_000 });

async function claudeP(prompt, { model = "claude-opus-4-7", maxTokens = 4000 } = {}) {
  await pacer.reserve(Math.ceil(prompt.length / 4) + maxTokens);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["-p", "--output-format", "text", "--model", model],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    proc.stdout.on("data", (b) => (out += b.toString("utf8")));
    proc.stderr.on("data", (b) => (err += b.toString("utf8")));
    proc.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude -p exit ${code}: ${err.slice(0, 200)}`));
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function parseVerdict(text) {
  const m = (text || "").match(/VERDICT:\s*(CORRECT|INCORRECT)/i);
  const r = (text || "").match(/REASON:\s*(.+)/i);
  return {
    correct: !!(m && m[1].toUpperCase() === "CORRECT"),
    reason: r ? r[1].trim() : (text || "").trim().slice(0, 200),
  };
}

async function runOneCycle(q, isolationPreamble, compressPrompt, answerPrompt, judgePrompt) {
  const digest = await withBackoff(() => claudeP(isolationPreamble + compressPrompt));
  const rawAns = await withBackoff(() => claudeP(isolationPreamble + answerPrompt("raw", buildRaw(q))));
  const compactAns = await withBackoff(() => claudeP(isolationPreamble + answerPrompt("compact", digest)));
  const rawGrade = await withBackoff(() => claudeP(isolationPreamble + judgePrompt(rawAns)));
  const compactGrade = await withBackoff(() => claudeP(isolationPreamble + judgePrompt(compactAns)));
  return {
    digest_tokens: Math.round(digest.length / 4),
    raw_candidate: rawAns,
    raw_grade: parseVerdict(rawGrade),
    compact_candidate: compactAns,
    compact_grade: parseVerdict(compactGrade),
  };
}

function buildRaw(q) {
  const lines = [];
  for (let i = 0; i < q.haystack_sessions.length; i++) {
    const date = (q.haystack_dates && q.haystack_dates[i]) || "unknown date";
    lines.push(`\n=== Session ${i + 1} (${date}) ===`);
    for (const turn of q.haystack_sessions[i]) {
      const role = (turn.role || "unknown").toUpperCase();
      lines.push(`${role}: ${turn.content || ""}`);
    }
  }
  return lines.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("headless-harness-stub.mjs")) {
  console.error("[headless-harness-stub] STUB — see top of file. Not runnable end-to-end yet.");
  console.error("[headless-harness-stub] Will exit cleanly so it doesn't block other work.");
  process.exit(0);
}

export { claudeP, runOneCycle, parseVerdict };
