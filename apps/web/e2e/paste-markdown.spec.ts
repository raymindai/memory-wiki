/*
 * Pasting Markdown into the Live (TipTap) editor must PARSE it into real
 * nodes (heading, link, list), not insert it as literal text that the
 * serializer then escapes to "\# Heading" / mangled links. Repro of the
 * founder's bug: pasting clean "# Claude Business\n\n[Raymind.AI](...)"
 * stored "\# Claude Business" + a broken link (+ the lost H1 made the
 * server prepend "# Untitled"). Fix: tiptap-markdown transformPastedText.
 */
import { test, expect, type Page } from "@playwright/test";

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "t-paste", title: "Untitled", markdown: "", readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "t-paste");
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

const MD = "# Claude Business\n\nI use Claude every day. [Raymind.AI](http://raymind.ai) is built on it.\n\n## Previous Experience\n\n- Kakao Europe\n- Devsisters VR";

test("pasting Markdown parses into real nodes (no escaped # / mangled links)", async ({ page, context }) => {
  test.setTimeout(45000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await seed(page);
  const ed = page.locator(".ProseMirror[contenteditable='true']").first();
  await ed.click();
  await page.evaluate((md) => navigator.clipboard.writeText(md), MD);
  await page.keyboard.press("ControlOrMeta+v");
  await page.waitForTimeout(600);

  // Parsed structure: a real H1, a real H2, a real link, real list items.
  await expect(page.locator(".ProseMirror h1")).toContainText("Claude Business");
  await expect(page.locator(".ProseMirror h2")).toContainText("Previous Experience");
  // A real anchor (link parsed into a node, not literal "[..](..)" text).
  const link = page.locator(".ProseMirror a").filter({ hasText: "Raymind.AI" });
  await expect(link).toHaveCount(1);
  expect((await link.getAttribute("href") || "").toLowerCase()).toContain("raymind.ai");
  expect(await page.locator(".ProseMirror ul li").count()).toBeGreaterThanOrEqual(2);

  // The literal markdown source must NOT survive as visible text.
  const text = await page.locator(".ProseMirror").first().innerText();
  expect(text).not.toContain("\\#");
  expect(text).not.toContain("# Claude Business");   // would mean it stayed literal
  expect(text).not.toContain("](http://raymind.ai)"); // mangled/literal link syntax
});
