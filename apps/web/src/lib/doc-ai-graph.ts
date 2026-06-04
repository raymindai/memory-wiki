// doc-ai-graph.ts — generate per-doc AI analysis (themes, insights,
// keyTakeaways, openQuestions, relatedDocs) and persist to
// documents.ai_graph. Mirrors what bundles.graph_data carries for a
// curated bundle, scoped to a single document.
//
// Routes through the shared cost-first cascade (callAI). Fire-and-
// forget from doc POST/PATCH so doc save stays fast; backfill of
// historic docs runs through eval/backfill-doc-graph.mjs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-providers";

const GRAPH_MODEL_LABEL = "lite-cascade";

export interface DocAIGraph {
  themes?: string[];
  insights?: string[];
  keyTakeaways?: string[];
  openQuestions?: string[];
  relatedDocs?: Array<{ id?: string; title?: string; relationship?: string }>;
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

export async function generateDocAIGraph(
  markdown: string,
): Promise<DocAIGraph | null> {
  if (!markdown || markdown.trim().length < 200) return null;
  const trimmed = markdown.length > 16000 ? markdown.slice(0, 16000) : markdown;

  const result = await callAI({
    prompt: PROMPT.replace("{{BODY}}", trimmed),
    useLiteModel: true,
    temperature: 0.3,
    maxOutputTokens: 1200,
  });
  if (!result.ok) return null;
  const m = result.text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[0]) as DocAIGraph;
    // Defensive trim — drop arrays beyond reasonable size, cap strings.
    const cap = (arr: string[] | undefined, n: number, len = 240) =>
      Array.isArray(arr) ? arr.slice(0, n).map((s) => String(s).slice(0, len)) : [];
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

/**
 * Fire-and-forget: regenerate doc AI graph after a content change.
 * Caller does NOT await — keeps the save path fast. Failures get
 * swallowed (logged) so the doc save never blocks on the analysis.
 */
export async function syncDocAIGraph(
  supabase: SupabaseClient,
  docId: string,
  markdown: string,
): Promise<void> {
  try {
    const graph = await generateDocAIGraph(markdown);
    if (!graph) return;
    await supabase
      .from("documents")
      .update({
        ai_graph: graph,
        ai_graph_model: GRAPH_MODEL_LABEL,
        ai_graph_generated_at: new Date().toISOString(),
      })
      .eq("id", docId);
  } catch (err) {
    console.error(`[doc-ai-graph] ${docId} failed:`, err instanceof Error ? err.message : err);
  }
}
