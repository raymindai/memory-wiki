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
import AuthProviderStack from "@/components/AuthProviderStack";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function VSCodeAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const supabase = getSupabaseBrowserClient();

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
            <AuthProviderStack redirectTo={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/vscode`} />
            <p
              className="font-mono text-center"
              style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", marginTop: 4 }}
            >
              Same account works on web, iOS, Android, CLI, MCP, Desktop, Chrome.
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
