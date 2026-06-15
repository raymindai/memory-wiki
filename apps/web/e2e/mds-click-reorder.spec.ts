/*
 * In MDs "Newest" sort, clicking a doc bumps it to the top (same recency
 * behavior as Recent), so the existing SidebarFolder FLIP slides it up.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-mds-sort", "newest");
    const old = 1000, newer = 2000;
    localStorage.setItem("mw-tabs", JSON.stringify([
      { id: "tab-a", title: "Alpha", markdown: "# Alpha\n\nx\n", readonly: false, permission: "mine", isDraft: true, lastOpenedAt: old },
      { id: "tab-b", title: "Bravo", markdown: "# Bravo\n\ny\n", readonly: false, permission: "mine", isDraft: true, lastOpenedAt: newer },
    ]));
    localStorage.setItem("mw-active-tab", "tab-b");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(600);
}

test("clicking a doc in Newest sort moves it to the top", async ({ page }) => {
  test.setTimeout(60000);
  await seed(page);
  const order = async () => page.evaluate(() => Array.from(document.querySelectorAll('[data-sidebar-tab-id]')).map(e => e.getAttribute("data-sidebar-tab-id")).filter(id => id === "tab-a" || id === "tab-b"));

  // Newest first → Bravo (newer) above Alpha.
  await expect(page.locator('[data-sidebar-tab-id="tab-a"]')).toBeVisible({ timeout: 10000 });
  expect(await order()).toEqual(["tab-b", "tab-a"]);

  // Click Alpha → its lastOpenedAt bumps → rises to the top.
  await page.locator('[data-sidebar-tab-id="tab-a"]').click();
  await page.waitForTimeout(600);
  expect(await order()).toEqual(["tab-a", "tab-b"]);
});
