"use client";

// /library — standalone image library.
//
// Used by the chrome extension's 'Saved to library → Open library' toast
// so users can land directly on their saved images without first having
// to open a document. The MdEditor sidebar version stays — same data,
// different surface.
//
// Pure design tokens, dark-first. Fetches /api/upload/list and renders
// the same 1:1 grid the editor sidebar uses.

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Img = { name: string; url: string; size: number; createdAt: string };
type Quota = { used: number; total: number };

export default function ImageLibraryPage() {
  const [status, setStatus] = useState<"loading" | "signed-out" | "ready" | "error">("loading");
  const [images, setImages] = useState<Img[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();

  const load = useCallback(async () => {
    if (!supabase) { setStatus("error"); return; }
    const { data: { session } } = await supabase.auth.getSession() as {
      data: { session: { access_token: string } | null };
    };
    if (!session?.access_token) { setStatus("signed-out"); return; }
    try {
      const res = await fetch("/api/upload/list", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 401) { setStatus("signed-out"); return; }
      if (!res.ok) { setStatus("error"); return; }
      const data = await res.json();
      setImages(Array.isArray(data.images) ? data.images : []);
      if (data.quota) setQuota(data.quota);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  async function onDelete(name: string) {
    if (!confirm("Delete this image?")) return;
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession() as {
      data: { session: { access_token: string } | null };
    };
    if (!session?.access_token) return;
    try {
      const res = await fetch(`/api/upload/delete?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        setImages((prev) => prev.filter((i) => i.name !== name));
        const data = await res.json();
        if (data.quota) setQuota(data.quota);
      }
    } catch { /* noop */ }
  }

  function onCopyUrl(name: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedName(name);
    setTimeout(() => setCopiedName((n) => (n === name ? null : n)), 1500);
  }

  function onCopyMd(name: string, url: string) {
    const alt = name.replace(/\.\w+$/, "");
    navigator.clipboard.writeText(`![${alt}](${url})`);
    setCopiedName(name + ":md");
    setTimeout(() => setCopiedName((n) => (n === name + ":md" ? null : n)), 1500);
  }

  function formatMb(b: number) {
    return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ background: "var(--canvas)", borderBottom: "1px solid var(--border-dim)" }}
      >
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80" style={{ textDecoration: "none", color: "var(--text-primary)" }}>
          <MemoryWikiLogo size={20} withBlob />
          <span style={{ fontSize: 14, fontWeight: 500 }}>memory.wiki</span>
        </Link>
        <div className="flex items-center gap-4">
          {quota && (
            <span className="font-mono" style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: "0.04em" }}>
              {formatMb(quota.used)} / {formatMb(quota.total)}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, letterSpacing: 0 }}>
            Image library
          </h1>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {status === "ready" ? `${images.length} image${images.length === 1 ? "" : "s"}` : ""}
          </span>
        </div>

        {/* Quota bar */}
        {quota && status === "ready" && (
          <div className="mb-8">
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--toggle-bg)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (quota.used / quota.total) * 100)}%`,
                  background: quota.used / quota.total > 0.9 ? "#ef4444" : "var(--text-primary)",
                }}
              />
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="text-center py-20" style={{ color: "var(--text-faint)" }}>
            <p style={{ fontSize: 13 }}>Loading…</p>
          </div>
        )}

        {status === "signed-out" && (
          <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>
            <p style={{ fontSize: 14, marginBottom: 16 }}>Sign in to see your saved images.</p>
            <Link
              href="/"
              className="inline-flex items-center transition-opacity hover:opacity-90"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "var(--text-primary)",
                color: "var(--background)",
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-20" style={{ color: "var(--text-faint)" }}>
            <p style={{ fontSize: 13 }}>Could not load images. Try refreshing.</p>
          </div>
        )}

        {status === "ready" && images.length === 0 && (
          <div className="text-center py-20" style={{ color: "var(--text-faint)" }}>
            <p style={{ fontSize: 14, marginBottom: 8, color: "var(--text-secondary)" }}>No images yet.</p>
            <p style={{ fontSize: 12 }}>
              Hover any image on the web with the Chrome extension installed, click the + button.
            </p>
          </div>
        )}

        {status === "ready" && images.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
          >
            {images.map((img) => (
              <div
                key={img.name}
                className="group relative rounded-lg overflow-hidden flex flex-col"
                style={{
                  border: "1px solid var(--border-dim)",
                  background: "var(--background)",
                }}
                title={img.name}
              >
                <div
                  className="cursor-pointer relative"
                  style={{ aspectRatio: "1 / 1", background: "var(--background)" }}
                  onClick={() => setLightbox(img.url)}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.18)" }}
                  >
                    <span
                      className="font-mono"
                      style={{ color: "rgba(255,255,255,0.9)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}
                    >
                      preview
                    </span>
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 px-1.5 py-1.5 mt-auto"
                  style={{ borderTop: "1px solid var(--border-dim)" }}
                >
                  <button
                    onClick={() => onCopyMd(img.name, img.url)}
                    className="flex-1 py-1 rounded-md transition-colors"
                    style={{
                      background: "transparent",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-dim)",
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--menu-hover)";
                      e.currentTarget.style.color = "var(--text-primary)";
                      e.currentTarget.style.borderColor = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.borderColor = "var(--border-dim)";
                    }}
                    title="Copy markdown ![alt](url)"
                  >
                    {copiedName === img.name + ":md" ? "Copied" : "Copy MD"}
                  </button>
                  <button
                    onClick={() => onCopyUrl(img.name, img.url)}
                    className="flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-[var(--menu-hover)]"
                    style={{ color: "var(--text-muted)" }}
                    title="Copy URL"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(img.name)}
                    className="flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444]"
                    style={{ color: "var(--text-faint)" }}
                    title="Delete"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-[92vw] max-h-[92vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
