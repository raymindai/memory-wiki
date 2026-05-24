/**
 * Per-doc summary generation for the compact hub digest.
 *
 * Cheap Anthropic Haiku 4.5 pass that produces a 1-2 sentence
 * load-bearing summary of a markdown doc. Fire-and-forget from the
 * doc save path; results land in `documents.summary` and the compact
 * route picks them up next render.
 *
 * Cost: ~$0.0008 per call at typical doc length. Backfilling the
 * raymindai corpus of 71 docs is ~$0.06.
 *
 * No-op when ANTHROPIC_API_KEY is missing or when the doc is empty
 * or very short — first-paragraph fallback in the route is fine in
 * those cases.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const SUMMARY_MODEL = process.env.MW_SUMMARY_MODEL || "claude-haiku-4-5";
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";

const PROMPT = `Summarize the following markdown document in 1-2 short sentences
that capture the load-bearing claim or fact. Skip metadata (capture date,
source, author), boilerplate, and table-of-contents lines. Return the
summary alone, with no preface, no markdown, no quotes.

Do NOT use em-dashes (—), en-dashes (–), middle-dots (·), arrows (→), check marks (✓), or emoji inside the summary. Use comma, colon, slash, parentheses, or a sentence break instead.

DOCUMENT:
`;

export async function generateSummary(markdown: string): Promise<string | null> {
  if (!markdown || markdown.trim().length < 80) return null;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  // Cap input — most docs are short, but we never want to send 100k
  // tokens to the cheap summarizer. 12k chars (~3k tokens) is plenty
  // of context for a 1-2 sentence gist.
  const trimmed = markdown.length > 12000 ? markdown.slice(0, 12000) : markdown;

  try {
    const r = await fetch(ANTHROPIC_ENDPOINT, {
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
      console.warn("[summary] HTTP", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const data = await r.json();
    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    if (!text) return null;
    // One-line: strip line breaks, collapse whitespace.
    return text.replace(/\s+/g, " ").slice(0, 600);
  } catch (err) {
    console.warn("[summary] threw", err);
    return null;
  }
}

/**
 * Generate + persist summary for one doc. Fire-and-forget from the
 * /api/docs save path — never throws.
 */
export async function syncDocumentSummary(
  supabase: SupabaseClient,
  id: string,
  markdown: string,
): Promise<void> {
  try {
    const summary = await generateSummary(markdown);
    if (!summary) return;
    await supabase
      .from("documents")
      .update({
        summary,
        summary_model: SUMMARY_MODEL,
        summary_generated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("[summary] sync failed", id, err);
  }
}
