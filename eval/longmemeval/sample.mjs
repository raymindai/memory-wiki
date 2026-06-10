#!/usr/bin/env node
// Sample N questions per type from LongMemEval-S for pilot runs.
// Usage: node sample.mjs <N_per_type> <out_filename>
//        e.g. node sample.mjs 1 data/sample-6.json   → 6 questions (1 per type)
//             node sample.mjs 5 data/sample-30.json  → 30 questions (5 per type)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nPerType = parseInt(process.argv[2] || "1", 10);
const outRel = process.argv[3] || `data/sample-${nPerType * 6}.json`;
const outPath = path.isAbsolute(outRel) ? outRel : path.join(__dirname, outRel);

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/longmemeval_s.json"), "utf8"),
);

const byType = {};
for (const d of data) {
  (byType[d.question_type] ||= []).push(d);
}

const sample = [];
for (const [t, items] of Object.entries(byType)) {
  sample.push(...items.slice(0, nPerType));
}

fs.writeFileSync(outPath, JSON.stringify(sample));
const bytes = fs.statSync(outPath).size;
console.error(
  `[sample] wrote ${sample.length} questions (${nPerType}/type × ${
    Object.keys(byType).length
  } types) → ${outPath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`,
);
for (const [t, items] of Object.entries(byType)) {
  console.error(`  ${t.padEnd(28)} pool=${items.length} sampled=${Math.min(nPerType, items.length)}`);
}
