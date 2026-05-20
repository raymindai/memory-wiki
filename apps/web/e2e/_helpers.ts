import { type Page } from "@playwright/test";

/**
 * Shared setup: dismiss onboarding/welcome and start the editor on a
 * fresh editable tab (NOT the read-only `tab-welcome` example, which
 * blocks editing in the LIVE view).
 */
export async function setupEditableTab(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    // WelcomeOverlay STORAGE_KEY is bumped per major release so users
    // see the rebranded tour. E2E must skip the current key too —
    // otherwise the overlay mounts and intercepts every pointer event.
    localStorage.setItem("mw-welcome-seen-v7", "1");
    // Match the live TABS_VERSION constant in MdEditor.tsx so the
    // editor doesn't run the version-mismatch path on every test
    // boot (which merges every EXAMPLE_TABS row into mw-tabs and
    // wastes setup time / state churn).
    localStorage.setItem("mw-tabs-version", "10");
    // Inject a single editable scratch tab
    const tab = {
      id: "tab-e2e-scratch",
      title: "E2E Scratch",
      markdown: "# E2E Scratch\n\nstart here\n",
      readonly: false,
      permission: "mine",
      isDraft: true,
    };
    localStorage.setItem("mw-tabs", JSON.stringify([tab]));
    localStorage.setItem("mw-active-tab", "tab-e2e-scratch");
  });
  // Append a harmless query so the bare-root → Home logic (added
  // 2026-05-15: path === "/" && !search && !hash forces showOnboarding)
  // doesn't override the seeded activeTab. With any search param
  // present, the editor restores from localStorage as it did before.
  await page.goto("/?e2e=1");
  // Wait for the Tiptap LIVE editor to mount AND become editable
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  // Give Tiptap a moment to fully wire up
  await page.waitForTimeout(300);
}

/** Replace the editor's content with `text` (LIVE view). */
export async function clearAndType(page: Page, text: string) {
  const editor = page.locator(".ProseMirror[contenteditable='true']").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(100);
  await page.keyboard.type(text, { delay: 5 });
}

export async function getEditorText(page: Page): Promise<string> {
  return page.locator(".ProseMirror").first().innerText();
}

export async function getEditorHTML(page: Page): Promise<string> {
  return page.locator(".ProseMirror").first().innerHTML();
}

/**
 * View-mode buttons — match by both visible text AND the icon-only fallback.
 * In the current build, view-mode toggles use icon buttons inside the toolbar
 * with `title` attributes ("Live", "Split", "Source").
 */
export async function clickView(page: Page, mode: "Live" | "Split" | "Source") {
  // Buttons have title="Live (Alt+1)" etc. — prefix match against the title attr.
  await page.locator(`button[title^="${mode}"]`).first().click();
  await page.waitForTimeout(250);
}

/** Set markdown via the Source (CM6) editor, then switch back to LIVE. */
export async function setViaSource(page: Page, md: string) {
  await clickView(page, "Source");
  await page.waitForTimeout(300);
  const cm = page.locator(".cm-editor .cm-content");
  await cm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(md, { delay: 0 });
  await clickView(page, "Live");
  await page.waitForTimeout(1500);
}
