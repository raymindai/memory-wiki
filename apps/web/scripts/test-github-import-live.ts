// Live regression test for POST /api/import/github.
//
// Hits a real GitHub URL (single tiny .md file from a stable public
// repo) through the import endpoint, asserts the response shape and
// that the inserted doc looks correct, then re-POSTs the same URL
// and asserts dedup kicked in (no second copy).
//
// We intentionally target a SINGLE-FILE URL so the test stays fast
// and doesn't burn the unauthenticated GitHub rate limit when run
// repeatedly during dev. The dedup assertion is the load-bearing
// part — silent dup creation in this endpoint would poison hubs.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env. Dev
// server (or staging) must be reachable at MDFY_BASE_URL (default
// http://localhost:3002).

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.MDFY_BASE_URL || "http://localhost:3002";
const TEST_USER_ID = process.env.MDFY_TEST_USER_ID || "4040031b-9fff-467e-a6ba-6656acc4fd92";

// Pick a tiny file from a stable widely-mirrored repo so the test
// doesn't fail when an upstream README changes shape.
const TARGET_URL = process.env.MDFY_GITHUB_TEST_URL
  || "https://github.com/raymindai/memory-wiki/blob/main/README.md";

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let pass = 0; let fail = 0;
const check = (label: string, cond: boolean, detail?: string) => {
  if (cond) { console.log("PASS —", label); pass++; }
  else      { console.log("FAIL —", label, detail || ""); fail++; }
};

interface ImportRow { id: string; title: string; path: string; sourceUrl: string; deduplicated?: boolean }
interface ImportResp { imported?: number; deduplicated?: number; failed?: number; docs?: ImportRow[]; error?: string }

async function callImport(payload: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(`${baseUrl}/api/import/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": TEST_USER_ID, ...headers },
    body: JSON.stringify(payload),
  });
  const json: ImportResp = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  // Track ids we create so we can clean up at the end even if assertions
  // throw partway.
  const createdIds: string[] = [];

  try {
    // 1) Auth gate
    const noAuthRes = await fetch(`${baseUrl}/api/import/github`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: TARGET_URL }),
    });
    check("no auth → 401", noAuthRes.status === 401, `got ${noAuthRes.status}`);

    // 2) Missing url body
    const noUrl = await callImport({});
    check("missing url → 400", noUrl.status === 400);

    // 3) Bogus URL → 400
    const badUrl = await callImport({ url: "https://example.com/not-github" });
    check("non-github URL → 400", badUrl.status === 400, `got ${badUrl.status}: ${JSON.stringify(badUrl.json)}`);

    // 4) Happy path — first import
    const first = await callImport({ url: TARGET_URL });
    check("first import responds 200", first.status === 200, `got ${first.status}: ${JSON.stringify(first.json).slice(0,200)}`);
    check("first.imported >= 1 OR deduplicated >= 1 (idempotent re-run)",
      (first.json.imported ?? 0) + (first.json.deduplicated ?? 0) >= 1,
      `imported=${first.json.imported} dedup=${first.json.deduplicated}`);
    check("docs[] is non-empty", Array.isArray(first.json.docs) && first.json.docs.length >= 1);

    // Track ids
    for (const d of (first.json.docs || [])) {
      if (!d.deduplicated && d.id) createdIds.push(d.id);
    }

    // 5) Inspect the inserted row directly to confirm shape
    const firstDoc = first.json.docs?.[0];
    if (firstDoc) {
      const { data: docRow } = await supabase
        .from("documents")
        .select("id, title, source, compile_from, user_id, is_draft")
        .eq("id", firstDoc.id)
        .single();
      check("doc row exists in DB", !!docRow, `id=${firstDoc.id}`);
      if (docRow) {
        check("source = github:owner/repo", String(docRow.source || "").startsWith("github:"), `got ${docRow.source}`);
        check("compile_from.external.provider === 'github'",
          (docRow.compile_from as { external?: { provider?: string } } | null)?.external?.provider === "github",
          `got ${JSON.stringify(docRow.compile_from)}`);
        check("doc.user_id matches caller", docRow.user_id === TEST_USER_ID);
        check("doc.is_draft === true (imports land as drafts)", docRow.is_draft === true);
      }
    }

    // 6) Idempotency — re-POST same URL, expect deduplicated >= 1
    const second = await callImport({ url: TARGET_URL });
    check("second import responds 200", second.status === 200);
    check("second import deduplicates at least one row",
      (second.json.deduplicated ?? 0) >= 1,
      `imported=${second.json.imported} dedup=${second.json.deduplicated}`);
    check("second import did NOT create new rows",
      (second.json.imported ?? 0) === 0,
      `imported=${second.json.imported} (expected 0 on re-run)`);
  } finally {
    // Cleanup — hard delete every doc we touched. We only hard-delete
    // ids we created (not deduplicated ones, which were from prior runs).
    if (createdIds.length > 0) {
      await supabase.from("documents").delete().in("id", createdIds);
      console.log(`\nCleaned up ${createdIds.length} test doc${createdIds.length === 1 ? "" : "s"}.`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();

export {};
