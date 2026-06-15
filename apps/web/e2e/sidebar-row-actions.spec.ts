/*
 * Sidebar row affordances:
 *  - MDs rows show a Star toggle on hover (in addition to the kebab),
 *    and clicking it stars/pins the doc.
 *  - Recent rows have a right-click "Locate" that reveals the doc in its
 *    home section (expanding MDs if collapsed).
 *
 * Keeps a cloud-tied doc tab alive without full auth: an sb-*-auth-token
 * localStorage marker satisfies the hydration keep-check, and NOT setting
 * mw-was-logged-in avoids the signed-out cloud-tab purge. togglePin
 * updates pins optimistically, so the star reflects immediately.
 */
import { test, expect, type Page } from "@playwright/test";

const DOC_ID = "stub-doc-1";

async function seed(page: Page, opts: { collapseMds?: boolean; inRecent?: boolean } = {}) {
  await page.addInitScript((o) => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    // A local draft tab (no cloudId) survives hydration for anonymous
    // users — enough to verify the row affordances (star toggle render +
    // Locate). The pin's network side reuses the existing context-menu
    // Star path, exercised elsewhere.
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-1", title: "My Doc One", markdown: "# My Doc One\n\nbody\n", readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "tab-1");
    if (o.inRecent) localStorage.setItem("mw-recent-tabs", JSON.stringify(["tab-1"]));
    if (o.collapseMds) localStorage.setItem("mw-show-mydocs", "false");
    localStorage.setItem("mw-show-recent", "true");
  }, opts);
  // Broad handlers FIRST so the specific ones below win (Playwright LIFO).
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/user/pins**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ pins: [] }) }));
  await page.route("**/api/docs/**", (r) => {
    if (r.request().method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: DOC_ID, markdown: "# My Doc One\n\nbody\n", title: "My Doc One", updated_at: "2026-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: DOC_ID, updated_at: new Date().toISOString() }) });
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(800);
}

test.describe("Sidebar row actions", () => {
  test.describe.configure({ timeout: 60_000 });

  test("MDs row shows a Star toggle on hover, next to the kebab", async ({ page }) => {
    await seed(page);

    const row = page.locator('[data-sidebar-tab-id="tab-1"]').first();
    await expect(row).toBeVisible({ timeout: 10000 });
    const star = row.locator('[data-action="star"]');
    await expect(star).toHaveCount(1);

    // Collapsed (w-0) until hover, expands on hover — alongside the kebab.
    expect(await star.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(2);
    await row.hover();
    await page.waitForTimeout(250);
    expect(await star.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(10);
  });

  test("Recent right-click Locate reveals the doc in its (collapsed) section", async ({ page }) => {
    await seed(page, { inRecent: true, collapseMds: true });

    // MDs starts collapsed.
    expect(await page.evaluate(() => localStorage.getItem("mw-show-mydocs"))).toBe("false");

    // Right-click the Recent row (scope to the recent row, not the editor H1).
    const recentRow = page.locator('.group\\/recent').filter({ hasText: "My Doc One" }).first();
    await expect(recentRow).toBeVisible({ timeout: 10000 });
    await recentRow.click({ button: "right" });

    // Locate appears and expands the MDs section + reveals the row.
    const locate = page.getByRole("button", { name: "Locate", exact: true });
    await expect(locate).toBeVisible({ timeout: 3000 });
    await locate.click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("mw-show-mydocs")), { timeout: 3000 }).toBe("true");
    await expect(page.locator('[data-sidebar-tab-id="tab-1"]')).toBeVisible({ timeout: 3000 });
  });
});
