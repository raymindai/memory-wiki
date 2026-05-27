"use client";

import { useEffect, useState } from "react";
import { diffMarkdown, type DiffSummary } from "@/lib/markdown-diff";

interface Props {
  /**
   * The compiled doc whose synthesis we're proposing to update.
   */
  docId: string;
  /**
   * Owner credentials. We pass them through to /api/docs/:id PATCH on
   * accept. Match whatever the doc was originally created with.
   */
  auth: {
    accessToken?: string;
    editToken?: string;
    userId?: string;
    anonymousId?: string;
  };
  /**
   * Closes the panel. Accepting also fires this; the parent decides
   * whether to refresh the doc afterwards via the onAccepted callback.
   */
  onClose: () => void;
  onAccepted?: (newMarkdown: string) => void;
}

interface PreviewResponse {
  preview: true;
  kind: string;
  currentMarkdown: string;
  proposedMarkdown: string;
  previousCompiledAt: string | null;
}

/**
 * Diff/accept panel for the synthesis exceed-move.
 *
 * Karpathy's wiki pattern can only regenerate pages — every refresh
 * blows away the previous version with no review surface. Memory.Wiki lets the
 * owner see a line-level diff between the existing synthesis and the
 * LLM's proposed update, then accept or reject as a whole.
 *
 * For v1 we accept the whole proposal at once. Per-paragraph accept is
 * a follow-up post-launch enhancement.
 */
export default function SynthesisDiff({ docId, auth, onClose, onAccepted }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (auth.accessToken) headers["Authorization"] = `Bearer ${auth.accessToken}`;
        if (auth.userId) headers["X-User-Id"] = auth.userId;
        const res = await fetch(`/api/docs/${docId}/recompile?preview=1`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            editToken: auth.editToken,
            userId: auth.userId,
            anonymousId: auth.anonymousId,
          }),
        });
        if (abort) return;
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setError(e.error || `Preview failed (${res.status})`);
          setLoading(false);
          return;
        }
        const body: PreviewResponse = await res.json();
        if (abort) return;
        setData(body);
        setDiff(diffMarkdown(body.currentMarkdown, body.proposedMarkdown));
        setLoading(false);
      } catch (err) {
        if (abort) return;
        setError(err instanceof Error ? err.message : "Preview failed");
        setLoading(false);
      }
    })();
    return () => {
      abort = true;
    };
  }, [docId, auth.accessToken, auth.editToken, auth.userId, auth.anonymousId]);

  const accept = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth.accessToken) headers["Authorization"] = `Bearer ${auth.accessToken}`;
      if (auth.userId) headers["X-User-Id"] = auth.userId;
      const res = await fetch(`/api/docs/${docId}`, {
        method: "PATCH",
        headers,
        credentials: "include",
        body: JSON.stringify({
          markdown: data.proposedMarkdown,
          editToken: auth.editToken,
          userId: auth.userId,
          anonymousId: auth.anonymousId,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Save failed (${res.status})`);
      }
      onAccepted?.(data.proposedMarkdown);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "color-mix(in srgb, var(--background) 85%, transparent)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              Proposed synthesis update
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {loading
                ? "Generating proposal…"
                : diff?.identical
                  ? "No changes — the synthesis is up to date."
                  : diff
                    ? `${diff.added} line${diff.added === 1 ? "" : "s"} added — ${diff.removed} removed`
                    : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 14,
              padding: "6px 10px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "32px 0", textAlign: "center" }}>
              Asking the model for the latest synthesis. This usually takes 5–15 seconds.
            </div>
          )}
          {error && (
            <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>
          )}
          {diff && !diff.identical && (
            <pre
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.55,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {diff.lines.map((l, i) => (
                <span
                  key={i}
                  style={{
                    display: "block",
                    padding: "1px 8px",
                    background:
                      l.op === "added"
                        ? "color-mix(in srgb, #22c55e 22%, transparent)"
                        : l.op === "removed"
                          ? "color-mix(in srgb, #ef4444 18%, transparent)"
                          : "transparent",
                    color:
                      l.op === "removed"
                        ? "color-mix(in srgb, var(--text-secondary) 80%, transparent)"
                        : "var(--text-primary)",
                    textDecoration: l.op === "removed" ? "line-through" : "none",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 14,
                      color: "var(--text-faint)",
                      marginRight: 8,
                    }}
                  >
                    {l.op === "added" ? "+" : l.op === "removed" ? "−" : " "}
                  </span>
                  {l.text || " "}
                </span>
              ))}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Reject
          </button>
          <button
            onClick={accept}
            disabled={submitting || loading || !data || !!error || (diff?.identical ?? true)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--text-primary)",
              background: "var(--text-primary)",
              color: "var(--background)",
              fontSize: 13,
              fontWeight: 600,
              cursor:
                submitting || loading || !data || !!error || (diff?.identical ?? true) ? "not-allowed" : "pointer",
              opacity:
                submitting || loading || !data || !!error || (diff?.identical ?? true) ? 0.5 : 1,
            }}
          >
            {submitting ? "Saving…" : "Accept update"}
          </button>
        </div>
      </div>
    </div>
  );
}
