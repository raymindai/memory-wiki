/*
 * Body-hash conflict detection. The false "Document Conflict" the
 * founder kept hitting came from a timestamp-based check: any time the
 * server's updated_at moved (out-of-order save responses, realtime echo
 * of the user's own save, side-channel writers) it 409'd even though
 * the body hadn't actually diverged. The fix sends expectedHash (hash
 * of the body the client believes is on the server) and the server
 * 409s only on a real body difference.
 *
 * The stub below mirrors the server's exact logic using the SAME
 * contentHash, so this verifies the client sends a hash that a
 * correctly-implemented server accepts during normal editing, and that
 * a genuine external body change still conflicts.
 */
import { test, expect, type Page } from "@playwright/test";
import { contentHash } from "../src/lib/content-hash";

const START = "# Conflict\n\nbaseline body\n";

async function seed(page: Page) {
  await page.addInitScript((md) => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-cf", title: "Conflict", markdown: md, readonly: false, permission: "mine", isDraft: false, cloudId: "stub-cf-id" }]));
    localStorage.setItem("mw-active-tab", "tab-cf");
  }, START);
}

// Server stub mirroring the real auto-save conflict logic.
function stub(page: Page) {
  const s = { body: START, updatedAt: "2020-01-01T00:00:00Z", conflicts: 0, saves: 0 };
  page.route("**/api/docs/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stub-cf-id", markdown: s.body, title: "Conflict", updated_at: s.updatedAt, isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
      return;
    }
    let b: Record<string, unknown> = {};
    try { b = JSON.parse(req.postData() || "{}"); } catch { /* ignore */ }
    if (b.action === "auto-save") {
      // Mirror server: body-hash check when expectedHash present.
      if (typeof b.expectedHash === "string" && b.expectedHash.length > 0) {
        if (b.expectedHash !== contentHash(s.body)) {
          s.conflicts++;
          await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Conflict", conflict: true, serverMarkdown: s.body, serverUpdatedAt: s.updatedAt }) });
          return;
        }
      }
      if (typeof b.markdown === "string") { s.body = b.markdown; s.updatedAt = new Date().toISOString(); s.saves++; }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-cf-id", editToken: "t", updated_at: s.updatedAt }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "stub-cf-id", editToken: "t", updated_at: new Date().toISOString() }) });
  });
  return s;
}

async function boot(page: Page) {
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(500);
}

test.describe("Body-hash conflict detection", () => {
  test.describe.configure({ timeout: 70_000 });

  test("timestamp moving (body unchanged) does NOT raise a conflict", async ({ page }) => {
    const s = stub(page);
    await seed(page);
    await boot(page);

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("EDIT ONE", { delay: 15 });
    await page.waitForTimeout(3500); // save lands → server body now has EDIT ONE

    // Simulate a side-channel write / race: bump updated_at, keep body.
    s.updatedAt = "2099-01-01T00:00:00Z";

    await page.keyboard.type(" EDIT TWO", { delay: 15 });
    await page.waitForTimeout(3500);

    // No conflict modal, no 409.
    await expect(page.getByText("Document Conflict", { exact: false })).toHaveCount(0);
    expect(s.conflicts).toBe(0);
    expect(s.body).toContain("EDIT TWO");
  });

  test("a genuine external body change DOES raise the conflict modal", async ({ page }) => {
    const s = stub(page);
    await seed(page);
    await boot(page);

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("MY EDIT", { delay: 15 });
    // Before our save lands, an external surface rewrites the server body
    // to something the client never saw.
    s.body = "# Conflict\n\nSOMEONE ELSE ENTIRELY\n";
    s.updatedAt = "2099-01-01T00:00:00Z";
    await page.waitForTimeout(3500);

    // The conflict modal should appear (server 409'd on real divergence).
    await expect(page.getByText("Document Conflict", { exact: false })).toBeVisible({ timeout: 3000 });
    expect(s.conflicts).toBeGreaterThan(0);
  });
});
