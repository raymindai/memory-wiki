"use client";

// /auth/cli — token handoff page for the CLI + MCP servers.
//
// Pure-design surface: canvas bg, Cal Sans 22px title, mono context
// eyebrow, ink-filled pill primary action. Status icons use the
// semantic micro colors (lime success, red error) so the state
// reads at a glance without raw hex. All hooks + OAuth handoff
// behavior preserved.

import { useEffect, useState } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CliAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const [accessToken, setAccessToken] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const signInWith = async (provider: "github" | "google") => {
    if (!supabase) return;
    const redirectUrl = `${window.location.origin}/auth/desktop`;
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

      const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string; refresh_token?: string } | null } };

      if (!session?.access_token) {
        setStatus("choose-provider");
        return;
      }

      // We surface the raw access_token on this page so CLI users +
      // MCP users can paste it into `Memory.Wiki login`. The legacy Electron
      // desktop app's `memorywiki://` URL scheme handler used to grab the
      // token automatically via a forced redirect — but a) most users
      // don't run that app, b) the redirect would launch the
      // (deprecated, mdfy.cc-baked) desktop app on macOS for users
      // who do have it installed. So now we stop auto-firing the
      // deep link and let the user copy + paste explicitly.
      setAccessToken(session.access_token);
      setStatus("success");
    })();
  }, [supabase]);

  const copyToken = async () => {
    if (!accessToken) return;
    try {
      await navigator.clipboard.writeText(accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  };

  // Mono context eyebrow — small, uppercase-ish via letter-spacing,
  // text-muted. Tells the user which surface they're connecting to
  // without competing with the title.
  const contextLabel =
    status === "success" ? "Token ready"
    : status === "error" ? "Couldn't connect"
    : status === "choose-provider" ? "Sign in to continue"
    : "Connecting to Memory.Wiki";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      <div className="flex flex-col items-center" style={{ gap: 20, maxWidth: 560, width: "100%" }}>
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
              You&apos;re signed in
            </h1>
            <p
              className="text-center leading-relaxed"
              style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6, maxWidth: 440 }}
            >
              Copy the token below and paste it into your terminal where{" "}
              <code
                className="font-mono"
                style={{ background: "var(--surface)", padding: "1px 6px", borderRadius: 3, fontSize: 12, color: "var(--text-primary)" }}
              >
                Memory.Wiki login
              </code>{" "}
              is waiting. The same token authenticates the CLI and any MCP server (Claude Code, Cursor, Claude Desktop) you wire up.
            </p>
            <div style={{ width: "min(560px, 90vw)", display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <code
                className="font-mono"
                style={{
                  display: "block",
                  background: "var(--surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--text-primary)",
                  wordBreak: "break-all",
                  maxHeight: 120,
                  overflow: "auto",
                }}
              >
                {accessToken || "…"}
              </code>
              <button
                onClick={copyToken}
                disabled={!accessToken}
                className="inline-flex items-center justify-center transition-opacity hover:opacity-90"
                style={{
                  alignSelf: "stretch",
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: copied ? "var(--toggle-bg)" : "var(--text-primary)",
                  color: copied ? "var(--micro-lime)" : "var(--background)",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: accessToken ? "pointer" : "not-allowed",
                  opacity: accessToken ? 1 : 0.6,
                }}
              >
                {copied ? "Copied, paste in your terminal" : "Copy token"}
              </button>
              <p
                className="text-center font-mono"
                style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", lineHeight: 1.5, margin: 0 }}
              >
                Saved to ~/.memory.wiki/config.json. Treat it like a password.
              </p>
            </div>
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
