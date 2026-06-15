/*
 * Version history end-to-end (UI layer, stubbed API):
 *  1. The History panel lists versions, newest = "Current".
 *  2. Clicking a past version shows a READ-ONLY preview overlay
 *     ([data-version-preview]) rendering that version's content — the
 *     live editor underneath is untouched (no autosave can fire).
 *  3. Restore opens the styled confirm dialog (NOT window.confirm —
 *     founder rule: no system modals) and, on confirm, restores.
 *
 * Auth model mirrors conflict-detection.spec: a fake sb-*-auth-token
 * localStorage marker satisfies the cloud-tab hydration keep-check
 * (MdEditor L823), and the doc GET stub returns isOwner:true so the
 * History + Restore affordances render — no real Supabase round-trip.
 */
import { test, expect, type Page } from "@playwright/test";

const DOC = "doc-ver";
const CURRENT_MD = "# Ver Doc\n\ncurrent v3 content\n";
const V1_MD = "# Ver Doc\n\nOLD v1 content here\n";

async function stub(page: Page) {
  // Catch-alls FIRST (Playwright runs last-registered first).
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  // Kitchen-sink empty arrays so any `.length`/`.map` on an unstubbed
  // endpoint's response finds an array, not undefined.
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [], recent: [], shared: [], pins: [], folders: [], concepts: [], versions: [], items: [], data: [], results: [], notifications: [], jobs: [], images: [], bundles: [], hubs: [], conceptIndex: { concepts: [] } }) }));

  // User sidebar endpoints need their array-shaped success bodies.
  await page.route("**/api/user/documents**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [] }) }));
  await page.route("**/api/user/recent**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recent: [] }) }));
  await page.route("**/api/user/shared**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shared: [] }) }));
  await page.route("**/api/user/pins**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pins: [] }) }));
  await page.route("**/api/user/folders**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ folders: [] }) }));
  await page.route("**/api/user/concepts**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ concepts: [], conceptIndex: { concepts: [] } }) }));

  // NB: Playwright checks routes in REVERSE registration order, and the
  // broad `**/api/docs/${DOC}**` pattern also matches the /versions URLs.
  // So register the BROAD doc route FIRST, then the more specific version
  // routes LATER, so the specific ones are checked first.

  // The doc itself — owner, editable. camelCase fields per the editor's reader.
  await page.route(`**/api/docs/${DOC}**`, (r) => {
    if (r.request().method() !== "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: DOC, editToken: "tok", updated_at: new Date().toISOString() }) });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: DOC, title: "Ver Doc", markdown: CURRENT_MD, updated_at: "2026-03-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", editToken: "tok", is_draft: false, allowedEmails: [], allowedEditors: [] }) });
  });
  // Version list — newest first (index 0 → "Current").
  await page.route(`**/api/docs/${DOC}/versions**`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ versions: [
    { id: 3, version_number: 3, title: "Ver Doc", created_at: "2026-03-01T00:00:00Z", change_summary: "Session end" },
    { id: 2, version_number: 2, title: "Ver Doc", created_at: "2026-02-01T00:00:00Z", change_summary: "Session start" },
    { id: 1, version_number: 1, title: "Ver Doc", created_at: "2026-01-01T00:00:00Z", change_summary: "Session start" },
  ] }) }));
  // Single-version fetch (preview / restore source) — most specific, last.
  await page.route(`**/api/docs/${DOC}/versions/1**`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: { id: 1, version_number: 1, markdown: V1_MD, title: "Ver Doc", created_at: "2026-01-01T00:00:00Z" } }) }));
}

test("Version history: preview overlay + styled restore confirm", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1500, height: 900 });
  await stub(page);
  // Hard-fail if anything reaches for window.confirm (the thing we removed).
  await page.addInitScript(() => {
    (window as unknown as { __confirmCalled?: boolean }).__confirmCalled = false;
    window.confirm = () => { (window as unknown as { __confirmCalled?: boolean }).__confirmCalled = true; return false; };
  });
  await page.addInitScript(({ doc, md }) => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    // Fake auth-token marker → cloud-tab keep-check passes (no real auth).
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
    // Two tabs: a local scratch tab is active first, so clicking the cloud
    // "Ver Doc" row is a real tab SWITCH (handleDocClick no-ops on the
    // already-active tab) → switchTab → loadTab → setDocId → History shows.
    localStorage.setItem("mw-tabs", JSON.stringify([
      { id: "tab-scratch", title: "Scratch", markdown: "# Scratch\n\nx\n", readonly: false, permission: "mine", isDraft: true },
      { id: "tab-ver", title: "Ver Doc", markdown: md, cloudId: doc, permission: "mine", isDraft: false, editToken: "tok" },
    ]));
    localStorage.setItem("mw-active-tab", "tab-scratch");
    localStorage.setItem("mw-edit-tokens", JSON.stringify({ [doc]: "tok" }));
  }, { doc: DOC, md: CURRENT_MD });

  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(1000);

  // In dev the editor is served from "/" (the prod /{id} rewrite that
  // sets docId on mount doesn't run), so click the sidebar row to switch
  // into the doc — switchTab → loadTab → setDocId, which gates History.
  await page.locator('[data-sidebar-tab-id="tab-ver"]').first().click();
  await page.waitForTimeout(800);

  // Open the History panel — three versions; the newest carries a
  // "Current" badge (panel render is proven by the rows showing).
  await page.locator('button[title="Version history"]').click();
  await expect(page.getByText("v3", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Current", { exact: true })).toBeVisible();

  // Click the v1 row → read-only preview overlay shows v1 content.
  await page.getByText("v1", { exact: true }).click();
  const overlay = page.locator("[data-version-preview]");
  await expect(overlay).toBeVisible({ timeout: 8000 });
  await expect(overlay).toContainText("OLD v1 content here");
  // The live editor underneath still holds the CURRENT content.
  expect(await page.locator(".ProseMirror").first().innerText()).toContain("current v3 content");

  // Restore v1 (rows render v3/v2/v1 newest-first; v3 is Current with no
  // button, so the restore buttons are [v2, v1] → v1 is .last()).
  // → styled confirm dialog (NOT window.confirm).
  await page.getByRole("button", { name: "Restore", exact: true }).last().click();
  await expect(page.getByText("Restore version 1?", { exact: true })).toBeVisible({ timeout: 5000 });
  expect(await page.evaluate(() => (window as unknown as { __confirmCalled?: boolean }).__confirmCalled)).toBe(false);

  // Confirm via the dialog's Restore button (rendered after the rows in the
  // DOM, so it's now the last "Restore"). Restore runs → editor adopts v1.
  await page.getByRole("button", { name: "Restore", exact: true }).last().click();
  await page.waitForTimeout(1500);
  await expect(overlay).toBeHidden();
  expect(await page.locator(".ProseMirror").first().innerText()).toContain("OLD v1 content here");
});
