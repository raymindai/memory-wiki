#!/usr/bin/env node
// populate-readiness.mjs — read MWBench result files, aggregate per-hub
// scores, write to hub_readiness table for the badge.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/populate-readiness.mjs --hub=raymindai --round=Round-7 \
//       --paste-hub=eval/results/<...>.json \
//       --paste-bundle=eval/results/<...>.json \
//       --paste-doc=eval/results/<...>.json \
//       --browse-hub=eval/results/<...>-browse.json \
//       --browse-bundle=eval/results/<...>-browse.json \
//       --browse-doc=eval/results/<...>-browse.json

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function args(argv) {
  const out = {
    hub: "raymindai",
    round: "manual",
    files: {},
  };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--hub=")) out.hub = a.slice(6);
    else if (a.startsWith("--round=")) out.round = a.slice(8);
    else if (a.startsWith("--paste-hub=")) out.files.pasteHub = a.slice(12);
    else if (a.startsWith("--paste-bundle=")) out.files.pasteBundle = a.slice(15);
    else if (a.startsWith("--paste-doc=")) out.files.pasteDoc = a.slice(12);
    else if (a.startsWith("--browse-hub=")) out.files.browseHub = a.slice(13);
    else if (a.startsWith("--browse-bundle=")) out.files.browseBundle = a.slice(16);
    else if (a.startsWith("--browse-doc=")) out.files.browseDoc = a.slice(13);
    else if (a.startsWith("--adversarial=")) out.files.adversarial = a.slice(14);
  }
  return out;
}

function aggregateFromFile(path, mode) {
  if (!path) return null;
  const data = JSON.parse(readFileSync(path, "utf8"));
  const judgments = data.judgments || [];
  const runs = data.runs || [];
  const targetMode = mode === "browse" ? "browse" : mode === "full" ? "full" : "compact";
  const errSet = new Set();
  for (const r of runs) {
    if (r.error) errSet.add(`${r.query_id}|${r.runner}|${r.mode}`);
  }
  const relevant = judgments.filter((j) => (j.mode || "full") === targetMode);
  const perRunner = {};
  let toolUseHits = 0;
  let toolUseTotal = 0;
  for (const j of relevant) {
    const k = `${j.query_id}|${j.runner}|${j.mode}`;
    if (errSet.has(k)) continue; // exclude runner errors
    perRunner[j.runner] = perRunner[j.runner] || { ok: 0, t: 0 };
    perRunner[j.runner].t++;
    if (j.accurate) perRunner[j.runner].ok++;
    if (mode === "browse") {
      toolUseTotal++;
      if ((j.tool_calls || 0) > 0) toolUseHits++;
    }
  }
  const runnerScores = {};
  for (const [r, v] of Object.entries(perRunner)) {
    runnerScores[r] = v.t > 0 ? v.ok / v.t : 0;
  }
  const accs = Object.values(runnerScores);
  const avg = accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
  return {
    accuracy: avg,
    perRunner: runnerScores,
    tool_use_rate: mode === "browse" && toolUseTotal > 0 ? toolUseHits / toolUseTotal : null,
    cells_total: Object.values(perRunner).reduce((s, v) => s + v.t, 0),
    cells_passing: Object.values(perRunner).reduce((s, v) => s + v.ok, 0),
  };
}

async function main() {
  const opts = args(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, srv);

  // Aggregate per (scope, mode) cell from the supplied files. Missing
  // files default to null — UI hides those cells.
  const f = opts.files;
  const scopes = {
    hub: {
      paste_full: aggregateFromFile(f.pasteHub, "full"),
      paste_compact: aggregateFromFile(f.pasteHub, "compact"),
      browse: aggregateFromFile(f.browseHub, "browse"),
    },
    bundle: {
      paste_full: aggregateFromFile(f.pasteBundle, "full"),
      paste_compact: aggregateFromFile(f.pasteBundle, "compact"),
      browse: aggregateFromFile(f.browseBundle, "browse"),
    },
    doc: {
      paste_full: aggregateFromFile(f.pasteDoc, "full"),
      paste_compact: aggregateFromFile(f.pasteDoc, "compact"),
      browse: aggregateFromFile(f.browseDoc, "browse"),
    },
    adversarial: {
      browse: aggregateFromFile(f.adversarial, "browse"),
    },
  };

  // Flatten top-level scores (scope×mode → accuracy) for indexable badge use.
  const scores = {};
  let totalCells = 0;
  let passingCells = 0;
  for (const [scope, modes] of Object.entries(scopes)) {
    scores[scope] = {};
    for (const [mode, agg] of Object.entries(modes)) {
      if (!agg) continue;
      scores[scope][mode] = agg.accuracy;
      totalCells += agg.cells_total;
      passingCells += agg.cells_passing;
    }
  }

  // Headline string ("100% paste / 95% browse · tool-use 100% across Claude/OpenAI/Gemini")
  const pasteAccs = [];
  const browseAccs = [];
  const allRunners = new Set();
  let browseToolUse = null;
  for (const scope of Object.values(scopes)) {
    for (const [mode, agg] of Object.entries(scope)) {
      if (!agg) continue;
      if (mode.startsWith("paste")) pasteAccs.push(agg.accuracy);
      else if (mode === "browse") {
        browseAccs.push(agg.accuracy);
        if (agg.tool_use_rate != null) browseToolUse = agg.tool_use_rate;
      }
      for (const r of Object.keys(agg.perRunner)) allRunners.add(r);
    }
  }
  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const pct = (x) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
  const pasteAvg = avg(pasteAccs);
  const browseAvg = avg(browseAccs);
  const headline = [
    pasteAvg != null ? `paste ${pct(pasteAvg)}` : null,
    browseAvg != null ? `browse ${pct(browseAvg)}` : null,
    browseToolUse != null ? `tool-use ${pct(browseToolUse)}` : null,
  ]
    .filter(Boolean)
    .join(" · ") +
    (allRunners.size > 0 ? ` across ${Array.from(allRunners).sort().join(" / ")}` : "");

  console.log(`hub=${opts.hub} round=${opts.round}`);
  console.log(`headline: ${headline}`);
  console.log(`scores: ${JSON.stringify(scores, null, 2)}`);
  console.log(`cells: ${passingCells}/${totalCells}`);

  const { error } = await supabase
    .from("hub_readiness")
    .upsert(
      {
        hub_slug: opts.hub,
        round_label: opts.round,
        scores,
        breakdown: scopes,
        headline,
        total_cells: totalCells,
        passing_cells: passingCells,
        last_run_at: new Date().toISOString(),
        judge_model: process.env.MWBENCH_JUDGE_MODEL || "claude-sonnet-4-6",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hub_slug" },
    );
  if (error) {
    console.error("Upsert failed:", error);
    process.exit(1);
  }
  console.log("✓ wrote hub_readiness");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
