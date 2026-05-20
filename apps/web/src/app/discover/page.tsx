"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { File as FileIcon } from "lucide-react";
import { DocsNav, SiteFooter } from "@/components/docs";

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
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("mw-theme") as "dark" | "light" | null;
    const t = saved || "dark";
    setTheme(t);
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
    // eslint-disable-next-line no-constant-condition
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
      // Add title from filename if markdown has no H1
      if (!/^#\s+/m.test(markdown)) {
        const title = filePath.split("/").pop()?.replace(/\.(md|markdown|mdx)$/i, "") || "Untitled";
        markdown = `# ${title}\n\n${markdown}`;
      }
      // Add source attribution
      markdown = markdown.trimEnd() + `\n\n---\n\n> Source: [${repoFullName}/${filePath}](https://github.com/${repoFullName}/blob/main/${filePath})\n`;
      const compressed = await compress(markdown);
      const url = `/#md=${compressed}`;
      window.open(url.length <= 8000 ? url : "/", "_blank");
    } catch {
      window.open(`https://github.com/${repoFullName}/blob/main/${filePath}`, "_blank");
    }
    setTimeout(() => setOpeningId(null), 2000);
  }, [compress]);

  return (
    <div style={{ background: "var(--background)", color: "var(--foreground)", minHeight: "100vh" }}>
      <DocsNav />

      {/* Hero */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 40px" }}>
        <p style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16, fontFamily: "var(--font-geist-mono), monospace" }}>
          Discover Trending Projects
        </p>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)", maxWidth: 600, margin: "0 0 16px" }}>
          Trending Project Docs,<br />
          <span style={{ color: "var(--accent)" }}>beautifully rendered.</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-tertiary)", maxWidth: 500, lineHeight: 1.7 }}>
          Explore documentation from the hottest GitHub projects. Every .md file rendered with Memory.Wiki.
        </p>
      </div>

      {/* Period tabs */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 24px" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--toggle-bg)", borderRadius: 8, padding: 3, width: "fit-content" }}>
          {(["daily", "weekly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                background: period === p ? "var(--accent-dim)" : "transparent",
                color: period === p ? "var(--accent)" : "var(--text-muted)",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {p === "daily" ? "Today" : "This Week"}
            </button>
          ))}
        </div>
      </div>

      {/* Repo list */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Fetching trending repos...</p>
          </div>
        ) : repos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontSize: 15, color: "var(--text-faint)" }}>No trending repos found. Try again later.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border-dim)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-dim)" }}>
            {repos.map((repo, i) => (
              <div key={repo.fullName} style={{ background: "var(--surface)" }}>
                {/* Repo row */}
                <div
                  style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "background 0.1s" }}
                  onClick={() => toggleRepo(repo.fullName)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--menu-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: i < 3 ? "var(--accent)" : "var(--text-faint)", fontFamily: "var(--font-geist-mono), monospace", width: 28, textAlign: "right", flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", transform: expandedRepo === repo.fullName ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>▶</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: repo.description ? 3 : 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{repo.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{repo.fullName.split("/")[0]}</span>
                    </div>
                    {repo.description && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{repo.description}</p>
                    )}
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: LANG_COLORS[repo.language] || "#666" }} />
                    <span className="hidden sm:inline">{repo.language}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", fontFamily: "var(--font-geist-mono), monospace", flexShrink: 0 }}>
                    ★ {formatStars(repo.stars)}
                  </span>
                </div>
                {/* Expanded file list */}
                {expandedRepo === repo.fullName && (
                  <div style={{ padding: "0 20px 12px 68px" }}>
                    {repoFiles[repo.fullName]?.loading ? (
                      <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "4px 0" }}>Loading files...</p>
                    ) : (repoFiles[repo.fullName]?.files || []).length === 0 ? (
                      <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "4px 0" }}>No .md files found</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {(repoFiles[repo.fullName]?.files || []).map((file) => {
                          const key = `${repo.fullName}/${file}`;
                          const isOpening = openingId === key;
                          return (
                            <div
                              key={file}
                              onClick={(e) => { e.stopPropagation(); openFile(repo.fullName, file); }}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, cursor: "pointer", transition: "background 0.1s", fontSize: 12 }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--toggle-bg)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <FileIcon width={11} height={11} style={{ color: "var(--text-faint)" }} aria-hidden />
                              <span style={{ flex: 1, color: "var(--text-secondary)", fontFamily: "var(--font-geist-mono), monospace", fontSize: 12 }}>{file}</span>
                              <span style={{
                                padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                                background: isOpening ? "rgba(74,222,128,0.15)" : "var(--accent-dim)",
                                color: isOpening ? "#4ade80" : "var(--accent)",
                              }}>
                                {isOpening ? "Opening..." : "Memory.Wiki"}
                              </span>
                            </div>
                          );
                        })}
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 10, color: "var(--text-faint)", padding: "4px 10px", textDecoration: "none" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on GitHub →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <p style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: 24, lineHeight: 1.6 }}>
          Data from GitHub API. Click any repo to browse its .md files and open them in Memory.Wiki.
          <br />
          <a href="https://github.com/trending" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>See full GitHub Trending →</a>
        </p>
      </div>

      <SiteFooter />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
