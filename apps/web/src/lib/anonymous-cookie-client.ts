/**
 * Browser-side counterpart to lib/anonymous-cookie.ts.
 *
 * The mw_anon cookie is intentionally not HttpOnly — the in-app sign-in
 * flow needs to read it so it can call /api/user/migrate and claim every
 * doc the browser created anonymously. Server still owns minting/refresh.
 */

const COOKIE_NAME = "mw_anon";

export function readMdfyAnonCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE_NAME + "="));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  return /^[a-f0-9-]{8,}$/i.test(value) ? value : null;
}

/**
 * Clear the cookie locally after a successful claim. Server-side the
 * row is already migrated; the cookie is now stale and re-issuing one
 * fresh on the next anonymous capture is the right behavior.
 *
 * We can't delete a SameSite=None;Secure cookie on http://localhost from
 * the JS side because Secure requires https; in that case the next
 * server response will overwrite it anyway.
 */
export function clearMdfyAnonCookie() {
  if (typeof document === "undefined") return;
  document.cookie =
    COOKIE_NAME +
    "=; Max-Age=0; Path=/; SameSite=None; Secure";
}
