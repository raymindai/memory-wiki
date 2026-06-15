/*
 * Source (CodeMirror) view: even when narrow-width is ON (the default,
 * which caps the text column to a comfortable measure), the vertical
 * scrollbar must sit flush at the FAR RIGHT of the pane — not at the
 * right edge of the narrowed text column. Founder request.
 *
 * Mechanism under test: the narrow cap lives on .cm-content padding
 * (.mw-cm-narrow), NOT on a wrapper around the scroller, so .cm-scroller
 * stays full-width.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    const body = "# Source Scroll\n\n" + Array.from({ length: 80 }, (_, i) => `Line ${i + 1} lorem ipsum dolor sit amet consectetur.`).join("\n\n");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-src", title: "Source Scroll", markdown: body, readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "tab-src");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  // Switch to Source (CM6) view — Alt+3.
  await page.keyboard.press("Alt+3");
  await page.waitForSelector(".cm-editor .cm-scroller", { timeout: 8000 });
  await page.waitForTimeout(400);
}

test("Source scrollbar sits at the far right even in narrow view", async ({ page }) => {
  test.setTimeout(40000);
  // Wide viewport so the editor pane is comfortably > 768px and the
  // narrow cap (calc(50% - 384px)) produces real, measurable padding.
  await page.setViewportSize({ width: 1600, height: 900 });
  await seed(page);

  // narrowSource defaults ON → .cm-content carries the centering padding.
  const narrow = await page.locator(".cm-editor .cm-content.mw-cm-narrow, .mw-cm-narrow .cm-content").count();
  expect(narrow).toBeGreaterThan(0);

  // The scroller (where the vertical scrollbar lives) must span the full
  // width of its pane wrapper — i.e. its right edge reaches the pane's
  // right edge. The OLD bug padded the wrapper, pulling the scroller (and
  // its scrollbar) inward by ~calc(50% - 384px).
  const geo = await page.evaluate(() => {
    const scroller = document.querySelector(".cm-editor .cm-scroller") as HTMLElement;
    const content = document.querySelector(".cm-editor .cm-content") as HTMLElement;
    const line = document.querySelector(".cm-editor .cm-line") as HTMLElement;
    // The pane wrapper is the flex-1 ancestor that holds the CM editor.
    const pane = scroller.closest('[class*="flex-1"]') as HTMLElement || scroller.parentElement!.parentElement!;
    const sr = scroller.getBoundingClientRect();
    const pr = pane.getBoundingClientRect();
    const cs = getComputedStyle(content);
    return {
      scrollerRight: sr.right, paneRight: pr.right, scrollerWidth: sr.width, paneWidth: pr.width,
      paddingLeft: parseFloat(cs.paddingLeft), paddingRight: parseFloat(cs.paddingRight),
      lineRight: line ? line.getBoundingClientRect().right : 0,
    };
  });

  // 1. Scroller right edge is flush with the pane right edge (allow 2px AA)
  //    → the vertical scrollbar lives at the far right of the pane.
  expect(Math.abs(geo.scrollerRight - geo.paneRight)).toBeLessThanOrEqual(2);
  // 2. Scroller spans (nearly) the full pane width — NOT narrowed by a
  //    wrapper (the old bug). This is what puts the bar at the edge.
  expect(geo.scrollerWidth).toBeGreaterThan(geo.paneWidth - 4);
  // 3. The narrow cap is real: the content carries symmetric horizontal
  //    padding well beyond the default 20px, centring the text column
  //    while the scroller (and bar) stay full-width.
  expect(geo.paddingRight).toBeGreaterThan(60);
  expect(Math.abs(geo.paddingLeft - geo.paddingRight)).toBeLessThanOrEqual(1);
  // 4. The actual text ends well to the LEFT of the scrollbar — there's a
  //    clear gutter between the last glyph column and the bar.
  expect(geo.scrollerRight - geo.lineRight).toBeGreaterThan(40);
});
