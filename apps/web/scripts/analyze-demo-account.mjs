#!/usr/bin/env node
// analyze-demo-account.mjs — runs embedding + AI organize +
// hub re-analyze passes over the seeded demo@memory.wiki content
// so the Settings → Your Hub stats, semantic search, and bundle
// concept canvas all surface real data when a reviewer or guest
// opens the demo.
//
// Pipeline (best-effort, errors logged but don't block):
//   1. POST /api/embed/<docId>           for every doc          (chunks + embeddings)
//   2. POST /api/embed/bundle/<bundleId> for every bundle       (bundle vector)
//   3. POST /api/docs/<docId>/organize   for every doc          (tags / cluster / summary)
//   4. POST /api/user/hub/reanalyze      (concept_index + relations rebuild)
//
// USAGE:
//   cd apps/web
//   node --env-file=.env.local scripts/analyze-demo-account.mjs

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HOST = process.env.MW_HOST || "https://memory.wiki";
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const s = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const DEMO_EMAIL = "demo@memory.wiki";

const { data: profile } = await s
  .from("profiles")
  .select("id, hub_slug")
  .eq("email", DEMO_EMAIL)
  .single();
if (!profile) {
  console.error(`Demo profile not found. Run seed-demo-account.mjs first.`);
  process.exit(1);
}
console.log(`Demo user: ${profile.id} (hub_slug=${profile.hub_slug})`);

const { data: docs } = await s
  .from("documents")
  .select("id, title")
  .eq("user_id", profile.id)
  .is("deleted_at", null);
console.log(`Documents to process: ${docs?.length ?? 0}`);

const { data: bundles } = await s
  .from("bundles")
  .select("id, title")
  .eq("user_id", profile.id);
console.log(`Bundles to process: ${bundles?.length ?? 0}`);

const headers = {
  "Content-Type": "application/json",
  "x-user-id": profile.id
};

async function hit(label, url, init = {}) {
  try {
    const res = await fetch(url, { headers, method: "POST", ...init });
    const ok = res.ok ? "OK" : `HTTP ${res.status}`;
    process.stdout.write(`  ${label} → ${ok}\n`);
    return res.ok;
  } catch (err) {
    process.stdout.write(`  ${label} → ERR ${err.message}\n`);
    return false;
  }
}

console.log("\n[1/4] Doc embeddings + chunks");
for (const d of docs ?? []) {
  await hit(d.title.slice(0, 60), `${HOST}/api/embed/${d.id}`);
}

console.log("\n[2/4] Bundle embeddings");
for (const b of bundles ?? []) {
  await hit(b.title.slice(0, 60), `${HOST}/api/embed/bundle/${b.id}`);
}

console.log("\n[3/4] Doc organize (tags + cluster + summary)");
for (const d of docs ?? []) {
  await hit(d.title.slice(0, 60), `${HOST}/api/docs/${d.id}/organize`);
}

console.log("\n[4/4] Hub re-analyze (concept_index + relations)");
await hit("hub", `${HOST}/api/user/hub/reanalyze`);

console.log("\nDONE. Demo hub:");
console.log(`  ${HOST}/@${profile.hub_slug}`);
