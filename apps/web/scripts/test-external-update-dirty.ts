/**
 * Scenario matrix for isLocalDirty — the predicate the editor uses
 * to decide whether an external update should fire "Synced" (clean
 * auto-pull) or "updated elsewhere" (real conflict).
 *
 * Each scenario describes the editor's state at the moment a Supabase
 * realtime payload OR focus/visibility refetch lands, then asserts
 * the resulting toast / outcome.
 *
 * Run: cd apps/web && npx tsx scripts/test-external-update-dirty.ts
 */

import { isLocalDirty } from "../src/lib/external-update-dirty";

type Case = {
  name: string;
  state: Parameters<typeof isLocalDirty>[0];
  expectDirty: boolean;
  note?: string;
};

const cases: Case[] = [
  // ─── Viewer-only flow (the original bug report) ──────────────────
  {
    name: "A1. Pristine viewer, 1st external edit",
    state: { localMd: "X", lastSaved: "", lastSynced: "X", isSaving: false },
    expectDirty: false,
    note: "init populated lastSynced from the loaded tab body",
  },
  {
    name: "A2. Viewer, 2nd external edit after auto-pull",
    state: { localMd: "Y", lastSaved: "", lastSynced: "Y", isSaving: false },
    expectDirty: false,
    note: "previous auto-pull set lastSynced=Y and localMd=Y synchronously",
  },
  {
    name: "A3. Viewer, 3rd external edit",
    state: { localMd: "Z", lastSaved: "", lastSynced: "Z", isSaving: false },
    expectDirty: false,
  },

  // ─── Save then external (the cascade-bug scenario) ───────────────
  {
    name: "B1. User saved Y, external Z arrives (pre-pull)",
    state: { localMd: "Y", lastSaved: "Y", lastSynced: "X", isSaving: false },
    expectDirty: false,
    note: "matchesSaved wins; cascade `lastSaved||lastSynced` would also be correct here",
  },
  {
    name: "B2. After auto-pull of Z, 2nd external Z2 arrives",
    state: { localMd: "Z", lastSaved: "Y", lastSynced: "Z", isSaving: false },
    expectDirty: false,
    note: "CRITICAL: cascade `lastSaved||lastSynced` would pick Y and false-flag dirty here",
  },
  {
    name: "B3. After 3rd external Z3 auto-pulled",
    state: { localMd: "Z3", lastSaved: "Y", lastSynced: "Z3", isSaving: false },
    expectDirty: false,
  },

  // ─── User typing flows (real conflict) ───────────────────────────
  {
    name: "C1. User typed Y, external Z arrives, no save yet",
    state: { localMd: "Y", lastSaved: "", lastSynced: "X", isSaving: false },
    expectDirty: true,
    note: "real conflict — user has unsaved edits",
  },
  {
    name: "C2. User typed Y, external Z arrives, debounce not flushed",
    state: { localMd: "Y", lastSaved: "", lastSynced: "X", isSaving: false },
    expectDirty: true,
  },
  {
    name: "E1. Saved Y, then typed Y2, external Z arrives",
    state: { localMd: "Y2", lastSaved: "Y", lastSynced: "X", isSaving: false },
    expectDirty: true,
    note: "user has post-save unsaved edits",
  },
  {
    name: "E2. Save in flight when external arrives",
    state: { localMd: "Y", lastSaved: "X", lastSynced: "X", isSaving: true },
    expectDirty: true,
    note: "isSaving=true → always dirty (PATCH body !== last persisted)",
  },

  // ─── Tab switch ──────────────────────────────────────────────────
  {
    name: "G1. Just switched to tab B; external Z on B arrives",
    state: { localMd: "B_body", lastSaved: "", lastSynced: "B_body", isSaving: false },
    expectDirty: false,
    note: "init effect reset lastSynced to B's body on cloudId change",
  },

  // ─── Empty doc ───────────────────────────────────────────────────
  {
    name: "Empty-1. Fresh empty doc, external edit Z arrives",
    state: { localMd: "", lastSaved: "", lastSynced: "", isSaving: false },
    expectDirty: false,
    note: "init populated lastSynced='' (empty doc is a valid in-sync state)",
  },
  {
    name: "Empty-2. Empty doc, user typed Y, external Z arrives",
    state: { localMd: "Y", lastSaved: "", lastSynced: "", isSaving: false },
    expectDirty: true,
    note: "real conflict on empty doc",
  },

  // ─── Pre-init guard (lastSynced still null) ──────────────────────
  {
    name: "Pre-1. External arrives before init effect ran, body matches",
    state: { localMd: "X", lastSaved: "", lastSynced: null, isSaving: false },
    expectDirty: true,
    note: "no baseline known → safer to flag dirty than risk silent overwrite",
  },
  {
    name: "Pre-2. External arrives before init, but lastSaved matches",
    state: { localMd: "Y", lastSaved: "Y", lastSynced: null, isSaving: false },
    expectDirty: false,
    note: "lastSaved is an independent baseline; pre-init lastSynced doesn't block it",
  },

  // ─── Race: save just completed, lastSynced not mirrored yet ─────
  {
    name: "Race-1. PATCH success at T, external arrives at T+1ms",
    state: { localMd: "Y", lastSaved: "Y", lastSynced: "X", isSaving: false },
    expectDirty: false,
    note: "matchesSaved closes the mirror-effect race window",
  },
];

let failed = 0;
for (const c of cases) {
  const got = isLocalDirty(c.state);
  const ok = got === c.expectDirty;
  if (!ok) failed++;
  const tag = ok ? "PASS" : "FAIL";
  // eslint-disable-next-line no-console
  console.log(
    `${tag}  ${c.name}\n      expect dirty=${c.expectDirty}  got dirty=${got}` +
      (c.note ? `\n      ${c.note}` : "")
  );
}

// eslint-disable-next-line no-console
console.log(`\n${cases.length - failed}/${cases.length} passing`);

if (failed) process.exit(1);
