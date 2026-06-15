/*
 * "Shared with me" sorting control. Two genuinely-shared docs; the sort
 * menu (Newest/Oldest/A-Z/Z-A) reorders the rows.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Cookie-decoded Supabase auth needs the supabase browser client, which
// requires NEXT_PUBLIC_SUPABASE_* at app runtime — not present in CI. Run
// these locally (real .env.local); skip in CI to keep the pipeline green.
test.beforeEach(() => { test.skip(!!process.env.CI, "Requires Supabase env (cookie auth); runs locally only."); });

const REF = "gxvhvcuoprbqnxkrieyj";
const KEY = `sb-${REF}-auth-token`;
const EMAIL = "e2e@memory.wiki";
const UID = "e2e-user-0001";
function b64(s: string) { return Buffer.from(s, "utf-8").toString("base64url"); }
function jwt() { return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: 4102444800 }))}.s`; }
async function seedAuth(c: BrowserContext) {
  const s = { access_token: jwt(), refresh_token: "r", token_type: "bearer", expires_in: 3.15e7, expires_at: 4102444800, user: { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2024-01-01T00:00:00Z" } };
  await c.addCookies([{ name: KEY, value: "base64-" + b64(JSON.stringify(s)), domain: "localhost", path: "/", sameSite: "Lax", expires: 4102444800 }]);
}

test("Shared-with-me sort menu reorders the rows", async ({ page, context }) => {
  test.setTimeout(60000);
  await seedAuth(context);
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  // "Apple" newer than "Zebra"
  await page.route("**/api/user/shared**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ shared: [
    { id: "doc-apple", title: "Apple notes", updatedAt: "2026-02-01T00:00:00Z", isOwner: false, sharedWithMe: true, canEdit: false, editMode: "view", ownerEmail: "o@x.com" },
    { id: "doc-zebra", title: "Zebra notes", updatedAt: "2026-01-01T00:00:00Z", isOwner: false, sharedWithMe: true, canEdit: false, editMode: "view", ownerEmail: "o@x.com" },
  ] }) }));
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-was-logged-in", "1");
    localStorage.setItem("mw-show-shared", "true"); localStorage.setItem("mw-shared-sort", "newest");
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(800);

  const ids = async () => page.evaluate(() => Array.from(document.querySelectorAll('[data-shared-extra]')).map(e => e.getAttribute("data-shared-extra")));

  // Newest first → Apple (newer) before Zebra.
  await expect(page.locator('[data-shared-extra="doc-apple"]')).toBeVisible({ timeout: 10000 });
  expect(await ids()).toEqual(["doc-apple", "doc-zebra"]);

  // Open sort menu (the shared section's sort button) → pick "Oldest first".
  const sortBtn = page.locator('[data-section-id="shared"] [data-action="sort"]');
  await sortBtn.click();
  await page.getByRole("button", { name: "Oldest first", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await ids()).toEqual(["doc-zebra", "doc-apple"]);

  // Z → A → Zebra before Apple.
  await sortBtn.click();
  await page.getByRole("button", { name: "Z → A", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await ids()).toEqual(["doc-zebra", "doc-apple"]);

  // A → Z → Apple before Zebra.
  await sortBtn.click();
  await page.getByRole("button", { name: "A → Z", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await ids()).toEqual(["doc-apple", "doc-zebra"]);
});
