#!/usr/bin/env node
// backfill-summaries.mjs — generate documents.summary for every public doc
// in a hub that doesn't have one yet. One-shot job; safe to re-run.
//
// Usage:
//   ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/backfill-summaries.mjs [--hub=raymindai] [--limit=200] [--dry]
//
// Cost: ~$0.001 per doc with claude-haiku-4-5.

import { createClient } from "@supabase/supabase-js";

const SUMMARY_MODEL = process.env.MW_SUMMARY_MODEL || "claude-haiku-4-5";

function args(argv) {
  const out = { hub: "raymindai", limit: 500, dry: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry") out.dry = true;
    else if (a.startsWith("--hub=")) out.hub = a.slice(6);
    else if (a.startsWith("--limit=")) out.limit = parseInt(a.slice(8), 10) || 500;
  }
  return out;
}

const PROMPT = `Summarize the following markdown document in 1-2 short sentences
that capture the load-bearing claim or fact. Skip metadata (capture date,
source, author), boilerplate, and table-of-contents lines. Return the
summary alone — no preface, no markdown, no quotes.

DOCUMENT:
`;

async function generateSummary(markdown, key) {
  if (!markdown || markdown.trim().length < 80) return null;
  const trimmed = markdown.length > 12000 ? markdown.slice(0, 12000) : markdown;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      max_tokens: 200,
      messages: [{ role: "user", content: PROMPT + trimmed }],
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`HTTP ${r.status} ${txt.slice(0, 200)}`);
  }
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text ? text.replace(/\s+/g, " ").slice(0, 600) : null;
}

async function main() {
  const opts = args(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anth = process.env.ANTHROPIC_API_KEY;
  if (!url || !srv) {
    console.error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }
  if (!anth) {
    console.error("ANTHROPIC_API_KEY required");
    process.exit(1);
  }

  const supabase = createClient(url, srv);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, hub_slug")
    .eq("hub_slug", opts.hub)
    .single();
  if (!profile) {
    console.error(`Hub not found: ${opts.hub}`);
    process.exit(1);
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown, summary")
    .eq("user_id", profile.id)
    .eq("is_draft", false)
    .is("deleted_at", null)
    .is("password_hash", null)
    .is("summary", null)
    .limit(opts.limit);

  if (!docs || docs.length === 0) {
    console.log(`No docs to backfill for hub ${opts.hub}.`);
    return;
  }
  console.log(`Backfilling ${docs.length} docs for hub ${opts.hub}${opts.dry ? " (DRY RUN)" : ""}`);

  let ok = 0, fail = 0;
  for (const d of docs) {
    process.stdout.write(`  ${d.id} "${(d.title || "").slice(0, 60)}" ... `);
    try {
      const summary = await generateSummary(d.markdown || "", anth);
      if (!summary) {
        process.stdout.write("skipped (too short)\n");
        continue;
      }
      if (!opts.dry) {
        await supabase
          .from("documents")
          .update({
            summary,
            summary_model: SUMMARY_MODEL,
            summary_generated_at: new Date().toISOString(),
          })
          .eq("id", d.id);
      }
      process.stdout.write(`ok (${summary.length} chars)\n`);
      ok++;
    } catch (err) {
      process.stdout.write(`FAIL ${err.message}\n`);
      fail++;
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
