"use client";

import { useState, useCallback, useRef, useEffect, memo, type ReactNode } from "react";
import { setAllowedEmails as defaultSetAllowedEmails, changeEditMode as defaultChangeEditMode, copyToClipboard } from "@/lib/share";
import { showToast } from "@/components/Toast";
import { Globe, Users, Cloud, Link2, X, ChevronDown } from "lucide-react";
import { Button, ModalShell } from "@/components/ui";

interface ShareModalProps {
  docId: string;
  title?: string;
  userId: string;
  ownerEmail: string;
  ownerName?: string;
  currentEditMode: string;
  /** True when the doc is currently is_draft=true on the server.
   *  Drives the Private vs Shared/Public radio default and gates the
   *  "Only me" option's selected state. */
  isPrivate?: boolean;
  initialAllowedEmails: string[];
  initialAllowedEditors: string[];
  onClose: () => void;
  onEditModeChange: (mode: "owner" | "view" | "public") => void;
  onAllowedEmailsChange: (emails: string[]) => void;
  onAllowedEditorsChange?: (editors: string[]) => void;
  /** Called when user picks "Only me" — caller PATCHes unpublish and
   *  flips the local tab back to is_draft=true. */
  onMakePrivate?: () => void;
  /** Called when user picks "Specific people" or "Anyone with the link"
   *  while the doc is currently private — caller PATCHes publish to
   *  flip is_draft=false. */
  onPublish?: () => Promise<void>;
  // Optional overrides — used by bundle share to cascade access onto included docs
  // and to substitute the bundle URL for "Copy link". Defaults preserve doc behavior.
  setAllowedEmailsOverride?: (id: string, userId: string, emails: string[], editors: string[]) => Promise<{ allowedEmails: string[]; allowedEditors: string[] }>;
  changeEditModeOverride?: (id: string, userId: string, mode: "owner" | "view" | "public") => Promise<void>;
  shareUrlOverride?: string;
  // Banner rendered between "People with access" and "General access" — used by bundle
  // share to surface the cascade warning and per-doc list.
  banner?: ReactNode;
  // Banner rendered at the TOP of the modal body, above the tab strip.
  // Used by BundleShareModal for the v8 4-state visibility picker so
  // the user's primary intent control sits above everything else.
  topBanner?: ReactNode;
  // When true, hides the built-in 3-state "Who can read" radio inside
  // the People tab. Used by callers that own their own visibility
  // model (BundleShareModal renders the 4-state picker via topBanner
  // and the 3-state would be redundant + confusing).
  hideAccessPicker?: boolean;
  // Title for the dialog header. Defaults to `Share "<title>"`.
  headerTitle?: string;
  /** Owner-scoped edit token. When present, renders a small
   *  "Developer access" footer with a copy-to-clipboard affordance.
   *  Used for programmatic access (GitHub Actions, MCP, the public
   *  REST API). Treat it like a password — anyone with it can write
   *  to this document/bundle. */
  editToken?: string;
  /** Bundle-only AI-readiness flags. When present, the modal renders
   *  a readiness banner that tells the user whether the bundle URL
   *  is currently fetch-ready by external AIs (Claude / Cursor /
   *  ChatGPT). Both flags need to be true for "Ready"; either false
   *  shows a "Pending..." or "Action needed" state. Docs don't pass
   *  this prop — the readiness concept only applies to bundles. */
  aiReadiness?: {
    hasGraph: boolean;
    hasEmbedding: boolean;
    isAnalysisStale: boolean;
    memberCount: number;
  } | null;
  /** Triggered when the user clicks the readiness banner's CTA to
   *  kick off a manual graph + embed pass. The caller wires this to
   *  parallel POSTs against /api/bundles/<id>/graph and
   *  /api/embed/bundle/<id>. */
  onReanalyze?: () => void;
  /** When true, the modal body renders a thin skeleton instead of
   *  the live access controls. Callers flip this to true while they
   *  rehydrate the doc's authoritative permission state from the
   *  server — otherwise the modal opens with stale "Anyone with
   *  the link" defaults and flips to the real state ~2s later, which
   *  read as a bug. */
  loading?: boolean;
}

function ShareModal({
  docId,
  title,
  userId,
  ownerEmail,
  ownerName,
  currentEditMode,
  initialAllowedEmails,
  initialAllowedEditors,
  onClose,
  onEditModeChange,
  onAllowedEmailsChange,
  onAllowedEditorsChange,
  onMakePrivate,
  onPublish,
  isPrivate,
  setAllowedEmailsOverride,
  changeEditModeOverride,
  shareUrlOverride,
  banner,
  topBanner,
  hideAccessPicker = false,
  headerTitle,
  loading = false,
  editToken,
  aiReadiness,
  onReanalyze,
}: ShareModalProps) {
  const setAllowedEmailsFn = setAllowedEmailsOverride || defaultSetAllowedEmails;
  const changeEditModeFn = changeEditModeOverride || defaultChangeEditMode;
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>(initialAllowedEmails);
  const [editors, setEditors] = useState<string[]>(initialAllowedEditors);
  // Three real read-access states the user can pick — same vocabulary
  // as DocStatusIcon and the Hub's owner view. There's no "Draft"
  // anywhere; a saved doc just sits in the cloud as Private until the
  // owner promotes it.
  //
  //   "private"           is_draft=true. Only owner can read.
  //   "restricted-people" is_draft=false + allowed_emails non-empty.
  //                       Only those people + owner can read.
  //   "anyone"            is_draft=false + no pw + no emails. Anyone
  //                       with the URL can read; listed on /hub/<slug>.
  type Access = "private" | "restricted-people" | "anyone";
  const computeInitial = (): Access => {
    if (isPrivate) return "private";
    if (initialAllowedEmails.length > 0) return "restricted-people";
    return "anyone";
  };
  const [generalAccess, setGeneralAccess] = useState<Access>(computeInitial());
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  // Tabbed surface: People / AI / API. People is the most-common
  // entry point so it starts active. Status dot + one-line summary
  // on each tab means the AI / API state is never *hidden* — a
  // glance at the tab strip tells the user where the work is.
  type TabKey = "people" | "ai" | "api";
  const [activeTab, setActiveTab] = useState<TabKey>("people");
  // Re-analyze pending state — bridges the gap between the user
  // clicking the CTA and the parent re-fetching readiness 65s later.
  // Without it, the button reads as a dead click for the full minute.
  const [reanalyzePending, setReanalyzePending] = useState(false);
  // Reset pending the moment the parent re-fetches and the readiness
  // flips to fully ready. Otherwise the button stays "Running…" for
  // the full 90s timeout even when the work completed in 20s.
  useEffect(() => {
    if (!aiReadiness) return;
    const ready = aiReadiness.hasGraph && aiReadiness.hasEmbedding && !aiReadiness.isAnalysisStale;
    if (ready && reanalyzePending) setReanalyzePending(false);
  }, [aiReadiness, reanalyzePending]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-sync local state when the parent hydrates the share state
  // asynchronously. The modal is opened immediately on Share-click
  // (no spinner) so the parent's first render passes the prior /
  // empty values; the real allowed_emails / allowed_editors arrive a
  // moment later via a background fetch. Without this effect the
  // modal showed "Anyone with the link" for a doc that's actually
  // restricted to specific people — the radio was frozen at mount.
  useEffect(() => {
    setEmails(initialAllowedEmails);
  }, [initialAllowedEmails]);
  useEffect(() => {
    setEditors(initialAllowedEditors);
  }, [initialAllowedEditors]);
  useEffect(() => {
    if (isPrivate) {
      setGeneralAccess("private");
    } else if (initialAllowedEmails.length > 0) {
      setGeneralAccess("restricted-people");
    } else {
      setGeneralAccess("anyone");
    }
  }, [isPrivate, initialAllowedEmails]);

  const saveAccess = useCallback(async (newEmails: string[], newEditors: string[]) => {
    setSaving(true);
    try {
      const result = await setAllowedEmailsFn(docId, userId, newEmails, newEditors);
      setEmails(result.allowedEmails);
      setEditors(result.allowedEditors);
      onAllowedEmailsChange(result.allowedEmails);
      onAllowedEditorsChange?.(result.allowedEditors);
    } catch { showToast("Failed to update access", "error"); }
    setSaving(false);
  }, [docId, userId, onAllowedEmailsChange, onAllowedEditorsChange]);

  const addEmail = useCallback(async (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const newEmails = input
      .split(/[,;\s]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => emailRegex.test(e) && !emails.includes(e) && e !== ownerEmail.toLowerCase());
    if (newEmails.length === 0) {
      if (input.trim()) showToast("Invalid or duplicate email", "error");
      return;
    }
    const updated = [...new Set([...emails, ...newEmails])];
    setEmails(updated);
    setEmailInput("");
    await saveAccess(updated, editors);
    // Send notifications to new people
    for (const email of newEmails) {
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: email,
          documentId: docId,
          fromUserId: userId,
          fromUserName: ownerName || ownerEmail.split("@")[0],
          message: `shared "${title || "Untitled"}" with you`,
        }),
      }).then((res) => {
        if (res.ok) showToast(`Email sent to ${email}`, "success");
      }).catch(() => {});
    }
  }, [emails, editors, ownerEmail, saveAccess, docId, userId, title]);

  const removeEmail = useCallback(async (email: string) => {
    const updatedEmails = emails.filter(e => e !== email);
    const updatedEditors = editors.filter(e => e !== email);
    setEmails(updatedEmails);
    setEditors(updatedEditors);
    await saveAccess(updatedEmails, updatedEditors);
    // If all emails removed, restriction no longer holds — fall back
    // to "anyone with the link" since the doc is now read-public.
    if (updatedEmails.length === 0 && generalAccess === "restricted-people") {
      setGeneralAccess("anyone");
    }
  }, [emails, editors, saveAccess, generalAccess]);

  // Toggle whether an email is in the allowed_editors set. When
  // promoted to editor, the row stays in allowed_emails (read access
  // is implied by edit access). Demoting to viewer drops it from
  // editors but keeps it in emails so the person can still read.
  const toggleEditor = useCallback(async (email: string) => {
    const isEditor = editors.includes(email);
    const updatedEditors = isEditor ? editors.filter(e => e !== email) : [...editors, email];
    setEditors(updatedEditors);
    await saveAccess(emails, updatedEditors);
    showToast(isEditor ? `${email} can now only view` : `${email} can now edit`, "success");
  }, [editors, emails, saveAccess]);


  const handleAccessChange = useCallback(async (mode: Access) => {
    // "Restricted-people" only makes sense when emails exist.
    if (mode === "restricted-people" && emails.length === 0) {
      showToast("Add at least one email above first.", "info");
      return;
    }
    // "Only me" — just delegate to onMakePrivate. The caller PATCHes
    // unpublish + flips local state.
    if (mode === "private") {
      setGeneralAccess("private");
      if (onMakePrivate) onMakePrivate();
      return;
    }
    // Switching to "Anyone with the link" while there are people in
    // the access list USED to silently wipe allowed_emails +
    // allowed_editors so the doc became read-public. Founder hit
    // this — toggling between modes deleted the people they had
    // explicitly invited, with no undo. Confirm before destroying
    // that list.
    if (mode === "anyone" && emails.length > 0) {
      const confirmed = typeof window !== "undefined"
        ? window.confirm(
            `Switching to "Anyone with the link" will remove ${emails.length} ` +
            `person${emails.length === 1 ? "" : "s"} from the access list. ` +
            `Continue?`,
          )
        : true;
      if (!confirmed) return;
    }
    setGeneralAccess(mode);
    // Promoting from Private → Shared/Public requires publish (flips
    // is_draft=false on the server).
    if (isPrivate && onPublish) {
      try { await onPublish(); } catch { /* showToast handled in caller */ }
    }
    if (mode === "anyone" && emails.length > 0) {
      // Drop the email allow-list so reads truly go public — only
      // reached after the explicit confirm above.
      setEmails([]);
      setEditors([]);
      await saveAccess([], []);
    }
    try {
      // edit_mode is still flipped for backwards compat with vscode/desktop
      // clients that branch on it. "anyone" → "view"; "restricted" → "owner".
      const editMode = mode === "anyone" ? "view" : "owner";
      await changeEditModeFn(docId, userId, editMode);
      onEditModeChange(editMode);
      showToast(mode === "restricted-people" ? "Restricted to people above" : "Anyone with the link can read", "success");
    } catch { showToast("Failed to change access", "error"); }
  }, [docId, userId, onEditModeChange, emails, editors, isPrivate, onMakePrivate, onPublish, changeEditModeFn, saveAccess]);

  const handleCopyLink = useCallback(async () => {
    const url = shareUrlOverride || `${window.location.origin}/${docId}`;
    await copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [docId, shareUrlOverride]);

  const dialogTitle = headerTitle || `Share${title ? ` "${title.length > 30 ? title.slice(0, 30) + "..." : title}"` : ""}`;

  return (
    <ModalShell
      open
      onClose={onClose}
      size="md"
      title={dialogTitle}
      headerExtras={saving ? (
        <span className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>Saving…</span>
      ) : null}
      footer={
        <div className="flex items-center w-full" style={{ gap: "var(--space-2)" }}>
          {/* Standalone "Make Private" button removed — the same
              action lives at the top of the modal as the "Only me"
              radio. One source of truth for access state. */}
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Link2 width={14} height={14} />}
            onClick={handleCopyLink}
            style={copied ? { color: "var(--color-success)" } : undefined}
          >
            {copied ? "Link copied!" : "Copy link"}
          </Button>
          <span style={{ flex: 1 }} />
          <Button variant="primary" size="md" onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div>
        {/* Top banner — modal-wide context that sits above the tab
            strip. Used by BundleShareModal for the 4-state visibility
            picker (the user's primary intent control). Rendered only
            after loading so it doesn't pop in above a skeleton. */}
        {!loading && topBanner && (
          <div className="mb-4">{topBanner}</div>
        )}
        {/* Loading skeleton sits ABOVE everything so the tab bar
            doesn't flash with stale values before the parent
            rehydrates. */}
        {loading && (
          <div className="py-2" aria-busy="true">
            <div className="text-caption mb-3" style={{ color: "var(--text-faint)" }}>Loading share settings…</div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="mb-2 rounded-lg"
                style={{
                  height: i === 0 ? 40 : 32,
                  background: "linear-gradient(90deg, var(--surface) 0%, var(--toggle-bg) 50%, var(--surface) 100%)",
                  backgroundSize: "200% 100%",
                  animation: "mw-skeleton 1.4s ease-in-out infinite",
                  opacity: 0.7,
                }}
              />
            ))}
            <style>{`@keyframes mw-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          </div>
        )}

        {/* Tab bar — three tabs, each with a status dot + one-line
            summary. The tabs are the disclosure surface; clicking a
            tab swaps the content below. The status row means the
            "AI" + "API" state is always glanceable even when the
            user is on the People tab. */}
        {!loading && (() => {
          // --- People status ---
          const peopleDot =
            generalAccess === "private" ? "#a1a1aa" :
            generalAccess === "restricted-people" ? (emails.length > 0 ? "#4ade80" : "#fb923c") :
            "#4ade80";
          const peopleSub =
            generalAccess === "private" ? "Only you" :
            generalAccess === "restricted-people"
              ? `Specific people (${emails.length})`
              : "Anyone with link";

          // --- AI status (bundles only have aiReadiness; docs skip) ---
          let aiDot: string;
          let aiSub: string;
          let aiVisible: boolean;
          if (aiReadiness) {
            const graphReady = aiReadiness.hasGraph && !aiReadiness.isAnalysisStale;
            const embedReady = aiReadiness.hasEmbedding;
            const canAnalyze = aiReadiness.memberCount >= 2;
            if (graphReady && embedReady) { aiDot = "#4ade80"; aiSub = "Ready"; }
            else if (!canAnalyze)         { aiDot = "#71717a"; aiSub = "Needs ≥2 docs"; }
            else if (graphReady || embedReady) { aiDot = "#fb923c"; aiSub = "Partial"; }
            else                          { aiDot = "#fb923c"; aiSub = "Pending"; }
            aiVisible = true;
          } else {
            // Single docs don't have a readiness object today. Keep
            // the tab present but indicate "indexed by default" — the
            // doc-created webhook embeds every doc the moment it's
            // saved, so by the time the user sees this modal, the
            // doc is already searchable.
            aiDot = "#4ade80";
            aiSub = "Indexed";
            aiVisible = true;
          }

          // --- API status ---
          const apiDot = editToken ? "#a1a1aa" : "#52525b";
          const apiSub = editToken ? "Token available" : "Owner-only";
          const apiVisible = !!editToken;

          const allTabs: Array<{ key: TabKey; label: string; dot: string; sub: string; visible: boolean }> = [
            { key: "people", label: "People", dot: peopleDot, sub: peopleSub, visible: true },
            { key: "ai",     label: "AI",     dot: aiDot,     sub: aiSub,     visible: aiVisible },
            { key: "api",    label: "API",    dot: apiDot,    sub: apiSub,    visible: apiVisible },
          ];
          const tabs = allTabs.filter(t => t.visible);

          return (
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 14,
                borderBottom: "1px solid var(--border-dim)",
              }}
            >
              {tabs.map((t) => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className="text-left transition-colors"
                    style={{
                      // Compact tab — no longer 1/3 of full width each
                      // (was reading as too sparse). Auto width with
                      // small horizontal padding lets the label + sub
                      // sit naturally tight together.
                      padding: "7px 12px 9px",
                      background: "transparent",
                      border: "none",
                      borderBottom: `2px solid ${active ? "var(--text-primary)" : "transparent"}`,
                      marginBottom: -1,
                      cursor: "pointer",
                      minWidth: 0,
                    }}
                  >
                    <div className="flex items-baseline gap-2">
                      <div className="flex items-center gap-1.5">
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: t.dot, flexShrink: 0 }} />
                        <span
                          className="font-semibold"
                          style={{
                            color: active ? "var(--text-primary)" : "var(--text-muted)",
                            fontSize: 12.5,
                          }}
                        >
                          {t.label}
                        </span>
                      </div>
                      <span
                        style={{
                          color: active ? "var(--text-muted)" : "var(--text-faint)",
                          fontSize: 11,
                        }}
                      >
                        {t.sub}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* AI tab — readiness checklist + Re-analyze. Bundle-only
            content; doc share gets a minimal "Indexed for recall"
            note since single-doc analysis is just the embed. */}
        {!loading && activeTab === "ai" && aiReadiness && (() => {
          // Treat the two readiness signals independently so the user
          // sees what's done and what's not — instead of one binary
          // "Ready / Not ready," surface graph + embedding as two
          // sub-checkmarks. Each carries its own consequence.
          const graphReady = aiReadiness.hasGraph && !aiReadiness.isAnalysisStale;
          const embedReady = aiReadiness.hasEmbedding;
          const fullyReady = graphReady && embedReady;
          const canAnalyze = aiReadiness.memberCount >= 2;
          // When fully ready, accent green. Otherwise orange. When
          // analysis is actively running (user clicked Re-analyze
          // moments ago), use a "pending" indicator until the parent
          // re-fetches and flips the flags.
          const bg = fullyReady ? "rgba(74, 222, 128, 0.07)" : "rgba(251, 146, 60, 0.07)";
          const border = fullyReady ? "rgba(74, 222, 128, 0.30)" : "rgba(251, 146, 60, 0.30)";
          const dot = fullyReady ? "#4ade80" : "#fb923c";
          const labelColor = fullyReady ? "#4ade80" : "#fb923c";
          let label: string;
          if (reanalyzePending) {
            label = "Analyzing…";
          } else if (fullyReady) {
            label = "Ready for AI";
          } else if (!canAnalyze) {
            label = "Add a 2nd doc to enable analysis";
          } else if (graphReady) {
            label = "Partially ready";   // graph done, embed missing
          } else if (embedReady) {
            label = "Partially ready";   // embed done, graph missing/stale
          } else {
            label = "Pending";
          }
          // Each row: short label (when done) + short reason (when
          // not). Keeps the banner scannable instead of paragraph-y.
          const checks: Array<{ done: boolean; label: string; pending: string; staleMsg?: string }> = [
            {
              done: graphReady,
              label: "External AI fetch",
              pending: "External AIs see members, no synthesis yet.",
              staleMsg: aiReadiness.isAnalysisStale ? "Stale — a member doc changed since analysis." : undefined,
            },
            {
              done: embedReady,
              label: "Hub recall",
              pending: "Not yet surfaced by hub semantic search.",
            },
          ];
          return (
            <div
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 4, background: dot, marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-caption font-mono uppercase tracking-wider mb-2" style={{ color: labelColor, fontSize: 10, letterSpacing: "0.08em" }}>
                  {label}
                </div>
                {/* Two-line checklist */}
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {checks.map((c, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{
                        flexShrink: 0,
                        width: 14,
                        textAlign: "center",
                        color: c.done && !c.staleMsg ? "#4ade80" : "#a1a1aa",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: 11,
                        lineHeight: "18px",
                      }}>
                        {c.done && !c.staleMsg ? "✓" : "○"}
                      </span>
                      <span className="text-caption" style={{
                        color: c.done && !c.staleMsg ? "var(--text-secondary)" : "var(--text-muted)",
                        lineHeight: 1.45,
                      }}>
                        {c.done && !c.staleMsg ? c.label : (c.staleMsg || c.pending)}
                      </span>
                    </li>
                  ))}
                </ul>
                {!fullyReady && canAnalyze && onReanalyze && (
                  <button
                    onClick={() => {
                      if (reanalyzePending) return;
                      setReanalyzePending(true);
                      try { onReanalyze(); } catch { /* fire-and-forget */ }
                      // Reset the pending state after a generous window
                      // even if the parent forgets to update readiness —
                      // the user can always click again to retry.
                      setTimeout(() => setReanalyzePending(false), 90_000);
                    }}
                    disabled={reanalyzePending}
                    className="text-caption mt-2 font-semibold"
                    style={{
                      color: reanalyzePending ? "var(--text-faint)" : "#fb923c",
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: reanalyzePending ? "wait" : "pointer",
                      textDecoration: reanalyzePending ? "none" : "underline",
                    }}
                  >
                    {reanalyzePending ? "Running… ~60s" : "Re-analyze now"}
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* AI tab — single-doc fallback (no readiness object passed) */}
        {!loading && activeTab === "ai" && !aiReadiness && (
          <div
            style={{
              background: "rgba(74, 222, 128, 0.07)",
              border: "1px solid rgba(74, 222, 128, 0.30)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 16,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#4ade80", marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-caption font-mono uppercase tracking-wider mb-1" style={{ color: "#4ade80", fontSize: 10, letterSpacing: "0.08em" }}>
                Indexed for AI recall
              </div>
              <p className="text-caption" style={{ color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 0 }}>
                Single docs are embedded on save — any AI that fetches this URL gets the markdown directly, and hub recall can surface it by semantic match. Bundle analysis (graph synthesis) only applies to bundles.
              </p>
            </div>
          </div>
        )}

        {/* People tab */}
        {!loading && activeTab === "people" && <div className="pb-4">
          <label className="text-caption font-medium mb-2 block" style={{ color: "var(--text-muted)" }}>
            Share with people
          </label>
          <div className="flex items-stretch gap-2">
            <input
              ref={inputRef}
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && emailInput.trim()) {
                  e.preventDefault();
                  addEmail(emailInput);
                }
              }}
              placeholder="Add people by email..."
              className="flex-1 h-10 px-3 rounded-lg text-sm outline-none transition-colors"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            {/* h-10 wrapper forces the Button to match the input's
                height. Button's size="md" is h-8 by design; the
                inline height override only applies in this row. */}
            <Button
              variant={emailInput.trim() ? "primary" : "secondary"}
              size="md"
              onClick={() => emailInput.trim() && addEmail(emailInput)}
              disabled={!emailInput.trim() || saving}
              loading={saving}
              className="!h-10"
            >
              Add
            </Button>
          </div>
        </div>}

        {/* People with access */}
        {!loading && activeTab === "people" && (
          <div className="pb-4">
            <label className="text-caption font-medium mb-2 block" style={{ color: "var(--text-muted)" }}>
              People with access
            </label>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
              {/* Owner */}
              <div
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderBottom: emails.length > 0 ? "1px solid var(--border-dim)" : "none" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold shrink-0"
                  style={{ background: "var(--border)", color: "var(--text-primary)" }}
                >
                  {(ownerName || ownerEmail)[0]?.toUpperCase() || "O"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{ownerName || ownerEmail}</p>
                  {ownerName && <p className="text-caption truncate" style={{ color: "var(--text-muted)" }}>{ownerEmail}</p>}
                </div>
                <span className="text-caption font-mono px-2 py-0.5 rounded" style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}>
                  Owner
                </span>
              </div>

              {/* Shared people. The role pill is toggleable —
                  clicking it swaps Viewer ↔ Editor (writes
                  allowed_editors). Read access is implied by being
                  in this list at all; edit access is the explicit
                  add-on. */}
              {emails.map((email) => {
                const isEditor = editors.includes(email);
                return (
                  <div
                    key={email}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ borderBottom: "1px solid var(--border-dim)" }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold shrink-0"
                      style={{ background: "var(--color-cool-dim)", color: "var(--color-cool)" }}
                    >
                      {email[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{email}</p>
                    </div>
                    {/* Permission picker — native <select> so it
                        unambiguously reads as a control with
                        options. The previous chip looked like a
                        passive label and people couldn't tell it
                        was clickable, let alone what clicking did.
                        Now: explicit dropdown with chevron, two
                        labelled choices ("Can view" / "Can edit"),
                        and the verb ("Can…") makes the permission
                        verbatim instead of forcing the reader to
                        translate "Editor" → "can edit". */}
                    <div className="relative shrink-0">
                      <select
                        value={isEditor ? "edit" : "view"}
                        onChange={(e) => {
                          const wantEditor = e.target.value === "edit";
                          if (wantEditor !== isEditor) toggleEditor(email);
                        }}
                        className="appearance-none text-caption font-medium pl-2.5 pr-7 py-1 rounded outline-none cursor-pointer transition-colors"
                        style={{
                          background: "var(--toggle-bg)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-dim)",
                        }}
                        aria-label={`Permission for ${email}`}
                      >
                        <option value="view">Can view</option>
                        <option value="edit">Can edit</option>
                      </select>
                      <ChevronDown
                        width={11}
                        height={11}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: "var(--text-muted)" }}
                      />
                    </div>
                    <button
                      onClick={() => removeEmail(email)}
                      className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{ color: "var(--text-faint)" }}
                      title="Remove access"
                    >
                      <X width={10} height={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Read access — three real states. The vocabulary matches
            DocStatusIcon and the Hub's owner view exactly: Private /
            Shared / Public. There's no "Draft" anywhere — a saved doc
            just sits in the cloud as Private until the owner promotes
            it.
            (Cascade banner that used to sit here has moved above the
            tab bar since it applies modal-wide.) */}
        {!loading && activeTab === "people" && !hideAccessPicker && <div className="pb-4">
          <label className="text-caption font-medium mb-2 block" style={{ color: "var(--text-muted)" }}>
            Who can read
          </label>
          <div className="flex flex-col gap-1.5">
            {([
              {
                value: "private" as const,
                label: "Only me",
                desc: "Saved to cloud — only you can read this URL.",
                icon: <Cloud width={16} height={16} strokeWidth={1.5} />,
                disabled: false,
              },
              {
                value: "restricted-people" as const,
                label: "Specific people only",
                desc: emails.length === 0
                  ? "Add at least one email above first to enable."
                  : `Only ${emails.length} person${emails.length === 1 ? "" : "s"} listed above + you can read.`,
                icon: <Users width={16} height={16} strokeWidth={1.5} />,
                disabled: emails.length === 0,
              },
              {
                value: "anyone" as const,
                label: "Anyone with the link",
                desc: "Anyone can read this URL — listed on your hub.",
                icon: <Globe width={16} height={16} strokeWidth={1.5} />,
                disabled: false,
              },
            ]).map((opt) => {
              const selected = generalAccess === opt.value;
              const isDisabled = opt.disabled && !selected;
              return (
                <button
                  key={opt.value}
                  onClick={() => !selected && !isDisabled && handleAccessChange(opt.value)}
                  disabled={isDisabled}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                  style={{
                    background: selected ? "var(--border)" : "var(--background)",
                    border: selected ? "1px solid var(--text-primary)" : "1px solid var(--border-dim)",
                    opacity: isDisabled ? 0.45 : 1,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center" style={{ border: selected ? "none" : "2px solid var(--border)" }}>
                    {selected && <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--text-primary)" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#000" }} />
                    </span>}
                  </span>
                  <span className="shrink-0" style={{ color: selected ? "var(--text-primary)" : "var(--text-faint)" }}>{opt.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-medium" style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}>{opt.label}</p>
                    <p className="text-caption" style={{ color: "var(--text-faint)" }}>{opt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>}

        {/* API tab — programmatic access via the owner edit token.
            The tab itself is the disclosure (no inner fold), so
            content is rendered flat. */}
        {!loading && activeTab === "api" && editToken && (
          <div>
            <p className="text-caption mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
              For GitHub Actions, MCP server, or any programmatic API call. Anyone with this token can write to this URL — treat it like a password. Rotate from the editor if it leaks.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (typeof navigator === "undefined" || !navigator.clipboard) return;
                  navigator.clipboard.writeText(editToken).then(
                    () => {
                      setTokenCopied(true);
                      setTimeout(() => setTokenCopied(false), 1400);
                    },
                    () => { /* clipboard blocked — silent */ },
                  );
                }}
                style={tokenCopied ? { color: "var(--color-success)" } : undefined}
              >
                {tokenCopied ? "Token copied" : "Copy edit token"}
              </Button>
              <a
                href="/docs/integrate#github-action"
                target="_blank"
                rel="noreferrer"
                className="text-caption"
                style={{ color: "var(--text-primary)", textDecoration: "underline" }}
              >
                Setup guide
              </a>
            </div>
          </div>
        )}

        {/* Cascade banner — bundle-only, modal-wide context. Sits at
            the bottom of the body because the per-tab controls are
            what the user came to use; the cascade rule is a quieter
            "by the way" note rather than the main event. */}
        {!loading && banner && (
          <div className="mt-4">{banner}</div>
        )}

      </div>
    </ModalShell>
  );
}

export default memo(ShareModal);
