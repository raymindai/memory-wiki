"use client";

import { useState, useEffect, useCallback } from "react";
import { File as FileIcon, ArrowUpRight } from "lucide-react";
import ViewerHeader from "@/components/ViewerHeader";
import ViewerFooter from "@/components/ViewerFooter";

// Discover / Trending — public-facing landing showing GitHub trending
// repos' .md files routed through Memory.Wiki. Pure design pass:
// canvas bg, Cal Sans hero, JetBrains Mono labels with Title Case,
// soft segmented chip toggle, micro-color (info/lime) instead of
// `var(--accent)` for emphasis.

interface TrendingRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  language: string;
  url: string;
  readmeUrl: string;
}

interface RepoFiles {
  [repo: string]: { files: string[]; loading: boolean };
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Rust: "#dea584",
  Go: "#00ADD8", Java: "#b07219", "C++": "#f34b7d", C: "#555555", Swift: "#F05138",
  Kotlin: "#A97BFF", Ruby: "#701516", PHP: "#4F5D95", Shell: "#89e051", Dart: "#00B4AB",
  Zig: "#ec915c", Lua: "#000080", Elixir: "#6e4a7e", Haskell: "#5e5086",
};

function formatStars(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default function DiscoverPage() {
  const [repos, setRepos] = useState<TrendingRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [repoFiles, setRepoFiles] = useState<RepoFiles>({});

  useEffect(() => {
    const saved = localStorage.getItem("mw-theme") as "dark" | "light" | null;
    const t = saved || "dark";
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/discover?period=${period}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.repos) setRepos(data.repos);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  const toggleRepo = useCallback(async (repoName: string) => {
    if (expandedRepo === repoName) { setExpandedRepo(null); return; }
    setExpandedRepo(repoName);
    if (!repoFiles[repoName]) {
      setRepoFiles(prev => ({ ...prev, [repoName]: { files: [], loading: true } }));
      try {
        const res = await fetch(`/api/discover/files?repo=${encodeURIComponent(repoName)}`);
        const data = res.ok ? await res.json() : { files: [] };
        setRepoFiles(prev => ({ ...prev, [repoName]: { files: data.files || [], loading: false } }));
      } catch {
        setRepoFiles(prev => ({ ...prev, [repoName]: { files: [], loading: false } }));
      }
    }
  }, [expandedRepo, repoFiles]);

  const compress = useCallback(async (text: string): Promise<string> => {
    const input = new TextEncoder().encode(text);
    const cs = new CompressionStream("gzip");
    const writer = cs.writable.getWriter();
    writer.write(input); writer.close();
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
    const merged = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
    let off = 0; for (const c of chunks) { merged.set(c, off); off += c.length; }
    let bin = ""; for (let i = 0; i < merged.length; i++) bin += String.fromCharCode(merged[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }, []);

  const openFile = useCallback(async (repoFullName: string, filePath: string) => {
    const key = `${repoFullName}/${filePath}`;
    setOpeningId(key);
    try {
      let markdown = "";
      for (const branch of ["main", "master"]) {
        const res = await fetch(`https://raw.githubusercontent.com/${repoFullName}/${branch}/${filePath}`);
        if (res.ok) { markdown = await res.text(); break; }
      }
      if (!markdown.trim()) throw new Error("Empty");
      if (!/^#\s+/m.test(markdown)) {
        const title = filePath.split("/").pop()?.replace(/\.(md|markdown|mdx)$/i, "") || "Untitled";
        markdown = `# ${title}\n\n${markdown}`;
      }
      markdown = markdown.trimEnd() + `\n\n---\n\n> Source: [${repoFullName}/${filePath}](https://github.com/${repoFullName}/blob/main/${filePath})\n`;
      const compressed = await compress(markdown);
      const url = `/#md=${compressed}`;
      if (url.length <= 8000) {
        window.open(url, "_blank");
      } else {
        // Markdown too big to round-trip through the URL hash —
        // fall back to opening the raw file on GitHub instead of
        // silently routing to an empty `/` which used to look like
        // "the button did nothing".
        window.open(`https://github.com/${repoFullName}/blob/main/${filePath}`, "_blank");
      }
    } catch {
      window.open(`https://github.com/${repoFullName}/blob/main/${filePath}`, "_blank");
    }
    setTimeout(() => setOpeningId(null), 2000);
  }, [compress]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
      <ViewerHeader title="Trending" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 sm:py-16">
        {/* Hero */}
        <div
          className="font-mono mb-3"
          style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Trending public docs
        </div>
        <h1
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 500,
            letterSpacing: 0,
            lineHeight: 1.15,
            margin: "0 0 16px",
            maxWidth: 600,
          }}
        >
          Trending project docs, beautifully rendered.
        </h1>
        <p
          className="mb-8"
          style={{ color: "var(--text-secondary)", fontSize: 15, lineHeight: 1.6, maxWidth: 560 }}
        >
          Explore documentation from the hottest GitHub projects. Every <code className="font-mono" style={{ color: "var(--text-primary)" }}>.md</code> file rendered with Memory.Wiki.
        </p>

        {/* Period segmented chip */}
        <div
          className="inline-flex p-0.5 rounded-md mb-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          role="tablist"
          aria-label="Trending window"
        >
          {(["daily", "weekly"] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded transition-colors inline-flex items-center gap-1.5"
                style={{
                  background: active ? "var(--toggle-bg)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden
                  style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "var(--micro-lime)" : "var(--border)" }}
                />
                {p === "daily" ? "Today" : "This week"}
              </button>
            );
          })}
        </div>

        {/* Repo list */}
        {loading ? (
          <div className="py-16 text-center">
            <div
              className="mx-auto mb-3"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "2px solid var(--border)",
                borderTopColor: "var(--text-primary)",
                animation: "mw-spin 0.9s linear infinite",
              }}
            />
            <p className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>
              Fetching trending repos…
            </p>
          </div>
        ) : repos.length === 0 ? (
          <div className="py-16 text-center">
            <p style={{ color: "var(--text-faint)", fontSize: 14 }}>No trending repos found. Try again later.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {repos.map((repo, i) => {
              const isExpanded = expandedRepo === repo.fullName;
              return (
                <li key={repo.fullName}>
                  <div
                    className="rounded-md overflow-hidden"
                    style={{ border: "1px solid var(--border-dim)" }}
                  >
                    {/* Repo row */}
                    <button
                      onClick={() => toggleRepo(repo.fullName)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--toggle-bg)]"
                    >
                      <span
                        className="font-mono shrink-0 text-right"
                        style={{
                          width: 24,
                          color: i < 3 ? "var(--micro-info)" : "var(--text-faint)",
                          fontSize: 12,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        aria-hidden
                        style={{
                          fontSize: 9,
                          color: "var(--text-faint)",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.15s",
                          flexShrink: 0,
                          display: "inline-block",
                          width: 8,
                        }}
                      >
                        ▶
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{repo.name}</span>
                          <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{repo.fullName.split("/")[0]}</span>
                        </div>
                        {repo.description && (
                          <p
                            className="truncate"
                            style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.45, margin: "2px 0 0" }}
                          >
                            {repo.description}
                          </p>
                        )}
                      </div>
                      <span
                        className="hidden sm:inline-flex items-center gap-1.5 shrink-0"
                        style={{ color: "var(--text-faint)", fontSize: 11 }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: LANG_COLORS[repo.language] || "var(--border)" }} />
                        {repo.language}
                      </span>
                      <span
                        className="font-mono shrink-0"
                        style={{ color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.04em" }}
                      >
                        ★ {formatStars(repo.stars)}
                      </span>
                    </button>

                    {/* Expanded files */}
                    {isExpanded && (
                      <div className="px-3 pb-3" style={{ paddingLeft: 56 }}>
                        {repoFiles[repo.fullName]?.loading ? (
                          <p className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", margin: "6px 0" }}>
                            Loading files…
                          </p>
                        ) : (repoFiles[repo.fullName]?.files || []).length === 0 ? (
                          <p className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", margin: "6px 0" }}>
                            No .md files found
                          </p>
                        ) : (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {(repoFiles[repo.fullName]?.files || []).map((file) => {
                              const key = `${repo.fullName}/${file}`;
                              const isOpening = openingId === key;
                              return (
                                <button
                                  key={file}
                                  onClick={(e) => { e.stopPropagation(); openFile(repo.fullName, file); }}
                                  className="text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                                >
                                  <FileIcon width={11} height={11} style={{ color: "var(--text-faint)" }} aria-hidden />
                                  <span
                                    className="flex-1 truncate font-mono"
                                    style={{ color: "var(--text-secondary)", fontSize: 12 }}
                                  >
                                    {file}
                                  </span>
                                  <span
                                    className="font-mono"
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      background: isOpening ? "rgba(181,255,26,0.12)" : "var(--toggle-bg)",
                                      color: isOpening ? "var(--micro-lime)" : "var(--text-muted)",
                                      fontSize: 10,
                                      letterSpacing: "0.04em",
                                    }}
                                  >
                                    {isOpening ? "Opening…" : "Open in Memory.Wiki"}
                                  </span>
                                </button>
                              );
                            })}
                            <a
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 mt-1 transition-colors hover:underline"
                              style={{ color: "var(--text-muted)", fontSize: 11 }}
                            >
                              View on GitHub
                              <ArrowUpRight width={11} height={11} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footnote */}
        <p
          className="mt-10 font-mono"
          style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.6 }}
        >
          Data from the GitHub API. Click any repo to browse its .md files.
          <br />
          <a
            href="https://github.com/trending"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            See full GitHub Trending
            <ArrowUpRight width={11} height={11} />
          </a>
        </p>
      </main>

      <ViewerFooter />
    </div>
  );
}
