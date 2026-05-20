"use client";

/**
 * Remote-cursor broadcast for collab. Pairs with usePresence:
 *
 *   usePresence       — who is here (durable state on the Realtime
 *                       presence channel)
 *   useCursorPresence — where each "here" person's caret is right
 *                       now (ephemeral broadcast events)
 *
 * The current Y.Doc collab path is markdown-string-based (Y.Text),
 * not y-prosemirror. That means cursor positions can only be sent
 * as `(line, col)` against the shared markdown — not as
 * ProseMirror node positions. Live tab can't render remote cursors
 * cleanly (the Tiptap tree ≠ the markdown string), so this hook is
 * consumed by the Source pane (CM6) only; the Live tab still gets
 * the presence-avatar identity in the header.
 *
 * Channel: `doc-cursor:{cloudId}` (separate from doc-presence to
 * avoid cursor-rate broadcasts crowding out presence sync).
 *
 * Throttled at ~80ms outgoing — fast enough to feel smooth, slow
 * enough to avoid hammering Supabase on every keystroke.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { userColor } from "@/lib/user-color";

export interface RemoteCursor {
  userId: string;
  line: number;     // 0-indexed (CM6 origin); 0 when sender is Tiptap-only
  col: number;      // 0-indexed
  pmPos?: number;   // ProseMirror position — set when sender is in the Live (Tiptap) tab
  name: string;
  color: string;
  updatedAt: number;
}

export interface UseCursorPresenceResult {
  remoteCursors: RemoteCursor[];
  broadcastCursor: (line: number, col: number, pmPos?: number) => void;
}

const BROADCAST_THROTTLE_MS = 80;
// Drop a remote cursor after this many ms of silence — covers
// users that closed the tab without an explicit "leave" event.
const CURSOR_STALENESS_MS = 30_000;

export function useCursorPresence(
  cloudId: string | null | undefined,
  user: { id?: string; email?: string; displayName?: string } | null,
): UseCursorPresenceResult {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null);
  const lastBroadcastAt = useRef(0);
  const pendingBroadcast = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentPos = useRef<{ line: number; col: number; pmPos?: number } | null>(null);
  const cursorsRef = useRef<RemoteCursor[]>([]);

  useEffect(() => {
    if (!cloudId || !user?.id) {
      setRemoteCursors([]);
      cursorsRef.current = [];
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`doc-cursor:${cloudId}`, {
      config: { broadcast: { self: false } },
    });

    const upsertCursor = (c: RemoteCursor) => {
      const next = cursorsRef.current.filter((rc) => rc.userId !== c.userId);
      next.push(c);
      cursorsRef.current = next;
      setRemoteCursors(next);
    };
    const removeCursor = (userId: string) => {
      const next = cursorsRef.current.filter((rc) => rc.userId !== userId);
      cursorsRef.current = next;
      setRemoteCursors(next);
    };

    channel
      .on(
        "broadcast",
        { event: "cursor" },
        ({ payload }: { payload: { userId?: string; line?: number; col?: number; pmPos?: number; name?: string } }) => {
          if (!payload?.userId || payload.userId === user.id) return;
          if (typeof payload.line !== "number" || typeof payload.col !== "number") return;
          upsertCursor({
            userId: payload.userId,
            line: payload.line,
            col: payload.col,
            pmPos: typeof payload.pmPos === "number" ? payload.pmPos : undefined,
            name: payload.name || "",
            color: userColor(payload.userId),
            updatedAt: Date.now(),
          });
        },
      )
      .on(
        "broadcast",
        { event: "cursor-leave" },
        ({ payload }: { payload: { userId?: string } }) => {
          if (payload?.userId) removeCursor(payload.userId);
        },
      )
      .subscribe();
    channelRef.current = channel;

    // Periodic stale-cursor sweep — covers clients that disconnected
    // without sending a leave. Cheap (≤ 8 collaborators realistically).
    const sweep = setInterval(() => {
      const now = Date.now();
      const fresh = cursorsRef.current.filter((c) => now - c.updatedAt < CURSOR_STALENESS_MS);
      if (fresh.length !== cursorsRef.current.length) {
        cursorsRef.current = fresh;
        setRemoteCursors(fresh);
      }
    }, 5000);

    return () => {
      clearInterval(sweep);
      try {
        channel.send({
          type: "broadcast",
          event: "cursor-leave",
          payload: { userId: user.id },
        });
      } catch { /* ignore — channel may already be closed */ }
      supabase.removeChannel(channel);
      channelRef.current = null;
      cursorsRef.current = [];
      setRemoteCursors([]);
    };
  }, [cloudId, user?.id]);

  const broadcastCursor = useCallback((line: number, col: number, pmPos?: number) => {
    if (!user?.id) return;
    const channel = channelRef.current;
    if (!channel) return;
    // Suppress no-op broadcasts (same position re-fires from a
    // re-render or selectionchange noise).
    const last = lastSentPos.current;
    if (last && last.line === line && last.col === col && last.pmPos === pmPos) return;
    const send = () => {
      lastSentPos.current = { line, col, pmPos };
      lastBroadcastAt.current = Date.now();
      try {
        channel.send({
          type: "broadcast",
          event: "cursor",
          payload: {
            userId: user.id,
            line,
            col,
            pmPos,
            name: user.displayName || user.email || "",
          },
        });
      } catch { /* network blip — next move will retry */ }
    };
    const now = Date.now();
    const wait = BROADCAST_THROTTLE_MS - (now - lastBroadcastAt.current);
    if (wait <= 0) {
      if (pendingBroadcast.current) {
        clearTimeout(pendingBroadcast.current);
        pendingBroadcast.current = null;
      }
      send();
    } else {
      if (pendingBroadcast.current) clearTimeout(pendingBroadcast.current);
      pendingBroadcast.current = setTimeout(send, wait);
    }
  }, [user?.id, user?.displayName, user?.email]);

  return { remoteCursors, broadcastCursor };
}
