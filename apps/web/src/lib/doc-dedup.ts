// Owner-scoped dedup for document creation.
//
// Every server-side path that ends in `INSERT INTO documents` should
// pre-check via `findRecentDuplicateDoc()`. If an existing doc owned by
// the same caller has identical (markdown, title), the caller should
// return THAT row instead of inserting a sibling.
//
// Policy (revised 2026-06-16): dedup collapses only NEAR-SIMULTANEOUS
// accidental duplicates — double-submit, multi-tab create races — inside a
// short window. INTENTIONAL identical docs (the Duplicate flow, pasting the
// same content into two drafts, two notes that converge) are legitimate and
// must NOT be silently merged. The previous "unbounded for authenticated
// users" mode merged identical creates HOURS/DAYS apart and — together with
// the migration-029 unique index (dropped in 063) — made it impossible to
// keep two same-content docs, which is bizarre for a notes tool.
//   - Exact (byte-identical) match → short window (DEDUP_WINDOW_MS), all callers.
//   - Loose (whitespace-diff) match → anon only, slightly longer, for
//     Chrome-ext capture races that emit near-duplicate rows.
//
// Owner is keyed on (user_id) when present, otherwise (anonymous_id).

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEDUP_WINDOW_MS = 30_000;
// Loose-match window for anon captures. Audit 1 uncovered Chrome ext
// captures producing 2-3 near-duplicate rows (whitespace-only diffs)
// minutes apart — exact-md5 dedup let them through. Loose match
// catches them. Authenticated users already use unbounded dedup, so
// this only widens the anon path.
export const DEDUP_LOOSE_WINDOW_MS = 5 * 60_000;
const FINGERPRINT_LEN = 200;

/** Cheap fingerprint for near-duplicate detection. */
function fingerprintBody(md: string): string {
  return md.replace(/\s+/g, " ").trim().slice(0, FINGERPRINT_LEN).toLowerCase();
}

/**
 * True when the supabase error is the partial UNIQUE index from
 * migration 029 firing on a same-owner same-(title, markdown) insert.
 * The caller should look up the existing row and return it instead of
 * propagating the failure.
 */
export function isStrictDupLockError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  return error.code === "23505" && !!error.message?.includes("documents_owner_strict_dup_lock");
}

export interface DedupOwner {
  userId?: string | null;
  anonymousId?: string | null;
}

export interface DedupHit {
  id: string;
  edit_token: string;
  created_at: string;
}

/**
 * Look for an existing doc owned by the same caller with identical
 * (markdown, title). Returns the row if found, else null. Best-effort —
 * a thrown error resolves to null so a hit-failure never blocks
 * insertion.
 *
 * Exact (byte-identical) matches are collapsed only within a short
 * accidental-race window (DEDUP_WINDOW_MS) for ALL callers, so intentional
 * identical docs are never merged. Loose (whitespace-diff) matches apply to
 * anonymous callers only. The legacy `options.unbounded` flag is accepted
 * for back-compat but no longer extends the window to "forever".
 */
export async function findRecentDuplicateDoc(
  supabase: SupabaseClient,
  owner: DedupOwner,
  markdown: string,
  title: string | null | undefined,
  options?: { unbounded?: boolean },
): Promise<DedupHit | null> {
  if (!owner.userId && !owner.anonymousId) return null;
  if (!markdown || markdown.length === 0) return null;
  try {
    const filterCol = owner.userId ? "user_id" : "anonymous_id";
    const filterVal = (owner.userId || owner.anonymousId)!;
    void options; // `unbounded` is intentionally no longer honored — see note above.
    // Exact-match window: near-simultaneous races only, for everyone, so
    // intentional identical docs are never merged. Loose match: anon only.
    const exactWindowMs = DEDUP_WINDOW_MS;
    const looseWindowMs = owner.userId ? 0 : DEDUP_LOOSE_WINDOW_MS;
    const queryWindowMs = Math.max(exactWindowMs, looseWindowMs);
    const sinceIso = new Date(Date.now() - queryWindowMs).toISOString();
    let q = supabase
      .from("documents")
      .select("id, edit_token, markdown, title, created_at, deleted_at")
      .eq(filterCol, filterVal)
      .is("deleted_at", null)
      .gte("created_at", sinceIso);
    // Filter by title server-side to narrow the result set quickly.
    // Title can be null in the DB; eq("title", null) doesn't work in
    // PostgREST so use is/null in that case.
    if (title) q = q.eq("title", title);
    else q = q.is("title", null);

    // Oldest first — when there's an existing hit we want the canonical
    // (original) row, not the newest near-duplicate.
    q = q.order("created_at", { ascending: true }).limit(20);
    const { data: rows } = await q;

    // Exact byte-identical match within the short accidental-race window.
    const exactSince = Date.now() - exactWindowMs;
    const exact = (rows || []).find((row) => row.markdown === markdown && new Date(row.created_at).getTime() >= exactSince);
    if (exact) return { id: exact.id, edit_token: exact.edit_token, created_at: exact.created_at };

    // Loose match (anon only): same fingerprint within the loose window.
    // Catches Chrome-ext capture races where the body differs by trailing
    // whitespace or a punctuation tweak but represents the same paste.
    if (looseWindowMs > 0) {
      const looseSince = Date.now() - looseWindowMs;
      const fp = fingerprintBody(markdown);
      if (fp.length < 30) return null; // too short to fingerprint reliably
      const loose = (rows || []).find((row) => {
        if (!row.markdown) return false;
        if (new Date(row.created_at).getTime() < looseSince) return false;
        return fingerprintBody(row.markdown) === fp;
      });
      if (loose) return { id: loose.id, edit_token: loose.edit_token, created_at: loose.created_at };
    }
    return null;
  } catch {
    return null;
  }
}
