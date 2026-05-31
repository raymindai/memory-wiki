/*
 * Regression test for the editor data-loss race.
 *
 * Bug (founder report 2026-05-31): while typing in the document
 * editor, characters sometimes vanish and the cursor jumps to
 * the end. Root cause: visibility/focus refetch fired during the
 * 2.5s autosave debounce window, and the dirty check used
 * `autoSave.isSaving` alone — false during the debounce gap —
 * so the handler overwrote local Tiptap content with the stale
 * server body.
 *
 * Fix (commit 20593eed + 8f5d1cfc): dirty check now compares
 * `markdown` against the baseline (last persisted body, falling
 * back to the load-time body). Tiptap's imperative setMarkdown
 * also short-circuits when body == current.
 *
 * This test reproduces the race conditions and asserts the fix
 * holds.
 */

import { test, expect } from "@playwright/test";

test.describe("Editor autosave race — Google Docs-level data safety", () => {
  // Cold-start CI runs the first describe-block before any other
  // spec has warmed the dev server. Tiptap mount + first-page
  // hydration can eat 15s+ of the default 30s budget, leaving very
  // little for the assertion phase. Bump to 60s so the assertions
  // have headroom; tests still assert within their own 2s expect
  // timeouts so signal stays sharp.
  test.describe.configure({ timeout: 60_000 });

  // Inlined setup (not shared setupEditableTab from _helpers): the
  // refetch path under test in MdEditor.tsx bails at "if (!cloudId)
  // return", so the scratch tab MUST carry a cloudId or our
  // `**/api/docs/**` route stub is never hit and the "refetch was
  // attempted" sanity check fails. The shared helper deliberately
  // omits cloudId because other specs are testing the cloud-less
  // flow; this spec needs the opposite.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mw-onboarded", "1");
      localStorage.setItem("mw-welcome-seen", "1");
      localStorage.setItem("mw-welcome-seen-v7", "1");
      localStorage.setItem("mw-editor-opened", "1");
      localStorage.setItem("mw-tabs-version", "10");
      // Fake Supabase auth token. MdEditor's tabs hydration drops
      // cloudId-bearing tabs when no `sb-...-auth-token` key
      // exists in localStorage (signed-out users would otherwise
      // flash other people's drafts). Our seeded tab below has a
      // cloudId, so it would get stripped at hydration without
      // this. Value can be anything — all network calls are
      // route-stubbed below.
      localStorage.setItem("sb-e2e-auth-token", JSON.stringify({ access_token: "e2e-fake", user: { id: "e2e-user" } }));
      const tab = {
        id: "tab-e2e-scratch",
        title: "E2E Scratch",
        markdown: "# E2E Scratch\n\nstart here\n",
        readonly: false,
        permission: "mine",
        isDraft: false,
        // Cloud-bound — required for the refetch path under test
        // (MdEditor.tsx L4625: `if (!cloudId) return;`).
        cloudId: "stub-cloud-id",
      };
      localStorage.setItem("mw-tabs", JSON.stringify([tab]));
      localStorage.setItem("mw-active-tab", "tab-e2e-scratch");
    });
    await page.goto("/?e2e=1");
    await page.waitForSelector(".ProseMirror[contenteditable='true']", { timeout: 20000 });
    await page.waitForTimeout(300);
  });

  test("typed content survives a visibility-change mid-debounce", async ({ page }) => {
    // Stub the cloud-doc GET so the visibility-refetch handler
    // sees a "newer" server body than what local holds. Without
    // this stub, the visibility handler would either fail
    // (no cloudId on scratch) or 404, and never reach the dirty
    // check we're testing.
    let getCount = 0;
    await page.route("**/api/docs/**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        getCount++;
        // Return a body that DIFFERS from whatever the user just
        // typed, simulating a server-side edit that happened
        // while the user was typing. updated_at well in the
        // future so the lastKnown check passes.
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "stub-cloud-id",
            markdown: "# E2E Scratch\n\nfrom another device\n",
            title: "E2E Scratch",
            updated_at: "2099-01-01T00:00:00Z",
            isOwner: true,
            isEditor: false,
            editMode: "account",
            allowedEmails: [],
            allowedEditors: [],
          }),
        });
        return;
      }
      // Let everything else (POST/PATCH/HEAD) pass through.
      await route.continue();
    });

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");
    // Type slowly so we stay inside the 2.5s debounce window
    // when we fire visibilitychange below.
    const sentence = "local typing that must not vanish";
    await page.keyboard.type(sentence, { delay: 20 });

    // Fire visibilitychange (hidden → visible). The visibility
    // refetch handler responds to `visibilitychange`; document.hidden
    // gating isn't relevant for our path since we're testing the
    // visible-side fetch.
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    // Give the handler a beat to run its fetch + dirty check.
    await page.waitForTimeout(300);

    // Assertion: the typed text is still in the editor.
    await expect(editor).toContainText(sentence, { timeout: 2000 });

    // Defensive: the "external" body we stubbed must NOT have
    // landed in the editor, since local was dirty.
    const html = await editor.innerHTML();
    expect(html).not.toContain("from another device");

    // Sanity: the refetch was actually attempted at least once.
    expect(getCount).toBeGreaterThan(0);
  });

  test("repeated focus events during typing never wipe content", async ({ page }) => {
    // Same stub philosophy.
    await page.route("**/api/docs/**", async (route) => {
      const req = route.request();
      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "stub-cloud-id",
            markdown: "# E2E Scratch\n\nserver wins\n",
            title: "E2E Scratch",
            updated_at: "2099-01-01T00:00:00Z",
            isOwner: true,
            isEditor: false,
            editMode: "account",
            allowedEmails: [],
            allowedEditors: [],
          }),
        });
        return;
      }
      await route.continue();
    });

    const editor = page.locator(".ProseMirror[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.press("Enter");

    // Alternate keystrokes with focus events to stress-test the
    // race. Each focus dispatches a refetch attempt. None of
    // these should ever swallow a keystroke.
    const target = "abcdefghij";
    for (const ch of target) {
      await page.keyboard.type(ch, { delay: 50 });
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    }

    // Wait a tick for any pending state to settle.
    await page.waitForTimeout(400);

    // Every character must be present in order.
    await expect(editor).toContainText(target, { timeout: 2000 });

    // The server-wins body must not have leaked in.
    const html = await editor.innerHTML();
    expect(html).not.toContain("server wins");
  });
});
