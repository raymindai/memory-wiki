"use client";

import { useRef, useCallback, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { contentHash } from "@/lib/content-hash";

interface AutoSaveOptions {
  debounceMs?: number;
}

interface ConflictData {
  serverMarkdown: string;
  serverUpdatedAt: string;
}

interface AutoSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  conflict: ConflictData | null;
}

/**
 * Auto-save hook: debounced save to server.
 * - First call with no cloudId → POST /api/docs to create
 * - Subsequent calls → PATCH /api/docs/{id} with action: "auto-save"
 */
export function useAutoSave(opts: AutoSaveOptions = {}) {
  const { debounceMs = 2000 } = opts;
  const [state, setState] = useState<AutoSaveState>({
    isSaving: false,
    lastSaved: null,
    error: null,
    conflict: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedMdRef = useRef<string>("");
  const lastServerUpdatedAtRef = useRef<string>("");
  const inflightRef = useRef(false);
  const pendingRef = useRef<Parameters<typeof scheduleSave>[0] | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  // Synchronous timestamp of the most recent save attempt (scheduled
  // OR completed). The realtime channel uses this to filter out
  // postgres_changes payloads that came from our own save — the older
  // useEffect-based mirror of `state.lastSaved` was async (had to wait
  // for React to commit), so a WebSocket frame landing before the
  // commit could fail the guard and trigger a false "updated
  // elsewhere" toast while the user was typing.
  const lastSaveAttemptAtRef = useRef<number>(0);

  // Embedding refresh runs on a separate, longer debounce (10s after the
  // last successful save). It calls POST /api/embed/{cloudId} which is
  // idempotent — the server short-circuits when the markdown hash hasn't
  // changed, so a missed call costs nothing on the next save. Fire-and-
  // forget; embedding failure must never block the editing flow.
  const embedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const EMBED_DEBOUNCE_MS = 10000;
  const scheduleEmbed = useCallback((cloudId: string, token: string | undefined) => {
    if (!cloudId) return;
    if (embedTimerRef.current) clearTimeout(embedTimerRef.current);
    embedTimerRef.current = setTimeout(async () => {
      embedTimerRef.current = null;
      try {
        await fetch(`/api/embed/${cloudId}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {
        // Silent — next save will retry. Embedding is best-effort.
      }
    }, EMBED_DEBOUNCE_MS);
  }, []);
  // Tracks whether we already attempted a Supabase session refresh for the
  // current 403. Prevents an infinite refresh→403→refresh loop if the user is
  // genuinely signed out or lacks permission on the doc.
  const refreshedThisRoundRef = useRef(false);

  /**
   * Try to refresh the Supabase session and return the new access token.
   * Returns null if refresh is not possible (no client / no session / failed).
   */
  const refreshSupabaseSession = useCallback(async (): Promise<string | null> => {
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return null;
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data?.session?.access_token) return null;
      return data.session.access_token;
    } catch {
      return null;
    }
  }, []);

  /**
   * Create a new document on the server.
   * Returns { id, editToken } or null on failure.
   *
   * In-flight dedup: if two callers ask to create a doc with the same
   * (owner, title, markdown) fingerprint while the first request is still
   * in flight, the second waits for the first's response and returns the
   * same {id, editToken}. Without this, multiple simultaneous create calls
   * (concurrent migration runs across tabs, double-fired effects under
   * StrictMode, accidental double-clicks of "+ New") would each spawn a
   * fresh server doc — exactly how the duplicates pile up.
   */
  const inflightCreatesRef = useRef<Map<string, Promise<{ id: string; editToken: string; deduplicated?: boolean } | null>>>(new Map());
  const createDocument = useCallback(
    async (args: {
      markdown: string;
      title?: string;
      userId?: string;
      anonymousId?: string;
    }) => {
      const ownerKey = args.userId || args.anonymousId || "anon";
      // Fingerprint: owner + title + a 1KB markdown prefix. The prefix is
      // enough to differentiate distinct content while keeping the key
      // bounded; the server-side dedup will catch any collisions inside
      // the same 30s window.
      const fingerprint = `${ownerKey}::${args.title || ""}::${args.markdown.slice(0, 1024)}`;
      const inflight = inflightCreatesRef.current.get(fingerprint);
      if (inflight) return inflight;

      const task = (async () => {
        try {
          const res = await fetch("/api/docs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              markdown: args.markdown,
              title: args.title,
              userId: args.userId,
              anonymousId: args.anonymousId,
              editMode: args.userId ? "account" : "token",
              isDraft: true,
            }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          // Baseline on what the SERVER actually stored (it may H1-prefix a
          // capture hint), not on what we sent — otherwise the next save's
          // expectedHash mismatches and 409s with a phantom "Document
          // Conflict" on a doc nobody else is editing.
          lastSavedMdRef.current = typeof data.markdown === "string" ? data.markdown : args.markdown;
          if (data.updated_at) lastServerUpdatedAtRef.current = data.updated_at;
          else if (data.created_at) lastServerUpdatedAtRef.current = data.created_at;
          // Mark createDocument too so the realtime guard sees the
          // initial INSERT-as-UPDATE bump and doesn't surface the
          // user's own create as an "external update".
          lastSaveAttemptAtRef.current = Date.now();
          setState({ isSaving: false, lastSaved: new Date(), error: null, conflict: null });
          return {
            id: data.id as string,
            editToken: data.editToken as string,
            deduplicated: !!data.deduplicated,
          };
        } catch {
          setState((s) => ({ ...s, error: "Failed to create document" }));
          return null;
        } finally {
          inflightCreatesRef.current.delete(fingerprint);
        }
      })();
      inflightCreatesRef.current.set(fingerprint, task);
      return task;
    },
    []
  );

  /**
   * Schedule a debounced auto-save for an existing document.
   */
  const scheduleSave = useCallback(
    (args: {
      cloudId: string;
      markdown: string;
      title?: string;
      userId?: string;
      userEmail?: string;
      anonymousId?: string;
      editToken?: string;
      /** Skip the debounce and fire on the next tick. Used by AI
       *  actions (Polish / Auto-Format / chat) where the user just
       *  saw a big edit land and may refresh the page within the
       *  2.5s debounce window, losing the save. */
      immediate?: boolean;
      /** Overwrite the server regardless of divergence — used by the
       *  conflict modal's "Keep mine". Omits expectedHash /
       *  expectedUpdatedAt so the server skips the conflict check. */
      force?: boolean;
    }) => {
      // Never save empty content — protect against content loss
      if (!args.markdown || !args.markdown.trim()) return;
      // Skip if content hasn't changed
      if (args.markdown === lastSavedMdRef.current) return;

      // Clear previous timer
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        if (inflightRef.current) {
          // Save is in flight — queue this one for retry after current completes
          pendingRef.current = args;
          return;
        }
        inflightRef.current = true;
        // Synchronous mark — the realtime channel reads this BEFORE
        // React commits state, so the guard works even when the
        // WebSocket frame for our own save lands ahead of the HTTP
        // response.
        lastSaveAttemptAtRef.current = Date.now();
        setState((s) => ({ ...s, isSaving: true }));
        // Reset the refresh guard at the START of every save attempt.
        // The guard exists to prevent infinite refresh loops within a
        // single save, NOT to permanently disable refresh across saves.
        // The earlier logic only reset it on a non-403 response, which
        // meant: once a single save ended on 403, every subsequent save
        // would skip the refresh+retry step and surface "Session
        // expired" — even if a fresh JWT was readily available. That
        // produced the "I just refreshed and it still says Session
        // expired" loop.
        refreshedThisRoundRef.current = false;

        try {
          const patchBody: Record<string, unknown> = {
            action: "auto-save",
            markdown: args.markdown,
            title: args.title,
            userId: args.userId,
            userEmail: args.userEmail,
            anonymousId: args.anonymousId,
            editToken: args.editToken,
          };
          // Body-based conflict detection (preferred). expectedHash is
          // the hash of the body we believe the server currently holds
          // (= the last body we saved or were seeded with from a load).
          // The server 409s only if its current body hashes differently
          // — a real external edit — so timestamp races stop producing
          // false "Document Conflict" dialogs. We still send
          // expectedUpdatedAt for older server builds / belt-and-braces.
          // force = the conflict modal's "Keep mine": omit both expected
          // fields so the server overwrites without a conflict check.
          if (!args.force) {
            patchBody.expectedHash = contentHash(lastSavedMdRef.current || "");
            if (lastServerUpdatedAtRef.current) {
              patchBody.expectedUpdatedAt = lastServerUpdatedAtRef.current;
            }
          }

          // Attach Authorization header from current Supabase session so the
          // server-side verifyAuthToken() can identify the user even if the
          // page was opened a long time ago.
          // Also pull session.user.{id,email} as a backup identity — the
          // caller passes args.userId/userEmail from React state, but if
          // useAuth happened to be transitioning (e.g. token refresh
          // mid-flight when scheduleSave fired) those args can be
          // undefined. The server's editor-role check relies on email,
          // so a missing email there means a real 403 for an actual
          // editor. Reading the session here gives us a synchronous
          // ground-truth at PATCH time.
          let bearer: string | null = null;
          let sessionUserId: string | undefined;
          let sessionUserEmail: string | undefined;
          try {
            const supabase = getSupabaseBrowserClient();
            if (supabase) {
              const { data } = await supabase.auth.getSession();
              bearer = data?.session?.access_token ?? null;
              sessionUserId = data?.session?.user?.id ?? undefined;
              sessionUserEmail = data?.session?.user?.email ?? undefined;
            }
          } catch { /* ignore */ }
          const effectiveUserId = args.userId || sessionUserId;
          const effectiveUserEmail = args.userEmail || sessionUserEmail;
          // Patch body identity too — the server's auto-save handler
          // reads body.userEmail / body.userId directly (not just the
          // headers), so make sure both surfaces carry the same value.
          if (effectiveUserId) patchBody.userId = effectiveUserId;
          if (effectiveUserEmail) patchBody.userEmail = effectiveUserEmail;

          // Editor-role auto-saves rely on the server resolving the
          // caller's email and matching it against allowed_editors.
          // Previously this PATCH only sent `Authorization: Bearer`
          // — so if the bearer was missing or stale, the server fell
          // back to verified=null with no x-user-* header to read,
          // and isAllowedEditor collapsed to false → 403 on every
          // save (and the auto-recovery retry path also re-fired the
          // same body). Mirror the same identity headers /api/docs
          // expects, so the email/uid fallback works whenever bearer
          // verification fails.
          const doFetch = (token: string | null) => fetch(`/api/docs/${args.cloudId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(effectiveUserId ? { "x-user-id": effectiveUserId } : {}),
              ...(effectiveUserEmail ? { "x-user-email": effectiveUserEmail } : {}),
              ...(args.anonymousId ? { "x-anonymous-id": args.anonymousId } : {}),
            },
            body: JSON.stringify(patchBody),
          });

          let res = await doFetch(bearer);

          // Auto-recover from expired token: if 403 and we haven't already
          // refreshed for this attempt, force a session refresh and retry once.
          if (res.status === 403 && !refreshedThisRoundRef.current) {
            refreshedThisRoundRef.current = true;
            const fresh = await refreshSupabaseSession();
            if (fresh) {
              res = await doFetch(fresh);
            }
          }
          // Reset the refresh guard on any non-403 (success, conflict, other err)
          if (res.status !== 403) refreshedThisRoundRef.current = false;

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            lastSavedMdRef.current = args.markdown;
            if (data.updated_at) {
              lastServerUpdatedAtRef.current = data.updated_at;
            }
            // Refresh the sync timestamp on save completion too so the
            // realtime guard stays warm for the full save round-trip,
            // not just the moment we kicked off.
            lastSaveAttemptAtRef.current = Date.now();
            retryCountRef.current = 0; // Reset on success
            setState({ isSaving: false, lastSaved: new Date(), error: null, conflict: null });
            // Kick off the debounced embedding refresh. Server is the
            // source of truth for "did anything actually change" via
            // embedding_source_hash, so we trigger after every save and
            // let the route decide whether to call OpenAI.
            scheduleEmbed(args.cloudId, bearer ?? undefined);
          } else if (res.status === 409) {
            // Conflict: someone else saved in between
            const conflictData = await res.json().catch(() => ({}));
            setState((s) => ({
              ...s,
              isSaving: false,
              error: null,
              conflict: {
                serverMarkdown: conflictData.serverMarkdown || "",
                serverUpdatedAt: conflictData.serverUpdatedAt || "",
              },
            }));
          } else if (res.status === 403) {
            // 403 has two shapes:
            //   - permission: the doc is read-only for this caller
            //     (not owner, not editor). The editor UI already
            //     shows a "View only" banner above the body, so a
            //     duplicate error in the footer is just noise —
            //     swallow it silently.
            //   - session: bearer token didn't verify. Surface the
            //     "sign in again" hint only when the server didn't
            //     send a permission-specific message.
            const errBody = await res.json().catch(() => ({}));
            const serverMsg = typeof errBody?.error === "string" ? errBody.error : "";
            const looksLikePermission = /owner|edit access|editor|restricted/i.test(serverMsg);
            if (looksLikePermission) {
              setState((s) => ({ ...s, isSaving: false, error: null }));
            } else {
              setState((s) => ({ ...s, isSaving: false, error: "Sign in again to keep editing — your session expired." }));
            }
          } else {
            const err = await res.json().catch(() => ({}));
            setState((s) => ({ ...s, isSaving: false, error: err.error || "Save failed" }));
          }
        } catch {
          // Retry with limit
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++;
            setState((s) => ({ ...s, isSaving: false, error: `Retrying (${retryCountRef.current}/${MAX_RETRIES})...` }));
            pendingRef.current = args;
          } else {
            setState((s) => ({ ...s, isSaving: false, error: "Save failed — check your connection" }));
            retryCountRef.current = 0;
          }
        } finally {
          inflightRef.current = false;
          // Process pending save if any
          const pending = pendingRef.current;
          if (pending && pending.markdown !== lastSavedMdRef.current) {
            pendingRef.current = null;
            scheduleSave(pending);
          }
        }
      }, args.immediate ? 0 : debounceMs);
    },
    [debounceMs]
  );

  /**
   * Cancel any pending auto-save.
   */
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (embedTimerRef.current) {
      clearTimeout(embedTimerRef.current);
      embedTimerRef.current = null;
    }
  }, []);

  /**
   * Force-push: re-save without expectedUpdatedAt (overwrite server).
   */
  const forceSave = useCallback(
    (args: {
      cloudId: string;
      markdown: string;
      title?: string;
      userId?: string;
      userEmail?: string;
      anonymousId?: string;
      editToken?: string;
    }) => {
      // Clear conflict state
      setState((s) => ({ ...s, conflict: null }));
      // Clear the expected timestamp so it sends without conflict check
      lastServerUpdatedAtRef.current = "";
      // Clear lastSavedMd to bypass dedup (content may match the failed save attempt)
      lastSavedMdRef.current = "";
      // force:true makes scheduleSave omit expectedHash too, so the
      // body-based conflict check is skipped and the user's version
      // overwrites the server.
      scheduleSave({ ...args, force: true });
    },
    [scheduleSave]
  );

  /**
   * Dismiss conflict without action (e.g., after pulling server version).
   */
  const dismissConflict = useCallback(() => {
    setState((s) => ({ ...s, conflict: null }));
  }, []);

  /**
   * Update the last known server timestamp (e.g., after pulling).
   */
  const setLastServerUpdatedAt = useCallback((ts: string) => {
    lastServerUpdatedAtRef.current = ts;
  }, []);

  /**
   * Read the last known server timestamp. The "is this an external
   * write?" check (realtime auto-pull, visibility refetch, foreground
   * poll) needs to compare the fetched doc's updated_at against the
   * timestamp WE last wrote / fetched. Without this, the check has
   * to compare markdown bodies, but that requires a separately
   * tracked "last saved body" which the caller doesn't have.
   */
  const getLastServerUpdatedAt = useCallback(() => lastServerUpdatedAtRef.current, []);

  /**
   * Read the last markdown body we successfully persisted to the server.
   * Callers compare this against their live markdownRef to know whether
   * local content has un-saved keystrokes — `isSaving` alone is FALSE
   * for the entire 2.5s debounce window between the last keystroke and
   * the next PATCH, so any background refetch / realtime auto-pull
   * that gates only on `isSaving` ends up clobbering the user's
   * in-flight typing.
   */
  const getLastSavedMarkdown = useCallback(() => lastSavedMdRef.current, []);

  /**
   * Seed the "last known server body" baseline. The editor calls this
   * whenever it applies a body straight from the server (initial tab
   * load, rehydrate, realtime/visibility auto-pull, conflict-resolve
   * "keep theirs"). Without seeding, lastSavedMdRef is "" until the
   * first save, so the body-hash conflict check would send hash("")
   * for a freshly-loaded doc that actually has content on the server
   * and 409 on the very first edit. Setting it to the loaded body
   * makes expectedHash match the server's body, so the first edit
   * saves cleanly. Shares lastSavedMdRef with the dedup logic — both
   * mean "the body we believe the server currently holds."
   */
  const setLastServerBody = useCallback((md: string) => {
    lastSavedMdRef.current = md;
  }, []);

  /**
   * Synchronous "did we save recently?" check. The realtime channel
   * uses this to ignore postgres_changes UPDATE payloads triggered by
   * our own PATCH — see the comment on lastSaveAttemptAtRef for why
   * the older async useEffect mirror of state.lastSaved produced false
   * "updated elsewhere" toasts under WebSocket-before-HTTP-response
   * races.
   */
  const isRecentSave = useCallback((windowMs: number = 5000) => {
    return Date.now() - lastSaveAttemptAtRef.current < windowMs;
  }, []);

  /**
   * Clear the sticky `error` (and any conflict). Used when switching
   * tabs / loading a new doc, since a stale error from a previous
   * tab's failed save shouldn't keep showing in the header on a doc
   * the user is now just opening.
   */
  const clearError = useCallback(() => {
    setState((s) => (s.error == null && s.conflict == null ? s : { ...s, error: null, conflict: null }));
  }, []);

  return {
    ...state,
    createDocument,
    scheduleSave,
    forceSave,
    dismissConflict,
    setLastServerUpdatedAt,
    getLastServerUpdatedAt,
    getLastSavedMarkdown,
    setLastServerBody,
    isRecentSave,
    clearError,
    cancel,
  };
}
