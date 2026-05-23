#!/usr/bin/env node
// agg.mjs — three numbers from a single bench result file:
//   A) accuracy        — % of (query × runner) judgments where accurate=true
//   B) consistency     — pairwise (runner_i, runner_j) agreement rate on accuracy across queries
//   C) token economy   — avg input + output tokens per query, per runner
//
// Usage:
//   node eval/agg.mjs eval/results/<file>.json
//   (when imported from run-bench.mjs, summarize() prints the same table)

import fs from "node:fs";

export function summarize(bench) {
  const runners = [...new Set(bench.runs.map((r) => r.runner))];
  const queries = bench.queries;

  // ── A) accuracy per runner ──
  const accByRunner = {};
  for (const r of runners) {
    const judged = bench.judgments.filter((j) => j.runner === r);
    const hits = judged.filter((j) => j.accurate).length;
    accByRunner[r] = judged.length ? hits / judged.length : 0;
  }

  // ── B) cross-runner consistency ──
  // Definition: for each query, check whether all runners scored "accurate"
  // identically. Pairwise agreement = mean over pairs of (matches / total queries).
  const pairAgreement = {};
  for (let i = 0; i < runners.length; i++) {
    for (let j = i + 1; j < runners.length; j++) {
      const a = runners[i];
      const b = runners[j];
      let matches = 0;
      let total = 0;
      for (const q of queries) {
        const ja = bench.judgments.find((x) => x.runner === a && x.query_id === q.id);
        const jb = bench.judgments.find((x) => x.runner === b && x.query_id === q.id);
        if (!ja || !jb) continue;
        total++;
        if (ja.accurate === jb.accurate) matches++;
      }
      pairAgreement[`${a} ↔ ${b}`] = total ? matches / total : 0;
    }
  }
  const avgConsistency =
    Object.values(pairAgreement).reduce((s, v) => s + v, 0) /
    Math.max(1, Object.keys(pairAgreement).length);

  // ── C) tokens per runner ──
  const tokenByRunner = {};
  for (const r of runners) {
    const rs = bench.runs.filter((x) => x.runner === r);
    const tIn = rs.reduce((s, x) => s + x.tokens_in, 0);
    const tOut = rs.reduce((s, x) => s + x.tokens_out, 0);
    const lat = rs.reduce((s, x) => s + x.latency_ms, 0);
    tokenByRunner[r] = {
      avg_in: rs.length ? Math.round(tIn / rs.length) : 0,
      avg_out: rs.length ? Math.round(tOut / rs.length) : 0,
      avg_latency_ms: rs.length ? Math.round(lat / rs.length) : 0,
    };
  }

  console.log();
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${bench.bench} — ${bench.started_at}`);
  console.log(`║ Corpus: ${bench.corpus_url} (hash ${bench.corpus_hash})`);
  console.log(`║ Queries: ${queries.length}, runners: ${runners.join(", ")}`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log();
  console.log(`Accuracy (per runner)`);
  for (const r of runners) {
    const pct = (accByRunner[r] * 100).toFixed(1);
    console.log(`  ${r.padEnd(8)}  ${pct}%`);
  }
  console.log();
  console.log(`Cross-AI consistency (pairwise agreement on accuracy)`);
  for (const [pair, v] of Object.entries(pairAgreement)) {
    const pct = (v * 100).toFixed(1);
    console.log(`  ${pair.padEnd(22)}  ${pct}%`);
  }
  console.log(`  ${"average".padEnd(22)}  ${(avgConsistency * 100).toFixed(1)}%`);
  console.log();
  console.log(`Token economy (avg per query)`);
  console.log(`  runner    in     out    latency`);
  for (const r of runners) {
    const t = tokenByRunner[r];
    console.log(
      `  ${r.padEnd(8)}  ${String(t.avg_in).padStart(6)}  ${String(t.avg_out).padStart(5)}  ${String(t.avg_latency_ms).padStart(6)}ms`,
    );
  }
  console.log();
  console.log(`One-line headline:`);
  const headlineAcc = (
    (Object.values(accByRunner).reduce((s, v) => s + v, 0) / Math.max(1, runners.length)) *
    100
  ).toFixed(1);
  console.log(
    `  MWBench v1: accuracy ${headlineAcc}%, cross-AI consistency ${(avgConsistency * 100).toFixed(1)}%, runners=${runners.length}, queries=${queries.length}`,
  );
  console.log();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node eval/agg.mjs <results file>");
    process.exit(1);
  }
  const bench = JSON.parse(fs.readFileSync(file, "utf8"));
  summarize(bench);
}
