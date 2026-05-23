#!/usr/bin/env node
// run-bench.mjs — execute MWBench v1.
//
// Usage:
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
//     node eval/run-bench.mjs [--hub=raymindai] [--max=20]
//
// Outputs:
//   eval/results/<ISO timestamp>.json     raw runs + judgments
//   stdout                                 score table

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run as runClaude } from "./runners/claude.mjs";
import { run as runOpenAI } from "./runners/openai.mjs";
import { run as runGemini } from "./runners/gemini.mjs";
import { judge } from "./judge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { hub: "raymindai", max: Infinity, base: process.env.MWBENCH_BASE_URL || "https://memory.wiki" };
  for (const a of argv.slice(2)) {
    const [k, v] = a.startsWith("--") ? a.slice(2).split("=") : [null, null];
    if (k === "hub") out.hub = v || out.hub;
    else if (k === "max") out.max = parseInt(v || "0", 10) || Infinity;
    else if (k === "base") out.base = v || out.base;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const corpusUrl = `${args.base}/hub/${args.hub}/llms-full.txt`;

  console.error(`[mwbench] fetching corpus: ${corpusUrl}`);
  const corpusRes = await fetch(corpusUrl);
  if (!corpusRes.ok) {
    console.error(`[mwbench] corpus fetch failed: HTTP ${corpusRes.status}`);
    process.exit(1);
  }
  const context = await corpusRes.text();
  const corpus_hash = crypto.createHash("sha256").update(context).digest("hex").slice(0, 16);
  console.error(`[mwbench] corpus: ${context.length} chars, hash=${corpus_hash}`);

  const queriesPath = path.join(__dirname, "queries", "v1.jsonl");
  const queries = fs
    .readFileSync(queriesPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .slice(0, args.max);
  console.error(`[mwbench] loaded ${queries.length} queries`);

  const runners = [
    { name: "claude", fn: runClaude, on: !!process.env.ANTHROPIC_API_KEY },
    { name: "openai", fn: runOpenAI, on: !!process.env.OPENAI_API_KEY },
    { name: "gemini", fn: runGemini, on: !!process.env.GEMINI_API_KEY },
  ].filter((r) => r.on);
  if (runners.length === 0) {
    console.error("[mwbench] no API keys set. Need ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY");
    process.exit(1);
  }
  console.error(`[mwbench] active runners: ${runners.map((r) => r.name).join(", ")}`);

  const started_at = new Date().toISOString();
  /** @type {any[]} */
  const runs = [];

  for (const q of queries) {
    for (const r of runners) {
      process.stderr.write(`[mwbench] ${q.id} × ${r.name} ... `);
      try {
        const result = await r.fn({ query: q, context });
        runs.push(result);
        process.stderr.write(result.error ? `ERR ${result.error.slice(0, 60)}\n` : `ok ${result.latency_ms}ms\n`);
      } catch (err) {
        runs.push({
          runner: r.name,
          query_id: q.id,
          answer: "",
          tokens_in: 0,
          tokens_out: 0,
          latency_ms: 0,
          error: err.message,
        });
        process.stderr.write(`THROW ${err.message}\n`);
      }
    }
  }

  console.error(`[mwbench] judging ${runs.length} answers ...`);
  /** @type {any[]} */
  const judgments = [];
  for (const r of runs) {
    const q = queries.find((q) => q.id === r.query_id);
    if (!q) continue;
    const j = await judge({ query: q, run: r });
    judgments.push(j);
    process.stderr.write(
      `[judge] ${r.query_id} × ${r.runner}: ${j.accurate ? "✓" : "✗"} (${j.keyword_hits}/${j.keyword_total})\n`,
    );
  }

  const finished_at = new Date().toISOString();
  const bench = {
    bench: "MWBench v1",
    corpus_url: corpusUrl,
    corpus_hash,
    started_at,
    finished_at,
    queries,
    runs,
    judgments,
  };

  const outPath = path.join(__dirname, "results", `${started_at.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(bench, null, 2));
  console.error(`[mwbench] wrote ${outPath}`);

  // Inline summary
  const { summarize } = await import("./agg.mjs");
  summarize(bench);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
