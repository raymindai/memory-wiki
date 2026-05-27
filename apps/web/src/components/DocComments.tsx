"use client";

/**
 * DocComments — flat thread under a doc.
 *
 * Mounts inside the public viewer (/d/<id>) and renders below the
 * doc body. Self-fetches via /api/docs/<id>/comments; no realtime
 * yet (poll on focus). The API gates read/write against the same
 * access model the doc uses, so this component renders identically
 * on private / restricted / public docs and the server enforces.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";

type CommentAuthor = {
  id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  hub_slug: string | null;
  is_me: boolean;
};

type Comment = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  edited: boolean;
  author: CommentAuthor;
};

type ViewerInfo = { isOwner: boolean; userId: string | null };

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DocComments({ docId }: { docId: string }) {
  const { user, accessToken } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewer, setViewer] = useState<ViewerInfo>({ isOwner: false, userId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const draftAreaRef = useRef<HTMLTextAreaElement>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (accessToken) h.Authorization = `Bearer ${accessToken}`;
    if (user?.id) h["x-user-id"] = user.id;
    if (user?.email) h["x-user-email"] = user.email;
    return h;
  }, [accessToken, user?.id, user?.email]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/docs/${docId}/comments`, { headers: authHeaders, cache: "no-store" });
      if (!res.ok) {
        // 401/403 just means comments aren't readable for this viewer —
        // surface nothing rather than a scary error banner. Genuine
        // server errors fall through.
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setComments([]);
          setViewer({ isOwner: false, userId: null });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setViewer(data.viewer || { isOwner: false, userId: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [docId, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll on focus — cheap freshness without realtime infra.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const handlePost = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/docs/${docId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }, [draft, posting, docId, authHeaders, load]);

  const handleEditStart = useCallback((c: Comment) => {
    setEditingId(c.id);
    setEditDraft(c.body);
  }, []);

  const handleEditSave = useCallback(async () => {
    const body = editDraft.trim();
    if (!body || !editingId) return;
    try {
      const res = await fetch(`/api/docs/${docId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ commentId: editingId, body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingId(null);
      setEditDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }, [editDraft, editingId, docId, authHeaders, load]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await fetch(`/api/docs/${docId}/comments?commentId=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }, [docId, authHeaders, load]);

  if (loading) return null;

  return (
    <section style={{ maxWidth: 720, margin: "32px auto 0", padding: "0 16px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          Comments
        </h2>
        <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono, ui-monospace)" }}>
          {comments.length}
        </span>
      </header>

      {error && (
        <div style={{ fontSize: 12, color: "var(--micro-red, #ef4444)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {comments.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 16px" }}>
          No comments yet.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {comments.map((c) => {
            const canEdit = c.author.is_me;
            const canDelete = c.author.is_me || viewer.isOwner;
            const isEditing = editingId === c.id;
            const displayName = c.author.display_name || (c.author.hub_slug ? `@${c.author.hub_slug}` : "Anonymous");
            const profileHref = c.author.hub_slug ? `/@${c.author.hub_slug}` : null;
            return (
              <li key={c.id} style={{ display: "flex", gap: 10 }}>
                <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: "var(--toggle-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {c.author.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.author.avatar_url} alt="" width={28} height={28} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>
                      {displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    {profileHref ? (
                      <a href={profileHref} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textDecoration: "none" }}>
                        {displayName}
                      </a>
                    ) : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{displayName}</span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {relativeTime(c.created_at)}{c.edited && " (edited)"}
                    </span>
                  </div>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={3}
                        maxLength={4000}
                        style={{ width: "100%", padding: 8, fontSize: 13, background: "var(--background)", border: "1px solid var(--border-dim)", borderRadius: 6, color: "var(--text-primary)", resize: "vertical", outline: "none" }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button onClick={handleEditSave} style={{ padding: "4px 10px", fontSize: 12, fontWeight: 500, background: "var(--text-primary)", color: "var(--background)", border: "none", borderRadius: 5, cursor: "pointer" }}>
                          Save
                        </button>
                        <button onClick={() => { setEditingId(null); setEditDraft(""); }} style={{ padding: "4px 10px", fontSize: 12, color: "var(--text-muted)", background: "transparent", border: "none", cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.body}</p>
                      {(canEdit || canDelete) && (
                        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                          {canEdit && (
                            <button onClick={() => handleEditStart(c)} style={{ fontSize: 11, color: "var(--text-faint)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(c.id)} style={{ fontSize: 11, color: "var(--text-faint)", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? (
        <div>
          <textarea
            ref={draftAreaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment"
            rows={3}
            maxLength={4000}
            style={{ width: "100%", padding: 10, fontSize: 13, background: "var(--background)", border: "1px solid var(--border-dim)", borderRadius: 6, color: "var(--text-primary)", resize: "vertical", outline: "none" }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              {draft.length}/4000 · ⌘↵ to post
            </span>
            <button
              onClick={handlePost}
              disabled={posting || !draft.trim()}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 500,
                background: "var(--text-primary)",
                color: "var(--background)",
                border: "none",
                borderRadius: 5,
                cursor: posting || !draft.trim() ? "not-allowed" : "pointer",
                opacity: posting || !draft.trim() ? 0.5 : 1,
              }}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
          <a href="/auth?next=/d/" style={{ color: "var(--text-primary)", textDecoration: "underline" }}>Sign in</a> to comment.
        </p>
      )}
    </section>
  );
}
