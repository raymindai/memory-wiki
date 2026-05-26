"use client";

/**
 * BundleShareModal — wraps the same `ShareModal` used for individual
 * documents but routes API calls through bundle adapters that:
 *   1) Update the bundle's own state (publish flips is_draft).
 *   2) Cascade allowed_emails / edit_mode onto every included document
 *      so each doc is also accessible directly via /d/<id> with the
 *      same permissions.
 * Renders a banner above "General access" listing the documents that
 * will be affected.
 *
 * Extracted from MdEditor.tsx.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import ShareModal from "@/components/ShareModal";
import { showToast } from "@/components/Toast";

type BundleDocStatus = {
  id: string;
  title: string | null;
  is_draft: boolean;
  edit_mode: string;
  allowed_emails_count: number;
  allowed_emails?: string[];
  allowed_editors?: string[];
};

/**
 * BundleShareModal — wraps the same `ShareModal` used for individual documents.
 * Shares all of ShareModal's UI (email chips, access modes, copy link, make private)
 * but routes API calls through bundle adapters that:
 *   1) Update the bundle's own state (publish flips is_draft).
 *   2) Cascade allowed_emails / edit_mode onto every included document so each
 *      doc is also accessible directly via /d/<id> with the same permissions.
 * Renders a banner above "General access" listing the documents that will be affected.
 */
export default function BundleShareModal({
  bundleId,
  bundleTitle,
  ownerEmail,
  ownerName,
  userId,
  authHeaders,
  onClose,
  onBundleUpdated,
}: {
  bundleId: string;
  bundleTitle: string;
  ownerEmail: string;
  ownerName?: string;
  userId: string;
  authHeaders: Record<string, string>;
  onClose: () => void;
  onBundleUpdated: (changes: { is_draft?: boolean; allowed_emails_count?: number }) => void;
}) {
  const [_loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<BundleDocStatus[]>([]);
  const [editMode, setEditMode] = useState<string>("owner");
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [showRevertPicker, setShowRevertPicker] = useState(false);
  const [revertDocIds, setRevertDocIds] = useState<Set<string>>(new Set());
  const [reverting, setReverting] = useState(false);
  const [bundleEditToken, setBundleEditToken] = useState<string | undefined>(undefined);
  // Whether the bundle row itself is a draft. The Share modal's
  // "Anyone with link" badge was hardcoded-cheerful for newly
  // created bundles because we never propagated bundles.is_draft
  // into ShareModal's isPrivate prop — the modal then defaulted
  // to "anyone" (no emails set, no isPrivate signal) even though
  // /b/<id> still 404'd for everyone but the owner.
  const [bundleIsDraft, setBundleIsDraft] = useState<boolean>(true);
  // Readiness for cross-AI fetch: graph_data + embedding pipeline.
  // Surfaces in the Share modal so the user sees "Ready / Pending"
  // before they hand the URL to Claude / Cursor / ChatGPT.
  const [bundleAiReady, setBundleAiReady] = useState<{ hasGraph: boolean; hasEmbedding: boolean; isAnalysisStale: boolean; memberCount: number } | null>(null);

  // Load bundle + docs to derive current shared state. The bundle row
  // now owns its own allowed_emails list (cascaded on every email
  // change), so we read it directly off the bundle response instead
  // of doing a second sequential GET against the first published
  // member doc. That second fetch was the load-time culprit: the
  // modal opened with a stale "Anyone with the link" default for up
  // to ~2 seconds until that follow-up resolved.
  useEffect(() => {
    // Skip the fetch while authHeaders is empty — the owner-only
    // draft bundle would 404 on the first paint (no x-user-id),
    // then refetch and 200 once the parent hydrated identity. The
    // intermediate 404 was just noise in the console.
    if (!authHeaders["x-user-id"] && !authHeaders.Authorization) return;
    let cancelled = false;
    fetch(`/api/bundles/${bundleId}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.documents) return;
        const docList: BundleDocStatus[] = data.documents.map((d: BundleDocStatus) => ({
          id: d.id,
          title: d.title,
          is_draft: d.is_draft !== false,
          edit_mode: d.edit_mode || "owner",
          allowed_emails_count: d.allowed_emails_count || 0,
        }));
        setDocs(docList);

        const publishedDocs = docList.filter(d => !d.is_draft);
        const sample = publishedDocs[0] || docList[0];
        if (sample) setEditMode(sample.edit_mode || "owner");

        if (Array.isArray(data.allowed_emails)) {
          setAllowedEmails(data.allowed_emails);
        }
        // Owner-only: capture the edit token so the Developer-access
        // footer can surface it for programmatic API access.
        if (typeof data.editToken === "string") {
          setBundleEditToken(data.editToken);
        }
        // Capture the bundle's own draft state so ShareModal's
        // People-tab badge tells the truth ("Only you" for a
        // freshly-created bundle, not "Anyone with link").
        if (typeof data.is_draft === "boolean") {
          setBundleIsDraft(data.is_draft);
        }
        setBundleAiReady({
          hasGraph: !!data.hasGraph,
          hasEmbedding: !!data.hasEmbedding,
          isAnalysisStale: !!data.isAnalysisStale,
          memberCount: docList.length,
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bundleId, authHeaders]);

  // Adapter: persist allowed_emails on the bundle row AND cascade to every doc
  // (so each doc is also accessible via /d/<id> with the same permissions).
  const setAllowedEmailsAdapter = useCallback(async (
    _id: string,
    uid: string,
    emails: string[],
    editors: string[],
  ) => {
    await fetch(`/api/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ userId: uid, action: "set-allowed-emails", allowedEmails: emails, allowedEditors: editors }),
    }).catch(() => {});
    await Promise.all(docs.map(d =>
      fetch(`/api/docs/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ userId: uid, action: "set-allowed-emails", allowedEmails: emails, allowedEditors: editors }),
      }).catch(() => {})
    ));
    // Notify parent so it refetches bundles → sidebar icon updates immediately
    // to reflect the new allowed_emails_count (gray → blue+avatar).
    onBundleUpdated({});
    setAllowedEmails(emails);
    return { allowedEmails: emails, allowedEditors: editors };
  }, [docs, bundleId, authHeaders, onBundleUpdated]);

  // Adapter: cascade edit-mode change + ensure bundle is published when sharing,
  // and publish each doc so it can also be opened directly.
  const changeEditModeAdapter = useCallback(async (
    _id: string,
    uid: string,
    mode: "owner" | "view" | "public",
  ) => {
    setEditMode(mode);
    // Ensure bundle is published (so /b/<id> is reachable)
    await fetch(`/api/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ userId: uid, action: "publish" }),
    }).catch(() => {});
    // Persist edit_mode on the bundle row too
    await fetch(`/api/bundles/${bundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ userId: uid, action: "change-edit-mode", editMode: mode }),
    }).catch(() => {});
    setBundleIsDraft(false);
    onBundleUpdated({ is_draft: false });
    // Cascade publish + edit-mode onto every doc
    await Promise.all(docs.map(async d => {
      await fetch(`/api/docs/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ userId: uid, action: "publish" }),
      }).catch(() => {});
      await fetch(`/api/docs/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ userId: uid, action: "change-edit-mode", editMode: mode }),
      }).catch(() => {});
    }));
  }, [docs, bundleId, authHeaders, onBundleUpdated]);

  const handleMakePrivate = useCallback(() => {
    // Open per-doc revert picker. Default-select every doc that's currently published.
    setRevertDocIds(new Set(docs.filter(d => !d.is_draft).map(d => d.id)));
    setShowRevertPicker(true);
  }, [docs]);

  const submitRevert = useCallback(async () => {
    setReverting(true);
    try {
      // Always unpublish the bundle
      await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ userId, action: "unpublish" }),
      }).catch(() => {});
      // Unpublish only the selected docs
      const toRevert = docs.filter(d => revertDocIds.has(d.id));
      await Promise.all(toRevert.map(d =>
        fetch(`/api/docs/${d.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ userId, action: "unpublish" }),
        }).catch(() => {})
      ));
      setBundleIsDraft(true);
      onBundleUpdated({ is_draft: true });
      showToast(
        toRevert.length === 0
          ? "Bundle unpublished. Documents kept as-is."
          : `Bundle and ${toRevert.length} document${toRevert.length === 1 ? "" : "s"} reverted to private`,
        "success"
      );
      onClose();
    } finally {
      setReverting(false);
    }
  }, [docs, revertDocIds, bundleId, userId, authHeaders, onBundleUpdated, onClose]);

  if (showRevertPicker) {
    const toggleRevert = (id: string) => {
      setRevertDocIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={() => setShowRevertPicker(false)}
      >
        <div
          className="w-full max-w-md mx-4 rounded-xl shadow-2xl flex flex-col"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", maxHeight: "80vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Make Bundle Private</h2>
            <p className="text-caption mt-1" style={{ color: "var(--text-muted)" }}>
              Bundle will be unpublished. Pick which documents inside should also revert to private.
            </p>
          </div>
          <div className="px-5 pb-3 flex-1 min-h-0 overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-caption font-medium" style={{ color: "var(--text-muted)" }}>{revertDocIds.size} of {docs.length} selected</span>
              <div className="flex gap-1.5 text-caption">
                <button onClick={() => setRevertDocIds(new Set(docs.map(d => d.id)))} className="px-1.5 py-0.5 rounded hover:bg-[var(--toggle-bg)]" style={{ color: "var(--text-faint)" }}>All</button>
                <button onClick={() => setRevertDocIds(new Set())} className="px-1.5 py-0.5 rounded hover:bg-[var(--toggle-bg)]" style={{ color: "var(--text-faint)" }}>None</button>
              </div>
            </div>
            <div className="space-y-1">
              {docs.map(d => {
                const isSelected = revertDocIds.has(d.id);
                const status = d.is_draft
                  ? { label: "Already private", color: "var(--text-faint)" }
                  : d.edit_mode === "view"
                  ? { label: "Public link", color: "#4ade80" }
                  : d.allowed_emails_count > 0
                  ? { label: `Shared with ${d.allowed_emails_count}`, color: "#60a5fa" }
                  : { label: "Published", color: "#4ade80" };
                return (
                  <div
                    key={d.id}
                    onClick={() => toggleRevert(d.id)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-caption cursor-pointer transition-colors hover:bg-[var(--border)]"
                    style={{
                      background: isSelected ? "var(--border)" : "var(--background)",
                      color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                      border: `1px solid ${isSelected ? "var(--border)" : "var(--border-dim)"}`,
                      opacity: d.is_draft ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded shrink-0 flex items-center justify-center"
                      style={{
                        background: isSelected ? "var(--text-primary)" : "transparent",
                        border: `1px solid ${isSelected ? "var(--text-primary)" : "var(--border)"}`,
                      }}
                    >
                      {isSelected && <Check width={10} height={10} style={{ color: "#fff" }} />}
                    </div>
                    <span className="flex-1 truncate">{d.title || "Untitled"}</span>
                    <span className="shrink-0 text-caption" style={{ color: status.color }}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border-dim)" }}>
            <button
              onClick={() => setShowRevertPicker(false)}
              className="px-3 py-1.5 rounded-md text-caption font-medium hover:bg-[var(--toggle-bg)]"
              style={{ color: "var(--text-muted)" }}
            >
              Cancel
            </button>
            <button
              onClick={submitRevert}
              disabled={reverting}
              className="px-4 py-1.5 rounded-md text-caption font-medium"
              style={{ background: "#ef4444", color: "#fff", opacity: reverting ? 0.5 : 1 }}
            >
              {reverting ? "Working..." : "Make Private"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // One-line cascade hint — short enough to read at a glance.
  const banner = (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}>
      <div className="flex items-center gap-2">
        <ShieldAlert width={13} height={13} style={{ color: "#fbbf24", flexShrink: 0 }} />
        <p className="text-caption" style={{ color: "var(--text-muted)" }}>
          Applies to every member doc — each one also at <code style={{ background: "var(--toggle-bg)", padding: "1px 5px", borderRadius: 3, fontSize: "0.85em" }}>/d/&lt;id&gt;</code>
        </p>
      </div>
    </div>
  );

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${bundleId}` : `/b/${bundleId}`;

  return (
    <ShareModal
      docId={bundleId}
      title={bundleTitle}
      headerTitle={`Share Bundle "${bundleTitle.length > 30 ? bundleTitle.slice(0, 30) + "..." : bundleTitle}"`}
      userId={userId}
      ownerEmail={ownerEmail}
      ownerName={ownerName}
      currentEditMode={editMode}
      initialAllowedEmails={allowedEmails}
      initialAllowedEditors={[]}
      isPrivate={bundleIsDraft}
      onClose={onClose}
      onEditModeChange={(mode) => {
        setEditMode(mode);
        // is_draft change handled inside changeEditModeAdapter
      }}
      onAllowedEmailsChange={setAllowedEmails}
      onMakePrivate={handleMakePrivate}
      setAllowedEmailsOverride={setAllowedEmailsAdapter}
      changeEditModeOverride={changeEditModeAdapter}
      shareUrlOverride={shareUrl}
      editToken={bundleEditToken}
      aiReadiness={bundleAiReady}
      onReanalyze={() => {
        // Fire-and-forget — no await. The ShareModal handles its own
        // pending-state UX (button → "Running… ~60s"). We never block
        // the click handler on the LLM call.
        //
        // After firing, poll readiness every 10s until both flags
        // flip green. This is more responsive than the prior fixed
        // 65s sleep, especially when embedding completes in <2s and
        // the user just wants confirmation the embed half landed.
        void fetch(`/api/bundles/${bundleId}/graph`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({}),
        }).catch(() => {});
        void fetch(`/api/embed/bundle/${bundleId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
        }).catch(() => {});

        // Poll every 10s for up to 2 minutes. Stop early once both
        // flags are green so we don't keep hitting the API.
        let attempts = 0;
        const maxAttempts = 12;
        const poll = () => {
          attempts++;
          fetch(`/api/bundles/${bundleId}`, { headers: authHeaders })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
              if (!d) return;
              setBundleAiReady({
                hasGraph: !!d.hasGraph,
                hasEmbedding: !!d.hasEmbedding,
                isAnalysisStale: !!d.isAnalysisStale,
                memberCount: (d.documents || []).length,
              });
              const ready = d.hasGraph && d.hasEmbedding && !d.isAnalysisStale;
              if (!ready && attempts < maxAttempts) {
                setTimeout(poll, 10_000);
              }
            })
            .catch(() => {
              if (attempts < maxAttempts) setTimeout(poll, 10_000);
            });
        };
        setTimeout(poll, 5_000);
      }}
      banner={banner}
    />
  );
}

