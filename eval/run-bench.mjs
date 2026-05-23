#!/usr/bin/env node
// run-bench.mjs — execute MWBench v1.
//
// Two corpus modes per query so you can read the accuracy/cost tradeoff
// directly off the table:
//   - full:    /hub/<slug>/llms-full.txt        (~100k input tokens)
//   - compact: /raw/hub/<slug>?digest=1&compact=1  (~1-3k input tokens)
//
// Same {query × runner} pair runs twice, once per mode. The aggregator
// breaks down accuracy / token-economy per mode and shows the delta.
//
// Usage:
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
//     node eval/run-bench.mjs [--hub=raymindai] [--max=20] [--modes=full,compact]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { run as runClaude } from "./runners/claude.mjs";
import { run as runOpenAI } from "./runners/openai.mjs";
import { run as runGemini } from "./runners/gemini.mjs";
import { judge } from "./judge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODE_URLS = {
  full: (base, slug) => `${base}/hub/${slug}/llms-full.txt`,
  compact: (base, slug) => `${base}/raw/hub/${slug}?digest=1&compact=1`,
};

function parseArgs(argv) {
  const out = {
    hub: "raymindai",
    max: Infinity,
    base: process.env.MWBENCH_BASE_URL || "https://memory.wiki",
    modes: ["full", "compact"],
  };
  for (const a of argv.slice(2)) {
    const [k, v] = a.startsWith("--") ? a.slice(2).split("=") : [null, null];
    if (k === "hub") out.hub = v || out.hub;
    else if (k === "max") out.max = parseInt(v || "0", 10) || Infinity;
    else if (k === "base") out.base = v || out.base;
    else if (k === "modes") out.modes = String(v).split(",").map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

async function fetchCorpus(url) {
  const t0 = Date.now();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
  const text = await r.text();
  return {
    url,
    text,
    chars: text.length,
    hash: crypto.createHash("sha256").update(text).digest("hex").slice(0, 16),
    fetch_ms: Date.now() - t0,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  // Fetch every mode's corpus up front so per-query loops don't pay
  // a network round-trip 20 times.
  const corpora = {};
  for (const mode of args.modes) {
    if (!MODE_URLS[mode]) {
      console.error(`[mwbench] unknown mode: ${mode}. Valid: ${Object.keys(MODE_URLS).join(", ")}`);
      process.exit(1);
    }
    const url = MODE_URLS[mode](args.base, args.hub);
    process.stderr.write(`[mwbench] fetching ${mode}: ${url} ... `);
    try {
      corpora[mode] = await fetchCorpus(url);
      process.stderr.write(`${corpora[mode].chars} chars (${corpora[mode].fetch_ms}ms)\n`);
    } catch (err) {
      console.error(`FAILED ${err.message}`);
      process.exit(1);
    }
  }

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
  console.error(`[mwbench] active modes:   ${args.modes.join(", ")}`);

  const started_at = new Date().toISOString();
  /** @type {any[]} */
  const runs = [];

  for (const q of queries) {
    for (const mode of args.modes) {
      for (const r of runners) {
        process.stderr.write(`[mwbench] ${q.id} × ${r.name} × ${mode} ... `);
        try {
          const result = await r.fn({ query: q, context: corpora[mode].text });
          result.mode = mode;
          runs.push(result);
          process.stderr.write(result.error ? `ERR ${result.error.slice(0, 60)}\n` : `ok ${result.latency_ms}ms\n`);
        } catch (err) {
          runs.push({
            runner: r.name,
            query_id: q.id,
            mode,
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
  }

  console.error(`[mwbench] judging ${runs.length} answers ...`);
  /** @type {any[]} */
  const judgments = [];
  for (const r of runs) {
    const q = queries.find((q) => q.id === r.query_id);
    if (!q) continue;
    const j = await judge({ query: q, run: r });
    j.mode = r.mode;
    judgments.push(j);
    process.stderr.write(
      `[judge] ${r.query_id} × ${r.runner} × ${r.mode}: ${j.accurate ? "✓" : "✗"} (${j.keyword_hits}/${j.keyword_total})\n`,
    );
  }

  const finished_at = new Date().toISOString();
  const bench = {
    bench: "MWBench v1",
    corpus_url: args.modes.map((m) => `${m}:${corpora[m].url}`).join(" | "),
    corpus_hash: args.modes.map((m) => `${m}:${corpora[m].hash}`).join(" | "),
    corpora: Object.fromEntries(
      args.modes.map((m) => [m, { url: corpora[m].url, chars: corpora[m].chars, hash: corpora[m].hash }]),
    ),
    modes: args.modes,
    started_at,
    finished_at,
    queries,
    runs,
    judgments,
  };

  const outPath = path.join(__dirname, "results", `${started_at.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(bench, null, 2));
  console.error(`[mwbench] wrote ${outPath}`);

  const { summarize } = await import("./agg.mjs");
  summarize(bench);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
