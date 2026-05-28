import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pages that have Korean versions
const I18N_PAGES = ["/about", "/manifesto", "/docs", "/plugins"];


export function middleware(request: NextRequest) {
  try {
    const { pathname, searchParams } = request.nextUrl;

    // /?doc=ID → redirect to /{id} (backwards compat)
    if (pathname === "/" && searchParams.has("doc")) {
      const docId = searchParams.get("doc");
      if (docId) {
        const url = request.nextUrl.clone();
        url.pathname = `/${docId}`;
        url.search = "";
        return NextResponse.redirect(url, 301);
      }
    }

    // /d/{id} stays as the rendered page — no redirect
    // /{id} is a route handler that serves content + redirects browsers to /d/{id}

    // i18n redirects
    const langCookie = request.cookies.get("mw-lang")?.value;

    // If user explicitly chose English and is on /ko/ path, redirect to English
    if (pathname.startsWith("/ko/") && langCookie === "en") {
      const enPath = pathname.replace(/^\/ko/, "");
      const url = request.nextUrl.clone();
      url.pathname = enPath || "/";
      return NextResponse.redirect(url);
    }

    // Auto-redirect to Korean for i18n pages (only if not already on /ko/)
    if (I18N_PAGES.includes(pathname)) {
      const lang = request.headers.get("accept-language") || "";
      const prefersKo = lang.split(",").some((l) => l.trim().startsWith("ko"));

      if (prefersKo && langCookie !== "en") {
        const url = request.nextUrl.clone();
        url.pathname = `/ko${pathname}`;
        return NextResponse.redirect(url);
      }
    }

    const response = NextResponse.next();
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return response;
  } catch {
    // Never let middleware throw — pass through to Next.js
    return NextResponse.next();
  }
}

export const config = {
  // Only run middleware on paths that actually need it
  // Document routes /{id} must NOT go through middleware (causes 500 for some fetchers)
  matcher: [
    "/",
    "/about",
    "/manifesto",
    "/docs",
    "/plugins",
    "/ko/:path*",
    // /d/:path*, /b/:path*, /hub/:path* intentionally NOT in middleware:
    // middleware match forces the page off the static prerender path,
    // and Vercel then emits `cache-control: private, no-store` — which
    // ChatGPT's safe-URL filter rejects. Security headers for those
    // routes come from vercel.json instead.
    "/discover",
    "/settings",
    "/privacy",
    "/terms",
    "/admin",
    "/embed/:path*",
  ],
};
