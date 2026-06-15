/*
 * Slash command menu (TipTap LIVE view). Verifies the menu opens on
 * "/" at block start, filters, and inserts the chosen block.
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
    localStorage.setItem("mw-tabs", JSON.stringify([{
      id: "tab-slash", title: "Slash", markdown: "# Slash\n\nfirst line\n",
      readonly: false, permission: "mine", isDraft: false, cloudId: "stub-slash-id",
    }]));
    localStorage.setItem("mw-active-tab", "tab-slash");
  });
  await page.route("**/api/docs/**", async (route) => {
    const m = route.request().method();
    if (m === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub-slash-id", markdown: "# Slash\n\nfirst line\n", title: "Slash", updated_at: "2020-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-slash-id", editToken: "t", updated_at: new Date().toISOString() }) });
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

test.describe("Slash command menu", () => {
  test.describe.configure({ timeout: 60_000 });

  test("opens on / at block start and shows commands", async ({ page }) => {
    await seed(page);
    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/");
    // Menu should appear with at least the Heading 1 item
    await expect(page.getByText("Heading 1", { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(page.getByText("Mermaid diagram", { exact: true })).toBeVisible();
  });

  test("filters by query and inserts a quote via Enter", async ({ page }) => {
    await seed(page);
    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/quote");
    await expect(page.getByText("Quote", { exact: true })).toBeVisible({ timeout: 2000 });
    await page.keyboard.press("Enter");
    // A blockquote node should now exist in the editor.
    await expect(editor.locator("blockquote")).toHaveCount(1, { timeout: 2000 });
    // The literal "/quote" text must be gone.
    await expect(editor).not.toContainText("/quote");
  });

  test("does NOT open mid-sentence", async ({ page }) => {
    await seed(page);
    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("hello /world");
    // No menu (Heading 1 item should not be visible).
    await expect(page.getByText("Heading 1", { exact: true })).toHaveCount(0);
  });
});
