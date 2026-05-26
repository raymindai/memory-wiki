#!/usr/bin/env node
// agg.mjs — three numbers per corpus mode:
//   A) accuracy        — % of judgments where accurate=true
//   B) consistency     — pairwise agreement on accuracy across runners
//   C) token economy   — avg input + output tokens per query, per runner
//
// Mode "full" vs "compact" let you read the accuracy/cost tradeoff
// directly off the table — typically compact costs ~30× less but
// loses some accuracy.

import fs from "node:fs";

function summarizeForMode(bench, mode) {
  const runs = bench.runs.filter((r) => (r.mode || "full") === mode);
  const judgments = bench.judgments.filter((j) => (j.mode || "full") === mode);
  const runners = [...new Set(runs.map((r) => r.runner))];
  const queries = bench.queries;

  const acc = {};
  for (const r of runners) {
    const js = judgments.filter((j) => j.runner === r);
    acc[r] = js.length ? js.filter((j) => j.accurate).length / js.length : 0;
  }

  const pair = {};
  for (let i = 0; i < runners.length; i++) {
    for (let j = i + 1; j < runners.length; j++) {
      const a = runners[i], b = runners[j];
      let m = 0, t = 0;
      for (const q of queries) {
        const ja = judgments.find((x) => x.runner === a && x.query_id === q.id);
        const jb = judgments.find((x) => x.runner === b && x.query_id === q.id);
        if (!ja || !jb) continue;
        t++;
        if (ja.accurate === jb.accurate) m++;
      }
      pair[`${a} ↔ ${b}`] = t ? m / t : 0;
    }
  }
  const avgConsistency =
    Object.values(pair).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(pair).length);

  const tokens = {};
  for (const r of runners) {
    const rs = runs.filter((x) => x.runner === r);
    const tIn = rs.reduce((s, x) => s + x.tokens_in, 0);
    const tOut = rs.reduce((s, x) => s + x.tokens_out, 0);
    const lat = rs.reduce((s, x) => s + x.latency_ms, 0);
    tokens[r] = {
      avg_in: rs.length ? Math.round(tIn / rs.length) : 0,
      avg_out: rs.length ? Math.round(tOut / rs.length) : 0,
      avg_latency_ms: rs.length ? Math.round(lat / rs.length) : 0,
    };
  }

  return { runners, acc, pair, avgConsistency, tokens, n: runs.length };
}

export function summarize(bench) {
  const modes = bench.modes || ["full"];

  console.log();
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${bench.bench} — ${bench.started_at}`);
  if (bench.corpora) {
    for (const [m, c] of Object.entries(bench.corpora)) {
      console.log(`║ ${m.padEnd(8)} corpus: ${c.chars} chars (hash ${c.hash})`);
    }
  } else {
    console.log(`║ Corpus: ${bench.corpus_url}`);
  }
  console.log(`║ Queries: ${bench.queries.length}, modes: ${modes.join(", ")}`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  const perMode = {};
  for (const mode of modes) perMode[mode] = summarizeForMode(bench, mode);

  // ── Accuracy table ──
  console.log();
  console.log(`Accuracy (per runner × mode)`);
  const runners = [...new Set(bench.runs.map((r) => r.runner))];
  console.log(`  runner    ${modes.map((m) => m.padStart(8)).join("  ")}`);
  for (const r of runners) {
    const cells = modes.map((m) => {
      const pct = (perMode[m].acc[r] * 100).toFixed(1) + "%";
      return pct.padStart(8);
    });
    console.log(`  ${r.padEnd(8)}  ${cells.join("  ")}`);
  }

  // ── Consistency ──
  console.log();
  console.log(`Cross-AI consistency (avg pairwise agreement)`);
  console.log(`  mode      avg`);
  for (const m of modes) {
    console.log(`  ${m.padEnd(8)}  ${(perMode[m].avgConsistency * 100).toFixed(1)}%`);
  }

  // ── Token economy ──
  console.log();
  console.log(`Token economy (avg per query)`);
  for (const m of modes) {
    console.log(`  [${m}]`);
    console.log(`    runner    in       out   latency`);
    for (const r of runners) {
      const t = perMode[m].tokens[r];
      console.log(
        `    ${r.padEnd(8)}  ${String(t.avg_in).padStart(6)}  ${String(t.avg_out).padStart(5)}  ${String(t.avg_latency_ms).padStart(6)}ms`,
      );
    }
  }

  // ── Mode tradeoff (full vs compact) ──
  if (modes.includes("full") && modes.includes("compact")) {
    console.log();
    console.log(`Accuracy/cost tradeoff (full → compact)`);
    for (const r of runners) {
      const dAcc = (perMode.full.acc[r] - perMode.compact.acc[r]) * 100;
      const fIn = perMode.full.tokens[r].avg_in;
      const cIn = perMode.compact.tokens[r].avg_in;
      const ratio = cIn > 0 ? (fIn / cIn).toFixed(1) : "?";
      console.log(
        `  ${r.padEnd(8)}  accuracy Δ ${dAcc >= 0 ? "+" : ""}${dAcc.toFixed(1)}pp  ·  full ${ratio}× more input tokens`,
      );
    }
  }

  // ── Headline ──
  console.log();
  console.log(`One-line headline:`);
  for (const m of modes) {
    const acc = (
      (Object.values(perMode[m].acc).reduce((s, v) => s + v, 0) / runners.length) *
      100
    ).toFixed(1);
    const cons = (perMode[m].avgConsistency * 100).toFixed(1);
    console.log(`  [${m}]  accuracy ${acc}%, consistency ${cons}%`);
  }
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
