/**
 * Backlinks — self-wiring knowledge graph.
 *
 * Zero LLM cost. Pure regex extraction on markdown bodies. Recognizes
 * five reference shapes, all of which collapse to one of three target
 * kinds (`document` / `bundle` / `hub`):
 *
 *   memory.wiki/<8 nanoid>          → document
 *   memory.wiki/d/<8 nanoid>        → document (canonical)
 *   memory.wiki/b/<8 nanoid>        → bundle
 *   memory.wiki/hub/<slug>          → hub
 *   [[<8 nanoid>]]                  → document wikilink
 *
 * The slug grammar matches getHub() in /hub/[slug]/page.tsx:
 *   /^[a-z0-9_-]{3,32}$/
 *
 * Document/bundle IDs are nanoid(8) — alphabet
 *   A-Z a-z 0-9 _ -   (length exactly 8).
 *
 * The extractor never validates that the target exists. Render-time
 * JOINs against documents / bundles / profiles filter dead references.
 *
 * Used by:
 *   - /api/docs    on POST + PATCH
 *   - /api/bundles on POST + PATCH
 *   - /api/profile (or wherever hub_description gets updated)
 *
 * Replace strategy: on save, DELETE all rows for this source then INSERT
 * the freshly-extracted set. Cheaper than diffing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type BacklinkEntityType = "document" | "bundle" | "hub";

export interface BacklinkRef {
  target_type: BacklinkEntityType;
  target_id: string;
  context: string | null;
}

const ID8 = "[A-Za-z0-9_-]{8}";
const SLUG = "[a-z0-9_-]{3,32}";

// Order matters: more specific patterns first so memory.wiki/b/<id>
// doesn't match the generic memory.wiki/<id> document rule.
const PATTERNS: Array<{ kind: BacklinkEntityType; re: RegExp }> = [
  // memory.wiki/d/<id> — canonical document URL
  { kind: "document", re: new RegExp(`(?:https?://)?memory\\.wiki/d/(${ID8})\\b`, "g") },
  // memory.wiki/b/<id> — bundle
  { kind: "bundle",   re: new RegExp(`(?:https?://)?memory\\.wiki/b/(${ID8})\\b`, "g") },
  // memory.wiki/hub/<slug> — hub
  { kind: "hub",      re: new RegExp(`(?:https?://)?memory\\.wiki/hub/(${SLUG})\\b`, "g") },
  // [[<id>]] wikilink — document
  { kind: "document", re: new RegExp(`\\[\\[(${ID8})\\]\\]`, "g") },
  // memory.wiki/<id> — bare document URL (catch-all; runs LAST so the
  // /d/, /b/, /hub/ prefixes above win on overlap).
  { kind: "document", re: new RegExp(`(?:https?://)?memory\\.wiki/(${ID8})\\b`, "g") },
];

const CONTEXT_RADIUS = 60;

/**
 * Extract backlink references from a markdown body.
 *
 * Returns a de-duplicated list of (target_type, target_id, context)
 * triples. Each unique (target_type, target_id) pair appears at most
 * once; context is the first occurrence's surrounding text.
 *
 * Self-references (same id as source) are NOT filtered here — the
 * caller decides whether to skip them, since the caller knows its own
 * id.
 */
export function extractBacklinks(markdown: string | null | undefined): BacklinkRef[] {
  if (!markdown) return [];

  const seen = new Map<string, BacklinkRef>();

  for (const { kind, re } of PATTERNS) {
    // Fresh lastIndex per body in case the RegExp got cached.
    re.lastIndex = 0;
    for (const m of markdown.matchAll(re)) {
      const id = m[1];
      const key = `${kind}:${id}`;
      if (seen.has(key)) continue;
      const idx = m.index ?? 0;
      const start = Math.max(0, idx - CONTEXT_RADIUS);
      const end = Math.min(markdown.length, idx + m[0].length + CONTEXT_RADIUS);
      const context = markdown.slice(start, end).replace(/\s+/g, " ").trim();
      seen.set(key, { target_type: kind, target_id: id, context: context || null });
    }
  }

  return Array.from(seen.values());
}

/**
 * Re-extract and persist backlinks for one source.
 *
 * Idempotent: delete-then-insert. If markdown is empty or has no refs,
 * the source's outbound edges are cleared.
 *
 * Skips self-references (a doc linking to itself adds noise without
 * value).
 *
 * Server-side only. Caller must use a service-role Supabase client.
 */
export async function syncBacklinks(
  supabase: SupabaseClient,
  source_type: BacklinkEntityType,
  source_id: string,
  markdown: string | null | undefined,
): Promise<{ inserted: number; cleared: boolean }> {
  // Wipe existing outbound edges for this source.
  const { error: delErr } = await supabase
    .from("backlinks")
    .delete()
    .eq("source_type", source_type)
    .eq("source_id", source_id);
  if (delErr) {
    // Don't crash the save flow — backlinks are best-effort.
    console.error("syncBacklinks delete failed", { source_type, source_id, delErr });
    return { inserted: 0, cleared: false };
  }

  const refs = extractBacklinks(markdown).filter(
    (r) => !(r.target_type === source_type && r.target_id === source_id),
  );

  if (refs.length === 0) {
    return { inserted: 0, cleared: true };
  }

  const rows = refs.map((r) => ({
    source_type,
    source_id,
    target_type: r.target_type,
    target_id: r.target_id,
    context: r.context,
  }));

  const { error: insErr } = await supabase.from("backlinks").insert(rows);
  if (insErr) {
    console.error("syncBacklinks insert failed", { source_type, source_id, insErr });
    return { inserted: 0, cleared: true };
  }

  return { inserted: rows.length, cleared: true };
}
