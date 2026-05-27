// v8 W4-6 Type 1 Auto-organize — fill document_ai_metadata for one doc.
//
// What lands in the table (per 044 schema):
//   tags[]            5-10 short labels for sidebar facets
//   cluster_id        soft key for grouping (>=5 share → AI bundle promo in W4+)
//   ai_summary        1-2 sentence overview surfaced in card view
//   related_doc_ids[] semantic cousins, recomputed on each run
//   entities (jsonb)  people / places / topics
//
// One LLM call returns all five so we don't burn round-trips. The
// LLM returns JSON; we parse, clamp sizes, and UPSERT. related_doc_ids
// is computed locally from cosine-similar embeddings (cheaper than
// asking the LLM to guess; reuses the same vectors the bundles use).

import type { SupabaseClient } from "@supabase/supabase-js";
import { callAI } from "@/lib/ai-providers";
import { enqueueJob, completeJob, failJob, type JobRow } from "@/lib/jobs";

const MIN_BODY_CHARS = 80;
// Cool-down between auto re-runs so an actively-edited doc doesn't
// burn an LLM call on every autosave. Mirrors the doc_ontology
// cooldown (12h) in ontology-refresh.ts.
const RE_RUN_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const ORGANIZE_PROMPT = `You are a knowledge librarian. Given a document, produce a small JSON
metadata object that helps the user find this doc again later. Do not
restate the document; describe it.

Return ONLY a JSON object with these fields:

{
  "tags": ["3-7 short lowercase labels — single nouns or noun phrases,
            no full sentences, no hashtags. Pick concrete + retrieval-
            useful tags, not abstract ('ai', 'pricing'), not
            generic ('notes', 'doc')."],
  "cluster_id": "single short slug (kebab-case, max 32 chars) that
                 groups this doc with peers on the same topic. Stable —
                 the same topic should produce the same cluster_id
                 across docs (e.g. 'product-strategy', 'auth-design',
                 'house-renovation-plan').",
  "ai_summary": "1-2 sentences (max 240 chars total) describing what
                 the doc is about and what someone would use it for.
                 No leading 'This document...'. Direct, neutral voice.",
  "entities": [
    { "type": "person|place|topic|organization|product|event",
      "value": "Proper noun or canonical name",
      "confidence": 0.0-1.0 }
  ]
}

Constraints:
- tags: 3-7 items, each <= 24 chars.
- cluster_id: required, never null. If the doc is misc, use 'misc'.
- ai_summary: required, <= 240 chars.
- entities: 0-12 items. Drop low-confidence (< 0.6) candidates.
- No markdown, no code fences, no commentary. Pure JSON.`;

interface OrganizePayload {
  tags: string[];
  cluster_id: string;
  ai_summary: string;
  entities: Array<{ type: string; value: string; confidence: number }>;
}

function clampPayload(raw: unknown): OrganizePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tagsIn = Array.isArray(r.tags) ? r.tags : [];
  const tags = tagsIn
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().toLowerCase().slice(0, 24))
    .slice(0, 7);
  const cluster_id = typeof r.cluster_id === "string" && r.cluster_id.trim()
    ? r.cluster_id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 32)
    : "misc";
  const ai_summary = typeof r.ai_summary === "string"
    ? r.ai_summary.trim().slice(0, 240)
    : "";
  const entitiesIn = Array.isArray(r.entities) ? r.entities : [];
  const entities = entitiesIn
    .filter((e): e is { type: string; value: string; confidence?: number } =>
      !!e && typeof e === "object" &&
      typeof (e as { type?: unknown }).type === "string" &&
      typeof (e as { value?: unknown }).value === "string")
    .map((e) => ({
      type: e.type.toLowerCase(),
      value: e.value.trim().slice(0, 120),
      confidence: typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : 0.7,
    }))
    .filter((e) => e.confidence >= 0.6 && e.value.length > 0)
    .slice(0, 12);
  if (!ai_summary && tags.length === 0) return null;
  return { tags, cluster_id, ai_summary, entities };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Strip fenced code blocks if the model returned them despite the
  // "pure JSON" instruction.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fenceMatch ? fenceMatch[1] : trimmed;
  try { return JSON.parse(body); } catch { /* try outer brace match */ }
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(body.slice(first, last + 1)); } catch { /* give up */ }
  }
  return null;
}

/**
 * Compute related_doc_ids using cosine similarity on doc embeddings
 * already stored in the documents table. Pulls the top 10 nearest
 * neighbours of the same owner. Skips when the doc has no embedding
 * yet (the doc_embedding job will fill that later; next organize run
 * picks them up).
 */
async function computeRelatedDocs(
  supabase: SupabaseClient,
  userId: string,
  docId: string,
): Promise<string[]> {
  // First check whether THIS doc has an embedding to compare against.
  const { data: self } = await supabase
    .from("documents")
    .select("id, embedding")
    .eq("id", docId)
    .maybeSingle();
  const selfEmbedding = (self as { embedding?: number[] | null } | null)?.embedding;
  if (!self || !selfEmbedding || !Array.isArray(selfEmbedding)) return [];
  // Use a Postgres RPC if one exists for vector search; otherwise the
  // raw approach below would need pgvector ops. Skip when not configured.
  try {
    const { data, error } = await supabase.rpc("match_related_docs", {
      query_doc_id: docId,
      query_user_id: userId,
      match_limit: 10,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as Array<{ id: string }>)
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string" && id !== docId)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Enqueue an organize job for one doc. Skips when:
 *   - body too short (< MIN_BODY_CHARS)
 *   - the row is locked (user pinned a manual edit)
 *   - a recent done run is within the cool-down
 */
export async function enqueueOrganizeDoc(args: {
  supabase: SupabaseClient;
  userId: string;
  docId: string;
  title: string;
  markdown: string;
  force?: boolean;
}): Promise<string | null> {
  const { supabase, userId, docId, title, markdown, force = false } = args;
  const md = (markdown || "").trim();
  if (md.length < MIN_BODY_CHARS) return null;
  if (!force) {
    const { data: existing } = await supabase
      .from("document_ai_metadata")
      .select("locked, generated_at")
      .eq("document_id", docId)
      .maybeSingle();
    if (existing?.locked) return null;
    if (existing?.generated_at) {
      const sinceMs = Date.now() - new Date(existing.generated_at).getTime();
      if (sinceMs < RE_RUN_COOLDOWN_MS) return null;
    }
  }
  return enqueueJob({
    supabase, userId, kind: "doc_organize", targetDocId: docId,
    payload: { title: title || "Untitled", markdown: md },
  });
}

/**
 * Worker handler. Called by drainJobs() (cron) and the inline fast-path
 * after enqueue. Marks the row done/failed at the end.
 */
export async function runOrganizeDocJob(
  supabase: SupabaseClient,
  job: JobRow,
): Promise<void> {
  try {
    const userId = job.user_id;
    const docId = job.target_doc_id;
    if (!userId || !docId) {
      await failJob(supabase, job, new Error("missing user_id or target_doc_id"));
      return;
    }
    let title = (job.payload?.title as string) || "Untitled";
    let markdown = (job.payload?.markdown as string) || "";
    if (!markdown || markdown.length < MIN_BODY_CHARS) {
      const { data: row } = await supabase
        .from("documents")
        .select("title, markdown")
        .eq("id", docId)
        .maybeSingle();
      title = row?.title || title;
      markdown = (row?.markdown || "").trim();
      if (markdown.length < MIN_BODY_CHARS) {
        await completeJob(supabase, job.id);
        return;
      }
    }

    // Truncate long bodies. 12k chars caps prompt cost; the librarian
    // pass doesn't need the full text, just enough to peg the topic.
    const bodySnippet = markdown.slice(0, 12_000);
    const prompt = `${ORGANIZE_PROMPT}\n\nTitle: ${title}\n\nBody:\n${bodySnippet}`;

    const ai = await callAI({ prompt, temperature: 0.2, maxOutputTokens: 1024 });
    if (!ai.ok) {
      await failJob(supabase, job, new Error(`callAI failed: ${ai.error || "unknown"}`));
      return;
    }
    const parsed = clampPayload(extractJsonObject(ai.text));
    if (!parsed) {
      await failJob(supabase, job, new Error("AI returned unparseable / empty metadata"));
      return;
    }

    const related = await computeRelatedDocs(supabase, userId, docId);

    const { error: upsertErr } = await supabase
      .from("document_ai_metadata")
      .upsert({
        document_id: docId,
        tags: parsed.tags,
        cluster_id: parsed.cluster_id,
        ai_summary: parsed.ai_summary,
        related_doc_ids: related,
        entities: parsed.entities,
        agent: `memory-wiki-${ai.provider}`,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "document_id" });

    if (upsertErr) {
      await failJob(supabase, job, new Error(`upsert failed: ${upsertErr.message}`));
      return;
    }

    await completeJob(supabase, job.id);
  } catch (err) {
    console.warn("organize-doc job failed", JSON.stringify({
      jobId: job.id,
      docId: job.target_doc_id,
      userId: job.user_id,
      attempt: job.attempts,
      err: err instanceof Error ? err.message : String(err),
    }));
    await failJob(supabase, job, err);
  }
}
