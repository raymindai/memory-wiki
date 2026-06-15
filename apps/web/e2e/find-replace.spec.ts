/*
 * In-document Find & Replace in the Live (TipTap) editor: Cmd+F opens a
 * bar, the query highlights all matches with a count, next/prev step, and
 * Replace All rewrites every match.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-view-mode", "preview");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-fr", title: "Find Doc", markdown: "# Find Doc\n\nalpha beta alpha gamma alpha\n", readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "tab-fr");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

test.describe("Find & Replace (Live editor)", () => {
  test.describe.configure({ timeout: 60_000 });

  test("Cmd+F finds + highlights matches with a count", async ({ page }) => {
    await seed(page);
    await page.locator(".ProseMirror[contenteditable='true']").first().click();
    await page.keyboard.press("ControlOrMeta+f");
    const input = page.getByPlaceholder("Find in document");
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill("alpha");
    await page.waitForTimeout(400);
    // 3 matches highlighted, counter shows 1/3.
    expect(await page.locator(".mw-search-match").count()).toBe(3);
    await expect(page.getByText("1/3", { exact: true })).toBeVisible();
    // Next → 2/3.
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await expect(page.getByText("2/3", { exact: true })).toBeVisible();
  });

  test("Replace All rewrites every match", async ({ page }) => {
    await seed(page);
    await page.locator(".ProseMirror[contenteditable='true']").first().click();
    await page.keyboard.press("ControlOrMeta+f");
    await page.getByPlaceholder("Find in document").fill("alpha");
    await page.waitForTimeout(400);
    // Open the replace row (collapsed by default) via the chevron.
    await page.locator('button[title="Show replace"]').click();
    const replaceInput = page.getByPlaceholder("Replace with");
    await expect(replaceInput).toBeVisible({ timeout: 2000 });
    await replaceInput.fill("ALPHA");
    await page.locator("[data-find-bar]").getByRole("button", { name: "All", exact: true }).click();
    await page.waitForTimeout(400);
    const text = await page.locator(".ProseMirror").first().innerText();
    expect(text).toContain("ALPHA beta ALPHA gamma ALPHA");
    expect(text).not.toContain("alpha");
  });
});
