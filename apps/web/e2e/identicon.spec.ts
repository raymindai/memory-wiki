/*
 * GitHub-style identicon: when a profile's avatar_style is "identicon"
 * (the founder's case, and the Settings "Identicon" tile), the avatar
 * resolves to a locally-generated GitHub-style pixel identicon — an SVG
 * data URI that actually loads as an image (not a DiceBear remote URL).
 *
 * Cookie-decoded Supabase auth needs Supabase env at runtime — local only.
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";

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

async function stub(page: Page) {
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documents: [], recent: [], shared: [], pins: [], folders: [], concepts: [], conceptIndex: { concepts: [] } }) }));
  // Profile picks the GitHub identicon style.
  await page.route("**/api/user/profile**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: { avatar_style: "identicon", display_name: "E2E" } }) }));
}

test("Identicon avatar is a GitHub-style SVG data URI that loads", async ({ page, context }) => {
  test.setTimeout(45000);
  await seedAuth(context);
  await stub(page);
  await page.addInitScript(() => {
    localStorage.setItem("mw-onboarded", "1"); localStorage.setItem("mw-welcome-seen", "1");
    localStorage.setItem("mw-welcome-seen-v7", "1"); localStorage.setItem("mw-editor-opened", "1");
    localStorage.setItem("mw-tabs-version", "10"); localStorage.setItem("mw-was-logged-in", "1");
    localStorage.setItem("mw-tabs", JSON.stringify([{ id: "tab-i", title: "Doc", markdown: "# Doc\n\nx\n", readonly: false, permission: "mine", isDraft: true }]));
    localStorage.setItem("mw-active-tab", "tab-i");
  });
  await page.goto("/?e2e=1");
  await page.waitForSelector(".ProseMirror", { timeout: 20000 });
  await page.waitForTimeout(1200);

  // Find an avatar img whose src is a generated identicon data URI.
  const info = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    const av = imgs.find((i) => i.src.startsWith("data:image/svg+xml"));
    if (!av) return { found: false } as const;
    const svg = decodeURIComponent(av.src.replace(/^data:image\/svg\+xml,/, ""));
    return {
      found: true,
      isDataUri: av.src.startsWith("data:image/svg+xml"),
      loaded: av.complete && av.naturalWidth > 0,
      rectCount: (svg.match(/<rect/g) || []).length,
      hasHsl: /hsl\(/.test(svg),
      notDicebear: !av.src.includes("dicebear.com"),
    };
  });

  expect(info.found).toBe(true);
  expect(info.isDataUri).toBe(true);
  // The SVG actually decoded + rendered as a bitmap (encoding is valid).
  expect(info.loaded).toBe(true);
  // GitHub-style grid: a background rect + several filled cells, in one hsl colour.
  expect(info.rectCount).toBeGreaterThan(3);
  expect(info.hasHsl).toBe(true);
  expect(info.notDicebear).toBe(true);
});
