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
import AuthProviderStack from "@/components/AuthProviderStack";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function CliAuthPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "choose-provider">("loading");
  const [accessToken, setAccessToken] = useState<string>("");
  const [copied, setCopied] = useState(false);
  // OAuth round-trip lands back on the same page (works for both
  // /auth/cli and /auth/mcp since mcp re-exports this component).
  const [redirectTo, setRedirectTo] = useState<string>("");
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectTo(`${window.location.origin}${window.location.pathname}`);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (!supabase) {
        setStatus("error");
        return;
      }

      // ?switch=1 lets the user drop the cached browser session and
      // land in the provider picker for a different account.
      const params = new URLSearchParams(window.location.search);
      if (params.get("switch") === "1") {
        await supabase.auth.signOut();
        setStatus("choose-provider");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession() as { data: { session: { access_token: string; refresh_token?: string } | null } };

      if (!session?.access_token) {
        setStatus("choose-provider");
        return;
      }

      // We surface the raw access_token on this page so CLI users +
      // MCP users can paste it into `memory.wiki login`. The legacy Electron
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
  // Eyebrow stays short + factual; the H1 below carries the status. Don't
  // duplicate the same line twice stacked.
  const contextLabel =
    status === "error" ? "Couldn't connect"
    : "CLI / MCP";

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
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
                memory.wiki login
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
              <a
                href="?switch=1"
                className="text-center transition-opacity hover:opacity-80"
                style={{ color: "var(--text-muted)", fontSize: 12, textDecoration: "underline" }}
              >
                Wrong account? Use a different one
              </a>
            </div>
          </>
        )}

        {status === "choose-provider" && (
          <AuthProviderStack redirectTo={redirectTo} />
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
