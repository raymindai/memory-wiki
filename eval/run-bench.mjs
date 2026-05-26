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

// Per-scope URL builders. Each query carries a `scope` and `scope_id`
// (default: hub/<args.hub>). Bundle queries hit /raw/bundle/<id>, doc
// queries hit /raw/<id>. Each scope still has a full vs compact axis
// for the accuracy/cost tradeoff measurement.
const SCOPE_URLS = {
  hub: {
    full: (base, scopeId) => `${base}/hub/${scopeId}/llms-full.txt`,
    compact: (base, scopeId) => `${base}/raw/hub/${scopeId}?digest=1&compact=1`,
  },
  bundle: {
    full: (base, scopeId) => `${base}/raw/bundle/${scopeId}?full=1`,
    compact: (base, scopeId) => `${base}/raw/bundle/${scopeId}?compact=1`,
  },
  doc: {
    full: (base, scopeId) => `${base}/raw/${scopeId}`,
    compact: (base, scopeId) => `${base}/raw/${scopeId}?compact=1`,
  },
};

function parseArgs(argv) {
  const out = {
    hub: "raymindai",
    max: Infinity,
    base: process.env.MWBENCH_BASE_URL || "https://memory.wiki",
    modes: ["full", "compact"],
    queries: "queries/v1.jsonl",
  };
  for (const a of argv.slice(2)) {
    const [k, v] = a.startsWith("--") ? a.slice(2).split("=") : [null, null];
    if (k === "hub") out.hub = v || out.hub;
    else if (k === "max") out.max = parseInt(v || "0", 10) || Infinity;
    else if (k === "base") out.base = v || out.base;
    else if (k === "modes") out.modes = String(v).split(",").map((s) => s.trim()).filter(Boolean);
    else if (k === "queries") out.queries = v || out.queries;
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

  const queriesPath = path.isAbsolute(args.queries)
    ? args.queries
    : path.join(__dirname, args.queries);
  const queries = fs
    .readFileSync(queriesPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
    .map((q) => ({ ...q, scope: q.scope || "hub", scope_id: q.scope_id || args.hub }))
    .slice(0, args.max);
  console.error(`[mwbench] loaded ${queries.length} queries from ${queriesPath}`);

  // Per-query corpus fetch (one (scope, scope_id, mode) tuple → one URL).
  // Cached so the same bundle/doc isn't fetched repeatedly across queries
  // that target it.
  const corpusCache = new Map();
  async function getCorpus(scope, scopeId, mode) {
    const key = `${scope}|${scopeId}|${mode}`;
    if (corpusCache.has(key)) return corpusCache.get(key);
    const builder = SCOPE_URLS[scope]?.[mode];
    if (!builder) throw new Error(`Unknown scope/mode: ${scope}/${mode}`);
    const url = builder(args.base, scopeId);
    process.stderr.write(`[mwbench] fetching ${scope}:${scopeId}:${mode} ... `);
    try {
      const c = await fetchCorpus(url);
      process.stderr.write(`${c.chars} chars (${c.fetch_ms}ms)\n`);
      corpusCache.set(key, c);
      return c;
    } catch (err) {
      process.stderr.write(`FAILED ${err.message}\n`);
      const empty = { url, text: "", chars: 0, hash: "ERR", fetch_ms: 0, error: err.message };
      corpusCache.set(key, empty);
      return empty;
    }
  }

  const runners = [
    { name: "claude", fn: runClaude, on: !!process.env.ANTHROPIC_API_KEY },
    { name: "openai", fn: runOpenAI, on: !!process.env.OPENAI_API_KEY },
    { name: "gemini", fn: runGemini, on: !!(process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY) },
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
      const corpus = await getCorpus(q.scope, q.scope_id, mode);
      for (const r of runners) {
        process.stderr.write(`[mwbench] ${q.id} (${q.scope}:${q.scope_id}) × ${r.name} × ${mode} ... `);
        try {
          const result = await r.fn({ query: q, context: corpus.text });
          result.mode = mode;
          result.scope = q.scope;
          result.scope_id = q.scope_id;
          runs.push(result);
          process.stderr.write(result.error ? `ERR ${result.error.slice(0, 60)}\n` : `ok ${result.latency_ms}ms\n`);
        } catch (err) {
          runs.push({
            runner: r.name,
            query_id: q.id,
            mode,
            scope: q.scope,
            scope_id: q.scope_id,
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
  const corporaSummary = Object.fromEntries(
    Array.from(corpusCache.entries()).map(([k, v]) => [
      k,
      { url: v.url, chars: v.chars, hash: v.hash, error: v.error || null },
    ]),
  );
  const bench = {
    bench: "MWBench v1",
    queries_file: args.queries,
    modes: args.modes,
    corpora: corporaSummary,
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
