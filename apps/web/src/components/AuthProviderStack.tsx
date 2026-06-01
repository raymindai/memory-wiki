"use client";

/*
 * AuthProviderStack — shared 4-provider sign-in surface used by every
 * /auth/<channel> handoff page (vscode, cli/mcp, desktop).
 *
 * Brand voice wiki section 12.3 requires the canonical provider
 * order Google, GitHub, Email, Apple and the rule "Apple required to
 * be present whenever any other SSO is offered." Founder report
 * (screenshot of /auth/vscode 2026-06-01): only GitHub + Google were
 * showing — this component closes that gap on every channel by
 * shipping all four in one tested module so the pages stay in sync.
 *
 * Each page passes its own `redirectTo` because the channel handoff
 * needs the browser to come back to the channel's own page (e.g.
 * /auth/vscode), not the main /auth/callback that useAuth's stock
 * helpers hard-code.
 */

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface Props {
  /** Absolute URL the OAuth round-trip + magic-link should come back to. */
  redirectTo: string;
}

export default function AuthProviderStack({ redirectTo }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const signInWith = async (provider: "google" | "github" | "apple") => {
    if (!supabase) return;
    // Force the provider's account chooser every time. Without this,
    // Google + Apple silently re-auth as the last-used account whenever
    // the user is still signed in to the provider, so people on multi-
    // account browsers couldn't switch identities. GitHub doesn't honor
    // `prompt`; users on github.com still need to sign out of GitHub
    // itself to pick a different GitHub identity.
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
  };

  const sendMagicLink = async () => {
    if (!supabase) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setEmailStatus("error");
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailStatus("sending");
    setEmailError(null);

    // Demo-account fast path — mirrors useAuth.ts L343. The same three
    // allowlisted emails bypass the magic-link round-trip and sign in
    // immediately via /api/auth/demo-signin. Without this branch, the
    // /auth/<channel> pages reject `demo@memory.wiki` outright because
    // Supabase's email validator doesn't accept the `.wiki` TLD.
    if (
      normalized === "yc@mdfy.app"
      || normalized === "demo@mdfy.app"
      || normalized === "demo@memory.wiki"
    ) {
      try {
        const res = await fetch("/api/auth/demo-signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalized }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setEmailStatus("error");
          setEmailError(err.error || `Demo sign-in failed (${res.status})`);
          return;
        }
        const data = await res.json();
        if (!data.access_token || !data.refresh_token) {
          setEmailStatus("error");
          setEmailError("Demo sign-in returned no session");
          return;
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (setErr) {
          setEmailStatus("error");
          setEmailError(setErr.message);
          return;
        }
        // Session is set in the browser. The channel handoff page's
        // own useEffect (in /auth/desktop, /auth/vscode, etc.) reads
        // supabase.auth.getSession() and forwards token + refresh
        // to the app — so just navigate back to redirectTo and let
        // that effect fire again with the fresh session.
        window.location.href = redirectTo;
        return;
      } catch (err) {
        setEmailStatus("error");
        setEmailError(err instanceof Error ? err.message : "Demo sign-in error");
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setEmailStatus("error");
      setEmailError(error.message);
      return;
    }
    setEmailStatus("sent");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
      <ProviderButton
        onClick={() => signInWith("google")}
        label="Continue with Google"
        icon={<GoogleIcon />}
        variant="solid"
      />
      <ProviderButton
        onClick={() => signInWith("github")}
        label="Continue with GitHub"
        icon={<GitHubIcon />}
        variant="outline"
      />

      {emailOpen ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 12px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={emailStatus === "sending" || emailStatus === "sent"}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMagicLink();
            }}
          />
          {emailStatus === "sent" ? (
            <p
              className="font-mono"
              style={{ color: "var(--micro-info)", fontSize: 11, letterSpacing: "0.04em", margin: 0 }}
            >
              Check your inbox for the sign-in link.
            </p>
          ) : (
            <>
              <button
                onClick={sendMagicLink}
                disabled={emailStatus === "sending"}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "var(--text-primary)",
                  color: "var(--background)",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: emailStatus === "sending" ? "default" : "pointer",
                  opacity: emailStatus === "sending" ? 0.7 : 1,
                }}
              >
                {emailStatus === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
              {emailError && (
                <p
                  className="font-mono"
                  style={{ color: "var(--micro-red)", fontSize: 11, letterSpacing: "0.04em", margin: 0 }}
                >
                  {emailError}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <ProviderButton
          onClick={() => setEmailOpen(true)}
          label="Continue with Email"
          icon={<MailIcon />}
          variant="outline"
        />
      )}

      <ProviderButton
        onClick={() => signInWith("apple")}
        label="Continue with Apple"
        icon={<AppleIcon />}
        variant="outline"
      />
    </div>
  );
}

function ProviderButton({
  onClick,
  label,
  icon,
  variant,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  variant: "solid" | "outline";
}) {
  const solid = variant === "solid";
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center transition-opacity hover:opacity-90"
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: solid ? "var(--text-primary)" : "transparent",
        color: solid ? "var(--background)" : "var(--text-primary)",
        border: solid ? "none" : "1px solid var(--border)",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        gap: 10,
        width: "100%",
        justifyContent: "center",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <path d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.3a3.68 3.68 0 01-1.6 2.41v2h2.59A7.84 7.84 0 0015.68 8.18z" fill="#4285F4"/>
      <path d="M8 16c2.16 0 3.97-.72 5.29-1.94l-2.59-2a4.98 4.98 0 01-7.41-2.63H.68v2.06A8 8 0 008 16z" fill="#34A853"/>
      <path d="M3.29 9.43a4.82 4.82 0 010-2.86V4.51H.68a8 8 0 000 6.98l2.61-2.06z" fill="#FBBC05"/>
      <path d="M8 3.16c1.22 0 2.31.42 3.17 1.24l2.38-2.38A7.96 7.96 0 008 0 8 8 0 00.68 4.51l2.61 2.06A4.77 4.77 0 018 3.16z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5"/>
      <path d="M2 4l6 5 6-5"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M11.182 8.453a3.41 3.41 0 011.62-2.86 3.5 3.5 0 00-2.756-1.49c-1.16-.12-2.286.69-2.876.69-.6 0-1.516-.676-2.495-.656a3.67 3.67 0 00-3.09 1.886c-1.32 2.28-.336 5.65.949 7.5.628.906 1.366 1.92 2.336 1.884.937-.04 1.293-.604 2.428-.604 1.13 0 1.45.604 2.444.585 1.01-.017 1.65-.92 2.27-1.83a8.13 8.13 0 001.038-2.118 3.3 3.3 0 01-2.068-3.027zM9.36 2.86A3.36 3.36 0 0010.149 0a3.42 3.42 0 00-2.246 1.16 3.2 3.2 0 00-.81 2.78 2.83 2.83 0 002.267-1.08z"/>
    </svg>
  );
}
