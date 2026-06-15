/*
 * A signed-in user who has a doc in their "Shared with me" / Recent
 * (hasVisited) must NOT be stranded on the public /d/{id} viewer on
 * refresh — they belong back in their editor. In prod vercel.json
 * rewrites /{id} -> /d/{id}; the viewer redirects them to /?from={id}.
 *
 * We drive /d/{id} directly (the rewrite doesn't run in dev) against a
 * REAL doc id so the SSR shell renders, then intercept the client-side
 * auth + /api/docs fetch to assert the redirect fires on hasVisited.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const REF = "gxvhvcuoprbqnxkrieyj";
const KEY = `sb-${REF}-auth-token`;
const ID = "E76Ns7om"; // a real, public doc — SSR shell renders locally
const EMAIL = "e2e@memory.wiki";
const UID = "e2e-user-0001";
function b(s: string) { return Buffer.from(s, "utf-8").toString("base64url"); }
function jwt() { return `${b(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b(JSON.stringify({ sub: UID, email: EMAIL, role: "authenticated", aud: "authenticated", exp: 4102444800 }))}.s`; }
async function seed(c: BrowserContext) {
  const s = { access_token: jwt(), refresh_token: "r", token_type: "bearer", expires_in: 3.15e7, expires_at: 4102444800, user: { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2024-01-01T00:00:00Z" } };
  await c.addCookies([{ name: KEY, value: "base64-" + b(JSON.stringify(s)), domain: "localhost", path: "/", sameSite: "Lax", expires: 4102444800 }]);
}
function authUser() {
  return { id: UID, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2024-01-01T00:00:00Z" };
}

async function routes(page: Page, hasVisited: boolean) {
  // getUser() hits /auth/v1/user — must return the user so the viewer's
  // ownership-check effect runs instead of bailing on "no session".
  await page.route("**/auth/v1/user**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authUser()) }));
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route(`**/api/docs/${ID}**`, (r) => {
    if (r.request().method() !== "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      id: ID, markdown: "# Shared\n\nBODY\n", title: "Shared", updated_at: "2026-01-01T00:00:00Z",
      isOwner: false, isEditor: false, isAllowedViewer: false, hasVisited, editMode: "view", ownerEmail: "o@x.com",
    }) });
  });
}

test("hasVisited shared doc on /d/{id} redirects a signed-in user to the editor", async ({ page, context }) => {
  test.setTimeout(45000);
  await seed(context);
  await routes(page, true);
  await page.goto(`/d/${ID}`);
  // Should bounce to the editor: /?from=E76Ns7om
  await page.waitForURL((u) => u.searchParams.get("from") === ID || u.pathname === `/${ID}`, { timeout: 15000 });
  expect(page.url()).toContain(`from=${ID}`);
});

test("a never-visited public doc stays on the viewer for a signed-in user", async ({ page, context }) => {
  test.setTimeout(45000);
  await seed(context);
  await routes(page, false);
  await page.goto(`/d/${ID}`);
  await page.waitForTimeout(5000);
  // No redirect — still on /d/{id}.
  expect(new URL(page.url()).pathname).toBe(`/d/${ID}`);
});
