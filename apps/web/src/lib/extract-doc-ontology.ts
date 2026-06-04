// Per-document concept extraction.
//
// The bundle Analyze flow already populates concept_index from a
// bundle's graph_data. That works once the user has built bundles, but
// it leaves the hub's ontology blank until the first Analyze run. To
// make "ask my hub" useful from doc 1, this lib lets us extract
// concepts from a single document and merge them into concept_index +
// concept_relations directly — no bundle required.
//
// Cheap path. Uses Haiku with a small JSON-only prompt; per-doc cost
// is on the order of $0.001 for typical 1-2k word notes. Idempotent
// on (user_id, normalized_label) so repeat extractions converge
// instead of multiplying rows.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeConceptLabel } from "@/lib/build-concept-index";
import { callAI } from "@/lib/ai-providers";

interface ExtractedConcept {
  label: string;
  type?: "concept" | "entity" | "tag";
  weight?: number;
  description?: string;
}
interface ExtractedRelation {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}
/** Page-type labels we surface in the UI chip. Mirrors the
 *  documents.intent CHECK constraint exactly (migration 030). The
 *  classifier may return null when nothing fits cleanly. */
export type DocIntent =
  | "note"
  | "definition"
  | "comparison"
  | "decision"
  | "question"
  | "reference";

interface ExtractedDoc {
  concepts: ExtractedConcept[];
  relations: ExtractedRelation[];
  intent: DocIntent | null;
}

const PER_DOC_PROMPT = `You analyze ONE document and return JSON with three things:

Return ONLY valid JSON with this exact shape:
{
  "doc_intent": "note|definition|comparison|decision|question|reference",
  "concepts": [
    { "label": "Display name", "type": "concept|entity|tag", "weight": 1-5, "description": "One sentence: why this concept matters in THIS document" }
  ],
  "relations": [
    { "source": "Concept A label", "target": "Concept B label", "label": "2-4 word relationship", "weight": 1-3 }
  ]
}

DOC_INTENT — pick the ONE that best describes the document's primary shape:
- "definition"  : the doc defines a concept, term, or system. Reads like "X is …".
- "comparison"  : the doc compares two or more options / approaches.
- "decision"    : the doc records a choice and the reasoning behind it (ADR-shaped).
- "question"    : the doc poses an open question / unresolved investigation.
- "reference"   : factual material the author goes back to (cheatsheet, API notes, playbook).
- "note"        : everything else — meeting notes, journal-style writing, brainstorms.
If genuinely uncertain, use "note". The user can override; default conservatively.

CONCEPTS:
- 5-15 concepts max. Quality over quantity. Skip filler.
- Mix types thoughtfully:
  - "concept" = abstract ideas, methodologies, principles
  - "entity"  = specific products, technologies, companies, people, tools
  - "tag"     = broad domains, topics
- weight 1-5 (5 = central thesis of this doc, 1 = passing mention)
- relations only between concepts you actually return. No orphan refs.
- Use the SAME label string in relations as in concepts (case + spacing).
- No prose, no fences, no commentary. JSON object only.`;

const ALLOWED_INTENTS: Set<DocIntent> = new Set([
  "note", "definition", "comparison", "decision", "question", "reference",
]);

export interface ExtractDocOntologyArgs {
  supabase: SupabaseClient;
  userId: string;
  docId: string;
  title: string;
  markdown: string;
  /** Override the default model picker. Mostly for tests. */
  apiKey?: string;
}

export interface ExtractDocOntologyResult {
  conceptsWritten: number;
  relationsWritten: number;
  /** AI-inferred intent for this doc, or null when the model couldn't
   *  classify it (empty doc, unparseable response, etc). The caller
   *  decides whether to write it to the documents row — the convention
   *  is "only set if doc.intent IS NULL" so user choices win. */
  inferredIntent: DocIntent | null;
  skipped?: "empty" | "no_api_key" | "extract_failed";
}

/**
 * Run a single-doc concept extraction and merge results into
 * concept_index + concept_relations. Safe to call repeatedly — the
 * unique constraint on (user_id, normalized_label) ensures convergence.
 *
 * Best-effort: if the LLM call fails, we skip silently. The caller
 * should not let this block doc save.
 */
export async function extractDocOntology(
  args: ExtractDocOntologyArgs,
): Promise<ExtractDocOntologyResult> {
  const { supabase, userId, docId, title, markdown } = args;
  const trimmed = (markdown || "").trim();
  if (trimmed.length < 200) {
    return { conceptsWritten: 0, relationsWritten: 0, inferredIntent: null, skipped: "empty" };
  }

  const extracted = await callExtractor(title, trimmed, args.apiKey, userId);
  if (!extracted) {
    return { conceptsWritten: 0, relationsWritten: 0, inferredIntent: null, skipped: "extract_failed" };
  }

  // 1. Upsert each concept node.
  const idByLabel = new Map<string, number>();
  let conceptsWritten = 0;
  for (const c of extracted.concepts) {
    const norm = normalizeConceptLabel(c.label || "");
    if (!norm) continue;
    const conceptType: "concept" | "entity" | "tag" = c.type === "entity" || c.type === "tag" ? c.type : "concept";

    const { data: existing } = await supabase
      .from("concept_index")
      .select("id, doc_ids, weight, occurrence_count")
      .eq("user_id", userId)
      .eq("normalized_label", norm)
      .maybeSingle();

    if (existing) {
      const newDocIds = Array.from(new Set([...(existing.doc_ids || []), docId]));
      const newWeight = (existing.weight || 0) + (c.weight || 1);
      const newOccurrence = (existing.occurrence_count || 0) + 1;
      const { error } = await supabase
        .from("concept_index")
        .update({
          label: c.label,
          concept_type: conceptType,
          description: c.description || undefined,
          doc_ids: newDocIds,
          weight: newWeight,
          occurrence_count: newOccurrence,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (!error) {
        idByLabel.set(c.label, existing.id);
        conceptsWritten++;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("concept_index")
        .insert({
          user_id: userId,
          label: c.label,
          normalized_label: norm,
          concept_type: conceptType,
          weight: c.weight || 1,
          description: c.description || null,
          doc_ids: [docId],
          bundle_ids: [],
          occurrence_count: 1,
        })
        .select("id")
        .single();
      if (!error && inserted) {
        idByLabel.set(c.label, inserted.id);
        conceptsWritten++;
      }
    }
  }

  // 2. Upsert relations between concepts present in THIS doc. Evidence
  //    is just `[docId]` since this single-doc extraction is the only
  //    proof we have right now.
  let relationsWritten = 0;
  for (const r of extracted.relations) {
    const srcId = idByLabel.get(r.source);
    const tgtId = idByLabel.get(r.target);
    if (!srcId || !tgtId || srcId === tgtId) continue;
    const relLabel = (r.label || "related").trim().toLowerCase();

    const { data: existingRel } = await supabase
      .from("concept_relations")
      .select("id, weight, evidence_doc_ids")
      .eq("user_id", userId)
      .eq("source_concept_id", srcId)
      .eq("target_concept_id", tgtId)
      .eq("relation_label", relLabel)
      .maybeSingle();

    if (existingRel) {
      const mergedEvidence = Array.from(new Set([...(existingRel.evidence_doc_ids || []), docId]));
      await supabase
        .from("concept_relations")
        .update({
          weight: (existingRel.weight || 0) + (r.weight || 1),
          evidence_doc_ids: mergedEvidence,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRel.id);
      relationsWritten++;
    } else {
      await supabase.from("concept_relations").insert({
        user_id: userId,
        source_concept_id: srcId,
        target_concept_id: tgtId,
        relation_label: relLabel,
        weight: r.weight || 1,
        evidence_doc_ids: [docId],
      });
      relationsWritten++;
    }
  }

  return { conceptsWritten, relationsWritten, inferredIntent: extracted.intent };
}

async function callExtractor(title: string, markdown: string, _overrideKey?: string, userId?: string): Promise<ExtractedDoc | null> {
  // _overrideKey was used by the old Anthropic-direct path. Now the
  // shared cascade handles provider selection + keys via env / site_config.
  // Truncate to 8000 chars — covers 95% of personal notes; preserves
  // beginning + ending where signal usually lives.
  const truncated = clipMiddle(markdown, 8000);
  const userBlock = `Title: ${title || "Untitled"}\n\n${truncated}`;

  try {
    const result = await callAI({
      prompt: `You return ONLY valid JSON matching the schema requested. No prose, no fences.\n\n${PER_DOC_PROMPT}\n\nDocument:\n${userBlock}`,
      useLiteModel: true,
      temperature: 0.3,
      maxOutputTokens: 2048,
      userId,
      action: "doc-ontology",
    });
    if (!result.ok) return null;
    return parsePerDocJson(result.text);
  } catch (err) {
    console.warn("extractDocOntology API error:", err instanceof Error ? err.message : err);
  }
  return null;
}

function parsePerDocJson(text: string): ExtractedDoc | null {
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) candidate = fence[1].trim();
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) candidate = candidate.slice(first, last + 1);
  try {
    const parsed = JSON.parse(candidate);
    const rawIntent = typeof parsed.doc_intent === "string" ? parsed.doc_intent.toLowerCase().trim() : "";
    const intent = ALLOWED_INTENTS.has(rawIntent as DocIntent) ? (rawIntent as DocIntent) : null;
    return {
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      intent,
    };
  } catch {
    return null;
  }
}

function clipMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.6));
  const tail = text.slice(text.length - Math.floor(maxChars * 0.4));
  return `${head}\n\n[…middle elided…]\n\n${tail}`;
}
