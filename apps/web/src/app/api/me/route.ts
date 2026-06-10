// GET /api/me — return current signed-in user's id + email + display name,
// or 401 when no session cookie. Cookie-based; works with credentials:
// "include" from any cross-origin caller that's signed in to memory.wiki.
//
// Why a separate endpoint exists: the Chrome / Safari extensions read
// auth state to decide whether to show "Sign in" or "Signed in as ...".
// Chrome can parse the Supabase auth-token cookies directly via
// chrome.cookies.getAll. Safari's stricter Storage Partitioning blocks
// cookie reads from extension context in many cases — so the Safari
// popup hits this endpoint instead. The browser sends the cookie
// automatically because the extension has memory.wiki in its host
// permissions and the user has granted access.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = new Set([
  "https://memory.wiki",
  "https://memory.wiki.online",
  // Safari Web Extension origin
  "safari-web-extension://",
  // Chrome extension origins (varies per install id, prefix-match below)
]);

function corsHeaders(req: NextRequest): Headers {
  const origin = req.headers.get("origin") || "";
  const h = new Headers();
  const isAllowed =
    ALLOWED_ORIGINS.has(origin) ||
    origin.startsWith("chrome-extension://") ||
    origin.startsWith("moz-extension://") ||
    origin.startsWith("safari-web-extension://");
  if (isAllowed) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Credentials", "true");
    h.set("Vary", "Origin");
  }
  return h;
}

export async function OPTIONS(req: NextRequest) {
  const h = corsHeaders(req);
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return new NextResponse(null, { status: 204, headers: h });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "auth-unavailable" }, { status: 500, headers });
  }
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      return NextResponse.json({ signedIn: false }, { status: 401, headers });
    }
    return NextResponse.json(
      {
        signedIn: true,
        userId: user.id,
        email: user.email || null,
        // Display name preferred from user_metadata, falls back to the
        // part of the email before @ so the popup can show SOMETHING
        // even for accounts whose providers don't return a name.
        displayName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          (user.email ? user.email.split("@")[0] : null),
        avatarUrl: user.user_metadata?.avatar_url || null,
      },
      { headers },
    );
  } catch (err) {
    console.error("[/api/me] error", err);
    return NextResponse.json({ error: "server-error" }, { status: 500, headers });
  }
}
