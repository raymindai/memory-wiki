/*
 * Heading folding (LIVE view). Verifies: clicking the chevron hides the
 * section's blocks; clicking again restores them; and the SAVED markdown
 * (PATCH body) is identical whether folded or not — folding is view-only.
 */
import { test, expect, type Page } from "@playwright/test";

const DOC = "# Doc\n\n## Alpha\n\nalpha body line\n\n## Beta\n\nbeta body line\n";

function stub(page: Page) {
  const state = { md: DOC, patchBodies: [] as string[] };
  page.route("**/api/docs/**", async (route) => {
    const m = route.request().method();
    if (m === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub-fold-id", markdown: state.md, title: "Doc", updated_at: "2020-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
      return;
    }
    try {
      const b = JSON.parse(route.request().postData() || "{}");
      if (b.action === "auto-save" && typeof b.markdown === "string") { state.md = b.markdown; state.patchBodies.push(b.markdown); }
    } catch { /* ignore */ }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-fold-id", editToken: "t", updated_at: new Date().toISOString() }) });
  });
  return state;
}

async function seed(page: Page) {
  await page.addInitScript((md) => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-fold", title: "Doc", markdown: md, readonly: false, permission: "mine", isDraft: false, cloudId: "stub-fold-id" }]));
    localStorage.setItem("mw-active-tab", "tab-fold");
  }, DOC);
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(500);
}

test.describe("Heading folding", () => {
  test.describe.configure({ timeout: 60_000 });

  test("fold hides the section, unfold restores it, markdown unchanged", async ({ page }) => {
    const state = stub(page);
    await seed(page);
    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await expect(editor).toContainText("alpha body line");

    // Hover the Alpha heading to reveal its chevron, then click it.
    const alpha = editor.locator("h2", { hasText: "Alpha" }).first();
    await alpha.hover();
    const chevron = alpha.locator(".mw-fold-toggle").first();
    await chevron.click();

    // Alpha's body should be hidden; Beta still visible.
    await expect(editor.getByText("alpha body line")).toBeHidden({ timeout: 2000 });
    await expect(editor).toContainText("beta body line");

    // The saved markdown must NOT have dropped the folded content.
    // Trigger a save by making a trivial edit elsewhere is risky; instead
    // assert the doc model is intact by unfolding and seeing it return.
    await alpha.hover();
    await chevron.click();
    await expect(editor.getByText("alpha body line")).toBeVisible({ timeout: 2000 });

    // If any auto-save fired during folding, it must still contain the
    // folded body (view-only invariant).
    for (const body of state.patchBodies) {
      expect(body).toContain("alpha body line");
    }
  });

  test("typing while a later section is folded still saves full doc", async ({ page }) => {
    const state = stub(page);
    await seed(page);
    const editor = page.locator(".ProseMirror[contenteditable='true']").first();

    // Fold Beta.
    const beta = editor.locator("h2", { hasText: "Beta" }).first();
    await beta.hover();
    await beta.locator(".mw-fold-toggle").first().click();
    await expect(editor.getByText("beta body line")).toBeHidden({ timeout: 2000 });

    // Type into Alpha's body (visible).
    const alphaBody = editor.getByText("alpha body line");
    await alphaBody.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" EDITED", { delay: 15 });
    await page.waitForTimeout(3500); // past autosave debounce

    // The latest saved markdown must contain BOTH the edit AND the
    // folded Beta body.
    const last = state.patchBodies[state.patchBodies.length - 1] || state.md;
    expect(last).toContain("EDITED");
    expect(last).toContain("beta body line");
  });
});
