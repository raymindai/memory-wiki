#!/usr/bin/env node
// compare.mjs — diff two bench result files. Shows accuracy and consistency
// deltas per mode, and lists queries that flipped (improved or regressed).
//
// Usage:
//   node eval/compare.mjs <baseline.json> <candidate.json>

import fs from "node:fs";

function load(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function indexJudgments(bench) {
  const idx = new Map();
  for (const j of bench.judgments) {
    const key = `${j.query_id}|${j.runner}|${j.mode || "full"}`;
    idx.set(key, j);
  }
  return idx;
}

function modeStats(bench, mode) {
  const js = bench.judgments.filter((j) => (j.mode || "full") === mode);
  const runners = [...new Set(js.map((j) => j.runner))];
  const queries = bench.queries;
  const acc = {};
  for (const r of runners) {
    const arr = js.filter((j) => j.runner === r);
    acc[r] = arr.length ? arr.filter((j) => j.accurate).length / arr.length : 0;
  }
  let allOK = 0;
  for (const q of queries) {
    const arr = js.filter((j) => j.query_id === q.id);
    if (arr.length === runners.length && arr.every((j) => j.accurate)) allOK++;
  }
  const consistency = queries.length ? allOK / queries.length : 0;
  return { runners, acc, consistency };
}

function main() {
  const [, , baseFile, candFile] = process.argv;
  if (!baseFile || !candFile) {
    console.error("Usage: compare.mjs <baseline.json> <candidate.json>");
    process.exit(1);
  }
  const base = load(baseFile);
  const cand = load(candFile);

  const baseIdx = indexJudgments(base);
  const candIdx = indexJudgments(cand);

  const modes = cand.modes || ["full"];
  console.log(`Comparing ${baseFile.split("/").pop()} → ${candFile.split("/").pop()}`);
  console.log(`Modes: ${modes.join(", ")}, queries: ${cand.queries.length}`);

  for (const mode of modes) {
    const b = modeStats(base, mode);
    const c = modeStats(cand, mode);
    console.log(`\n[${mode}]`);
    for (const r of c.runners) {
      const bv = b.acc[r] != null ? (b.acc[r] * 100).toFixed(1) : "?";
      const cv = (c.acc[r] * 100).toFixed(1);
      const d = b.acc[r] != null ? `(Δ ${(c.acc[r] * 100 - b.acc[r] * 100).toFixed(1)}pp)` : "";
      console.log(`  ${r.padEnd(8)} ${bv}% → ${cv}% ${d}`);
    }
    const bc = (b.consistency * 100).toFixed(1);
    const cc = (c.consistency * 100).toFixed(1);
    console.log(`  consistency  ${bc}% → ${cc}% (Δ ${(c.consistency * 100 - b.consistency * 100).toFixed(1)}pp)`);
  }

  console.log(`\nFlips:`);
  const runners = [...new Set(cand.judgments.map((j) => j.runner))];
  for (const mode of modes) {
    let impr = [], regr = [];
    for (const q of cand.queries) {
      for (const r of runners) {
        const k = `${q.id}|${r}|${mode}`;
        const bj = baseIdx.get(k), cj = candIdx.get(k);
        if (!bj || !cj) continue;
        if (!bj.accurate && cj.accurate) impr.push(`  [${mode}] ${q.id} ${r}: ✗→✓  ${q.q}`);
        if (bj.accurate && !cj.accurate) regr.push(`  [${mode}] ${q.id} ${r}: ✓→✗  ${q.q}  REASON: ${cj.reason}`);
      }
    }
    if (impr.length) {
      console.log(`\n  Improvements (${impr.length}):`);
      for (const line of impr) console.log(line);
    }
    if (regr.length) {
      console.log(`\n  Regressions (${regr.length}):`);
      for (const line of regr) console.log(line);
    }
  }
}

main();
