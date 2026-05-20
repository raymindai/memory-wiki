"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MdfyLogo from "@/components/MdfyLogo";
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
      let vscodeUri = `vscode://raymindai.mdfy-vscode/auth?token=${encodeURIComponent(token)}`;
      if (refreshToken) {
        vscodeUri += `&refresh_token=${encodeURIComponent(refreshToken)}`;
      }

      // Try to open VS Code
      window.location.href = vscodeUri;
      setStatus("success");

      // Also try the insiders variant after a delay
      setTimeout(() => {
        let insidersUri = `vscode-insiders://raymindai.mdfy-vscode/auth?token=${encodeURIComponent(token)}`;
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

  return (
    <div
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <MdfyLogo size={32} />

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
            <div style={{ height: "100%", borderRadius: 2, background: "var(--accent)", animation: "loadbar 1.2s ease-in-out infinite" }} />
          </div>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Connecting to VS Code...</p>
        </>
      )}

      {status === "success" && (
        <>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l3 3 5-5" />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Connected to VS Code</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 400 }}>
            Your memory.wiki account is now linked. You can close this tab and return to VS Code.
          </p>
          <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
            Didn&apos;t work? Make sure the memory.wiki extension is installed in VS Code.
          </p>
        </>
      )}

      {status === "choose-provider" && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Sign in to connect VS Code</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", maxWidth: 400 }}>
            Use the same account you use on memory.wiki
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={() => signInWith("github")}
              style={{ padding: "10px 24px", borderRadius: 8, background: "#24292e", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </button>
            <button
              onClick={() => signInWith("google")}
              style={{ padding: "10px 24px", borderRadius: 8, background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.41v2h2.59A7.84 7.84 0 0015.68 8.18z" fill="#4285F4"/><path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.59-2a4.98 4.98 0 01-7.41-2.63H.68v2.06A8 8 0 008 16z" fill="#34A853"/><path d="M3.29 9.43a4.82 4.82 0 010-2.86V4.51H.68a8 8 0 000 6.98l2.61-2.06z" fill="#FBBC05"/><path d="M8 3.16c1.22 0 2.31.42 3.17 1.24l2.38-2.38A7.96 7.96 0 008 0 8 8 0 00.68 4.51l2.61 2.06A4.77 4.77 0 018 3.16z" fill="#EA4335"/></svg>
              Google
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#ef4444" }}>Connection Failed</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Please sign in to memory.wiki first, then try again from VS Code.
          </p>
          <Link
            href="/"
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              background: "var(--accent-dim)",
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Go to memory.wiki
          </Link>
        </>
      )}
    </div>
  );
}
