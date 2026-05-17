// Single helper every doc-ingest path calls so a freshly created or
// substantially edited document gets folded into the user's hub
// ontology in the background.
//
// Fire-and-forget. The caller wraps this in Next.js's `after()` so the
// HTTP response goes out immediately and the LLM extraction happens
// after-response. Failures are swallowed — never let the ingest path
// fail because of a side-effect extractor.
//
// Throttling: a rolling 30-minute per-doc cooldown prevents autosaves
// from re-triggering Haiku every few seconds. Process-local Map is
// fine here because the cooldown only needs to dampen burst writes
// from the same node; cross-region duplicates are harmless (the
// extractor itself is idempotent).

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractDocOntology } from "@/lib/extract-doc-ontology";

const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const MIN_DELTA_CHARS = 200;        // skip whitespace-only autosaves

interface RefreshState {
  lastAt: number;
  lastChars: number;
}

const docState = new Map<string, RefreshState>();

export interface OntologyRefreshArgs {
  supabase: SupabaseClient;
  userId: string | null | undefined;
  docId: string;
  title: string | null | undefined;
  markdown: string | null | undefined;
  /** Force-bypass the cooldown — used by manual rebuild paths. */
  force?: boolean;
}

/**
 * Run extractDocOntology if the doc clears the cooldown + delta
 * thresholds. Returns immediately for anonymous docs (no user_id to
 * attribute concepts to) and tiny docs that wouldn't yield useful
 * concepts anyway.
 *
 * Auto-promotes to force=true when the user's concept_index is
 * empty — i.e. the very first ontology-eligible doc gets extracted
 * immediately so Compact view comes alive on day one. Subsequent
 * docs use the normal per-doc cooldown.
 *
 * Returns void — callers should not await this in latency-critical
 * paths. Use Next.js `after(() => enqueueOntologyRefresh(...))`.
 */
export async function enqueueOntologyRefresh(args: OntologyRefreshArgs): Promise<void> {
  const { supabase, userId, docId, title, markdown } = args;
  let force = args.force;
  if (!userId) return;
  const md = (markdown || "").trim();
  if (md.length < MIN_DELTA_CHARS) return;

  // First-doc kickoff — if the user has no concept_index rows yet,
  // bypass the cooldown so a brand new hub gets its Compact view
  // built on the first substantive save instead of waiting for a
  // second one to land. One extra count query per save, but only
  // until the first concept is written; harmless after that.
  let firstBuild = false;
  if (!force) {
    try {
      const { count } = await supabase
        .from("concept_index")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) === 0) {
        force = true;
        firstBuild = true;
      }
    } catch {
      /* count failures shouldn't block extraction — fall through */
    }
  }

  const key = `${userId}:${docId}`;
  const now = Date.now();
  const prev = docState.get(key);

  if (!force && prev) {
    const sinceMs = now - prev.lastAt;
    const delta = Math.abs(md.length - prev.lastChars);
    if (sinceMs < COOLDOWN_MS && delta < MIN_DELTA_CHARS) {
      return;
    }
  }

  // Reserve the slot eagerly so concurrent calls collapse into one
  // extraction attempt.
  docState.set(key, { lastAt: now, lastChars: md.length });

  try {
    const result = await extractDocOntology({
      supabase,
      userId,
      docId,
      title: title || "Untitled",
      markdown: md,
    });
    if (firstBuild) {
      // Structured log so the first-build outcome is easy to grep
      // in Vercel logs ("why is Compact still empty for this user?").
      console.info(
        "ontology refresh first-build",
        JSON.stringify({
          userId,
          docId,
          conceptsWritten: result.conceptsWritten,
          relationsWritten: result.relationsWritten,
          skipped: result.skipped || null,
        }),
      );
    }
    // AI-inferred doc intent. Only write when the row currently has
    // NO intent set — never override a user's manual choice from
    // the chip dropdown.
    if (result.inferredIntent) {
      try {
        const { data: row } = await supabase
          .from("documents")
          .select("intent")
          .eq("id", docId)
          .single();
        if (row && (row.intent === null || row.intent === undefined)) {
          await supabase.from("documents").update({ intent: result.inferredIntent }).eq("id", docId);
        }
      } catch {
        /* best-effort — never let a writeback error block the refresh */
      }
    }
  } catch (err) {
    // Roll back the cooldown on failure so the next save retries
    // instead of waiting 30 minutes.
    docState.delete(key);
    console.warn(
      "ontology refresh failed",
      JSON.stringify({
        userId,
        docId,
        firstBuild,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
