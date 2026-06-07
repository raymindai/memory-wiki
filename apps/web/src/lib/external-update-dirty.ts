/**
 * Decide whether the editor's local body has UNSAVED user edits
 * relative to anything we know the server has agreed with.
 *
 * Called from two places in MdEditor: the Supabase realtime channel
 * handler and the focus/visibility refetch. Both want the same
 * question — "did the user type something we haven't persisted?" —
 * because a true `dirty=true` means an external edit landing right
 * now is a real merge conflict and the toast should fire; while
 * `dirty=false` means the auto-pull is safe and silent.
 *
 * Inputs:
 *   localMd     — markdownRef.current (always fresh state mirror)
 *   lastSaved   — most recent body successfully PATCH'd to server.
 *                 Empty string "" means no save has happened this
 *                 session.
 *   lastSynced  — most recent body the editor APPLIED from a server
 *                 source (initial tab load, auto-pull from realtime,
 *                 focus refetch, conflict-resolve "Keep theirs",
 *                 rehydrate). Null means we haven't initialized yet.
 *   isSaving    — autoSave.isSaving (a PATCH is in flight; treat as
 *                 dirty because saving body !== last persisted body).
 *
 * Cleanness rule: localMd matches EITHER lastSaved OR lastSynced.
 *
 * Why both, not a cascade: after `Save Y` then `external auto-pull Z`,
 * lastSaved=Y but lastSynced=Z and localMd=Z. A cascade like
 * `lastSaved || lastSynced` would pick Y → flag dirty → false toast.
 * Treating each as an independent valid baseline covers viewer-only
 * AND post-save flows.
 *
 * Why a null sentinel for lastSynced: empty string "" is a valid
 * in-sync body for an empty doc — distinguishing "never initialized"
 * from "initialized to empty" matters for the very first realtime
 * event on a fresh doc.
 */
export function isLocalDirty(args: {
  localMd: string;
  lastSaved: string;          // "" when never saved
  lastSynced: string | null;  // null when never initialized
  isSaving: boolean;
}): boolean {
  if (args.isSaving) return true;
  const matchesSaved = args.lastSaved !== "" && args.localMd === args.lastSaved;
  const matchesSynced = args.lastSynced !== null && args.localMd === args.lastSynced;
  return !matchesSaved && !matchesSynced;
}
