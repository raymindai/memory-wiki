"use client";

// /auth/chrome — Chrome extension auth handoff. Unlike /auth/desktop or
// /auth/vscode there is no custom URI scheme to bounce into: the chrome
// extension reads the Supabase session out of the shared *.memory.wiki
// cookie via chrome.cookies. So this page just (1) gets the user signed
// in to memory.wiki in the browser, and (2) tells them to close the tab
// and return to the Chrome popup.
//
// Same Pure-design surface as /auth/cli + /auth/desktop + /auth/vscode.

import { useEffect, useState } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import AuthProviderStack from "@/components/AuthProviderStack";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ChromeAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("switch") === "1") {
        await supabase.auth.signOut();
        setStatus("choose-provider");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession() as {
        data: { session: { access_token: string; user?: { email?: string } } | null };
      };

      if (!session?.access_token) {
        setStatus("choose-provider");
        return;
      }
      setEmail(session.user?.email || null);
      setStatus("success");
      // No auto-close. Founder feedback: when a tab auto-closes the
      // user can't visually verify which account they signed into.
      // The success copy below explicitly tells them to close the tab
      // themselves and surfaces a clear "Use a different account"
      // option in case the session belongs to the wrong account.
    })();
  }, [supabase]);

  // Mono surface eyebrow shows only on choose-provider — disambiguates
  // which surface the user is connecting to. Hidden on success / error
  // / loading because the explicit H1 + body there already carry context.
  const contextLabel = "Chrome";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      <div className="flex flex-col items-center" style={{ gap: 20, maxWidth: 480, width: "100%" }}>
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
            <div
              style={{
                width: 128,
                height: 2,
                borderRadius: 2,
                overflow: "hidden",
                background: "var(--border-dim)",
              }}
            >
              <div style={{ height: "100%", borderRadius: 2, background: "var(--text-primary)", animation: "loadbar 1.2s ease-in-out infinite" }} />
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>One moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <p
              className="text-center"
              style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.55, margin: 0 }}
            >
              {email ? (
                <>Signed in as <span className="font-mono">{email}</span>.</>
              ) : (
                <>Signed in.</>
              )}
            </p>
            <p
              className="text-center"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.55 }}
            >
              Close this tab and click the memory.wiki Clipper icon in your toolbar to start capturing.
            </p>
            <a
              href="?switch=1"
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "underline" }}
            >
              Use a different account
            </a>
          </>
        )}

        {status === "choose-provider" && (
          <>
            <AuthProviderStack redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/chrome`} />
            <p
              className="font-mono text-center"
              style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", marginTop: 4 }}
            >
              Same account works on web, iOS, Android, CLI, MCP, Desktop, VS Code.
            </p>
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
            <p
              className="text-center"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}
            >
              Please sign in to memory.wiki first, then try again from the Chrome popup.
            </p>
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
