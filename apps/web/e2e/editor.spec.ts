import { test, expect } from "@playwright/test";
import { setupEditableTab, clickView, getEditorText } from "./_helpers";

test.describe("Editor — Core Writing Experience", () => {
  test.beforeEach(async ({ page }) => { await setupEditableTab(page); });

  test("renders the editor with content", async ({ page }) => {
    await expect(page.locator(".ProseMirror").first()).toBeVisible();
  });

  test("can type in Source view and content appears in LIVE", async ({ page }) => {
    await clickView(page, "Source");
    const cm = page.locator(".cm-editor .cm-content");
    await cm.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("# Hello World\n\nThis is a test.");
    await clickView(page, "MD");
    await page.waitForTimeout(800);
    expect(await getEditorText(page)).toContain("Hello World");
  });

  test("can switch between MD, Split, and Source views", async ({ page }) => {
    for (const mode of ["Split", "Source", "MD"] as const) {
      await clickView(page, mode);
    }
    await expect(page.locator(".ProseMirror").first()).toBeVisible();
  });

  test("can type directly in LIVE view (Tiptap)", async ({ page }) => {
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Direct typing test");
    await page.waitForTimeout(200);
    await expect(editor).toContainText("Direct typing test");
  });

  test("bold formatting works in LIVE view", async ({ page }) => {
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("test");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+b");
    await page.waitForTimeout(300);
    await expect(editor.locator("strong, b").first()).toBeVisible({ timeout: 3000 });
  });

  test("Enter creates new paragraph", async ({ page }) => {
    const editor = page.locator(".ProseMirror").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Line 1");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Line 2");
    await page.waitForTimeout(200);
    const paragraphs = editor.locator("p");
    await expect(paragraphs).toHaveCount(2, { timeout: 3000 });
  });
});
