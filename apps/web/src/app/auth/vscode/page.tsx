"use client";

// /auth/vscode — VS Code Marketplace extension auth handoff. Bounces
// the user's Supabase session into the `vscode://` URI scheme so the
// extension's auth handler can pick up token + refresh_token. Tries
// the Insiders variant via a hidden iframe so users on either build
// land successfully.
//
// Pure-design surface: canvas bg, Cal Sans 22px title, mono context
// eyebrow, ink-filled pill primary action. Same shape as
// /auth/cli + /auth/desktop so the three handoff pages read as one
// family.

import { useEffect, useState } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function VSCodeAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const supabase = getSupabaseBrowserClient();

  const signInWith = async (provider: "github" | "google") => {
    if (!supabase) return;
    const redirectUrl = `${window.location.origin}/auth/vscode`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl },
    });
  };

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      // Get current session (any provider)
      const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string } | null } };

      if (!session?.access_token) {
        // Not logged in — show provider choice
        setStatus("choose-provider");
        return;
      }

      // We have a token — redirect to VS Code URI handler
      const token = session.access_token;
      const refreshToken = (session as { refresh_token?: string }).refresh_token;
      let vscodeUri = `vscode://raymindai.memory-wiki-vscode/auth?token=${encodeURIComponent(token)}`;
      if (refreshToken) {
        vscodeUri += `&refresh_token=${encodeURIComponent(refreshToken)}`;
      }

      // Try to open VS Code
      window.location.href = vscodeUri;
      setStatus("success");

      // Also try the insiders variant after a delay
      setTimeout(() => {
        let insidersUri = `vscode-insiders://raymindai.memory-wiki-vscode/auth?token=${encodeURIComponent(token)}`;
        if (refreshToken) {
          insidersUri += `&refresh_token=${encodeURIComponent(refreshToken)}`;
        }
        // Create hidden iframe to try insiders without navigating away
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = insidersUri;
        document.body.appendChild(iframe);
        setTimeout(() => iframe.remove(), 1000);
      }, 500);
    })();
  }, [supabase]);

  const contextLabel =
    status === "success" ? "Connected to VS Code"
    : status === "error" ? "Couldn't connect"
    : status === "choose-provider" ? "Sign in to continue"
    : "Connecting to VS Code";

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
              Connected to VS Code
            </h1>
            <p
              className="text-center leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}
            >
              Your Memory.Wiki account is now linked. You can close this tab and return to VS Code.
            </p>
            <p
              className="font-mono text-center"
              style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", marginTop: 0 }}
            >
              Didn&apos;t work? Make sure the Memory.Wiki extension is installed in VS Code.
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
              Sign in to connect VS Code
            </h1>
            <p
              className="text-center"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 400 }}
            >
              Use the same account you use on Memory.Wiki.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => signInWith("github")}
                className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  background: "var(--text-primary)",
                  color: "var(--background)",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                Continue with GitHub
              </button>
              <button
                onClick={() => signInWith("google")}
                className="inline-flex items-center gap-2 transition-colors hover:bg-[var(--toggle-bg)]"
                style={{
                  padding: "10px 18px",
                  borderRadius: 8,
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.41v2h2.59A7.84 7.84 0 0015.68 8.18z" fill="#4285F4"/><path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.59-2a4.98 4.98 0 01-7.41-2.63H.68v2.06A8 8 0 008 16z" fill="#34A853"/><path d="M3.29 9.43a4.82 4.82 0 010-2.86V4.51H.68a8 8 0 000 6.98l2.61-2.06z" fill="#FBBC05"/><path d="M8 3.16c1.22 0 2.31.42 3.17 1.24l2.38-2.38A7.96 7.96 0 008 0 8 8 0 00.68 4.51l2.61 2.06A4.77 4.77 0 018 3.16z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </div>
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
              Please sign in to Memory.Wiki first, then try again from VS Code.
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
              Go to Memory.Wiki
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
