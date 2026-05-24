#!/usr/bin/env node
// run-browse-bench.mjs — MWBench v2 (browse mode).
//
// Difference from run-bench.mjs (paste mode):
//   - Runners receive ONLY a URL + question. They must call fetch_url
//     to retrieve markdown themselves. Mirrors the real-world scenario
//     where a user pastes a Memory.Wiki URL into ChatGPT/Claude/Gemini.
//   - No corpus pre-fetch. Each runner pays its own network round-trip.
//   - Tracks tool_calls per query (did the runner actually fetch?
//     how many fetches did it use to answer?).
//
// Usage:
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
//     node eval/run-browse-bench.mjs --queries=queries/v1.jsonl [--max=20]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run as runClaude } from "./runners/claude-browse.mjs";
import { run as runOpenAI } from "./runners/openai-browse.mjs";
import { run as runGemini } from "./runners/gemini-browse.mjs";
import { judge } from "./judge.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCOPE_URLS = {
  hub: (base, scopeId) => `${base}/hub/${scopeId}`,
  bundle: (base, scopeId) => `${base}/b/${scopeId}`,
  doc: (base, scopeId) => `${base}/${scopeId}`,
};

function parseArgs(argv) {
  const out = {
    hub: "raymindai",
    max: Infinity,
    base: process.env.MWBENCH_BASE_URL || "https://memory.wiki",
    queries: "queries/v1.jsonl",
  };
  for (const a of argv.slice(2)) {
    const [k, v] = a.startsWith("--") ? a.slice(2).split("=") : [null, null];
    if (k === "hub") out.hub = v || out.hub;
    else if (k === "max") out.max = parseInt(v || "0", 10) || Infinity;
    else if (k === "base") out.base = v || out.base;
    else if (k === "queries") out.queries = v || out.queries;
  }
  return out;
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
  console.error(`[browse] loaded ${queries.length} queries from ${queriesPath}`);

  const runners = [
    { name: "claude", fn: runClaude, on: !!process.env.ANTHROPIC_API_KEY },
    { name: "openai", fn: runOpenAI, on: !!process.env.OPENAI_API_KEY },
    {
      name: "gemini",
      fn: runGemini,
      on: !!(process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY),
    },
  ].filter((r) => r.on);
  if (runners.length === 0) {
    console.error("[browse] no API keys. Need ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY(_2)");
    process.exit(1);
  }
  console.error(`[browse] active runners: ${runners.map((r) => r.name).join(", ")}`);

  const started_at = new Date().toISOString();
  const runs = [];

  for (const q of queries) {
    const urlBuilder = SCOPE_URLS[q.scope];
    if (!urlBuilder) {
      console.error(`[browse] unknown scope: ${q.scope}`);
      continue;
    }
    const url = urlBuilder(args.base, q.scope_id);
    for (const r of runners) {
      process.stderr.write(`[browse] ${q.id} (${q.scope}:${q.scope_id}) × ${r.name} ... `);
      try {
        const result = await r.fn({ query: q, url });
        result.mode = "browse";
        result.scope = q.scope;
        result.scope_id = q.scope_id;
        result.url = url;
        runs.push(result);
        process.stderr.write(
          result.error
            ? `ERR ${result.error.slice(0, 60)}\n`
            : `ok ${result.latency_ms}ms (tool_calls=${result.tool_calls})\n`,
        );
      } catch (err) {
        runs.push({
          runner: r.name,
          query_id: q.id,
          mode: "browse",
          scope: q.scope,
          scope_id: q.scope_id,
          url,
          answer: "",
          tokens_in: 0,
          tokens_out: 0,
          latency_ms: 0,
          tool_calls: 0,
          error: err.message,
        });
        process.stderr.write(`THROW ${err.message}\n`);
      }
    }
  }

  console.error(`[browse] judging ${runs.length} answers ...`);
  const judgments = [];
  for (const r of runs) {
    const q = queries.find((q) => q.id === r.query_id);
    if (!q) continue;
    const j = await judge({ query: q, run: r });
    j.mode = "browse";
    j.scope = r.scope;
    j.scope_id = r.scope_id;
    j.tool_calls = r.tool_calls;
    judgments.push(j);
    process.stderr.write(
      `[judge] ${r.query_id} × ${r.runner}: ${j.accurate ? "✓" : "✗"} (tools=${r.tool_calls})\n`,
    );
  }

  const finished_at = new Date().toISOString();
  const bench = {
    bench: "MWBench v2 (browse)",
    queries_file: args.queries,
    modes: ["browse"],
    started_at,
    finished_at,
    queries,
    runs,
    judgments,
  };

  const outPath = path.join(__dirname, "results", `${started_at.replace(/[:.]/g, "-")}-browse.json`);
  fs.writeFileSync(outPath, JSON.stringify(bench, null, 2));
  console.error(`[browse] wrote ${outPath}`);

  // Summary
  const byRunner = {};
  for (const j of judgments) {
    byRunner[j.runner] = byRunner[j.runner] || { ok: 0, t: 0, tools: 0, used_tools: 0 };
    byRunner[j.runner].t++;
    if (j.accurate) byRunner[j.runner].ok++;
    byRunner[j.runner].tools += j.tool_calls || 0;
    if ((j.tool_calls || 0) > 0) byRunner[j.runner].used_tools++;
  }
  console.log();
  console.log(`╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║ ${bench.bench} — ${started_at}`);
  console.log(`║ Queries: ${queries.length}, runners: ${runners.map((r) => r.name).join(", ")}`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log();
  console.log(`Per-runner accuracy (browse mode)`);
  for (const k of Object.keys(byRunner).sort()) {
    const v = byRunner[k];
    console.log(
      `  ${k.padEnd(8)} ${v.ok}/${v.t} = ${((v.ok / v.t) * 100).toFixed(1)}% · tool-use rate ${((v.used_tools / v.t) * 100).toFixed(0)}% · avg tool calls ${(v.tools / v.t).toFixed(1)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
