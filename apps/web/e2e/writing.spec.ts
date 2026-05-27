import { test, expect } from "@playwright/test";
import {
  setupEditableTab,
  clearAndType,
  getEditorText,
  getEditorHTML,
  clickView,
} from "./_helpers";

// ─── 1. Basic Typing ───
test.describe("Typing", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("type text and it appears", async ({ page }) => {
    await clearAndType(page, "Hello world");
    expect(await getEditorText(page)).toContain("Hello world");
  });

  test("Enter creates new paragraph", async ({ page }) => {
    await clearAndType(page, "Line 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line 2");
    await page.waitForTimeout(150);
    const html = await getEditorHTML(page);
    expect((html.match(/<p[^>]*>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  test("Backspace merges paragraphs", async ({ page }) => {
    await clearAndType(page, "First");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second");
    await page.keyboard.press("Home");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(150);
    expect(await getEditorText(page)).toContain("FirstSecond");
  });

  test("Delete key removes forward", async ({ page }) => {
    await clearAndType(page, "ABCD");
    await page.keyboard.press("Home");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(150);
    expect(await getEditorText(page)).toContain("BCD");
  });
});

// ─── 2. Formatting ───
test.describe("Formatting", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("Cmd+B toggles bold on/off", async ({ page }) => {
    await clearAndType(page, "test");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+b");
    await page.waitForTimeout(200);
    expect(await getEditorHTML(page)).toMatch(/<strong>|<b>/);
    await page.keyboard.press("ControlOrMeta+b");
    await page.waitForTimeout(200);
    expect(await getEditorHTML(page)).not.toMatch(/<strong>test<\/strong>/);
  });

  test("Cmd+I toggles italic", async ({ page }) => {
    await clearAndType(page, "test");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+i");
    await page.waitForTimeout(200);
    expect(await getEditorHTML(page)).toMatch(/<em>|<i>/);
  });
});

// ─── 3. Undo/Redo ───
test.describe("Undo/Redo", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("Cmd+Z undoes", async ({ page }) => {
    await clearAndType(page, "A");
    await page.waitForTimeout(400);
    await page.keyboard.type("B");
    await page.waitForTimeout(400);
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(300);
    const text = await getEditorText(page);
    expect(text).not.toContain("AB");
  });

  test("Cmd+Shift+Z redoes", async ({ page }) => {
    await clearAndType(page, "Redo");
    await page.waitForTimeout(300);
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(300);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await page.waitForTimeout(300);
    expect(await getEditorText(page)).toContain("Redo");
  });
});

// ─── 4. Source ↔ LIVE Sync ───
test.describe("Source ↔ LIVE Sync", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("Source → LIVE syncs", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("# From Source\n\nSync OK");
    await clickView(page, "MD");
    await page.waitForTimeout(1000);
    expect(await getEditorText(page)).toContain("From Source");
  });

  test("LIVE → Source syncs", async ({ page }) => {
    await clearAndType(page, "From LIVE");
    await page.waitForTimeout(500);
    await clickView(page, "Source");
    await page.waitForTimeout(500);
    const sourceText = await page.locator(".cm-editor .cm-content").innerText();
    expect(sourceText).toContain("From LIVE");
  });
});

// ─── 5. Content Preservation ───
test.describe("Content Preservation", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("20 paragraphs survive view switch round-trip", async ({ page }) => {
    // Heavier than the rest: types ~180 chars through CodeMirror,
    // then full Source→LIVE re-render of 20 paragraphs (WASM parse +
    // post-process passes). The 30s default isn't always enough on
    // a cold CI run; give it 60s. Failure here is a real regression,
    // not a flake — but the budget needs to be honest.
    test.setTimeout(60000);
    const lines = Array.from({ length: 20 }, (_, i) => `Para ${i + 1}`);
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    // `page.keyboard.type` paste-via-keypresses scales poorly with
    // length. Replace via CodeMirror's selection-and-paste path so
    // the editor receives one input event instead of N. Falls back
    // to plain typing if CM isn't there (would be a different bug).
    await page.evaluate((text: string) => {
      const sel = window.getSelection();
      const range = document.createRange();
      const cmContent = document.querySelector(".cm-editor .cm-content");
      if (cmContent) {
        range.selectNodeContents(cmContent);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      document.activeElement?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, lines.join("\n\n"));
    await clickView(page, "MD");
    await page.waitForTimeout(1500);
    const live = await getEditorText(page);
    expect(live).toContain("Para 1");
    expect(live).toContain("Para 20");
    await clickView(page, "Source");
    await page.waitForTimeout(500);
    const src = await cm.innerText();
    expect(src).toContain("Para 1");
    expect(src).toContain("Para 20");
  });
});

// ─── 6. Math (KaTeX) ───
test.describe("Math (KaTeX)", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("inline math renders in LIVE view", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("The equation $E=mc^2$ is famous.");
    await clickView(page, "MD");
    await page.waitForTimeout(2000);
    const html = await page.locator(".ProseMirror").first().innerHTML();
    expect(html).toMatch(/katex|tiptap-math/);
  });

  test("display math renders in LIVE view", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("$$\\frac{a}{b}$$");
    await clickView(page, "MD");
    await page.waitForTimeout(2000);
    const html = await page.locator(".ProseMirror").first().innerHTML();
    expect(html).toMatch(/katex|tiptap-math/);
  });
});

// ─── 7. Mermaid ───
test.describe("Mermaid", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("mermaid code block renders diagram in LIVE view", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("```mermaid\ngraph TD\n    A-->B\n```");
    await clickView(page, "MD");
    // Wait for mermaid CDN load + render (NodeView has retry logic up to ~6s)
    await page.waitForTimeout(7000);
    const html = await page.locator(".ProseMirror").first().innerHTML();
    expect(html).toMatch(/tiptap-mermaid-render|<svg|mermaid/);
  });
});

// ─── 8. Code blocks (CustomCodeBlock NodeView) ───
test.describe("Code blocks", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("code block shows language label and copy button", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("```js\nconst x = 1;\n```");
    await clickView(page, "MD");
    await page.waitForTimeout(800);
    // Header should appear
    await expect(page.locator(".tiptap-codeblock-lang").first()).toBeVisible();
    // The Convert ▾ button shares the .tiptap-codeblock-copy class — match by text
    await expect(page.locator(".tiptap-codeblock-copy", { hasText: /^Copy$/ }).first()).toBeVisible();
    // Language label should say "js"
    const lang = await page.locator(".tiptap-codeblock-lang").first().innerText();
    expect(lang.toLowerCase()).toContain("js");
  });

  test("code block has line-number gutter", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("```\nline1\nline2\nline3\n```");
    await clickView(page, "MD");
    await page.waitForTimeout(800);
    const linenos = page.locator(".tiptap-codeblock-lineno");
    expect(await linenos.count()).toBeGreaterThanOrEqual(3);
  });
});
