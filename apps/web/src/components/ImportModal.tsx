"use client";

// One modal, five ingest sources. Replaces the old pattern of five
// separate inline-input prompts that fired from the Library + menu —
// users couldn't see which sources existed without opening the menu,
// each prompt looked different, and the menu itself sprawled.
//
// Now: a single "Import…" entry opens this modal. The user picks a
// source from a card grid, the form fills the body of the modal,
// they submit, the modal closes on success. State is local; the
// parent supplies authHeaders + showToast + a refresh callback.

import { useRef, useState, useCallback } from "react";
import { readSSE } from "@/lib/sse-stream";
import {
  X,
  Globe,
  Upload,
  FileText,
  Loader2,
} from "lucide-react";

// Real brand marks. fill="currentColor" so the icon takes the row's
// ink tint, the rows themselves stay color-free.

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.83-.26.83-.58v-2c-3.33.72-4.03-1.6-4.03-1.6-.55-1.4-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.31 1.23a11.46 11.46 0 0 1 6.02 0c2.3-1.55 3.31-1.23 3.31-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .3" />
    </svg>
  );
}

export type ImportSource = "files" | "github" | "obsidian" | "url" | "notion";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  authHeaders: Record<string, string>;
  /** Toast for success/error notices. Same shape as the editor's
   *  global showToast(message, kind). */
  showToast: (message: string, kind?: "success" | "error" | "info") => void;
  /** Called after any successful import so the parent can refresh
   *  its document list / lint / etc. When a docId is supplied, the
   *  parent should also open that doc as the active tab. */
  onImported?: (docId?: string) => void;
  /** Called when the user picks "Files" + a list of File objects.
   *  Files use the existing importFile() pipeline in the parent —
   *  we just hand the files back. */
  onPickFiles: (files: File[]) => void;
  /** Source pre-selected when the modal opens. Use to deep-link the
   *  modal to a specific tab (e.g. Add → Import GitHub). */
  initialSource?: ImportSource | null;
}

interface SourceCard {
  id: ImportSource;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

// Obsidian — official brand mark (simple-icons.org, CC0). Renders
// as the canonical purple gem outline rather than our prior
// approximation.
function ObsidianIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z" />
    </svg>
  );
}

// Notion — official brand mark (simple-icons.org, CC0). Replaces our
// hand-rolled N glyph with the canonical Notion page mark.
function NotionIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

const SOURCES: SourceCard[] = [
  { id: "files",    label: "Files",            desc: "PDF, DOCX, MD, code, drag in or pick",  icon: <Upload width={18} height={18} strokeWidth={1.5} /> },
  { id: "github",   label: "GitHub",           desc: "Repo, folder, or single .md URL",       icon: <GithubIcon size={18} /> },
  { id: "obsidian", label: "Obsidian vault",   desc: "Drop a .zip of your vault",             icon: <ObsidianIcon size={18} /> },
  { id: "url",      label: "URL",              desc: "Any web page, we extract the article",  icon: <Globe width={18} height={18} strokeWidth={1.5} /> },
  { id: "notion",   label: "Notion",           desc: "Integration token + page URL",          icon: <NotionIcon size={18} /> },
];

export default function ImportModal({
  open,
  onClose,
  authHeaders,
  showToast,
  onImported,
  onPickFiles,
  initialSource = null,
}: ImportModalProps) {
  const [active, setActive] = useState<ImportSource | null>(initialSource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Live progress for streaming imports (currently URL). { label, done, total }
  const [progress, setProgress] = useState<{ label: string; done?: number; total?: number } | null>(null);
  const obsidianRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    if (busy) return;
    setActive(null);
    setError(null);
    setProgress(null);
    onClose();
  }, [busy, onClose]);

  const announce = useCallback((imp?: number, dedup?: number, fail?: number, skip?: number) => {
    const parts = [
      (imp ?? 0) > 0 ? `${imp} imported` : null,
      (dedup ?? 0) > 0 ? `${dedup} already in your hub` : null,
      (skip ?? 0) > 0 ? `${skip} skipped` : null,
      (fail ?? 0) > 0 ? `${fail} failed` : null,
    ].filter(Boolean);
    showToast(parts.length > 0 ? parts.join(" · ") : "Nothing to import", (fail ?? 0) > 0 ? "error" : "success");
  }, [showToast]);

  const submitGithub = useCallback(async (url: string) => {
    if (!url.trim()) { setError("Paste a GitHub URL"); return; }
    setBusy(true); setError(null);
    showToast("Importing from GitHub…", "info");
    try {
      const res = await fetch("/api/import/github", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: url.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || `Import failed (${res.status})`); setBusy(false); return; }
      announce(json.imported, json.deduplicated, json.failed);
      onImported?.();
      close();
    } catch { setError("Import failed"); }
    finally { setBusy(false); }
  }, [authHeaders, announce, onImported, close, showToast]);

  const submitUrl = useCallback(async (url: string) => {
    if (!url.trim()) { setError("Paste a URL"); return; }
    setBusy(true); setError(null);
    setProgress({ label: "Starting…" });
    try {
      const res = await fetch("/api/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ url: url.trim() }),
      });
      // Non-SSE errors (auth, rate-limit, bad body) come back as
      // application/json with the right status; surface those before
      // trying to read SSE.
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.startsWith("text/event-stream")) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || `Import failed (${res.status})`);
        setBusy(false);
        setProgress(null);
        return;
      }

      let importedId: string | undefined;
      let importedTitle = "";
      let deduplicated = false;
      let imagesFound: number | undefined;
      let imagesRehosted: number | undefined;
      let gotError: string | null = null;
      for await (const evt of readSSE(res)) {
        if (evt.event === "stage") {
          const d = evt.data as { label?: string; done?: number; total?: number };
          setProgress({ label: d.label || "Working…", done: d.done, total: d.total });
        } else if (evt.event === "done") {
          const d = evt.data as { id?: string; title?: string; deduplicated?: boolean; imagesFound?: number; imagesRehosted?: number };
          importedId = d.id;
          importedTitle = d.title || "";
          deduplicated = !!d.deduplicated;
          imagesFound = d.imagesFound;
          imagesRehosted = d.imagesRehosted;
        } else if (evt.event === "error") {
          const d = evt.data as { message?: string };
          gotError = d.message || "Import failed";
        }
      }
      if (gotError) {
        setError(gotError);
        setBusy(false);
        setProgress(null);
        return;
      }
      // Build a tidy toast — count + dedupe + image-rehost delta.
      const toastBits: string[] = [];
      if (deduplicated) {
        toastBits.push(`"${importedTitle || "Page"}" already in your hub`);
      } else if (importedId) {
        toastBits.push(`Imported "${importedTitle || "page"}"`);
      }
      if (typeof imagesFound === "number" && typeof imagesRehosted === "number" && imagesFound > imagesRehosted) {
        toastBits.push(`${imagesRehosted}/${imagesFound} images`);
      }
      showToast(toastBits.join(" / ") || "Imported", deduplicated ? "info" : "success");
      onImported?.(importedId);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [authHeaders, onImported, close, showToast]);

  const submitNotion = useCallback(async (token: string, pageUrl: string) => {
    if (!token.trim()) { setError("Paste your integration token"); return; }
    if (!pageUrl.trim()) { setError("Paste a Notion page URL"); return; }
    setBusy(true); setError(null);
    showToast("Importing from Notion…", "info");
    try {
      const res = await fetch("/api/import/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ token: token.trim(), pageUrl: pageUrl.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || `Import failed (${res.status})`); setBusy(false); return; }
      announce(json.imported, json.deduplicated, json.failed);
      onImported?.();
      close();
    } catch { setError("Import failed"); }
    finally { setBusy(false); }
  }, [authHeaders, announce, onImported, close, showToast]);

  const submitObsidianZip = useCallback(async (file: File) => {
    setBusy(true); setError(null);
    showToast(`Importing ${file.name}…`, "info");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/import/obsidian", {
        method: "POST",
        headers: { ...authHeaders },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || `Import failed (${res.status})`); setBusy(false); return; }
      announce(json.imported, json.deduplicated, json.failed, json.skipped);
      onImported?.();
      close();
    } catch { setError("Import failed"); }
    finally { setBusy(false); }
  }, [authHeaders, announce, onImported, close, showToast]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={close}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => { if (!busy) { setActive(null); setError(null); } }}
              className={`text-caption font-mono uppercase tracking-wider ${active ? "hover:text-[var(--text-primary)]" : "cursor-default"}`}
              style={{ color: active ? "var(--text-muted)" : "var(--text-faint)", letterSpacing: 1.5, fontSize: 10 }}
            >
              {active ? "← Import" : "Import to your hub"}
            </button>
            {active && (
              <>
                <span style={{ color: "var(--border)", fontSize: 11 }}>/</span>
                <span className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>
                  {SOURCES.find((s) => s.id === active)?.label}
                </span>
              </>
            )}
          </div>
          <button onClick={close} disabled={busy} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--toggle-bg)] transition-colors disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
            <X width={14} height={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {!active && (
            <>
              <p className="text-caption mb-4" style={{ color: "var(--text-muted)" }}>
                Pull markdown into your hub from anywhere. Every doc lands as a
                draft you can review before publishing.
              </p>
              <div className="grid grid-cols-1 gap-1">
                {SOURCES.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.id === "files") {
                        fileRef.current?.click();
                      } else if (s.id === "obsidian") {
                        obsidianRef.current?.click();
                      } else {
                        setActive(s.id);
                      }
                    }}
                    className="group flex items-center gap-4 px-3 py-3 rounded-lg text-left transition-colors"
                    style={{
                      background: "transparent",
                      border: "1px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      // Quiet ink lift on hover, no coloured glow.
                      (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }}
                  >
                    {/* Faint mono ordinal in fixed slot. Matches the
                        picker pattern established elsewhere in the
                        product — order is for the user, not chrome. */}
                    <span
                      className="font-mono tabular-nums shrink-0"
                      style={{ width: 18, color: "var(--text-faint)", fontSize: 10, letterSpacing: 0.5 }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="shrink-0 flex items-center justify-center rounded-md"
                      style={{
                        width: 28,
                        height: 28,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>{s.label}</div>
                      <div className="text-caption" style={{ color: "var(--text-faint)" }}>{s.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {active === "github" && (
            <SimpleUrlForm
              hint="Repo home, /tree/branch/path, /blob/branch/path, or raw.githubusercontent.com link. Up to 80 .md files, 200 KB each."
              placeholder="https://github.com/owner/repo"
              busy={busy}
              error={error}
              onSubmit={submitGithub}
            />
          )}

          {active === "url" && (
            <SimpleUrlForm
              hint="Any public http(s) page. YouTube URLs auto-extract the transcript. Everything else: memory.wiki strips chrome (nav, footer, ads) and converts the main content."
              placeholder="https://example.com/article  or  https://youtube.com/watch?v=…"
              busy={busy}
              error={error}
              progress={progress}
              onSubmit={submitUrl}
            />
          )}

          {active === "notion" && (
            <NotionForm
              busy={busy}
              error={error}
              onSubmit={submitNotion}
            />
          )}
        </div>
      </div>

      {/* Hidden file inputs — invoked via the source cards */}
      <input
        ref={obsidianRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) submitObsidianZip(file);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.currentTarget.value = "";
          if (files.length === 0) return;
          // Hand off to the parent's import pipeline; close the modal.
          onPickFiles(files);
          close();
        }}
      />
    </div>
  );
}

function SimpleUrlForm({
  hint,
  placeholder,
  busy,
  error,
  progress,
  onSubmit,
}: {
  hint: string;
  placeholder: string;
  busy: boolean;
  error: string | null;
  progress?: { label: string; done?: number; total?: number } | null;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const pct = (progress?.total && progress.total > 0 && typeof progress.done === "number")
    ? Math.round((progress.done / progress.total) * 100)
    : null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(value); }} className="flex flex-col gap-3">
      <p className="text-caption" style={{ color: "var(--text-muted)" }}>{hint}</p>
      <input
        autoFocus
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        className="px-3 py-2.5 rounded-md text-body outline-none transition-colors"
        style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--text-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-dim)")}
      />
      {error && (
        <div className="text-caption px-2 py-1.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}
      {busy && progress && (
        <div
          className="rounded-md px-3 py-2.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
        >
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-caption" style={{ color: "var(--text-primary)" }}>
              {progress.label}
            </span>
            {typeof progress.done === "number" && typeof progress.total === "number" && progress.total > 0 && (
              <span className="text-caption font-mono tabular-nums" style={{ color: "var(--text-faint)" }}>
                {progress.done} / {progress.total}
              </span>
            )}
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: "var(--border-dim)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {pct !== null ? (
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--text-primary)",
                  transition: "width 0.2s ease",
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  height: "100%",
                  width: "30%",
                  background: "var(--text-primary)",
                  borderRadius: 2,
                  animation: "mwBootBar 1.1s ease-in-out infinite",
                }}
              />
            )}
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !value.trim()}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-body font-semibold transition-colors disabled:opacity-40"
        style={{ background: "var(--text-primary)", color: "var(--background)" }}
      >
        {busy ? <Loader2 width={14} height={14} className="animate-spin" /> : null}
        {busy ? "Importing…" : "Import"}
      </button>
    </form>
  );
}

function NotionForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (token: string, pageUrl: string) => void;
}) {
  const [token, setToken] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(token, pageUrl); }} className="flex flex-col gap-3">
      <p className="text-caption" style={{ color: "var(--text-muted)" }}>
        Create an internal integration at{" "}
        <a
          href="https://www.notion.so/profile/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--text-primary)" }}
        >
          notion.so/profile/integrations
        </a>{" "}
        and share the page with it. The token (<code className="font-mono" style={{ fontSize: 11 }}>secret_…</code>) is sent per-import and isn&apos;t stored.
      </p>
      <input
        autoFocus
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxx"
        disabled={busy}
        className="px-3 py-2.5 rounded-md text-body outline-none transition-colors font-mono"
        style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", fontSize: 12 }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--text-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-dim)")}
      />
      <input
        type="url"
        value={pageUrl}
        onChange={(e) => setPageUrl(e.target.value)}
        placeholder="https://www.notion.so/My-Page-..."
        disabled={busy}
        className="px-3 py-2.5 rounded-md text-body outline-none transition-colors"
        style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--text-primary)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-dim)")}
      />
      {error && (
        <div className="text-caption px-2 py-1.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !token.trim() || !pageUrl.trim()}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-body font-semibold transition-colors disabled:opacity-40"
        style={{ background: "var(--text-primary)", color: "var(--background)" }}
      >
        {busy ? <Loader2 width={14} height={14} className="animate-spin" /> : <FileText width={14} height={14} />}
        {busy ? "Importing…" : "Import page"}
      </button>
    </form>
  );
}
