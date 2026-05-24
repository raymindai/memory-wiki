#!/usr/bin/env node
// backfill-doc-graph.mjs — generate documents.ai_graph for every public
// doc in a hub that doesn't have one. One-shot job; safe to re-run.
//
// Cost ~$0.001 per doc with claude-haiku-4-5. Run in parallel batches
// to keep wall time low.
//
// Usage:
//   ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/backfill-doc-graph.mjs [--hub=raymindai] [--limit=500] [--parallel=4]

import { createClient } from "@supabase/supabase-js";

const MODEL = process.env.MW_DOC_GRAPH_MODEL || "claude-haiku-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

function args(argv) {
  const out = { hub: "raymindai", limit: 500, parallel: 4, dry: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry") out.dry = true;
    else if (a.startsWith("--hub=")) out.hub = a.slice(6);
    else if (a.startsWith("--limit=")) out.limit = parseInt(a.slice(8), 10) || 500;
    else if (a.startsWith("--parallel=")) out.parallel = parseInt(a.slice(11), 10) || 4;
  }
  return out;
}

const PROMPT = `Analyze this Memory.Wiki document and return a structured JSON graph an AI could use as navigation when answering questions about it. Skip metadata (capture date, source).

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

async function generateGraph(markdown, key) {
  if (!markdown || markdown.trim().length < 200) return null;
  const trimmed = markdown.length > 16000 ? markdown.slice(0, 16000) : markdown;
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: PROMPT.replace("{{BODY}}", trimmed) }],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  const parsed = JSON.parse(m[0]);
  const cap = (arr, n, len = 240) =>
    Array.isArray(arr) ? arr.slice(0, n).map((s) => String(s).slice(0, len)) : [];
  return {
    themes: cap(parsed.themes, 5, 80),
    insights: cap(parsed.insights, 4, 240),
    keyTakeaways: cap(parsed.keyTakeaways, 6, 240),
    openQuestions: cap(parsed.openQuestions, 3, 240),
  };
}

async function main() {
  const opts = args(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anth = process.env.ANTHROPIC_API_KEY;
  if (!url || !srv || !anth) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, srv);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("hub_slug", opts.hub)
    .single();
  if (!profile) {
    console.error(`Hub not found: ${opts.hub}`);
    process.exit(1);
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .is("ai_graph", null)
    .limit(opts.limit);

  if (!docs || docs.length === 0) {
    console.log(`No docs need AI graph backfill for hub ${opts.hub}.`);
    return;
  }
  console.log(`Backfilling ai_graph for ${docs.length} docs (parallel=${opts.parallel})${opts.dry ? " DRY" : ""}`);

  let ok = 0, fail = 0, skipped = 0;
  const queue = docs.slice();
  const workers = Array.from({ length: opts.parallel }, async (_, worker) => {
    while (queue.length > 0) {
      const d = queue.shift();
      if (!d) break;
      const tag = `[w${worker}] ${d.id} "${(d.title || "").slice(0, 50)}"`;
      try {
        const g = await generateGraph(d.markdown || "", anth);
        if (!g) {
          console.log(`${tag} skipped (too short or null)`);
          skipped++;
          continue;
        }
        if (!opts.dry) {
          await supabase
            .from("documents")
            .update({
              ai_graph: g,
              ai_graph_model: MODEL,
              ai_graph_generated_at: new Date().toISOString(),
            })
            .eq("id", d.id);
        }
        console.log(`${tag} ok (${(g.keyTakeaways || []).length} takeaways)`);
        ok++;
      } catch (err) {
        console.log(`${tag} FAIL ${err.message}`);
        fail++;
      }
    }
  });
  await Promise.all(workers);
  console.log(`\nDone. ok=${ok} fail=${fail} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
