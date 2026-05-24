#!/usr/bin/env node
// rejudge.mjs — re-score an existing bench result with the current judge.mjs
// without re-running the LLM runners. Use after upgrading judge logic.
//
// Usage:
//   ANTHROPIC_API_KEY=... MWBENCH_BASE_URL=http://localhost:3002 \
//     node eval/rejudge.mjs eval/results/<file>.json [--out=eval/results/<file>.rejudged.json]

import { readFileSync, writeFileSync } from "fs";
import { judge } from "./judge.mjs";

function args(argv) {
  const out = { in: null, out: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--out=")) out.out = a.slice(6);
    else if (!a.startsWith("--")) out.in = a;
  }
  if (!out.in) {
    console.error("Usage: rejudge.mjs <result.json> [--out=<file.rejudged.json>]");
    process.exit(1);
  }
  if (!out.out) out.out = out.in.replace(/\.json$/, ".rejudged.json");
  return out;
}

async function main() {
  const opts = args(process.argv);
  const data = JSON.parse(readFileSync(opts.in, "utf8"));
  const queriesById = {};
  for (const q of data.queries) queriesById[q.id] = q;

  console.log(`Re-judging ${data.runs.length} runs from ${opts.in}`);
  const newJudgments = [];
  let i = 0;
  for (const run of data.runs) {
    i++;
    const q = queriesById[run.query_id];
    if (!q) {
      console.warn(`  skip: no query ${run.query_id}`);
      continue;
    }
    // Mode is stored on the old judgment at the same index; preserve it.
    const oldJ = data.judgments[i - 1] || {};
    const mode = oldJ.mode || run.mode || "unknown";
    process.stdout.write(`  [${i}/${data.runs.length}] ${run.query_id} ${run.runner} ${mode} ... `);
    const j = await judge({ query: q, run });
    j.mode = mode;
    newJudgments.push(j);
    const oldMark = oldJ.accurate ? "OK" : "XX";
    const newMark = j.accurate ? "OK" : "XX";
    const changed = oldMark === newMark ? "" : ` (${oldMark} → ${newMark})`;
    process.stdout.write(`${newMark}${changed}\n`);
  }

  const out = { ...data, judgments: newJudgments, rejudged_at: new Date().toISOString() };
  writeFileSync(opts.out, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${opts.out}`);

  // Quick aggregate
  const acc = {};
  for (const j of newJudgments) {
    const k = `${j.mode}|${j.runner}`;
    if (!acc[k]) acc[k] = { ok: 0, total: 0 };
    acc[k].total++;
    if (j.accurate) acc[k].ok++;
  }
  console.log("\nNew accuracy:");
  for (const k of Object.keys(acc).sort()) {
    const v = acc[k];
    console.log(`  ${k.padEnd(20)} ${v.ok}/${v.total} (${((v.ok / v.total) * 100).toFixed(1)}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
