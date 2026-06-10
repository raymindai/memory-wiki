#!/usr/bin/env node
// Random sampler — N questions per type, uniformly sampled (vs
// sample.mjs which always picks the smallest haystack per type).
// Use this for unbiased per-question runs; sample.mjs stays for
// reproducible smoke tests / script-cap-friendly slices.
//
// Determinism: seedable PRNG so the same --seed gives the same sample
// every time across machines. Default seed = 42.
//
// Usage:
//   node sample-random.mjs <N_per_type> <out_filename> [--seed=42]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const nPerType = parseInt(args[0] || "1", 10);
const outRel = args[1] || `data/random-${nPerType * 6}.json`;
const seedArg = args.find((a) => a.startsWith("--seed=")) || "--seed=42";
const seed = parseInt(seedArg.slice("--seed=".length), 10);

const outPath = path.isAbsolute(outRel) ? outRel : path.join(__dirname, outRel);

// Mulberry32 seeded PRNG — small, deterministic, good distribution.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/longmemeval_s.json"), "utf8"),
);

const byType = {};
for (const d of data) {
  (byType[d.question_type] ||= []).push(d);
}

const rng = mulberry32(seed);
const sample = [];
for (const [, items] of Object.entries(byType)) {
  const shuffled = shuffle(items, rng);
  sample.push(...shuffled.slice(0, nPerType));
}

fs.writeFileSync(outPath, JSON.stringify(sample));
const bytes = fs.statSync(outPath).size;
console.error(
  `[sample-random] wrote ${sample.length} questions (seed ${seed}, ${nPerType}/type) -> ${outPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
);
for (const [t, items] of Object.entries(byType)) {
  console.error(`  ${t.padEnd(28)} pool=${items.length} sampled=${Math.min(nPerType, items.length)}`);
}
console.error(
  `[sample-random] CAVEAT: large random samples may produce per-question scripts above the Workflow 524288-byte cap. Use B1 (claude -p headless) for large samples or partition further.`,
);
