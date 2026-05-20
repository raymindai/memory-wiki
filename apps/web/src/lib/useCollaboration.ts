"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as Y from "yjs";
import { getSupabaseBrowserClient } from "./supabase-browser";

/**
 * Yjs CRDT collaborative editing hook.
 *
 * Architecture:
 *   User A's Editor <-> Y.Doc <-> Supabase Realtime Broadcast <-> Y.Doc <-> User B's Editor
 *
 * - Each editor maintains a Y.Doc for the active document.
 * - Changes are synced via Supabase Realtime Broadcast (not postgres_changes).
 * - Channel name: `yjs-doc-{cloudId}`
 * - Y.Doc updates are sent as binary (Uint8Array -> base64).
 * - No server-side Y.Doc persistence — markdown is saved normally via auto-save.
 */

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function useCollaboration(
  cloudId: string | null,
  markdown: string,
  onRemoteChange: (newMarkdown: string) => void,
) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const isApplyingRemoteRef = useRef(false);
  const [peerCount, setPeerCount] = useState(0);
  const [isCollaborating, setIsCollaborating] = useState(false);

  // Keep latest callback in a ref to avoid re-initializing the channel
  const onRemoteChangeRef = useRef(onRemoteChange);
  onRemoteChangeRef.current = onRemoteChange;

  // Keep latest markdown in a ref for initial Y.Text content
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;

  // Initialize Y.Doc + Supabase Realtime Broadcast channel when cloudId changes
  useEffect(() => {
    if (!cloudId) {
      setIsCollaborating(false);
      setPeerCount(0);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    // Don't insert content yet — wait for sync-response from peers.
    // If no peers respond within a timeout, initialize with local content.
    let initialized = false;
    const initTimer = setTimeout(() => {
      if (!initialized) {
        initialized = true;
        const current = markdownRef.current;
        if (current && ytext.length === 0) {
          ytext.insert(0, current);
        }
      }
    }, 1500);

    // Listen for local Y.Doc updates and broadcast to peers
    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote") return; // Don't re-broadcast remote changes
      const channel = channelRef.current;
      if (channel) {
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: { update: uint8ToBase64(update) },
        });
      }
    });

    // Set up Supabase Realtime Broadcast channel
    const channel = supabase.channel(`yjs-doc-${cloudId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "yjs-update" }, ({ payload }: { payload: { update?: string } }) => {
        if (!payload?.update) return;
        const update = base64ToUint8(payload.update);
        isApplyingRemoteRef.current = true;
        Y.applyUpdate(ydoc, update, "remote");
        const merged = ytext.toString();
        // Protect against blank: only apply if result has content
        if (merged.trim() || markdownRef.current.trim().length === 0) {
          onRemoteChangeRef.current(merged);
        }
        isApplyingRemoteRef.current = false;
      })
      .on("broadcast", { event: "yjs-sync-request" }, () => {
        // Peer just joined — send state if we have content.
        // If not initialized yet but have local markdown, init now and respond
        // (prevents both-users-open-simultaneously leaving both unsynced).
        if (!initialized && markdownRef.current) {
          initialized = true;
          clearTimeout(initTimer);
          if (ytext.length === 0) {
            ytext.insert(0, markdownRef.current);
          }
        }
        if (ytext.length === 0) return;
        const state = Y.encodeStateAsUpdate(ydoc);
        channel.send({
          type: "broadcast",
          event: "yjs-sync-response",
          payload: { state: uint8ToBase64(state) },
        });
      })
      .on("broadcast", { event: "yjs-sync-response" }, ({ payload }: { payload: { state?: string } }) => {
        if (!payload?.state) return;
        const state = base64ToUint8(payload.state);

        // Probe peer payload first — refuse to swap our content for an
        // empty doc (defensive against a peer that mounted with empty
        // markdown and broadcast its blank state).
        const probeDoc = new Y.Doc();
        Y.applyUpdate(probeDoc, state);
        const peerContent = probeDoc.getText("content").toString();
        probeDoc.destroy();
        if (!peerContent.trim()) return;

        isApplyingRemoteRef.current = true;
        if (!initialized) {
          initialized = true;
          clearTimeout(initTimer);
          // If we have local items already (init timer fired before
          // the peer responded), mark them deleted so peerContent is
          // the only visible text. We then applyUpdate the peer state
          // so peer's character ids are imported into OUR Y.Doc —
          // critical for subsequent delta sync, because the deltas
          // are anchored relative to those ids. The previous
          // toString → insert(0, peerContent) variant materialised
          // peer content under OUR clientId, so peer deltas arrived
          // anchored to ids that didn't exist in our structure and
          // were silently buffered (CRDT duplication symptom: peers
          // saw each other's initial state but no live updates).
          if (ytext.length > 0) {
            ydoc.transact(() => { ytext.delete(0, ytext.length); }, "remote");
          }
          Y.applyUpdate(ydoc, state, "remote");
          onRemoteChangeRef.current(ytext.toString());
          isApplyingRemoteRef.current = false;
          return;
        }
        // After initialization, use normal CRDT merge
        Y.applyUpdate(ydoc, state, "remote");
        const merged = ytext.toString();
        if (merged.trim()) { // Only apply non-empty merged content
          onRemoteChangeRef.current(merged);
        }
        isApplyingRemoteRef.current = false;
      })
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState();
        setPeerCount(Math.max(0, Object.keys(presenceState).length - 1));
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          setIsCollaborating(true);
          // Request full state from any existing peers
          channel.send({
            type: "broadcast",
            event: "yjs-sync-request",
            payload: {},
          });
          // Track presence so peers can count us
          await channel.track({ joined_at: Date.now() });
        }
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(initTimer);
      channel.unsubscribe();
      ydoc.destroy();
      ydocRef.current = null;
      ytextRef.current = null;
      channelRef.current = null;
      setIsCollaborating(false);
      setPeerCount(0);
    };
  }, [cloudId]); // Intentionally exclude markdown/onRemoteChange to avoid re-init

  /**
   * Call this when the local editor content changes (user typing).
   * Computes a Y.Doc transaction and broadcasts the update to peers.
   */
  const applyLocalChange = useCallback((newMarkdown: string) => {
    if (isApplyingRemoteRef.current) return;
    const ytext = ytextRef.current;
    const ydoc = ydocRef.current;
    if (!ytext || !ydoc) return;

    const currentYText = ytext.toString();
    if (currentYText === newMarkdown) return;

    // Apply minimal diff to Y.Text (avoid delete-all + insert-all which causes CRDT duplication)
    ydoc.transact(() => {
      // Find common prefix
      let prefixLen = 0;
      const minLen = Math.min(currentYText.length, newMarkdown.length);
      while (prefixLen < minLen && currentYText[prefixLen] === newMarkdown[prefixLen]) {
        prefixLen++;
      }
      // Find common suffix (from the end, not overlapping with prefix)
      let suffixLen = 0;
      const maxSuffix = Math.min(currentYText.length - prefixLen, newMarkdown.length - prefixLen);
      while (suffixLen < maxSuffix && currentYText[currentYText.length - 1 - suffixLen] === newMarkdown[newMarkdown.length - 1 - suffixLen]) {
        suffixLen++;
      }
      // Delete changed middle, insert new middle
      const deleteLen = currentYText.length - prefixLen - suffixLen;
      const insertStr = newMarkdown.slice(prefixLen, newMarkdown.length - suffixLen);
      if (deleteLen > 0) ytext.delete(prefixLen, deleteLen);
      if (insertStr.length > 0) ytext.insert(prefixLen, insertStr);
    });
  }, []);

  // Force reset Y.Doc (use after version restore to prevent CRDT merge reverting)
  const forceReset = useCallback((newMarkdown: string) => {
    const ytext = ytextRef.current;
    const ydoc = ydocRef.current;
    if (!ytext || !ydoc) return;
    ydoc.transact(() => {
      if (ytext.length > 0) ytext.delete(0, ytext.length);
      ytext.insert(0, newMarkdown);
    });
  }, []);

  return { applyLocalChange, forceReset, peerCount, isCollaborating };
}
