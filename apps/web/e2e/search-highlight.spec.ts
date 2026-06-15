/*
 * Search UX polish: cloud search results highlight the matched query term
 * (in title + snippet) instead of showing an un-highlighted doc-start blurb.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-show-mydocs", "true");
    // Need an sb-* token so the search effect runs (gated on user/anon).
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "x", user: { id: "e2e-user" } }));
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "scr", title: "Scratch", markdown: "# Scratch\n\nx\n", permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "scr");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/search**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    query: "keyboard",
    results: [{ id: "cloud-1", title: "iOS keyboard avoidance", snippet: "...the keyboard avoidance that actually works...", isDraft: false, viewCount: 0, source: null, updatedAt: "2026-01-01T00:00:00Z" }],
  }) }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(500);
}

test("cloud search results highlight the matched term", async ({ page }) => {
  test.setTimeout(60000);
  await seed(page);

  const input = page.getByPlaceholder("Search…");
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill("keyboard");
  // Cloud results are debounced (~250ms) then rendered.
  await expect(page.getByText("Cloud results", { exact: false })).toBeVisible({ timeout: 6000 });

  // The matched term is wrapped in a highlight mark, in both title + snippet.
  const marks = page.locator("mark.mw-search-hit", { hasText: /keyboard/i });
  await expect(marks.first()).toBeVisible({ timeout: 3000 });
  expect(await marks.count()).toBeGreaterThanOrEqual(2); // title + snippet
});
