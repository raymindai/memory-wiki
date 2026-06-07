"use client";

// /auth/desktop — auth flow for the memory.wiki Electron desktop app.
//
// Lifecycle: main.js's "login" IPC handler opens this URL in the system
// browser with redirect=memorywiki://auth. If the visitor already has an
// memory.wiki Supabase session, we immediately bounce to the memorywiki:// URI
// scheme with token + refresh_token attached as query params — the
// Electron AuthManager.handleProtocolUrl() picks them up and signs the
// app in.
//
// If they don't have a session, show provider buttons (GitHub / Google)
// that go through Supabase OAuth and come back to /auth/desktop, at
// which point the effect above runs again with a real session.
//
// Pure-design surface: canvas bg, Cal Sans 22px title, mono context
// eyebrow, ink-filled pill primary action. Same shape as
// /auth/cli + /auth/vscode so the three handoff pages read as one
// family.

import { useEffect, useState } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import AuthProviderStack from "@/components/AuthProviderStack";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function DesktopAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      // `?switch=1` from the success screen's "Use a different account"
      // link, or from the desktop app passing the flag explicitly. Drop
      // the cached browser session so we land in the provider picker
      // instead of auto-completing as the previous user.
      const params = new URLSearchParams(window.location.search);
      if (params.get("switch") === "1") {
        await supabase.auth.signOut();
        setStatus("choose-provider");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string; user?: { email?: string } } | null } };

      if (!session?.access_token) {
        setStatus("choose-provider");
        return;
      }

      const token = session.access_token;
      const refreshToken = (session as { refresh_token?: string }).refresh_token;
      let desktopUri = `memorywiki://auth?token=${encodeURIComponent(token)}`;
      if (refreshToken) {
        desktopUri += `&refresh_token=${encodeURIComponent(refreshToken)}`;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setEmail(user.email);
      } catch {}

      window.location.href = desktopUri;
      setStatus("success");
    })();
  }, [supabase]);

  // Mono surface eyebrow shows only on choose-provider — it disambiguates
  // which surface the user is signing into. On success / error / loading,
  // the explicit H1 + body sentence carry surface context (e.g. "Return
  // to the Mac app"), so the eyebrow would just stack as a duplicate.
  const contextLabel = "memory.wiki for Mac";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      {/* Ambient morph blob — same shape used on the desktop Home tab and
          the marketing site, so the auth screen no longer reads as a
          generic OAuth interstitial. Low opacity + heavy blur keeps it
          purely atmospheric: it never competes with the wordmark or the
          provider stack. Hidden under the content via z-index 0. */}
      <img
        src="/brand/mwblob_morph.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute pointer-events-none select-none mw-auth-blob-darktheme"
        style={{
          width: 560, height: 560,
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.08,
          filter: "blur(80px)",
          zIndex: 0,
        }}
      />
      <img
        src="/brand/mwblob_morph_dark.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="absolute pointer-events-none select-none mw-auth-blob-lighttheme"
        style={{
          width: 560, height: 560,
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.06,
          filter: "blur(80px)",
          zIndex: 0,
        }}
      />
      <div className="flex flex-col items-center relative" style={{ gap: 20, maxWidth: 480, width: "100%", zIndex: 1 }}>
        <MemoryWikiLogo size={28} withBlob />

        {status === "choose-provider" && (
          <div
            className="font-mono"
            style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
          >
            {contextLabel}
          </div>
        )}

        {status === "loading" && (
          <>
            <div style={{ width: 128, height: 2, borderRadius: 2, overflow: "hidden", background: "var(--border-dim)" }}>
              <div style={{ height: "100%", borderRadius: 2, background: "var(--text-primary)", animation: "loadbar 1.2s ease-in-out infinite" }} />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>One moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            {/* Status chip — small inline ✓ + label, sized like a pill
                so it reads as a state badge rather than a hero icon.
                Previous design used a 40px circle-check on its own line
                which dominated the layout and felt like a generic OAuth
                "success" stock illustration. */}
            <div
              className="inline-flex items-center"
              style={{
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12l5 5L20 7" />
              </svg>
              Signed in
            </div>

            {email && (
              <div
                className="font-mono"
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim, var(--border))",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  letterSpacing: 0,
                }}
              >
                {email}
              </div>
            )}

            <p
              className="text-center"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.55, maxWidth: 360 }}
            >
              Return to the Mac app. This tab is safe to close.
            </p>

            <a
              href="?switch=1"
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "underline" }}
            >
              Wrong account? Use a different one
            </a>
          </>
        )}

        {status === "choose-provider" && (
          <AuthProviderStack redirectTo={typeof window !== "undefined" ? `${window.location.origin}/auth/desktop` : "/auth/desktop"} />
        )}

        {status === "error" && (
          <>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--micro-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6" />
              <path d="M9 9l6 6" />
            </svg>
            <h1
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: 0,
                lineHeight: 1.25,
                margin: 0,
              }}
            >
              Connection failed
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Please try again.</p>
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-90"
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                background: "var(--text-primary)",
                color: "var(--background)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Go to memory.wiki
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
