/*
 * Regression tests for the save-reliability batch (2026-06-15):
 *
 *  1. setMarkdown markdownRef sync — non-typing edit paths were
 *     silently bailing in triggerAutoSave because markdownRef still
 *     held the old value when the guard `val !== markdownRef.current`
 *     ran. This test proves a TipTap edit reaches the server as a
 *     PATCH carrying the typed content.
 *
 *  2. echo-of-own-save guard — a realtime/refetch payload whose body
 *     equals what we last saved must NOT raise the "updated
 *     elsewhere" conflict toast.
 *
 * Same localStorage-seed + route-stub approach as
 * editor-autosave-race.spec.ts.
 */

import { test, expect } from "@playwright/test";

test.describe("Editor save reliability", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mw-onboarded", "1");
      localStorage.setItem("mw-welcome-seen", "1");
      localStorage.setItem("mw-welcome-seen-v7", "1");
      localStorage.setItem("mw-editor-opened", "1");
      localStorage.setItem("mw-tabs-version", "10");
      localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
      const tab = {
        id: "tab-e2e-save",
        title: "Save Test",
        markdown: "# Save Test\n\nbaseline body\n",
        readonly: false,
        permission: "mine",
        isDraft: false,
        cloudId: "stub-save-id",
      };
      localStorage.setItem("mw-tabs", JSON.stringify([tab]));
      localStorage.setItem("mw-active-tab", "tab-e2e-save");
    });
  });

  test("TipTap edit fires a PATCH auto-save with the typed content", async ({ page }) => {
    const patchBodies: string[] = [];
    await page.route("**/api/docs/**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({
            id: "stub-save-id", markdown: "# Save Test\n\nbaseline body\n",
            title: "Save Test", updated_at: "2020-01-01T00:00:00Z",
            isOwner: true, isEditor: false, editMode: "account",
            allowedEmails: [], allowedEditors: [],
          }),
        });
        return;
      }
      if (req.method() === "PATCH") {
        try { patchBodies.push(req.postData() || ""); } catch { /* ignore */ }
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, updated_at: new Date().toISOString() }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/?e2e=1");
    await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
    await page.waitForTimeout(400);

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    const marker = "UNIQUE_SAVE_MARKER_42";
    await page.keyboard.type(marker, { delay: 15 });

    // Wait past the 2.5s autosave debounce.
    await page.waitForTimeout(3500);

    // A PATCH must have fired carrying the marker.
    const sawMarker = patchBodies.some((b) => b.includes(marker));
    expect(sawMarker, `PATCH bodies seen: ${patchBodies.length}`).toBe(true);
  });

  test("echo of our own save does not raise the conflict toast", async ({ page }) => {
    // The server GET returns EXACTLY what we just saved, with a newer
    // updated_at. The echo guard should treat this as our own save
    // reflected back and stay silent.
    let lastPatchedBody = "# Save Test\n\nbaseline body\n";
    await page.route("**/api/docs/**", async (route) => {
      const req = route.request();
      if (req.method() === "PATCH") {
        try {
          const parsed = JSON.parse(req.postData() || "{}");
          if (typeof parsed.markdown === "string") lastPatchedBody = parsed.markdown;
        } catch { /* ignore */ }
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, updated_at: new Date().toISOString() }),
        });
        return;
      }
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({
            id: "stub-save-id",
            markdown: lastPatchedBody,           // echo what we last saved
            title: "Save Test",
            updated_at: "2099-01-01T00:00:00Z",  // "newer" so lastKnown check passes
            isOwner: true, isEditor: false, editMode: "account",
            allowedEmails: [], allowedEditors: [],
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/?e2e=1");
    await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
    await page.waitForTimeout(400);

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("echo guard content", { delay: 15 });
    // Let the save land so lastSavedMarkdown == server body.
    await page.waitForTimeout(3500);

    // Now fire a refetch — server echoes our saved body.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(600);

    // The conflict toast text must NOT appear.
    const conflictToast = page.getByText("updated elsewhere", { exact: false });
    await expect(conflictToast).toHaveCount(0);
    // And our content is intact.
    await expect(editor).toContainText("echo guard content", { timeout: 2000 });
  });
});
