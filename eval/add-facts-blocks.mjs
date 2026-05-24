#!/usr/bin/env node
// add-facts-blocks.mjs — append a `## Facts` block to specific docs.
//
// Generates 3-5 bullet facts via Claude Haiku, appends after the
// existing body. Idempotent: skips docs that already have a `## Facts`
// section. The compact route's extractFacts() picks up the new block
// next time the digest is rendered.
//
// One-shot maintenance script. The "real" Phase B is owner-curated
// Facts blocks; this auto-generated variant tests whether the FORMAT
// (bullets) beats the auto-generated prose summary from A.2.
//
// Usage:
//   ANTHROPIC_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/add-facts-blocks.mjs --ids=RUMdz2fQ,yWkfCPhn,...

import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-haiku-4-5";

function args(argv) {
  const out = { ids: [], dry: false };
  for (const a of argv.slice(2)) {
    if (a === "--dry") out.dry = true;
    else if (a.startsWith("--ids=")) out.ids = a.slice(6).split(",").map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

const PROMPT = `Extract 3-5 load-bearing facts from the following markdown document.
Each fact must be a single short claim that an AI could answer questions about.
Skip metadata (dates, source, author). Focus on the substance.
Return ONLY a markdown bullet list. No preface, no markdown headings, no quotes.

Example output:
- launches 2026-06 to Hacker News
- cross-AI URL paste is the wedge
- 9 capture surfaces shipping in v8

DOCUMENT:
`;

async function generateFacts(markdown, key) {
  const trimmed = markdown.length > 12000 ? markdown.slice(0, 12000) : markdown;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: PROMPT + trimmed }],
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text;
}

async function main() {
  const opts = args(process.argv);
  if (opts.ids.length === 0) {
    console.error("Usage: --ids=<docId>,<docId>,...");
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anth = process.env.ANTHROPIC_API_KEY;
  if (!url || !srv || !anth) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, srv);

  for (const id of opts.ids) {
    process.stdout.write(`  ${id} ... `);
    const { data: doc } = await supabase
      .from("documents")
      .select("id, title, markdown")
      .eq("id", id)
      .single();
    if (!doc) {
      process.stdout.write(`not found\n`);
      continue;
    }
    if (/^##\s+Facts\s*$/im.test(doc.markdown || "")) {
      process.stdout.write(`already has Facts section, skipping\n`);
      continue;
    }
    try {
      const facts = await generateFacts(doc.markdown || "", anth);
      if (!facts) {
        process.stdout.write(`empty facts, skipping\n`);
        continue;
      }
      const newBody = `${(doc.markdown || "").trim()}\n\n## Facts\n\n${facts.trim()}\n`;
      if (opts.dry) {
        process.stdout.write(`dry run, facts=\n${facts}\n`);
        continue;
      }
      await supabase
        .from("documents")
        .update({ markdown: newBody, updated_at: new Date().toISOString() })
        .eq("id", id);
      process.stdout.write(`ok (${facts.length} chars)\n`);
    } catch (err) {
      process.stdout.write(`FAIL ${err.message}\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
