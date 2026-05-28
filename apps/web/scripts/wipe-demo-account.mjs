#!/usr/bin/env node
// wipe-demo-account.mjs — nukes every row tied to demo@memory.wiki
// so the seed script can re-run from a clean slate. Used when an
// earlier run wrote duplicates (the original seed used random ids
// that defeated upsert dedup).
//
// USAGE:
//   cd apps/web
//   node --env-file=.env.local scripts/wipe-demo-account.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing env");
  process.exit(1);
}
const s = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_EMAIL = "demo@memory.wiki";

const { data: profile } = await s
  .from("profiles")
  .select("id")
  .eq("email", DEMO_EMAIL)
  .single();
if (!profile) {
  console.log("Demo profile not found — nothing to wipe.");
  process.exit(0);
}
const userId = profile.id;
console.log(`Wiping demo user: ${userId}`);

// Find all doc + bundle ids first so we can wipe related rows
// (chunks, bundle_documents, concept_index relations).
const { data: docs } = await s.from("documents").select("id").eq("user_id", userId);
const { data: bundles } = await s.from("bundles").select("id").eq("user_id", userId);
const docIds = (docs || []).map(d => d.id);
const bundleIds = (bundles || []).map(b => b.id);

async function deleteIn(table, column, values) {
  if (!values.length) return;
  for (let i = 0; i < values.length; i += 100) {
    const slice = values.slice(i, i + 100);
    const { error } = await s.from(table).delete().in(column, slice);
    if (error) console.warn(`  ${table}.${column}: ${error.message}`);
  }
}

await deleteIn("document_chunks", "doc_id", docIds);          console.log(`  document_chunks (×${docIds.length} docs)`);
await deleteIn("bundle_documents", "bundle_id", bundleIds);   console.log(`  bundle_documents (×${bundleIds.length} bundles)`);
const { error: bdel } = await s.from("bundles").delete().eq("user_id", userId);
console.log(`  bundles${bdel ? ": " + bdel.message : ""}`);
const { error: ddel } = await s.from("documents").delete().eq("user_id", userId);
console.log(`  documents${ddel ? ": " + ddel.message : ""}`);
const { error: fdel } = await s.from("folders").delete().eq("user_id", userId);
console.log(`  folders${fdel ? ": " + fdel.message : ""}`);
const { error: cdel } = await s.from("concept_index").delete().eq("user_id", userId);
console.log(`  concept_index${cdel ? ": " + cdel.message : ""}`);
// concept_relations — table may key on user_id or via concept_id FK.
// Try a best-effort cascade.
try {
  await s.from("concept_relations").delete().eq("user_id", userId);
} catch {}

console.log("\nDONE. Run seed-demo-account.mjs to repopulate.");
