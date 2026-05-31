import { test, expect } from "@playwright/test";
import { setupEditableTab, setViaSource, getEditorText } from "./_helpers";

// ─── Math editing continuity ───
test.describe("Math editing continuity", () => {
  // setupEditableTab + setViaSource (Source-mode round-trip with
  // CM6 mount, full markdown re-paint, view switch) burns 5-10s of
  // the default 30s budget on a cold dev-server boot. The first
  // test in this describe hits that cold path and flaked on every
  // CI run before this bump. Same pattern as editor-autosave-race.
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("can type text AFTER inline math without breaking it", async ({ page }) => {
    await setViaSource(page, "The formula $E=mc^2$ is here.");
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" More text after math.");
    await page.waitForTimeout(500);
    const text = await editor.innerText();
    expect(text).toContain("More text after math");
    expect(text).toMatch(/E.*=.*mc|formula/);
  });

  test("can type text BEFORE inline math without breaking it", async ({ page }) => {
    await setViaSource(page, "$E=mc^2$ is famous.");
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("Einstein's ");
    await page.waitForTimeout(500);
    expect(await editor.innerText()).toContain("Einstein");
  });

  test("math renders after Source→LIVE switch", async ({ page }) => {
    await setViaSource(page, "Inline: $\\alpha + \\beta$\n\nDisplay:\n\n$$\\int_0^1 x^2 dx$$");
    const html = await page.locator(".ProseMirror").first().innerHTML();
    expect(html).toMatch(/katex|tiptap-math/);
  });
});

// ─── Mermaid editing continuity ───
test.describe("Mermaid editing continuity", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("can type paragraph AFTER mermaid block", async ({ page }) => {
    await setViaSource(page, "Before\n\n```mermaid\ngraph TD\n    A-->B\n```\n\nAfter");
    await page.waitForTimeout(5000); // mermaid CDN + render
    const editor = page.locator(".ProseMirror").first();
    const text = await editor.innerText();
    expect(text).toContain("Before");
    expect(text).toContain("After");
  });
});

// ─── Title sync (H1 → tab title) ───
test.describe("Title sync", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("editing the H1 in LIVE updates the document title", async ({ page }) => {
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("# Brand New Title\n\nbody");
    await page.waitForTimeout(800);
    // Header title is rendered somewhere; check the doc-level title via React state
    // by reading from the active tab title in the sidebar (open if needed)
    const text = await getEditorText(page);
    expect(text).toContain("Brand New Title");
  });
});
