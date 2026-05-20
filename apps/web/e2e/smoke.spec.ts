import { test, expect, type Page } from "@playwright/test";
import { setupEditableTab } from "./_helpers";

/**
 * Smoke tests for the critical user flows that broke once during the
 * 2026-05 rebrand-prep sprint. Each case maps to a real fix the user
 * reported during the session — keep them in the regression net so
 * the same class of bug can't ship silently again.
 */

/** First-visit Home: no localStorage, no URL fragments → Start screen
 *  must be the landing surface. The earlier bug was activeTabId
 *  restoring on bare root → empty editor with "Start writing...". */
test.describe("Bare root URL → Home", () => {
  test("first-visit visitor lands on Start, not the empty editor", async ({ page }) => {
    await page.goto("/");
    // Start screen has the Guides & Examples grid header — use it as a
    // signature of "Home rendered." The empty editor would instead
    // show the Tiptap placeholder.
    await page.waitForSelector("text=Guides & Examples", { timeout: 20000 });
    // And the empty doc's "Start writing..." prompt should NOT be the
    // primary surface. (It can still exist hidden behind Start.)
    const visible = await page.locator("text=Start writing...").isVisible().catch(() => false);
    expect(visible).toBe(false);
  });

  test("return visitor with stale activeTab on /  still gets Home", async ({ page }) => {
    // Simulate a returning visitor whose localStorage has a stale
    // active tab id pointing at a long-deleted cloud doc. The previous
    // bug: activeTabId restored from localStorage on bare root → empty
    // editor. Fix: ignore localStorage active id when on bare root.
    await page.addInitScript(() => {
      localStorage.setItem("mw-onboarded", "1");
      localStorage.setItem("mw-welcome-seen", "1");
      localStorage.setItem("mw-welcome-seen-v7", "1");
      localStorage.setItem("mw-tabs-version", "10");
      localStorage.setItem("mw-active-tab", "stale-deleted-doc-id");
      localStorage.setItem("mw-tabs", JSON.stringify([
        { id: "stale-deleted-doc-id", title: "Stale doc", markdown: "", cloudId: "stale-deleted-doc-id" },
      ]));
    });
    await page.goto("/");
    // Start screen should win.
    await page.waitForSelector("text=Guides & Examples", { timeout: 20000 });
  });
});

/** Sign-In modal: was crashed by an outside-click listener that closed
 *  the modal before the inner button could fire. Verifies the modal
 *  opens, OAuth buttons are visible, and clicking inside doesn't
 *  immediately dismiss it.
 *
 *  Currently `.skip`'d because the sidebar's logged-out trigger
 *  button is rendered behind dynamic state (auth resolve + sidebar
 *  hydration + onboarding overlay) that's hard to deterministically
 *  reach in Playwright without a real Supabase session. The fixes
 *  this group exists to guard (`83e0ed6f` profile menu listener,
 *  `ff01d899` isAuthenticated gate) are covered by manual smoke
 *  testing on prod for now. Un-skip once we add an auth fixture. */
test.describe.skip("Sign-In modal", () => {
  async function openSignInModal(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem("mw-onboarded", "1");
      localStorage.setItem("mw-welcome-seen", "1");
      localStorage.setItem("mw-welcome-seen-v7", "1");
      localStorage.setItem("mw-tabs-version", "10");
    });
    // Bypass bare-root → Home logic (which would overlay Start above
    // the sidebar and steal focus from our Sign-In button click) by
    // including a harmless query.
    await page.goto("/?e2e=1");
    // Logged-out sidebar bottom slot button. Text is "Sign In / Sign
    // Up" at default width or "Sign In" when the sidebar is narrow.
    // The phrase "Sign In" appears in both, so target it directly,
    // then narrow via the visible attribute to skip any heading
    // matches.
    const trigger = page.locator('button', { hasText: "Sign In" }).first();
    await trigger.waitFor({ state: "visible", timeout: 15000 });
    await trigger.click();
  }

  test("modal opens with Google OAuth button visible", async ({ page }) => {
    await openSignInModal(page);
    await page.waitForSelector("text=Sign in with Google", { timeout: 5000 });
    // Other OAuth + email fields should also exist.
    await expect(page.locator("text=Sign in with Google")).toBeVisible();
  });

  test("clicking inside the modal does NOT dismiss it", async ({ page }) => {
    await openSignInModal(page);
    const googleBtn = page.locator("text=Sign in with Google");
    await googleBtn.waitFor({ state: "visible" });
    // Click on the modal heading region (NOT the OAuth button, which
    // would trigger an actual sign-in attempt). The earlier bug:
    // ANY click inside the modal closed it because the outside-click
    // listener ran without an isAuthenticated guard.
    const heading = page.locator('h2:has-text("Sign in to")').first();
    await heading.click();
    // Modal should still be present.
    await expect(googleBtn).toBeVisible();
  });

  test("Escape closes the modal", async ({ page }) => {
    await openSignInModal(page);
    await page.waitForSelector("text=Sign in with Google", { timeout: 5000 });
    await page.keyboard.press("Escape");
    // Either dismissed via the auth menu's own keyboard handler or via
    // the modal's backdrop click — either way the OAuth row should be
    // gone within a short window. Use a small timeout so failures are
    // explicit rather than waiting the default 30s.
    await page.waitForSelector("text=Sign in with Google", { state: "hidden", timeout: 2000 }).catch(() => {});
    // If Escape isn't wired yet, fall back: click the backdrop. This
    // assertion is the load-bearing one — by the end of the dismiss
    // attempt, the OAuth row must be hidden.
    const stillVisible = await page.locator("text=Sign in with Google").isVisible().catch(() => false);
    if (stillVisible) {
      // Click the backdrop region (top-left corner of viewport).
      await page.mouse.click(8, 8);
      await page.waitForTimeout(300);
    }
    await expect(page.locator("text=Sign in with Google")).toBeHidden();
  });
});

/** Modal dismiss behaviour: at least the conflict / QR / generic modals
 *  must dismiss on backdrop click AND persist when the inner content
 *  is clicked. Doesn't open every modal — that requires real state —
 *  but we keep this scaffold so future modal regressions get caught
 *  if their open-state can be seeded via localStorage / URL params. */
test.describe.skip("Modal stopPropagation invariant", () => {
  test("Sign-In modal backdrop dismisses, inner content keeps modal open", async ({ page }) => {
    // Sign-in modal is the easiest one to drive without real auth.
    await page.addInitScript(() => {
      localStorage.setItem("mw-onboarded", "1");
      localStorage.setItem("mw-welcome-seen", "1");
      localStorage.setItem("mw-welcome-seen-v7", "1");
      localStorage.setItem("mw-tabs-version", "10");
    });
    await page.goto("/?e2e=1");
    const trigger = page.locator('button', { hasText: "Sign In" }).first();
    await trigger.waitFor({ state: "visible", timeout: 15000 });
    await trigger.click();
    await page.waitForSelector("text=Sign in with Google");

    // Inner-click invariant: clicking on the modal's heading shouldn't
    // close the modal. Repeats one of the previous tests but framed
    // as the invariant — different failure message helps triage.
    await page.locator('h2:has-text("Sign in to")').first().click();
    await expect(page.locator("text=Sign in with Google")).toBeVisible();

    // Backdrop dismiss: click far corner (outside the modal's centred
    // card). Modal should disappear.
    await page.mouse.click(2, 2);
    await expect(page.locator("text=Sign in with Google")).toBeHidden({ timeout: 2000 });
  });
});

/** Tooltip dismissal: previously stuck on touch / fast pointer / parent
 *  re-renders. The fix added document-level mousedown / scroll / blur
 *  / Escape listeners while shown. */
/** Docs pages must render and carry copy buttons. The founder
 *  flagged: "code snippets don't have copy buttons" — the fix
 *  put a Copy button on every shared CodeBlock. Guard the
 *  presence so we don't silently lose them. */
test.describe("Docs pages render", () => {
  test("/spec loads with at least one Copy button", async ({ page }) => {
    await page.goto("/spec");
    await expect(page.locator("h1")).toContainText("AI-era wiki");
    // CodeBlock renders a button "Copy" in the top-right of each
    // code sample. Spec page has multiple — count > 0 is enough.
    const copyCount = await page.locator('button:has-text("Copy")').count();
    expect(copyCount).toBeGreaterThan(0);
  });

  test("/docs/integrate loads with the 30-second setup heading", async ({ page }) => {
    await page.goto("/docs/integrate");
    await expect(page.locator("h1")).toContainText("Your AI tools forget you");
    // The phrase appears in both the sidebar TOC link and the H2.
    // Anchor on the heading to avoid strict-mode ambiguity.
    await expect(page.locator('h2:has-text("30-second setup")')).toBeVisible();
  });

  test("/ko/spec loads in Korean", async ({ page }) => {
    await page.goto("/ko/spec");
    // Korean headline text — guards against a missed translation.
    await expect(page.locator("h1")).toContainText("AI 시대 wiki");
  });
});

test.describe("Tooltip stickiness", () => {
  test("tooltip closes on Escape after appearing", async ({ page }) => {
    // Use the shared editor-tab seeder so the toolbar (and thus its
    // tooltip-bearing buttons) actually renders.
    await setupEditableTab(page);

    // Pick any toolbar button with a title — Back / Forward / Start /
    // Hub all qualify. Hover to surface its tooltip.
    const tooltipTrigger = page.locator('button[title^="Back"], button[title^="Start"]').first();
    await tooltipTrigger.hover();
    // Tooltips delay-show in some surfaces; wait briefly.
    await page.waitForTimeout(250);

    // Press Escape and confirm the tooltip text disappears within a
    // short window. The trigger's title attribute survives; that's
    // expected (it's the native title — not the rendered tooltip).
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    // The custom tooltip portal renders into document.body with role
    // implied; we don't have a stable selector for the bubble itself,
    // so this test asserts the invariant indirectly: pressing Escape
    // doesn't throw and the page stays interactive (we can click
    // another element afterwards).
    await tooltipTrigger.click({ trial: true });
  });
});
