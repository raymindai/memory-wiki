/**
 * Bundle synthesis core — used by both /api/bundles/:id/synthesize (one-shot
 * generation) and /api/docs/:id/recompile (regenerating an existing compiled
 * doc with the same provenance).
 *
 * Given a supabase client + bundleId + kind + (optional) intent override,
 * returns the synthesized markdown. Throws on misconfiguration; returns null
 * if the AI call fails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { readHubSchema, DEFAULT_HUB_SCHEMA_MD } from "@/lib/hub-schema";
import { callAI } from "@/lib/ai-providers";

export type SynthesisKind = "memo" | "faq" | "brief" | "wiki";

const MEMO_PROMPT = `You are a senior analyst producing a one-page decision memo from a collection of documents.

Output STRICT markdown in this shape:

# <Headline answering the intent in one declarative sentence>

**TL;DR.** <2-3 sentence summary of where the user stands and what to do next.>

## Key findings
- <Finding 1, with [doc-N] citation>
- <Finding 2, with [doc-N] citation>
- <…>

## Tensions to be aware of
- <Tension 1: which docs disagree and on what>
- <…>

## Gaps
- <Missing data / perspectives that would strengthen the conclusion>

## Recommendations
1. <Concrete next move>
2. <…>

CRITICAL RULES:
- Cite documents inline as [doc-1], [doc-2] etc. matching the numbers in the input.
- Lead with the answer (Headline + TL;DR), not background.
- Be opinionated: the memo should make a recommendation, not just summarize.
- Maximum 350 words across the whole memo.`;

const FAQ_PROMPT = `You are a knowledge architect producing an FAQ from a collection of documents.

Extract every meaningful question raised in or implied by the documents, then synthesize the best answer from the available evidence. Use this markdown shape:

# Frequently Asked Questions

## <Question 1>

<Answer synthesized from the docs, with [doc-N] citations.>

## <Question 2>

<Answer.>

…

CRITICAL RULES:
- 5-10 questions total. Pick the most important ones.
- Each answer cites at least one doc inline as [doc-N].
- If the docs don't answer a question, say so explicitly (don't invent).
- Order questions from most foundational to most specific.`;

const WIKI_PROMPT = `You are the LLM maintaining the owner's personal knowledge wiki. The owner curates raw documents; you keep the wiki page that synthesizes them.

The hub schema below tells you HOW to maintain this user's wiki. Honor it.

Output a wiki-style synthesis page in markdown:

# <Page title for this synthesis>

> A 2-3 sentence summary. What does the bundled set of docs collectively say?

## Key claims

- [EXTRACTED] <Direct claim quoted or paraphrased from one doc, with [doc-N] citation>
- [INFERRED] <Claim that follows logically from multiple docs but is not stated outright, with [doc-N] citations>
- [AMBIGUOUS] <Claim where the docs partially support it but leave room for disagreement, with [doc-N] citations>

## Cross-references

- <Concept X appears in [doc-A] and [doc-B]. Note how they treat it differently or agree.>

## Open questions / gaps

- <What the docs don't address but should>

## Provenance

- [doc-1]: <one-sentence summary of this doc's role in the page>
- [doc-2]: <one-sentence summary>

CONFIDENCE TAGS (REQUIRED):
- Every bullet under "Key claims" MUST start with [EXTRACTED], [INFERRED], or [AMBIGUOUS] in brackets.
  - [EXTRACTED]: the docs say this directly. Quote or close paraphrase.
  - [INFERRED]: the docs collectively imply this, but no single sentence states it.
  - [AMBIGUOUS]: the evidence is partial or split across docs.
- Don't use the tags outside the Key claims section.

OTHER RULES:
- Cite sources inline as [doc-N].
- Don't invent claims. Every assertion must be supported by at least one citation.
- Keep under 700 words.
- Use the schema's tone and topic guidance.`;

const BRIEF_PROMPT = `You are a writer producing a narrative brief that distills a collection of documents into a single readable essay.

Output STRICT markdown:

# <Title — what this brief is about>

<Paragraph 1: framing — what the docs collectively address.>

<Paragraph 2-4: the through-line — the argument or story the docs tell when read together. Cite docs inline as [doc-N].>

<Final paragraph: the implication — so what?>

CRITICAL RULES:
- 400-600 words total.
- Read like a coherent essay, not a list. Use transitions.
- Cite docs inline as [doc-N].
- Make the through-line explicit; do not just summarize each doc in turn.`;

export interface SynthesisResult {
  markdown: string;
  /** Document IDs (in order) that were fed into the synthesis. */
  sourceDocIds: string[];
  intent: string | null;
}

/**
 * Run a fresh synthesis against the bundle's current state.
 * Returns null if AI call fails or no docs available.
 */
export async function synthesizeBundle(
  supabase: SupabaseClient,
  bundleId: string,
  kind: SynthesisKind,
  intentOverride?: string | null,
): Promise<SynthesisResult | null> {
  const { data: bundle } = await supabase
    .from("bundles")
    .select("intent, graph_data, user_id")
    .eq("id", bundleId)
    .single();
  if (!bundle) return null;

  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, sort_order")
    .eq("bundle_id", bundleId)
    .order("sort_order", { ascending: true });
  if (!bundleDocs || bundleDocs.length === 0) return null;

  const docIds = bundleDocs.map(d => d.document_id);
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, markdown, semantic_chunks")
    .in("id", docIds)
    .is("deleted_at", null);
  if (!docs || docs.length === 0) return null;

  const docOrder = docIds.map(did => docs.find(d => d.id === did)).filter(Boolean) as typeof docs;
  const sections = docOrder.map((doc, i) => {
    const tag = `doc-${i + 1}`;
    const header = `### ${tag}: "${doc.title || "Untitled"}"`;
    const chunks = (doc.semantic_chunks as { chunks?: Array<{ type: string; label: string; content: string }> } | null)?.chunks;
    if (chunks && chunks.length > 0) {
      const top = chunks.slice(0, 12).map(c => `- [${c.type}] **${c.label}** — ${c.content.slice(0, 320)}`).join("\n");
      return `${header}\n${top}`;
    }
    return `${header}\n${doc.markdown.slice(0, 1500)}`;
  }).join("\n\n");

  const graph = bundle.graph_data as Record<string, unknown> | null;
  const insights = (graph?.insights as string[] | undefined) || [];
  const gaps = (graph?.gaps as string[] | undefined) || [];
  const themes = (graph?.themes as string[] | undefined) || [];

  const intent = intentOverride !== undefined ? intentOverride : bundle.intent;
  const intentBlock = intent
    ? `## Reader's Intent\nThe user gathered these documents to answer: **${intent}**\nAnchor your output to this question.\n\n`
    : "";
  const signalsBlock = (insights.length || gaps.length || themes.length)
    ? `## Bundle-level Signals\n${themes.length ? `Themes: ${themes.join(", ")}\n` : ""}${insights.length ? `Insights:\n${insights.map(s => `- ${s}`).join("\n")}\n` : ""}${gaps.length ? `Gaps:\n${gaps.map(s => `- ${s}`).join("\n")}\n` : ""}\n`
    : "";

  const promptHead =
    kind === "faq" ? FAQ_PROMPT
      : kind === "brief" ? BRIEF_PROMPT
        : kind === "wiki" ? WIKI_PROMPT
          : MEMO_PROMPT;

  // For wiki kind, inject the hub's MDFY.md schema so the LLM follows the
  // owner's customizations (tone, topics, cross-reference rules, lint
  // signals). For other kinds the schema is irrelevant — the prompt itself
  // is the spec.
  let schemaBlock = "";
  if (kind === "wiki" && bundle.user_id) {
    try {
      const schema = await readHubSchema(bundle.user_id as string);
      // Only include the schema text when it differs from the bundled
      // default — otherwise we waste tokens on something the prompt already
      // implies.
      if (!schema.isDefault && schema.markdown.trim() !== DEFAULT_HUB_SCHEMA_MD.trim()) {
        schemaBlock = `## Hub schema (the owner's instructions for you)\n${schema.markdown}\n\n`;
      }
    } catch { /* fall back to default behavior */ }
  }

  const fullPrompt = `${promptHead}\n\n---\n${schemaBlock}${intentBlock}${signalsBlock}## Documents\n${sections}`;

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const result = await callAI({
    prompt: fullPrompt,
    useLiteModel: false,
    temperature: 0.3,
    maxOutputTokens: 2048,
  });
  if (!result.ok) return null;
  return {
    markdown: result.text,
    sourceDocIds: docOrder.map(d => d.id),
    intent: intent || null,
  };
}
