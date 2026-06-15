/*
 * Recent must not list the same bundle/doc twice. recentTabIds can hold
 * several ids for one bundle (each open mints bundle-<id>-<ts>; after a
 * refresh the old id lingers as a ghost). The render dedups by the
 * underlying bundleId/cloudId so it shows once.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-show-recent", "true");
    // One live bundle tab + a scratch doc so the editor mounts.
    localStorage.setItem("mw-tabs", JSON.stringify([
      { id: "scratch", title: "Scratch", markdown: "# Scratch\n\nx\n", permission: "mine", isDraft: true },
      { id: "bundle-bx-100", kind: "bundle", bundleId: "bx", title: "V8 Plan", markdown: "" },
    ]));
    localStorage.setItem("mw-active-tab", "scratch");
    // Recent references the SAME bundle 3×: the live tab + two ghost ids.
    localStorage.setItem("mw-recent-tabs", JSON.stringify(["bundle-bx-100", "bundle-bx-50", "bundle-bx-20"]));
  });
  // Broad catch-all FIRST so the specific /api/bundles below wins (LIFO).
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/bundles**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bundles: [{ id: "bx", title: "V8 Plan", description: null, documentCount: 3, updated_at: "2026-01-01T00:00:00Z", is_draft: false }] }) }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(800);
}

test("Recent shows one row per bundle even with duplicate ids", async ({ page }) => {
  test.setTimeout(60000);
  await seed(page);
  // Recent section visible.
  await expect(page.getByText("Recent", { exact: true })).toBeVisible({ timeout: 10000 });
  // Count rows in the Recent section that say "V8 Plan".
  const count = await page.evaluate(() => {
    const header = document.querySelector('[data-section-id="recent"]');
    const section = header?.parentElement;
    if (!section) return -1;
    const rows = Array.from(section.querySelectorAll('.group\\/recent'));
    return rows.filter(r => (r.textContent || "").includes("V8 Plan")).length;
  });
  expect(count).toBe(1);
});
