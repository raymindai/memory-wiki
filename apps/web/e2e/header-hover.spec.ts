/*
 * Sidebar section-header action buttons (sort / new folder / +) go from
 * faint to full-ink on hover. Verifies the mw-shdr-btn:hover rule wins
 * over the inline color:var(--text-faint) at rest.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-hh", title: "HH", markdown: "# HH\n\nbody\n", readonly: false, permission: "mine", isDraft: false, cloudId: "stub-hh-id" }]));
    localStorage.setItem("mw-active-tab", "tab-hh");
  });
  await page.route("**/api/docs/**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub-hh-id", markdown: "# HH\n\nbody\n", title: "HH", updated_at: "2020-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-hh-id", editToken: "t", updated_at: new Date().toISOString() }) });
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

test("section header buttons turn ink on hover", async ({ page }) => {
  test.setTimeout(60_000);
  await seed(page);

  const btn = page.locator('[data-action="sort"]').first();
  await expect(btn).toBeVisible();

  // Resolve the theme's --text-primary so the assertion is theme-agnostic.
  const primary = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--text-primary)";
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });

  const faint = await btn.evaluate((el) => getComputedStyle(el).color);
  await btn.hover();
  await page.waitForTimeout(250);
  const hovered = await btn.evaluate((el) => getComputedStyle(el).color);

  // Hover lands on full ink (text-primary), NOT a per-section micro hue.
  expect(hovered).not.toBe(faint);
  expect(hovered).toBe(primary);
});
