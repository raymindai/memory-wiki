"use client";

// /auth/desktop — auth flow for the Memory.Wiki Electron desktop app.
//
// Lifecycle: main.js's "login" IPC handler opens this URL in the system
// browser with redirect=memorywiki://auth. If the visitor already has an
// Memory.Wiki Supabase session, we immediately bounce to the memorywiki:// URI
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
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string } | null } };

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

      window.location.href = desktopUri;
      setStatus("success");
    })();
  }, [supabase]);

  const contextLabel =
    status === "success" ? "Connected to desktop"
    : status === "error" ? "Couldn't connect"
    : status === "choose-provider" ? "Sign in to continue"
    : "Connecting to Memory.Wiki for Mac";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      <div className="flex flex-col items-center" style={{ gap: 20, maxWidth: 480, width: "100%" }}>
        <MemoryWikiLogo size={28} withBlob />

        <div
          className="font-mono"
          style={{ color: "var(--text-muted)", fontSize: 11, letterSpacing: "0.04em" }}
        >
          {contextLabel}
        </div>

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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--micro-lime)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l3 3 5-5" />
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
              Connected to Memory.Wiki for Mac
            </h1>
            <p
              className="text-center leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}
            >
              Your Memory.Wiki account is now linked. You can close this tab and return to the app.
            </p>
          </>
        )}

        {status === "choose-provider" && (
          <>
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
              Sign in to connect Memory.Wiki for Mac
            </h1>
            <p
              className="text-center"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}
            >
              Use the same account you use on Memory.Wiki.
            </p>
            <AuthProviderStack redirectTo={typeof window !== "undefined" ? `${window.location.origin}/auth/desktop` : "/auth/desktop"} />
          </>
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
              Go to Memory.Wiki
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
