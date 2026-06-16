"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";

// Detects when this tab is running a STALE client bundle (a newer
// deployment is live) and offers a one-tap reload that also clears the
// service-worker caches so the new chunks actually load.
//
// Why this exists: client-side fixes ship inside the JS bundle, but a tab
// left open across deploys keeps running the bundle it first loaded — so
// "fixed" bugs reappear until a hard refresh (this cost hours of phantom
// "Document Conflict" debugging — see memory conflict_baseline_invariant).
// The SW makes it worse: /_next/static/* is cache-first, so a plain reload
// can still serve stale chunks. Hence: clear caches, THEN reload.
//
// Baked id (NEXT_PUBLIC_BUILD_ID, set at build time in next.config.ts)
// vs the live deployment id from /api/version. Off Vercel both are "dev"
// → the watcher is a no-op.

const LOADED = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
const POLL_MS = 3 * 60_000; // background poll cadence
const MIN_GAP_MS = 30_000; // floor between checks (visibility/focus can fire often)

export default function VersionWatcher() {
  const [staleSha, setStaleSha] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const dismissedRef = useRef<string | null>(null);
  const lastCheckRef = useRef(0);
  const busyRef = useRef(false);

  const check = useCallback(async () => {
    if (LOADED === "dev" || busyRef.current) return;
    const now = Date.now();
    if (now - lastCheckRef.current < MIN_GAP_MS) return;
    lastCheckRef.current = now;
    busyRef.current = true;
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { sha?: unknown };
      const server = typeof data.sha === "string" ? data.sha : "";
      if (!server || server === "dev") return;
      if (server !== LOADED && server !== dismissedRef.current) {
        setStaleSha(server);
      }
    } catch {
      // offline / transient — ignore, retry on the next tick
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (LOADED === "dev" || typeof window === "undefined") return;
    // Never nag inside an embed/iframe.
    try {
      if (window.top !== window.self) return;
    } catch {
      return;
    }
    const first = window.setTimeout(check, 8000); // let the app settle first
    const iv = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  const reloadFresh = useCallback(async () => {
    setReloading(true);
    // Clear SW caches first so cache-first /_next/static/* refetches the
    // new chunks, then pull any updated SW, then reload.
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* best effort */
    }
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
    } catch {
      /* best effort */
    }
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = staleSha;
    setStaleSha(null);
  }, [staleSha]);

  if (!staleSha) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 9990,
        maxWidth: "calc(100vw - 24px)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "9px 10px 9px 14px",
        borderRadius: "14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
        color: "var(--text-primary)",
        fontSize: "13px",
        lineHeight: 1.3,
      }}
    >
      <RefreshCw size={15} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} aria-hidden />
      <span style={{ whiteSpace: "nowrap" }}>A new version is available.</span>
      <button
        type="button"
        onClick={reloadFresh}
        disabled={reloading}
        style={{
          flexShrink: 0,
          padding: "5px 12px",
          borderRadius: "9px",
          border: "none",
          background: "var(--text-primary)",
          color: "var(--bg-base)",
          fontSize: "13px",
          fontWeight: 600,
          cursor: reloading ? "default" : "pointer",
          opacity: reloading ? 0.6 : 1,
        }}
      >
        {reloading ? "Reloading" : "Reload"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          borderRadius: "8px",
          border: "none",
          background: "transparent",
          color: "var(--text-tertiary)",
          cursor: "pointer",
        }}
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
