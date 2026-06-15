/*
 * A tab saved with a stale "Untitled" title but a real H1 in its body
 * should show the real name from the first paint (no Untitled flash).
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-show-mydocs", "true");
    localStorage.setItem("mw-tabs", JSON.stringify([
      { id: "t-stale", title: "Untitled", markdown: "# Quarterly Roadmap\n\nbody\n", readonly: false, permission: "mine", isDraft: true },
    ]));
    localStorage.setItem("mw-active-tab", "t-stale");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
}

test("no Untitled flash — H1 title shows immediately", async ({ page }) => {
  test.setTimeout(40000);
  await seed(page);
  // The MDs row shows the real H1-derived title, never "Untitled".
  await expect(page.locator('[data-sidebar-tab-id="t-stale"]')).toContainText("Quarterly Roadmap", { timeout: 8000 });
  const text = await page.locator('[data-sidebar-tab-id="t-stale"]').innerText();
  expect(text).not.toContain("Untitled");
});
