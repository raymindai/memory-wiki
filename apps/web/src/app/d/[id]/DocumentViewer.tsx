"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ViewerFooter from "@/components/ViewerFooter";
import ViewerPromoStrip from "@/components/ViewerPromoStrip";
import RelatedInHubPanel from "@/components/RelatedInHubPanel";
import VisitorAskAI from "@/components/VisitorAskAI";
import ViewerHeader from "@/components/ViewerHeader";
import type { TiptapLiveEditorHandle } from "@/components/TiptapLiveEditor";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

// Render the body through the same TipTap pipeline the editor uses so
// the public viewer and the in-editor Live tab paint identically. The
// founder asked for "모든 문서 뷰어는 통일되어야함" — using the same
// component on both sides is the single-source-of-truth answer instead
// of two parallel renderers that need to be kept matched by hand.
const TiptapLiveEditor = dynamic(() => import("@/components/TiptapLiveEditor"), {
  ssr: false,
  loading: () => null,
});

type Theme = "dark" | "light";

export default function DocumentViewer({
  id,
  markdown: initialMarkdown,
  title: initialTitle,
  isExpired = false,
  isRestricted = false,
  showBadge = true,
  editMode = "token",
}: {
  id: string;
  markdown: string;
  title: string | null;
  /** Deprecated — password feature removed. Accepted for source-compat
   *  with older callers but ignored. */
  isProtected?: boolean;
  isExpired?: boolean;
  isRestricted?: boolean;
  showBadge?: boolean;
  editMode?: string;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [title, setTitle] = useState(initialTitle);
  // TipTap mounts and paints synchronously once it has its markdown
  // prop, so we no longer need a separate "isLoading" gate around a
  // WASM render. Keep it as a small initial-paint shim only for
  // restricted/expired branches that still flash a spinner.
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [copiedMd, setCopiedMd] = useState(false);
  // The viewer used to gate rendering behind a password OR a
  // restricted-email check. Password access mode was removed
  // (commits 5a056bc5 / 41a61ce5); the only remaining gate is
  // isRestricted (allowed_emails), where the auth check below
  // calls setUnlocked(true) once the caller's session matches.
  const [unlocked, setUnlocked] = useState(!isRestricted);
  // Defer the access gate UNTIL client-side auth check finishes — otherwise
  // owners see "You need access" flash for ~500ms before the redirect to /
  const [authChecked, setAuthChecked] = useState(!isRestricted);
  const [copied, setCopied] = useState(false);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [updateToast, setUpdateToast] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const tiptapRef = useRef<TiptapLiveEditorHandle>(null);
  const markdownRef = useRef(initialMarkdown);
  markdownRef.current = markdown;

  // Check ownership: if logged-in user owns this doc, redirect to editor
  // Also handles restricted docs: try client-side fetch with user credentials
  useEffect(() => {
    (async () => {
      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        const supabase = getSupabaseBrowserClient();
        let { data: { user } } = await supabase.auth.getUser();
        // Stale session: getUser() returned null but a refresh token may
        // still be valid. Attempt one silent refresh before giving up —
        // otherwise the user sees the "You need access" gate on their own
        // doc and has to manually click Sign in to recover.
        if (!user) {
          try {
            const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
            if (!refreshErr && refreshed?.user) {
              user = refreshed.user;
            }
          } catch { /* refresh failed — treat as logged out */ }
        }
        if (!user) return;

        const res = await fetch(`/api/docs/${id}`, {
          headers: { "x-user-id": user.id, "x-user-email": user.email || "" },
        });
        if (!res.ok) return;

        const doc = await res.json();

        // Owner → open in editor instead of viewer (don't flip authChecked,
        // we're navigating away)
        if (doc.isOwner) {
          window.location.replace(`/?from=${id}`);
          return;
        }

        // Not owner but has access to restricted doc → show content
        if (isRestricted && !unlocked && doc.markdown) {
          setMarkdown(doc.markdown);
          if (doc.title) setTitle(doc.title);
          setUnlocked(true);
          setIsLoading(true);
        }
      } catch { /* no session or not authorized */ }
      finally { setAuthChecked(true); }
    })();
  }, [id, isRestricted, unlocked]);


  // Theme
  useEffect(() => {
    const saved = localStorage.getItem("mdfy-theme") as Theme | null;
    const initial = saved || "dark";
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
    // Restore accent and scheme
    const accent = localStorage.getItem("mdfy-accent");
    if (accent && accent !== "orange") {
      document.documentElement.setAttribute("data-accent", accent);
    }
    const scheme = localStorage.getItem("mdfy-scheme");
    if (scheme && scheme !== "default") {
      document.documentElement.setAttribute("data-scheme", scheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("mdfy-theme", next);
  }, [theme]);

  // Copy link
  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // handleUnlock removed — password access mode no longer exists.

  // Render path is the same TipTap pipeline the editor uses — see the
  // <TiptapLiveEditor> mount in the JSX below. The WASM/comrak render
  // + ad-hoc Mermaid + KaTeX post-processing that used to live here is
  // gone; TipTap's CodeBlock NodeView renders Mermaid blocks and its
  // own Math node handles KaTeX, so the viewer now matches the
  // editor's Live tab DOM-for-DOM.
  //
  // The imperative TipTap handle lets realtime / authchecked updates
  // push fresh markdown into ProseMirror without remounting the
  // component (which would lose scroll position and the click-to-copy
  // affordances on code blocks).

  // Push markdown into TipTap whenever it changes (realtime + the
  // restricted-doc auth-check path both call setMarkdown).
  useEffect(() => {
    if (!unlocked) return;
    tiptapRef.current?.setMarkdown(markdown || "");
  }, [markdown, unlocked]);

  // Supabase Realtime: subscribe to document changes
  useEffect(() => {
    if (!unlocked || isExpired) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return; // fallback polling handles it below

    const channel = supabase
      .channel(`doc-${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${id}` },
        async () => {
          // Document was updated — fetch fresh content and check permissions
          // Use x-no-view-count to prevent view_count increment → Realtime loop
          try {
            const res = await fetch(`/api/docs/${id}`, {
              headers: { "x-no-view-count": "1" },
            });
            if (res.status === 403 || res.status === 404) {
              // Access revoked or document made private/draft
              setAccessRevoked(true);
              return;
            }
            if (res.ok) {
              const doc = await res.json();
              // Check if document was made draft (no longer available)
              if (doc.is_draft) {
                setAccessRevoked(true);
                return;
              }
              if (doc.markdown !== markdownRef.current) {
                setMarkdown(doc.markdown);
                if (doc.title) setTitle(doc.title);
                setUpdateToast(true);
                setTimeout(() => setUpdateToast(false), 3000);
              }
            }
          } catch { /* offline */ }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, unlocked, isExpired]);

  // Fallback polling if Supabase Realtime is not available
  const lastUpdatedRef = useRef<string>("");
  useEffect(() => {
    if (!unlocked || isExpired) return;
    const supabase = getSupabaseBrowserClient();
    if (supabase) return; // Realtime handles it

    const poll = async () => {
      try {
        const res = await fetch(`/api/docs/${id}`, { method: "HEAD" });
        const updatedAt = res.headers.get("x-updated-at") || "";
        if (lastUpdatedRef.current && updatedAt && updatedAt !== lastUpdatedRef.current) {
          const full = await fetch(`/api/docs/${id}`);
          if (full.ok) {
            const doc = await full.json();
            if (doc.markdown !== markdownRef.current) {
              setMarkdown(doc.markdown);
              if (doc.title) setTitle(doc.title);
              setUpdateToast(true);
              setTimeout(() => setUpdateToast(false), 3000);
            }
          }
        }
        lastUpdatedRef.current = updatedAt;
      } catch { /* offline, ignore */ }
    };
    poll();
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, [id, unlocked, isExpired]);

  // Compact pill style every action button shares.
  const actionBtn = "h-7 px-2.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors";

  // Copy markdown — paste-into-AI flow. Strips no formatting; the
  // markdown body itself is what every LLM already knows how to read.
  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdownRef.current || "");
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch { /* clipboard denied */ }
  }, []);

  return (
    // min-h-screen (not h-screen): the viewer used to be a fixed-height
    // app shell with the body internally scrolling, which worked when the
    // only sibling below body was the footer. After F2′ added the related-
    // in-hub panel and the promo strip, header + related + promo + footer
    // started exceeding the viewport on standard laptop heights, which
    // squashed the body's flex-1 child to height 0 (overflow-auto then
    // clipped the entire article). Switch the outer container to grow
    // beyond the viewport so the page scrolls naturally and the article
    // takes its real content height instead of being clipped to 0.
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <ViewerHeader
        title={title || "Untitled"}
        breadcrumb={<>mdfy.app/<span style={{ color: "var(--accent)" }}>{id}</span></>}
        actions={
          <>
            <button
              onClick={copyLink}
              className={actionBtn}
              style={{ background: "var(--toggle-bg)", color: copied ? "#4ade80" : "var(--text-muted)" }}
              title="Copy link"
              aria-label="Copy link"
            >
              {copied ? (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 8 7 11 12 5"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1"/><path d="M9 7.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1"/></svg>
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Link"}</span>
            </button>
            <button
              onClick={copyMarkdown}
              className={actionBtn}
              style={{ background: "var(--toggle-bg)", color: copiedMd ? "#4ade80" : "var(--text-muted)" }}
              title="Copy markdown — paste into any AI as context"
              aria-label="Copy markdown"
            >
              {copiedMd ? (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 8 7 11 12 5"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h10v10H3z"/><path d="M5 6h6M5 9h6M5 12h3"/></svg>
              )}
              <span className="hidden sm:inline">{copiedMd ? "Copied" : "MD"}</span>
            </button>
            <button
              onClick={toggleTheme}
              className={actionBtn}
              style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                {theme === "dark"
                  ? <><circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 3.4l1-1"/></>
                  : <path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z"/>
                }
              </svg>
            </button>
          </>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto" ref={previewRef}>
        {accessRevoked ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/>
            </svg>
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>This document is no longer available</p>
            <p className="text-sm text-center" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              The owner has changed the permissions or made this document private.
            </p>
            <Link
              href="/"
              className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Create your own
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l5 5-5 5"/></svg>
            </Link>
          </div>
        ) : isRestricted && !unlocked && !authChecked ? (
          // Auth check still in flight — show neutral loading state instead of
          // flashing the "You need access" gate to owners about to be redirected.
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/>
            </svg>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading...
            </span>
          </div>
        ) : isRestricted && !unlocked ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6" style={{ maxWidth: 440, margin: "0 auto" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/>
            </svg>
            <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>You need access</p>
            <p className="text-sm text-center" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              This document is shared with specific people.
              Sign in with an authorized email, or ask the owner for access.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={async () => {
                  try {
                    const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
                    const supabase = getSupabaseBrowserClient();
                    await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: window.location.href },
                    });
                  } catch { window.location.href = "/"; }
                }}
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                Sign in with Google
              </button>
              <button
                onClick={async () => {
                  // Request access from owner
                  try {
                    await fetch("/api/notifications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        recipientEmail: "__owner__",
                        type: "access_request",
                        documentId: id,
                        message: "requested access to this document",
                      }),
                    });
                    const btn = document.activeElement as HTMLButtonElement;
                    if (btn) { btn.textContent = "Request sent"; btn.style.color = "#4ade80"; }
                  } catch { /* ignore */ }
                }}
                className="px-5 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Request access
              </button>
            </div>
            <Link href="/" className="mt-2 text-xs underline" style={{ color: "var(--text-muted)" }}>
              Or create your own document →
            </Link>
          </div>
        ) : isExpired ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <p className="text-lg" style={{ color: "var(--text-muted)" }}>This document has expired</p>
            <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
              But you can publish your own beautiful document in seconds.
            </p>
            <Link
              href="/"
              className="mt-2 px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              Create your own
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l5 5-5 5"/></svg>
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/>
            </svg>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading...
            </span>
          </div>
        ) : markdown ? (
          // Single source of truth for rendered markdown across mdfy:
          // the editor's Live tab and this public viewer both mount
          // TiptapLiveEditor — same node handlers, same Mermaid +
          // KaTeX NodeViews, same paragraph/list/table HTML. canEdit
          // is false so SelectionToolbar / TableMenu don't render and
          // the doc reads as a static page even though it's a real
          // ProseMirror surface underneath.
          <TiptapLiveEditor
            ref={tiptapRef}
            markdown={markdown}
            onChange={() => { /* read-only */ }}
            canEdit={false}
            narrowView={true}
            onPasteImage={async () => null}
            onDoubleClickCode={() => { /* read-only */ }}
          />
        ) : (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-muted)" }}
          >
            Empty document
          </div>
        )}
      </div>

      {/* Visitor "Ask AI about this doc" — inline, between the doc
          body and the Related-in-hub panel. Hidden on restricted /
          expired / revoked states (no doc body to ask about) and
          when the markdown is empty. Same /api/ai endpoint as the
          editor, restricted to read-only chat. */}
      {unlocked && !isExpired && !accessRevoked && markdown.trim().length > 0 && (
        <VisitorAskAI markdown={markdown} docTitle={title} docId={id} />
      )}

      {/* Related-in-hub panel (F2′ in MEMORI-WIKI-GAP rev 2).
          AI-era replacement for hand-typed backlinks — surfaces other
          docs in the same public hub that share concepts with this
          one. The component self-gates: it shows nothing when the
          endpoint returns 403 (doc not in a public hub) or no
          results. Owners on /d/<id> won't typically see this (they
          get redirected to the editor on auth check), so the public
          mode is the right default here. */}
      {unlocked && !isExpired && !accessRevoked && (
        <RelatedInHubPanel docId={id} mode="public" />
      )}

      {/* Viewer-wide promote strip — only when the visitor isn't the
          owner. Owners about to be redirected via the auth-check effect
          briefly land here too; the same effect sets authChecked true
          but doesn't flip a separate isOwner flag, so we hide the strip
          for password / restricted / expired states (those audiences
          aren't candidates for the funnel right now). */}
      {showBadge && unlocked && !isExpired && !accessRevoked && (
        <ViewerPromoStrip />
      )}

      {/* Footer — single shared chrome across /d, /b, /hub. Stats slot
          carries the lightweight word/char count; engine badges, VS
          Code / Chrome / Privacy links are gone — the footer's job is
          minimal nav + the Make-your-own CTA, nothing more. */}
      <ViewerFooter
        stats={
          <>
            <span className="hidden sm:inline">{markdown.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
            <span>{markdown.length.toLocaleString()} chars</span>
          </>
        }
      />

      {/* Update toast */}
      {updateToast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-body font-medium animate-[fade-in-up_0.2s_ease]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            color: "var(--text-primary)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2L6 10l-4-4"/>
          </svg>
          Document updated
        </div>
      )}
    </div>
  );
}
