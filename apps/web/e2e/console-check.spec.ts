import { test, expect } from "@playwright/test";
import { setupEditableTab } from "./_helpers";

/**
 * Catch any uncaught console errors / page errors during a normal editor load.
 * Filters out known-benign warnings (Next.js HMR, dev-mode WASM async/await,
 * 401s on auth-required endpoints when not signed in).
 */
test("no uncaught errors on editor load", async ({ page }) => {
  test.setTimeout(60000); // CI cold-starts the editor route on first hit
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push("PAGE_ERROR: " + err.message));

  await setupEditableTab(page);
  await page.waitForTimeout(2000);

  const fatal = errors.filter((e) => {
    if (/401|Unauthorized/i.test(e)) return false; // not signed in
    if (/asyncWebAssembly|async\/await/i.test(e)) return false; // dev-mode WASM warning
    // "Failed to load resource" is the browser's generic message for a
    // failed network request (HTTP error status) — not a JS bug. In CI
    // (no Supabase env) several API routes return 503; those, plus the
    // usual 4xx on auth-gated endpoints, are environmental noise. Real
    // crashes surface as pageerror ("PAGE_ERROR: …") which is kept.
    if (/Failed to load resource/i.test(e)) return false;
    return true;
  });

  if (fatal.length) {
    console.log("UNEXPECTED ERRORS:\n" + fatal.map((e) => "  - " + e).join("\n"));
  }
  expect(fatal).toEqual([]);
});
