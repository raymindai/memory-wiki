#!/usr/bin/env node
// sweep-all-glyph-clean.mjs — clean LLM-generated content across the
// entire production database so legacy glyphs (em-dash, middle-dot,
// arrows, check marks, emoji) are scrubbed from anything an AI sees
// when it fetches our URLs.
//
// Scope:
//   - documents.summary (Haiku, regenerable)
//   - documents.ai_graph (Haiku, regenerable)
//   - bundles.graph_data themes/insights/keyTakeaways/gaps text
//     (regen requires going through the canvas analyze endpoint;
//      this script strips glyphs inline as a quick clean)
//   - concept_index.description (Haiku, strips inline)
//
// Two modes:
//   --regen-docs   reset summary + ai_graph for every public doc and
//                  refire the Haiku generators with the new prompts.
//                  Cost ~$0.001 per doc * N docs.
//   --strip-inline strip forbidden glyphs inline without regenerating.
//                  Zero LLM cost. Used for bundles.graph_data and
//                  concept_index.description where bulk regen is
//                  expensive.
//
// Default runs both passes.
//
// Usage:
//   ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/sweep-all-glyph-clean.mjs [--regen-docs] [--strip-inline] [--dry]

import { createClient } from "@supabase/supabase-js";

const SUMMARY_MODEL = process.env.MW_SUMMARY_MODEL || "claude-haiku-4-5";
const GRAPH_MODEL = process.env.MW_DOC_GRAPH_MODEL || "claude-haiku-4-5";

const SUMMARY_PROMPT = `Do NOT use em-dashes, en-dashes, middle-dots (·), arrows (→), check marks (✓), or emoji inside the summary. Use comma, colon, slash, parentheses, or a sentence break instead.

Summarize the following markdown document in 1-2 short sentences
that capture the load-bearing claim or fact. Skip metadata (capture date,
source, author), boilerplate, and table-of-contents lines. Return the
summary alone, with no preface, no markdown, no quotes.

DOCUMENT:
`;

const GRAPH_PROMPT = `Analyze this Memory.Wiki document and return a structured JSON graph an AI could use as navigation when answering questions about it. Skip metadata (capture date, source).

DOCUMENT:
{{BODY}}

Return STRICTLY one JSON object on a single line (no markdown fences):
{"themes":[<3-5 short theme phrases>],"insights":[<2-4 non-obvious observations>],"keyTakeaways":[<3-6 load-bearing claims the document makes>],"openQuestions":[<1-3 things the document doesn't fully answer>]}

Rules:
- Every claim in keyTakeaways must be SUPPORTED by the document body. Do not extrapolate.
- Themes are short (2-5 words). Insights are full sentences. Takeaways are one-sentence facts.
- Skip openQuestions if the document is self-contained.
- Output JSON only, no markdown, no preface.
- Inside string values, do NOT use em-dashes (—), en-dashes (–), middle-dots (·), arrows (→ ← ↑ ↓), check marks (✓ ✔), or emoji. Use comma, colon, slash, parentheses, or a sentence break instead.`;

// Glyph-replacement table for inline strip mode. Replace with a safe
// equivalent so meaning survives.
function stripGlyphs(s) {
  if (!s || typeof s !== "string") return s;
  return s
    .replace(/[—―]/g, ", ") // em-dash, horizontal bar
    .replace(/–/g, "-") // en-dash
    .replace(/·/g, ", ") // middle-dot
    .replace(/[→➤➜]/g, "to") // right arrows
    .replace(/[←]/g, "from") // left arrow
    .replace(/[↑↓]/g, "") // up/down arrows
    .replace(/[✓✔✖✘]/g, "") // checks / x marks
    .replace(/[★☆✩✭✯✰]/g, "") // stars
    .replace(/…/g, "...") // ellipsis
    .replace(/\s+/g, " ")
    .trim();
}

// Walk a JSON value and strip glyphs in any string leaf.
function deepStrip(value) {
  if (typeof value === "string") return stripGlyphs(value);
  if (Array.isArray(value)) return value.map(deepStrip);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepStrip(v);
    return out;
  }
  return value;
}

// Walk a JSON value and return TRUE if any string leaf contains a
// forbidden glyph. Cheap pre-check before writing back.
function hasGlyph(value) {
  if (typeof value === "string") return /[–—―·←-↓→➤➜✓✔✖✘★☆✩✭✯✰…]/.test(value);
  if (Array.isArray(value)) return value.some(hasGlyph);
  if (value && typeof value === "object") return Object.values(value).some(hasGlyph);
  return false;
}

function args(argv) {
  const out = { regenDocs: false, stripInline: false, dry: false };
  for (const a of argv.slice(2)) {
    if (a === "--regen-docs") out.regenDocs = true;
    else if (a === "--strip-inline") out.stripInline = true;
    else if (a === "--dry") out.dry = true;
  }
  if (!out.regenDocs && !out.stripInline) {
    out.regenDocs = true;
    out.stripInline = true;
  }
  return out;
}

async function callHaiku(model, prompt, apiKey, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

async function regenSummary(markdown, apiKey) {
  const trimmed = markdown.length > 12000 ? markdown.slice(0, 12000) : markdown;
  const text = await callHaiku(SUMMARY_MODEL, SUMMARY_PROMPT + trimmed, apiKey, 200);
  return text ? stripGlyphs(text).slice(0, 600) : null;
}

async function regenGraph(markdown, apiKey) {
  const trimmed = markdown.length > 16000 ? markdown.slice(0, 16000) : markdown;
  const text = await callHaiku(GRAPH_MODEL, GRAPH_PROMPT.replace("{{BODY}}", trimmed), apiKey, 1200);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]);
    const cap = (arr, n, len = 240) =>
      Array.isArray(arr) ? arr.slice(0, n).map((s) => stripGlyphs(String(s)).slice(0, len)) : [];
    return {
      themes: cap(parsed.themes, 5, 80),
      insights: cap(parsed.insights, 4, 240),
      keyTakeaways: cap(parsed.keyTakeaways, 6, 240),
      openQuestions: cap(parsed.openQuestions, 3, 240),
    };
  } catch {
    return null;
  }
}

async function regenAllDocs(supabase, apiKey, dry) {
  console.log("\n--- Regenerating summary + ai_graph for ALL public docs ---");
  const { data: docs } = await supabase
    .from("documents")
    .select("id, user_id, title, markdown")
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .or("summary.is.null,ai_graph.is.null");
  // ^ initial filter: docs missing either field. If you want a FULL reset
  // first, run a separate SQL UPDATE that NULLs both columns.

  if (!docs || docs.length === 0) {
    console.log("Nothing to regenerate.");
    return;
  }
  console.log(`Regenerating ${docs.length} docs (parallel=6)${dry ? " DRY" : ""}`);
  let ok = 0, fail = 0;
  const queue = docs.slice();
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length > 0) {
      const d = queue.shift();
      if (!d) break;
      const tag = `${d.id} "${(d.title || "").slice(0, 40)}"`;
      try {
        const [summary, graph] = await Promise.all([
          regenSummary(d.markdown || "", apiKey).catch(() => null),
          regenGraph(d.markdown || "", apiKey).catch(() => null),
        ]);
        if (!summary && !graph) {
          console.log(`  ${tag} skipped (no output)`);
          continue;
        }
        if (!dry) {
          await supabase
            .from("documents")
            .update({
              ...(summary ? { summary, summary_model: SUMMARY_MODEL, summary_generated_at: new Date().toISOString() } : {}),
              ...(graph ? { ai_graph: graph, ai_graph_model: GRAPH_MODEL, ai_graph_generated_at: new Date().toISOString() } : {}),
            })
            .eq("id", d.id);
        }
        ok++;
        if (ok % 10 === 0) console.log(`  ... ${ok} regenerated`);
      } catch (err) {
        console.log(`  ${tag} FAIL ${err.message}`);
        fail++;
      }
    }
  });
  await Promise.all(workers);
  console.log(`Docs regen: ok=${ok} fail=${fail}`);
}

async function stripInlineSummariesAndGraphs(supabase, dry) {
  console.log("\n--- Stripping glyphs inline from existing documents.summary and ai_graph ---");
  const { data: rows } = await supabase
    .from("documents")
    .select("id, summary, ai_graph")
    .or("summary.not.is.null,ai_graph.not.is.null");
  let changed = 0;
  for (const r of rows || []) {
    let newSummary = r.summary;
    let newGraph = r.ai_graph;
    const sChanged = r.summary && /[–—·→✓…]/.test(r.summary);
    if (sChanged) newSummary = stripGlyphs(r.summary);
    const gChanged = r.ai_graph && hasGlyph(r.ai_graph);
    if (gChanged) newGraph = deepStrip(r.ai_graph);
    if (sChanged || gChanged) {
      if (!dry) {
        await supabase
          .from("documents")
          .update({
            ...(sChanged ? { summary: newSummary } : {}),
            ...(gChanged ? { ai_graph: newGraph } : {}),
          })
          .eq("id", r.id);
      }
      changed++;
    }
  }
  console.log(`Docs inline strip: ${changed} rows changed${dry ? " (dry)" : ""}`);
}

async function stripBundles(supabase, dry) {
  console.log("\n--- Stripping glyphs inline from bundles.graph_data ---");
  const { data: bundles } = await supabase
    .from("bundles")
    .select("id, graph_data")
    .not("graph_data", "is", null);
  let changed = 0;
  for (const b of bundles || []) {
    if (!hasGlyph(b.graph_data)) continue;
    const cleaned = deepStrip(b.graph_data);
    if (!dry) {
      await supabase.from("bundles").update({ graph_data: cleaned, updated_at: new Date().toISOString() }).eq("id", b.id);
    }
    changed++;
  }
  console.log(`Bundles: ${changed} rows changed${dry ? " (dry)" : ""}`);
}

async function stripConcepts(supabase, dry) {
  console.log("\n--- Stripping glyphs inline from concept_index.description ---");
  const { data: rows } = await supabase
    .from("concept_index")
    .select("id, description")
    .not("description", "is", null);
  let changed = 0;
  for (const r of rows || []) {
    if (!r.description) continue;
    if (!/[–—·→✓…]/.test(r.description)) continue;
    const cleaned = stripGlyphs(r.description);
    if (!dry) {
      await supabase.from("concept_index").update({ description: cleaned }).eq("id", r.id);
    }
    changed++;
  }
  console.log(`Concepts: ${changed} rows changed${dry ? " (dry)" : ""}`);
}

async function stripConceptRelations(supabase, dry) {
  console.log("\n--- Stripping glyphs from concept_relations.relation_label ---");
  const { data: rows } = await supabase
    .from("concept_relations")
    .select("source_concept_id, target_concept_id, relation_label")
    .not("relation_label", "is", null);
  let changed = 0;
  for (const r of rows || []) {
    if (!r.relation_label) continue;
    if (!/[–—·→✓…]/.test(r.relation_label)) continue;
    const cleaned = stripGlyphs(r.relation_label);
    if (!dry) {
      await supabase
        .from("concept_relations")
        .update({ relation_label: cleaned })
        .eq("source_concept_id", r.source_concept_id)
        .eq("target_concept_id", r.target_concept_id);
    }
    changed++;
  }
  console.log(`Concept relations: ${changed} rows changed${dry ? " (dry)" : ""}`);
}

async function main() {
  const opts = args(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anth = process.env.ANTHROPIC_API_KEY;
  if (!url || !srv) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, srv);

  if (opts.stripInline) {
    await stripInlineSummariesAndGraphs(supabase, opts.dry);
    await stripBundles(supabase, opts.dry);
    await stripConcepts(supabase, opts.dry);
    await stripConceptRelations(supabase, opts.dry);
  }
  if (opts.regenDocs) {
    if (!anth) {
      console.error("Need ANTHROPIC_API_KEY for --regen-docs");
      process.exit(1);
    }
    await regenAllDocs(supabase, anth, opts.dry);
  }
  console.log("\nSweep complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
