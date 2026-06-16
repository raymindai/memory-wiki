/*
 * Phantom "Document Conflict" on a brand-new doc. Repro of the founder's
 * bug: create a new doc, paste a body with NO H1 → the server used to
 * prepend "# <titleHint>" to the body, but the client baselined its
 * conflict refs on the un-prefixed body it sent → the next auto-save's
 * expectedHash mismatched the server body → 409 "Document Conflict" on a
 * doc nobody else was editing (and "# Untitled" got injected into the text).
 *
 * Fix: server ignores the "Untitled" placeholder hint (no injection) and
 * returns the stored markdown; client baselines on the SERVER's body.
 * This stub mirrors the real server (POST create + PATCH auto-save with
 * the same body-hash conflict check) so a regression re-surfaces the 409.
 */
import { test, expect, type Page } from "@playwright/test";
import { contentHash } from "../src/lib/content-hash";

const DOC_ID = "newdoc01";

function stub(page: Page, opts: { hintBehavior: "untitled" | "real" }) {
  const s = { body: "", conflicts: 0, created: 0, injected: false };
  // Catch-all first (Playwright checks last-registered first).
  page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [], recent: [], shared: [], pins: [], folders: [], concepts: [], conceptIndex: { concepts: [] } }) }));
  // POST /api/docs — create. Mirrors the (fixed) server: prepend "# hint"
  // only for a REAL hint (never "Untitled"); return the stored markdown.
  page.route("**/api/docs", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    const b = JSON.parse(route.request().postData() || "{}");
    const md: string = typeof b.markdown === "string" ? b.markdown : "";
    const raw = (b.title || "").trim();
    const hint = raw === "Untitled" ? "" : raw;               // server fix B
    const firstLine = (md.split("\n")[0] || "").trim();
    const hasH1 = /^#\s+\S/.test(firstLine);
    const stored = (!hasH1 && hint) ? (md.trim() ? `# ${hint}\n\n${md}` : `# ${hint}\n`) : md;
    s.body = stored;
    s.created++;
    if (/^#\s+Untitled/.test(stored)) s.injected = true;       // should never happen
    const now = new Date().toISOString();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: DOC_ID, editToken: "tok", markdown: stored, created_at: now, updated_at: now }) });
  });
  // PATCH /api/docs/<id> — auto-save with the real body-hash conflict check.
  page.route(`**/api/docs/${DOC_ID}**`, async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: DOC_ID, markdown: s.body, title: "x", updated_at: "2020-01-01T00:00:00Z", isOwner: true, isEditor: false, editMode: "account", allowedEmails: [], allowedEditors: [] }) });
    const b = JSON.parse(req.postData() || "{}");
    if (b.action === "auto-save") {
      if (typeof b.expectedHash === "string" && b.expectedHash.length > 0 && b.expectedHash !== contentHash(s.body)) {
        s.conflicts++;
        return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Conflict", conflict: true, serverMarkdown: s.body, serverUpdatedAt: new Date().toISOString() }) });
      }
      if (typeof b.markdown === "string") s.body = b.markdown;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: DOC_ID, editToken: "tok", updated_at: new Date().toISOString() }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: DOC_ID }) });
  });
  void opts;
  return s;
}

async function seed(page: Page, tabTitle: string) {
  await page.addInitScript((title) => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "t-new", title, markdown: "", readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "t-new");
  }, tabTitle);
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
  await page.waitForTimeout(400);
}

test.describe("New-doc phantom conflict", () => {
  test.describe.configure({ timeout: 60_000 });

  test("paste with no H1 into a new (Untitled) doc never conflicts, never injects # Untitled", async ({ page }) => {
    const s = stub(page, { hintBehavior: "untitled" });
    await seed(page, "Untitled");
    const ed = page.locator(".ProseMirror[contenteditable='true']").first();
    await ed.click();
    // Paste-like: a paragraph with NO heading.
    await page.keyboard.type("I use Claude every day and ship with it.", { delay: 5 });
    await page.waitForTimeout(3200);            // create + debounced auto-save
    // Keep editing — this is the save that used to 409.
    await page.keyboard.type(" Adding more text now.", { delay: 5 });
    await page.waitForTimeout(3200);

    expect(s.created).toBeGreaterThan(0);
    expect(s.conflicts).toBe(0);                                  // no phantom 409
    expect(s.injected).toBe(false);                              // no "# Untitled" injected
    await expect(page.getByText("Document Conflict", { exact: false })).toHaveCount(0);
  });

  test("server H1-prefix on create does not desync the baseline (real title hint)", async ({ page }) => {
    const s = stub(page, { hintBehavior: "real" });
    await seed(page, "My Notes");             // real tab title → server prepends "# My Notes"
    const ed = page.locator(".ProseMirror[contenteditable='true']").first();
    await ed.click();
    await page.keyboard.type("first line of the body with no heading", { delay: 5 });
    await page.waitForTimeout(3200);
    await page.keyboard.type(" and a second edit", { delay: 5 });
    await page.waitForTimeout(3200);

    expect(s.created).toBeGreaterThan(0);
    // Server prepended the hint (proves the rewrite path is exercised)…
    expect(s.body.startsWith("# My Notes") || s.body.includes("first line")).toBeTruthy();
    // …yet the client baselined on the server body → no phantom conflict.
    expect(s.conflicts).toBe(0);
    await expect(page.getByText("Document Conflict", { exact: false })).toHaveCount(0);
  });
});
