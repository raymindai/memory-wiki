/*
 * Sidebar UX: open/close state persists across reload, and the Library
 * header "+" menu offers New document / New bundle / Import.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-sx", title: "SX", markdown: "# SX\n\nbody\n", readonly: false, permission: "mine", isDraft: false, cloudId: "stub-sx-id" }]));
    localStorage.setItem("mw-active-tab", "tab-sx");
  });
  await page.route("**/api/docs/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub-sx-id", markdown: "# SX\n\nbody\n", title: "SX", updated_at: "2020-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-sx-id", editToken: "t", updated_at: new Date().toISOString() }) });
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

test.describe("Sidebar UX", () => {
  test.describe.configure({ timeout: 60_000 });

  test("open/close state persists across reload", async ({ page }) => {
    await seed(page);
    // Sidebar visible by default on desktop.
    await expect(page.getByText("LIBRARY", { exact: true })).toBeVisible();

    // Close it via the panel toggle in the Library header.
    await page.locator("[data-library-header] button").first().click();
    await expect(page.getByText("LIBRARY", { exact: true })).toBeHidden({ timeout: 2000 });

    // Reload — it should stay closed.
    await page.reload();
    await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
    await page.waitForTimeout(500);
    await expect(page.getByText("LIBRARY", { exact: true })).toBeHidden();

    // Re-open (persisted localStorage), then reload — stays open.
    const persisted = await page.evaluate(() => localStorage.getItem("mw-sidebar-open"));
    expect(persisted).toBe("false");
  });

  test("Library + menu offers New document / New bundle / Import", async ({ page }) => {
    await seed(page);
    await page.locator('[data-action="library-add"]').click();
    await expect(page.getByText("New document", { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(page.getByText("New bundle", { exact: true })).toBeVisible();
    await expect(page.getByText("Import…", { exact: true })).toBeVisible();

    // Import opens the import modal.
    await page.getByText("Import…", { exact: true }).click();
    await expect(page.getByText("Import to your hub", { exact: false })).toBeVisible({ timeout: 2000 });
  });

  test("MDs section collapsed state persists across reload", async ({ page }) => {
    await seed(page);
    const mdsHeader = page.locator('[data-section-id="mds"]');
    await expect(mdsHeader).toBeVisible();

    // Collapse the MDs section.
    await mdsHeader.click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("mw-show-mydocs")), { timeout: 3000 }).toBe("false");

    // Reload — it must stay collapsed.
    await page.reload();
    await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => localStorage.getItem("mw-show-mydocs"))).toBe("false");
  });
});
