import type { NextRequest, NextResponse } from "next/server";

/**
 * Server-side anonymous-id, persisted in a cross-site cookie.
 *
 * Why: when the bookmarklet runs on chatgpt.com / claude.ai / gemini.google.com
 * and POSTs to memory.wiki/api/docs, browser localStorage on memory.wiki is
 * unreachable (same-origin policy). A cookie issued on memory.wiki is the
 * only thing that survives across these cross-origin captures so we can
 * group all of a user's anonymous docs under one id and let them claim
 * the lot when they sign in.
 *
 * Cookie shape:
 *   mw_anon=<uuid>; Max-Age=31536000; Path=/; SameSite=None; Secure
 *
 * SameSite=None+Secure is required for the bookmarklet's cross-origin
 * fetch (with credentials: "include") to send and receive the cookie.
 * It's intentionally NOT HttpOnly so client-side scripts on memory.wiki
 * can also read it during the in-app capture flow.
 */

const COOKIE_NAME = "mw_anon";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Returns the anonymous id from the request cookie, or null. */
export function readAnonymousCookie(req: NextRequest): string | null {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  return value && /^[a-f0-9-]{8,}$/i.test(value) ? value : null;
}

/**
 * Resolves the anonymous id for this request and writes a Set-Cookie if
 * a new one had to be issued. Mutates the response headers in place.
 *
 * If the request already has a userId (verified JWT) we skip cookie
 * issuance — authenticated users don't need it.
 */
export function ensureAnonymousCookie(
  req: NextRequest,
  res: NextResponse,
  options: { explicitId?: string | null; skip?: boolean } = {}
): string {
  if (options.skip) return "";
  if (options.explicitId) {
    // Caller (e.g. body param) supplied an id — honor it AND persist as
    // a cookie so subsequent same-browser captures share it.
    setCookie(res, options.explicitId);
    return options.explicitId;
  }
  const existing = readAnonymousCookie(req);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  setCookie(res, fresh);
  return fresh;
}

function setCookie(res: NextResponse, value: string) {
  // Use the response Set-Cookie header directly. NextResponse.cookies.set
  // would also work but doesn't expose the SameSite=None nuance cleanly
  // across runtime versions, and we explicitly need SameSite=None for the
  // bookmarklet's cross-origin fetch path.
  res.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=None; Secure`
  );
}

/**
 * Origins that can fetch /api/docs and similar capture endpoints with
 * credentials. Everything else gets a non-credentialed CORS response.
 */
const TRUSTED_ORIGINS = new Set([
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://memory.wiki",
  "https://staging.memory.wiki",
  "http://localhost:3000",
  "http://localhost:3002",
]);

/**
 * Apply CORS headers for cross-origin capture (bookmarklet, MCP, future
 * extensions). Returns the headers object to apply; the caller is
 * responsible for attaching them to the actual response.
 */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  if (!TRUSTED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-User-Email, X-Anonymous-Id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
