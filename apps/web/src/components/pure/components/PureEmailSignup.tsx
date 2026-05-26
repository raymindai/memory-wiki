"use client";

import { useState } from "react";
import "../styles/components/pure-email-signup.css";

/**
 * PureEmailSignup — single-field waitlist form. Posts to
 * /api/waitlist with the current locale. Shows an inline success
 * state on submit — no toast, no modal, no double opt-in.
 */
export function PureEmailSignup({
  locale = "en",
  source = "about",
  placeholder,
  button,
  buttonSending,
  successMsg,
  errorMsg,
  privacyNote,
}: {
  locale?: "en" | "ko";
  source?: string;
  placeholder: string;
  button: string;
  buttonSending: string;
  successMsg: string;
  errorMsg: string;
  privacyNote: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending" || state === "ok") return;
    if (!email.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale, source }),
      });
      setState(res.ok ? "ok" : "err");
    } catch {
      setState("err");
    }
  }

  if (state === "ok") {
    return (
      <div className="pure-email-success">
        <div className="pure-email-success-mark mono">✓</div>
        <div className="pure-email-success-msg">{successMsg}</div>
      </div>
    );
  }

  return (
    <form className="pure-email-signup" onSubmit={submit}>
      <div className="pure-email-row">
        <input
          type="email"
          required
          autoComplete="email"
          className="pure-email-input"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === "sending"}
        />
        <button
          type="submit"
          className="pure-email-submit"
          disabled={state === "sending" || !email.trim()}
        >
          {state === "sending" ? buttonSending : button}
        </button>
      </div>
      <div className="pure-email-foot mono">
        {state === "err" ? errorMsg : privacyNote}
      </div>
    </form>
  );
}
