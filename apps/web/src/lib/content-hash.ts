/**
 * Deterministic, dependency-free content hash shared by the client
 * (useAutoSave) and the server (auto-save conflict check). Both sides
 * MUST hash the exact same string and get the exact same result, so
 * this is a plain FNV-1a 32-bit hash rendered as hex — no Web Crypto
 * (async, env-dependent), no Node crypto (server-only).
 *
 * Why a content hash for conflict detection instead of a timestamp:
 * the old check compared the row's `updated_at` against the client's
 * last-known timestamp and 409'd when the server's was newer. But
 * `updated_at` moves for reasons that are NOT a real external edit —
 * concurrent in-flight saves whose responses land out of order, the
 * realtime echo of the user's own save, future side-channel writers.
 * Any of those produced a false "Document Conflict" while the user
 * was happily editing their own doc alone. Hashing the BODY makes the
 * check care about the only thing that matters: did the server's
 * actual content diverge from what the client last saw? If not, it's
 * not a conflict no matter what the timestamp did.
 */
export function contentHash(input: string): string {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts (keeps it in 32-bit range)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // Length suffix guards against the (already tiny) FNV collision space
  // for same-length anagrams in practice.
  return h.toString(16).padStart(8, "0") + "-" + input.length.toString(16);
}
