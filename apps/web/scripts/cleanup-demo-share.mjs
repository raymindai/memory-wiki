#!/usr/bin/env node
/*
 * One-time cleanup: un-share the founder's real address (hi@raymind.ai)
 * from demo-seeded docs/bundles. The demo seed used to add the founder's
 * email to allowed_emails, so demo content showed up permanently in their
 * own "Shared with me" and couldn't be cleared from the UI (re-seeding
 * re-added it). This removes that email from the access lists — exactly
 * what "Remove from list" does, in bulk, server-side. Reversible (re-add).
 *
 * Run: node apps/web/scripts/cleanup-demo-share.mjs
 * Reads SUPABASE creds from apps/web/.env.local.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};
const URL = get("NEXT_PUBLIC_SUPABASE_URL");
const KEY = get("SUPABASE_SERVICE_ROLE_KEY");
const EMAIL = (process.argv[2] || "hi@raymind.ai").toLowerCase();
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const has = (arr) => Array.isArray(arr) && arr.some((x) => (x || "").trim().toLowerCase() === EMAIL);

async function cleanTable(table) {
  const sel = table === "documents" ? "id,allowed_emails,allowed_editors" : "id,allowed_emails";
  const r = await fetch(`${URL}/rest/v1/${table}?select=${sel}&or=(allowed_emails.cs.{"${EMAIL}"}${table === "documents" ? `,allowed_editors.cs.{"${EMAIL}"}` : ""})`, { headers: H });
  const rows = await r.json();
  if (!Array.isArray(rows)) { console.log(`${table}: query error`, JSON.stringify(rows).slice(0, 200)); return; }
  console.log(`${table}: ${rows.length} matched`);
  let changed = 0;
  for (const d of rows) {
    const body = {};
    if (has(d.allowed_emails)) body.allowed_emails = (d.allowed_emails || []).filter((e) => (e || "").trim().toLowerCase() !== EMAIL);
    if (table === "documents" && has(d.allowed_editors)) body.allowed_editors = (d.allowed_editors || []).filter((e) => (e || "").trim().toLowerCase() !== EMAIL);
    if (Object.keys(body).length === 0) continue;
    const u = await fetch(`${URL}/rest/v1/${table}?id=eq.${d.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (u.ok) changed++; else console.log(`  FAIL ${d.id}`, u.status, await u.text());
  }
  console.log(`${table}: cleaned ${changed}`);
  const v = await fetch(`${URL}/rest/v1/${table}?select=id&or=(allowed_emails.cs.{"${EMAIL}"}${table === "documents" ? `,allowed_editors.cs.{"${EMAIL}"}` : ""})`, { headers: H });
  const vd = await v.json();
  console.log(`${table}: remaining with ${EMAIL}:`, Array.isArray(vd) ? vd.length : vd);
}

(async () => {
  console.log("Cleaning shares for", EMAIL);
  await cleanTable("documents");
  await cleanTable("bundles");
  console.log("done");
})();
