"use client";

/**
 * HubHeaderActions — the [Link][For AI] pair shown in the hub's
 * ViewerHeader actions slot. Same compact pill style as the /d and
 * /b viewers so the three top-level surfaces match.
 *
 * Hub's page.tsx is a server component so the clipboard handlers
 * have to live in a client island; this is that island.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";

const ACTION_BTN = "h-7 px-2.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors";

export default function HubHeaderActions({ hubUrl }: { hubUrl: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(hubUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch { /* clipboard denied */ }
  };

  const copyAiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(`Use ${hubUrl} as my context.`);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    } catch { /* clipboard denied */ }
  };

  return (
    <>
      <button
        onClick={copyLink}
        className={ACTION_BTN}
        style={{
          background: copiedLink ? "rgba(181,255,26,0.12)" : "var(--toggle-bg)",
          color: copiedLink ? "var(--micro-lime)" : "var(--text-muted)",
        }}
        title="Copy link"
        aria-label="Copy link"
      >
        {copiedLink ? (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 8 7 11 12 5"/></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1"/><path d="M9 7.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1"/></svg>
        )}
        <span className="hidden sm:inline">{copiedLink ? "Copied" : "Link"}</span>
      </button>
      <button
        onClick={copyAiPrompt}
        className={ACTION_BTN}
        style={{
          background: copiedAi ? "rgba(181,255,26,0.12)" : "var(--toggle-bg)",
          color: copiedAi ? "var(--micro-lime)" : "var(--text-muted)",
        }}
        title="Copy as a paste-ready AI prompt — drop into Claude / ChatGPT / Cursor"
        aria-label="Copy as AI prompt"
      >
        {copiedAi ? (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 8 7 11 12 5"/></svg>
        ) : (
          <Sparkles width={11} height={11} strokeWidth={1.6} />
        )}
        <span className="hidden sm:inline">{copiedAi ? "Copied" : "For AI"}</span>
      </button>
    </>
  );
}
