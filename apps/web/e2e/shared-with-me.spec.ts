/*
 * "Shared with me" section — the not-yet-open rows (allExtra: recent
 * shared docs + share notifications). These rows previously had NO
 * context menu, NO hover kebab, and NO working "Remove from list".
 * This verifies all four reported problems are fixed:
 *   1. clicking the row opens the doc
 *   2. right-click shows a context menu
 *   3. hovering reveals the "..." kebab
 *   4. "Remove from list" fires leave-share and drops the row
 *
 * Requires an authenticated user (the section only renders for
 * signed-in accounts). We seed a Supabase session cookie in the exact
 * @supabase/ssr 0.9.0 format (base64- + base64url(JSON)) so
 * getSession() resolves a user without any network round-trip.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Cookie-decoded Supabase auth needs the supabase browser client, which
// requires NEXT_PUBLIC_SUPABASE_* at app runtime — not present in CI. Run
// these locally (real .env.local); skip in CI to keep the pipeline green.
test.beforeEach(() => { test.skip(!!process.env.CI, "Requires Supabase env (cookie auth); runs locally only."); });

const PROJECT_REF = "gxvhvcuoprbqnxkrieyj";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const USER_ID = "e2e-user-0001";
const USER_EMAIL = "e2e@memory.wiki";
const SHARED_ID = "shared-doc-xyz";
const SHARED_TITLE = "Quarterly Plan (shared)";
const SHARED_BODY = "# Quarterly Plan (shared)\n\nSHARED BODY CONTENT\n";

function b64url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64url");
}

function makeJWT(): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const farFuture = 4102444800; // 2100-01-01
  const payload = b64url(JSON.stringify({
    sub: USER_ID, email: USER_EMAIL, role: "authenticated", aud: "authenticated", exp: farFuture,
  }));
  return `${header}.${payload}.e2e-sig`;
}

async function seedAuthCookie(context: BrowserContext) {
  const farFutureSec = 4102444800;
  const session = {
    access_token: makeJWT(),
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3.15e7,
    expires_at: farFutureSec,
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: USER_EMAIL,
      email_confirmed_at: "2024-01-01T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2024-01-01T00:00:00Z",
    },
  };
  const value = "base64-" + b64url(JSON.stringify(session));
  await context.addCookies([{
    name: STORAGE_KEY,
    value,
    domain: "localhost",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
    expires: farFutureSec,
  }]);
}

// Tracks server interactions so we can assert leave-share fired.
type Calls = { docGet: number; leaveShare: Array<Record<string, unknown>>; leaveShareAuth: string[]; recentGets: number; left: boolean };

async function routeApi(page: Page): Promise<Calls> {
  const calls: Calls = { docGet: 0, leaveShare: [], leaveShareAuth: [], recentGets: 0, left: false };

  // Register the broad handlers FIRST so the specific ones below
  // (registered later → checked first by Playwright's LIFO order) win.
  // Supabase REST/auth (profile fetch, token refresh) → benign.
  await page.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  // Quiet the rest of the API surface so nothing throws / hits network.
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  // The shared doc itself.
  await page.route(`**/api/docs/${SHARED_ID}**`, async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      calls.docGet++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        id: SHARED_ID, markdown: SHARED_BODY, title: SHARED_TITLE, updated_at: "2026-01-01T00:00:00Z",
        isOwner: false, isEditor: false, isAllowedViewer: true, editMode: "view", ownerEmail: "owner@memory.wiki",
        allowedEmails: [USER_EMAIL], allowedEditors: [],
      }) });
      return;
    }
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(req.postData() || "{}"); } catch { /* ignore */ }
    if (body.action === "leave-share") {
      // Record the Authorization header so we can assert the client sends
      // a fresh bearer (server authenticates leave-share from the JWT).
      calls.leaveShareAuth.push(req.headers()["authorization"] || "");
      calls.leaveShare.push(body);
      // Mirror the real server: leave-share deletes the visit_history
      // row, so subsequent /api/user/recent no longer returns this doc.
      calls.left = true;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  // Shared-with-me feed → one genuinely-shared doc, UNTIL the user leaves
  // the share (then it no longer matches allowed_emails → drops out).
  await page.route("**/api/user/shared**", async (route) => {
    calls.recentGets++;
    const shared = calls.left ? [] : [{ id: SHARED_ID, title: SHARED_TITLE, updatedAt: "2026-01-01T00:00:00Z", isOwner: false, sharedWithMe: true, canEdit: false, editMode: "view", ownerEmail: "owner@memory.wiki" }];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shared }) });
  });

  return calls;
}

async function boot(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1");
    localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1");
    localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10");
    localStorage.setItem("mw-was-logged-in", "1");
    localStorage.setItem("mw-show-shared", "true");
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(1500);
}

test.describe("Shared with me — not-yet-open rows", () => {
  test.describe.configure({ timeout: 70_000 });

  test("auth seed resolves a signed-in user and renders the shared row", async ({ page, context }) => {
    await seedAuthCookie(context);
    await routeApi(page);
    await boot(page);

    // The shared row should appear in the sidebar.
    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(SHARED_TITLE);
  });

  test("a public doc only VISITED (not shared) does NOT appear in Shared with me", async ({ page, context }) => {
    await seedAuthCookie(context);
    await routeApi(page);
    // A visited-but-not-shared public doc isn't a member of allowed_emails,
    // so the shared endpoint never returns it → empty Shared-with-me.
    await page.route("**/api/user/shared**", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ shared: [] }),
    }));
    await boot(page);

    // It must NOT show up under Shared with me.
    await expect(page.getByText("Shared with me", { exact: true })).toBeVisible();
    await expect(page.locator('[data-shared-extra="public-visited-1"]')).toHaveCount(0);
  });

  test("clicking the row opens the document", async ({ page, context }) => {
    await seedAuthCookie(context);
    const calls = await routeApi(page);
    await boot(page);

    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    // The doc is fetched and its body lands on the page (readonly
    // shared docs render through the markdown-it viewer surface, not
    // necessarily the editable .ProseMirror).
    await expect(page.getByText("SHARED BODY CONTENT", { exact: false }).first()).toBeVisible({ timeout: 8000 });
    expect(calls.docGet).toBeGreaterThan(0);

    // It must STAY in "Shared with me" after opening — a genuinely shared
    // doc (isAllowedViewer) opened read-only should remain listed, just as
    // an open tab now. (Regression: it used to vanish on click.)
    await page.waitForTimeout(800);
    const stillListed = await page.evaluate((title) => {
      const header = document.querySelector('[data-section-id="shared"]');
      const section = header?.parentElement; // the section wrapper div
      return !!section && (section.textContent || "").includes(title);
    }, SHARED_TITLE);
    expect(stillListed).toBe(true);
  });

  test("right-click shows a context menu with Open + Remove from list", async ({ page, context }) => {
    await seedAuthCookie(context);
    await routeApi(page);
    await boot(page);

    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click({ button: "right" });

    await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Remove from list", exact: true })).toBeVisible();
  });

  test("hovering the row reveals the kebab", async ({ page, context }) => {
    await seedAuthCookie(context);
    await routeApi(page);
    await boot(page);

    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    const kebab = row.locator('button[title="Document options"]');

    // Collapsed (w-0) before hover, expands to 18px on hover.
    const wBefore = await kebab.evaluate((el) => el.getBoundingClientRect().width);
    await row.hover();
    await page.waitForTimeout(250);
    const wAfter = await kebab.evaluate((el) => el.getBoundingClientRect().width);
    expect(wBefore).toBeLessThan(2);
    expect(wAfter).toBeGreaterThan(10);
  });

  test("Remove from list fires leave-share and drops the row", async ({ page, context }) => {
    await seedAuthCookie(context);
    const calls = await routeApi(page);
    await boot(page);

    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click({ button: "right" });

    await page.getByRole("button", { name: "Remove from list", exact: true }).click();

    // Row disappears and the server got the leave-share PATCH with the
    // recipient's email.
    await expect(row).toHaveCount(0, { timeout: 5000 });
    expect(calls.leaveShare.length).toBeGreaterThan(0);
    expect(calls.leaveShare[0]).toMatchObject({ action: "leave-share", userEmail: USER_EMAIL });
    // Client must send a fresh bearer so the server can authenticate the
    // leave (a stale/missing token used to 401 and delete nothing).
    expect(calls.leaveShareAuth[0]).toMatch(/^Bearer .+/);

    // And it must STAY gone: the client re-pulls /api/user/recent after
    // leave-share, and the server (now without the visit_history row)
    // returns an empty feed. This is the "removed but it keeps coming
    // back" regression — the row must not reappear.
    await expect.poll(() => calls.recentGets, { timeout: 5000 }).toBeGreaterThan(1);
    await page.waitForTimeout(1000);
    await expect(row).toHaveCount(0);
  });

  test("refresh on an opened shared doc stays in the editor, not the viewer", async ({ page, context }) => {
    await seedAuthCookie(context);
    await routeApi(page);
    await boot(page);

    // Open the shared doc from the row (URL → /{id}).
    const row = page.locator(`[data-shared-extra="${SHARED_ID}"]`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
    await expect(page.getByText("SHARED BODY CONTENT", { exact: false }).first()).toBeVisible({ timeout: 8000 });
    expect(new URL(page.url()).pathname).toBe(`/${SHARED_ID}`);

    // Refresh — the editor (sidebar + body) must come back; we must NOT
    // get bounced to the bare public /d/{id} viewer.
    await page.reload();
    await page.waitForSelector(".ProseMirror", { timeout: 20000 });
    await expect(page.getByText("LIBRARY", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("SHARED BODY CONTENT", { exact: false }).first()).toBeVisible({ timeout: 8000 });
    expect(new URL(page.url()).pathname.startsWith("/d/")).toBe(false);
  });
});
