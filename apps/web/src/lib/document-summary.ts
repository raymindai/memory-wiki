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
import { callAI } from "@/lib/ai-providers";

// Kept for the `summary_model` row column. Provider that actually
// served the response is reflected in result.provider but the column
// expects a model string for backwards compat — we record the lite
// tier name as a sensible label.
const SUMMARY_MODEL_LABEL = "lite-cascade";

const PROMPT = `Summarize the following markdown document in 1-2 short sentences
that capture the load-bearing claim or fact. Skip metadata (capture date,
source, author), boilerplate, and table-of-contents lines. Return the
summary alone, with no preface, no markdown, no quotes.

Do NOT use em-dashes (—), en-dashes (–), middle-dots (·), arrows (→), check marks (✓), or emoji inside the summary. Use comma, colon, slash, parentheses, or a sentence break instead.

DOCUMENT:
`;

export async function generateSummary(markdown: string, userId?: string): Promise<string | null> {
  if (!markdown || markdown.trim().length < 80) return null;

  // Cap input — most docs are short, but we never want to send 100k
  // tokens to the cheap summarizer. 12k chars (~3k tokens) is plenty
  // of context for a 1-2 sentence gist.
  const trimmed = markdown.length > 12000 ? markdown.slice(0, 12000) : markdown;

  try {
    const result = await callAI({
      prompt: PROMPT + trimmed,
      useLiteModel: true,
      temperature: 0.3,
      maxOutputTokens: 200,
      userId,
      action: "doc-summary",
    });
    if (!result.ok) {
      console.warn("[summary] callAI failed", result.status, result.error);
      return null;
    }
    const text = result.text.trim();
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
  userId?: string,
): Promise<void> {
  try {
    const summary = await generateSummary(markdown, userId);
    if (!summary) return;
    await supabase
      .from("documents")
      .update({
        summary,
        summary_model: SUMMARY_MODEL_LABEL,
        summary_generated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (err) {
    console.warn("[summary] sync failed", id, err);
  }
}
