/*
 * Recent rows use the real file context menu (right-click + hover More
 * Options), and that menu includes "Remove from Recent".
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-show-recent", "true");
    localStorage.setItem("mw-tabs", JSON.stringify([
      { id: "tab-a", title: "Recent Doc A", markdown: "# Recent Doc A\n\nx\n", permission: "mine", isDraft: true },
      { id: "tab-b", title: "Other", markdown: "# Other\n\ny\n", permission: "mine", isDraft: true },
    ]));
    localStorage.setItem("mw-active-tab", "tab-b");
    localStorage.setItem("mw-recent-tabs", JSON.stringify(["tab-a"]));
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(600);
}

test("Recent right-click menu has Remove from Recent + Locate and it works", async ({ page }) => {
  test.setTimeout(60000);
  await seed(page);
  const row = page.locator('.group\\/recent').filter({ hasText: "Recent Doc A" }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click({ button: "right" });

  // Real file menu: Locate present; Recent adds Remove from Recent.
  await expect(page.getByRole("button", { name: "Remove from Recent", exact: true })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole("button", { name: "Locate", exact: true })).toBeVisible();

  // Remove it → the Recent row disappears.
  await page.getByRole("button", { name: "Remove from Recent", exact: true }).click();
  await expect(page.locator('.group\\/recent').filter({ hasText: "Recent Doc A" })).toHaveCount(0, { timeout: 3000 });
});
