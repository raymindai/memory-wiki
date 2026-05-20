/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { File as FileIcon, Sparkles, BookOpen, Tag, Box, Hash, ArrowRight, ArrowLeftRight, AlertTriangle } from "lucide-react";
import MdfyLogo from "@/components/MdfyLogo";
import ViewerFooter from "@/components/ViewerFooter";
import ViewerPromoStrip from "@/components/ViewerPromoStrip";
import ViewerHeader from "@/components/ViewerHeader";
import { render } from "@/lib/render";

const BundleCanvas = dynamic(() => import("@/components/BundleCanvas"), { ssr: false });

type Theme = "dark" | "light";

// Tiny placeholder used inside each analysis tab when its data slot is
// empty. Keeps the panel from collapsing height when the user clicks a
// tab that the model didn't fill out.
function EmptyTab({ label }: { label: string }) {
  return (
    <p className="text-caption text-center py-8" style={{ color: "var(--text-faint)" }}>
      {label}
    </p>
  );
}

interface BundleDocument {
  id: string;
  title: string | null;
  markdown: string;
  created_at: string;
  updated_at: string;
  /** Per-doc annotation set on bundle_documents — surfaces here as a
   *  read-only "✨ note" under the doc title in the side panel. Owners
   *  edit it from the sidebar list view; viewers only read. */
  annotation?: string | null;
}

export default function BundleViewer({
  id,
  title: initialTitle,
  description,
  isProtected = false,
  documentCount,
  showBadge = true,
}: {
  id: string;
  title: string | null;
  description?: string | null;
  isProtected?: boolean;
  isDraft?: boolean;
  documentCount: number;
  showBadge?: boolean;
  layout?: string;
}) {
  const [documents, setDocuments] = useState<BundleDocument[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiGraph, setAiGraph] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedHtml, setSelectedHtml] = useState("");
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<{
    type: string;
    label: string;
    weight?: number;
    description?: string;
    summary?: string;
    themes?: string[];
    insights?: string[];
    readingOrder?: string[];
    readingOrderReason?: string;
    keyTakeaways?: string[];
    gaps?: string[];
    connections?: Array<{ doc1: string; doc2: string; relationship: string }>;
    documentSummary?: string;
    connectedDocs?: Array<{ id: string; title: string }>;
    relationships?: Array<{ label: string; target: string }>;
    docStats?: { wordCount: number; readingTime: number; sections: number; hasCode: boolean };
  } | null>(null);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [isLoading, setIsLoading] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [unlocked, setUnlocked] = useState(!isProtected);
  const [copied, setCopied] = useState(false);
  const [canvasHoveredNode, setCanvasHoveredNode] = useState<string | null>(null);
  const [contextCopied, setContextCopied] = useState(false);
  // Analysis side-panel tab state. Reset whenever the user picks a new
  // analysis node so the new node opens on its first non-empty tab.
  const [analysisTab, setAnalysisTab] = useState<"summary" | "insights" | "reading" | "links">("summary");
  const previewRef = useRef<HTMLDivElement>(null);

  // Whenever a new analysis node is opened, jump to the first tab that
  // actually has content. Avoids landing on an empty Reading tab when
  // the model didn't return one, etc.
  useEffect(() => {
    if (selectedNodeInfo?.type !== "analysis") return;
    const counts = {
      summary: (selectedNodeInfo.summary ? 1 : 0) + (selectedNodeInfo.keyTakeaways?.length || 0),
      insights: (selectedNodeInfo.insights?.length || 0) + (selectedNodeInfo.themes?.length || 0),
      reading: selectedNodeInfo.readingOrder?.length || 0,
      links: (selectedNodeInfo.connections?.length || 0) + (selectedNodeInfo.gaps?.length || 0),
    } as const;
    const first = (Object.entries(counts) as [keyof typeof counts, number][])
      .find(([, n]) => n > 0)?.[0];
    if (first) setAnalysisTab(first);
  }, [selectedNodeInfo]);

  // Owner-aware redirect: if the signed-in user owns this bundle, send
  // them to the main editor with ?bundle=<id> so the bundle opens as an
  // editable tab. Mirrors the per-document behavior in /d/[id].
  useEffect(() => {
    (async () => {
      try {
        const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        const supabase = getSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const res = await fetch(`/api/bundles/${id}`, {
          headers: { "x-user-id": user.id, "x-user-email": user.email || "" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.isOwner) {
          window.location.replace(`/?bundle=${id}`);
        }
      } catch { /* not signed in or bundle not accessible — stay on viewer */ }
    })();
  }, [id]);

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem("mdfy-theme");
    if (saved === "dark" || saved === "light") {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("mdfy-theme", next);
  };

  // Fetch bundle data
  useEffect(() => {
    if (!unlocked) return;

    (async () => {
      try {
        const headers: Record<string, string> = {};

        // Build headers from localStorage (non-blocking)
        const anonId = localStorage.getItem("mdfy-anonymous-id");
        if (anonId) headers["x-anonymous-id"] = anonId;
        const storedUserId = localStorage.getItem("mdfy-user-id");
        if (storedUserId) headers["x-user-id"] = storedUserId;
        const storedEmail = localStorage.getItem("mdfy-user-email");
        if (storedEmail) headers["x-user-email"] = storedEmail;

        const res = await fetch(`/api/bundles/${id}`, { headers });
        if (!res.ok) {
          if (res.status === 401) {
            const data = await res.json();
            if (data.passwordRequired) {
              setUnlocked(false);
              setIsLoading(false);
              return;
            }
          }
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        const docs = data.documents || [];
        setDocuments(docs);
        if (data.editToken) setEditToken(data.editToken);

        // Use cached AI graph if available
        if (data.graph_data) {
          setAiGraph(data.graph_data);
        }

        // Auto-open first document
        if (docs.length > 0) {
          const first = docs[0];
          setSelectedDocId(first.id);
          try {
            const result = render(first.markdown);
            setSelectedHtml(result.html);
          } catch { /* render error */ }
        }
        setIsLoading(false);

        // Trigger AI analysis if no cached graph
        if (!data.graph_data && docs.length >= 2) {
          setIsAnalyzing(true);
          try {
            const graphRes = await fetch(`/api/bundles/${id}/graph`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({ editToken: data.editToken }),
            });
            if (graphRes.ok) {
              const graphData = await graphRes.json();
              setAiGraph(graphData.graphData);
            }
          } catch { /* AI not available */ }
          setIsAnalyzing(false);
        }
      } catch {
        setIsLoading(false);
      }
    })();
  }, [id, unlocked]);

  // Password unlock
  const handlePasswordSubmit = async () => {
    try {
      const res = await fetch(`/api/bundles/${id}`, {
        headers: { "x-document-password": passwordInput },
      });
      if (res.ok) {
        setUnlocked(true);
        setIsLoading(true);
        setPasswordError(false);
      } else {
        setPasswordError(true);
      }
    } catch {
      setPasswordError(true);
    }
  };

  // Copy as Context — fetch the Bundle Spec v1.0 conformant payload from
  // /raw/bundle/[id] so the user pastes the same structured markdown that
  // AI fetchers receive when they hit the bundle URL directly. Includes
  // frontmatter (mdfy_bundle: 1, id, title, url, document_count, updated)
  // + per-doc URLs + annotations. Falls back to a local concat if the
  // raw endpoint isn't reachable (shouldn't happen on staging/prod, but
  // belt-and-suspenders for local dev where Supabase may be offline).
  const handleCopyContext = useCallback(async () => {
    let payload = "";
    try {
      const res = await fetch(`/raw/bundle/${id}`, {
        headers: { Accept: "text/markdown" },
      });
      if (res.ok) {
        payload = await res.text();
      }
    } catch { /* fall through to local fallback */ }

    if (!payload) {
      // Local fallback — keeps "Copy as context" working even when the
      // raw endpoint can't be reached. Output is intentionally simpler
      // than the spec payload so the user notices and reports.
      const header = `Bundle: ${initialTitle || "Untitled Bundle"}\nDocuments: ${documents.length}\n\n`;
      const body = documents.map((doc, i) => {
        const title = doc.title || "Untitled";
        return `--- Document ${i + 1}: ${title} ---\n\n${doc.markdown}`;
      }).join("\n\n---\n\n");
      payload = header + body;
    }

    try {
      await navigator.clipboard.writeText(payload);
      setContextCopied(true);
      setTimeout(() => setContextCopied(false), 2000);
    } catch { /* clipboard error */ }
  }, [id, documents, initialTitle]);

  // Regenerate AI analysis
  const [regenerateKey, setRegenerateKey] = useState(0);
  const handleRegenerate = useCallback(async () => {
    setAiGraph(null);
    setIsAnalyzing(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const anonId = localStorage.getItem("mdfy-anonymous-id");
      if (anonId) headers["x-anonymous-id"] = anonId;
      const graphRes = await fetch(`/api/bundles/${id}/graph`, {
        method: "POST",
        headers,
        body: JSON.stringify({ editToken }),
      });
      if (graphRes.ok) {
        const data = await graphRes.json();
        // Force fresh render with new key
        setRegenerateKey(k => k + 1);
        setAiGraph(data.graphData);
      }
    } catch { /* AI error */ }
    setIsAnalyzing(false);
  }, [id, editToken]);

  // Render selected document
  const renderDocument = useCallback(async (doc: BundleDocument) => {
    setSelectedDocId(doc.id);
    try {
      const result = render(doc.markdown);
      setSelectedHtml(result.html);
    } catch {
      setSelectedHtml(`<p style="color: var(--text-muted)">Failed to render document</p>`);
    }
  }, []);

  // Handle canvas node click
  const handleNodeClick = useCallback((nodeId: string) => {
    // Document node
    if (nodeId.startsWith("doc:")) {
      const docId = nodeId.slice(4);
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        const wc = doc.markdown.split(/\s+/).filter(Boolean).length;
        setSelectedNodeInfo({
          type: "document",
          label: doc.title || "Untitled",
          documentSummary: aiGraph?.documentSummaries?.[nodeId] || undefined,
          docStats: {
            wordCount: wc,
            readingTime: Math.max(1, Math.ceil(wc / 200)),
            sections: (doc.markdown.match(/^#{1,3}\s+/gm) || []).length,
            hasCode: /```\w+/.test(doc.markdown),
          },
          // Find concepts connected to this doc
          connectedDocs: aiGraph?.edges
            ?.filter((e: any) => (e.source === nodeId || e.target === nodeId) && !(e.source === nodeId && e.target.startsWith("doc:")) && !(e.target === nodeId && e.source.startsWith("doc:")))
            .map((e: any) => {
              const conceptId = e.source === nodeId ? e.target : e.source;
              const concept = aiGraph?.nodes.find((n: any) => n.id === conceptId);
              return concept ? { id: conceptId, title: `${concept.label} (${e.label || concept.type})` } : null;
            }).filter(Boolean) as any || [],
        });
        renderDocument(doc);
      }
      return;
    }
    // Concept/entity/tag node
    if (nodeId.startsWith("concept:") && aiGraph) {
      const concept = aiGraph.nodes.find((n: any) => n.id === nodeId);
      if (!concept) return;
      const connectedDocIds = aiGraph.edges
        .filter((e: any) => (e.source === nodeId && e.target.startsWith("doc:")) || (e.target === nodeId && e.source.startsWith("doc:")))
        .map((e: any) => e.source.startsWith("doc:") ? e.source.slice(4) : e.target.slice(4));
      const connectedDocs = documents.filter(d => connectedDocIds.includes(d.id));
      const relationships = aiGraph.edges
        .filter((e: any) => e.source === nodeId || e.target === nodeId)
        .map((e: any) => {
          const targetId = e.source === nodeId ? e.target : e.source;
          const targetNode = aiGraph.nodes.find((n: any) => n.id === targetId) || documents.find(d => `doc:${d.id}` === targetId);
          return { label: e.label || "related", target: (targetNode as any)?.label || (targetNode as any)?.title || targetId };
        });

      setSelectedDocId(null);
      setSelectedHtml("");
      setSelectedNodeInfo({
        type: concept.type,
        label: concept.label,
        weight: concept.weight,
        description: concept.description,
        connectedDocs: connectedDocs.map(d => ({ id: d.id, title: d.title || "Untitled" })),
        relationships,
      });
      return;
    }
    // Summary node
    if (nodeId === "analysis:summary" && aiGraph) {
      setSelectedDocId(null);
      setSelectedHtml("");
      setSelectedNodeInfo({
        type: "analysis",
        label: "Bundle Analysis",
        summary: aiGraph.summary,
        themes: aiGraph.themes,
        insights: aiGraph.insights,
        readingOrder: aiGraph.readingOrder,
        readingOrderReason: aiGraph.readingOrderReason,
        keyTakeaways: aiGraph.keyTakeaways,
        gaps: aiGraph.gaps,
        connections: aiGraph.connections,
      });
      return;
    }
  }, [documents, renderDocument, aiGraph]);

  // Re-render selected doc when theme changes
  useEffect(() => {
    if (selectedDocId) {
      const doc = documents.find(d => d.id === selectedDocId);
      if (doc) renderDocument(doc);
    }
  }, [theme, selectedDocId, documents, renderDocument]);

  // Mermaid rendering
  useEffect(() => {
    if (!selectedHtml || !previewRef.current) return;
    const containers = previewRef.current.querySelectorAll(".mermaid-container");
    if (containers.length === 0) return;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: theme === "dark" ? "dark" : "default", securityLevel: "loose" });
        for (const el of containers) {
          const code = el.getAttribute("data-mermaid");
          if (!code) continue;
          const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, code);
          el.innerHTML = svg;
        }
      } catch { /* mermaid render error */ }
    })();
  }, [selectedHtml, theme]);

  // Copy link
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/b/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard error */ }
  };

  // ─── Password screen ───
  if (isProtected && !unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-sm mx-4">
          <div className="text-center mb-6">
            <MdfyLogo />
            <h1 className="text-lg font-semibold mt-4" style={{ color: "var(--text-primary)" }}>Protected Bundle</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{documentCount} documents</p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Enter password"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "var(--surface)", color: "var(--text-primary)", border: `1px solid ${passwordError ? "#ef4444" : "var(--border)"}` }}
              autoFocus
            />
            <button onClick={handlePasswordSubmit} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
              Unlock
            </button>
          </div>
          {passwordError && <p className="text-xs mt-2 text-center" style={{ color: "#ef4444" }}>Wrong password</p>}
        </div>
      </div>
    );
  }

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Loading bundle...</span>
        </div>
      </div>
    );
  }

  // ─── Main view ───
  // Compact pill style every action button shares — matches the doc viewer.
  const actionBtn = "h-7 px-2.5 rounded-md text-caption font-medium flex items-center gap-1.5 transition-colors";

  // 2-3 sentence digest of the bundle, surfaced inline so a visitor can
  // grasp what the bundle is about before deciding to engage with the
  // canvas. Falls back to a short placeholder while analysis is running;
  // hidden entirely on bundles with fewer than 2 docs (no graph_data).
  const summaryText = aiGraph?.summary?.trim();
  const showSummaryBand = documents.length >= 2 && (summaryText || isAnalyzing);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <ViewerHeader
        title={
          editToken ? (
            <input
              className="bg-transparent outline-none border-b border-transparent hover:border-[var(--border)] focus:border-[var(--accent)] transition-colors w-full text-body font-semibold"
              style={{ color: "var(--text-primary)" }}
              defaultValue={initialTitle || "Untitled Bundle"}
              onBlur={(e) => {
                const newTitle = e.target.value.trim();
                if (newTitle && newTitle !== initialTitle) {
                  fetch(`/api/bundles/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: newTitle, editToken }),
                  }).catch(() => {});
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            initialTitle || "Untitled Bundle"
          )
        }
        subtitle={description || undefined}
        breadcrumb={<>memory.wiki/b/<span style={{ color: "var(--accent)" }}>{id}</span></>}
        actions={
          <>
            <button onClick={toggleTheme} className={actionBtn} style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }} title="Toggle theme" aria-label="Toggle theme">
              {theme === "dark" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <button onClick={copyLink} className={actionBtn} style={{ background: "var(--toggle-bg)", color: copied ? "#4ade80" : "var(--text-muted)" }} title="Copy link" aria-label="Copy link">
              {copied ? (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 8 7 11 12 5"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8.5a3 3 0 004.24 0l2-2a3 3 0 00-4.24-4.24l-1 1"/><path d="M9 7.5a3 3 0 00-4.24 0l-2 2a3 3 0 004.24 4.24l1-1"/></svg>
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Link"}</span>
            </button>
          </>
        }
      />

      {/* Summary band — surfaces the bundle's executive summary (from
          graph_data) under the header so visitors see the gist before
          touching the canvas. Two-line clamp keeps the band a fixed
          predictable height across bundles. */}
      {showSummaryBand && (
        <div
          className="shrink-0 flex items-center px-6"
          style={{
            height: "4.5rem",
            borderBottom: "1px solid var(--border-dim)",
            background: "var(--surface)",
          }}
        >
          {summaryText ? (
            <p
              className="text-sm leading-relaxed mx-auto w-full"
              style={{
                color: "var(--text-secondary)",
                maxWidth: "72rem",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summaryText}
            </p>
          ) : (
            <p className="text-sm mx-auto w-full" style={{ color: "var(--text-faint)", maxWidth: "72rem" }}>
              Analyzing this bundle…
            </p>
          )}
        </div>
      )}

      {/* Canvas + Document Reader split. The chrome (header + summary +
          this split) is locked to one viewport so the canvas always
          opens fully visible; scrolling the page reveals the promo
          strip and shared footer underneath, matching the doc viewer. */}
      <div className="flex shrink-0" style={{ height: showSummaryBand ? "calc(100vh - 53px - 4.5rem)" : "calc(100vh - 53px)" }}>
        {/* Canvas */}
        <div className="relative" style={{ flex: 1, height: "100%", borderRight: selectedDocId ? "1px solid var(--border)" : "none" }}>
          {documents.length > 0 ? (
            <BundleCanvas
              key={regenerateKey}
              documents={documents}
              aiGraph={aiGraph}
              isAnalyzing={isAnalyzing}
              selectedDocId={selectedDocId}
              hoveredNodeId={canvasHoveredNode}
              onDocumentClick={handleNodeClick}
              onCopyContext={handleCopyContext}
              onRegenerate={handleRegenerate}
            />
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: "var(--text-muted)" }}>
              <p className="text-sm">No documents in this bundle</p>
            </div>
          )}

          {/* Context copied toast */}
          {contextCopied && (
            <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg text-xs font-medium animate-in fade-in" style={{ background: "var(--accent)", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
              Copied all documents as AI context
            </div>
          )}
        </div>

        {/* Side Panel — Document content OR Node info */}
        {(selectedDocId || selectedNodeInfo) && (
          <div className="w-[45%] max-w-2xl flex flex-col overflow-hidden" style={{ borderLeft: "1px solid var(--border)" }}>
            {/* Panel header */}
            <div className="shrink-0 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {selectedDocId ? (
                    <>
                      <FileIcon width={13} height={13} className="shrink-0" style={{ color: "var(--accent)" }} aria-hidden />
                      <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {documents.find(d => d.id === selectedDocId)?.title || "Untitled"}
                      </span>
                      <button
                        onClick={() => window.open(`/d/${selectedDocId}`, "_blank")}
                        className="text-xs px-2 py-0.5 rounded shrink-0 transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-faint)", border: "1px solid var(--border-dim)" }}
                      >
                        Open
                      </button>
                    </>
                  ) : selectedNodeInfo && (
                    <>
                      {(() => {
                        const color = selectedNodeInfo.type === "analysis" ? "#60a5fa"
                          : selectedNodeInfo.type === "entity" ? "#4ade80"
                          : selectedNodeInfo.type === "tag" ? "#a78bfa"
                          : "#38bdf8";
                        const NodeIcon = selectedNodeInfo.type === "analysis" ? BookOpen
                          : selectedNodeInfo.type === "entity" ? Box
                          : selectedNodeInfo.type === "tag" ? Tag
                          : Hash;
                        return <NodeIcon width={13} height={13} className="shrink-0" style={{ color }} aria-hidden />;
                      })()}
                      <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {selectedNodeInfo.label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{
                        background: selectedNodeInfo.type === "analysis" ? "rgba(96,165,250,0.12)" : selectedNodeInfo.type === "entity" ? "rgba(74,222,128,0.12)" : selectedNodeInfo.type === "tag" ? "rgba(167,139,250,0.12)" : "rgba(56,189,248,0.12)",
                        color: selectedNodeInfo.type === "analysis" ? "#60a5fa" : selectedNodeInfo.type === "entity" ? "#4ade80" : selectedNodeInfo.type === "tag" ? "#a78bfa" : "#38bdf8",
                      }}>{selectedNodeInfo.type}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedDocId(null); setSelectedHtml(""); setSelectedNodeInfo(null); }}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--toggle-bg)] shrink-0 ml-2"
                  style={{ color: "var(--text-faint)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto px-5 py-5">
              {selectedDocId ? (
                <>
                  {/* Read-only annotation card — set by the bundle owner via
                      AI Bundle Generation or manual edit. Only renders when
                      the doc actually carries one. */}
                  {(() => {
                    const sel = documents.find(d => d.id === selectedDocId);
                    const ann = sel?.annotation?.trim();
                    if (!ann) return null;
                    return (
                      <div
                        className="mb-5 px-3.5 py-2.5 rounded-md text-sm leading-relaxed"
                        style={{ background: "var(--accent-dim)", border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)", color: "var(--text-secondary)" }}
                      >
                        <Sparkles width={12} height={12} className="inline-block mr-1.5 align-text-bottom" style={{ color: "var(--accent)" }} aria-hidden />
                        {ann}
                      </div>
                    );
                  })()}
                  <div
                    ref={previewRef}
                    // .mdcore-rendered already supplies the 12px / 1.65
                    // body baseline that matches the sidebar + doc
                    // viewer. No inline override needed — that just
                    // diverged the side panel from the rest.
                    className="mdcore-rendered"
                    dangerouslySetInnerHTML={{ __html: selectedHtml }}
                  />
                </>
              ) : selectedNodeInfo && (
                <div>
                  {/* Analysis panel — redesigned as tabbed pill nav over a
                      single content area. Previously every section
                      (Summary / Takeaways / Themes / Insights / Reading /
                      Connections / Gaps) stacked vertically and the panel
                      felt like a wall of headings. Now: 4 tabs, one
                      content area, one cognitive load at a time. Pill
                      pattern matches MdEditor's left sidebar (All /
                      Private / Shared / Synced) for consistency. */}
                  {selectedNodeInfo.type === "analysis" && (() => {
                    const TABS = [
                      { key: "summary", label: "Summary", count: (selectedNodeInfo.summary ? 1 : 0) + (selectedNodeInfo.keyTakeaways?.length || 0) },
                      { key: "insights", label: "Insights", count: (selectedNodeInfo.insights?.length || 0) + (selectedNodeInfo.themes?.length || 0) },
                      { key: "reading", label: "Reading", count: selectedNodeInfo.readingOrder?.length || 0 },
                      { key: "links", label: "Links", count: (selectedNodeInfo.connections?.length || 0) + (selectedNodeInfo.gaps?.length || 0) },
                    ] as const;
                    type TabKey = typeof TABS[number]["key"];
                    return (
                      <>
                        <div
                          className="inline-flex items-center gap-0.5 p-0.5 rounded-md w-full mb-5"
                          style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
                        >
                          {TABS.map((t) => {
                            const isActive = analysisTab === t.key;
                            const empty = t.count === 0;
                            return (
                              <button
                                key={t.key}
                                onClick={() => setAnalysisTab(t.key as TabKey)}
                                disabled={empty}
                                className="flex-1 text-caption py-1.5 rounded transition-colors flex items-center justify-center gap-1"
                                style={{
                                  background: isActive ? "var(--accent-dim)" : "transparent",
                                  color: isActive ? "var(--accent)" : empty ? "var(--text-faint)" : "var(--text-secondary)",
                                  fontWeight: isActive ? 600 : 500,
                                  opacity: empty ? 0.4 : 1,
                                  cursor: empty ? "default" : "pointer",
                                }}
                                onMouseEnter={(e) => { if (!isActive && !empty) { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; } }}
                                onMouseLeave={(e) => { if (!isActive && !empty) { (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
                              >
                                {t.label}
                                {t.count > 0 && <span className="font-mono tabular-nums" style={{ fontSize: 9, opacity: 0.7 }}>{t.count}</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* SUMMARY tab — executive summary as pull-quote
                            (no card frame), takeaways as numbered headline
                            list. */}
                        {analysisTab === "summary" && (
                          <div className="space-y-5">
                            {selectedNodeInfo.summary && (
                              <p
                                className="text-body leading-[1.7] pl-4"
                                style={{
                                  color: "var(--text-primary)",
                                  borderLeft: "3px solid var(--accent)",
                                  fontStyle: "italic",
                                }}
                              >
                                {selectedNodeInfo.summary}
                              </p>
                            )}
                            {selectedNodeInfo.keyTakeaways && selectedNodeInfo.keyTakeaways.length > 0 && (
                              <ol className="space-y-3">
                                {selectedNodeInfo.keyTakeaways.map((t, i) => (
                                  <li key={i} className="flex gap-3">
                                    <span className="font-mono tabular-nums shrink-0" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{String(i + 1).padStart(2, "0")}</span>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{t}</p>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {!selectedNodeInfo.summary && !selectedNodeInfo.keyTakeaways?.length && (
                              <EmptyTab label="No summary yet" />
                            )}
                          </div>
                        )}

                        {/* INSIGHTS tab — themes as inline tag row at top,
                            insights below as numbered headline stream. */}
                        {analysisTab === "insights" && (
                          <div className="space-y-5">
                            {selectedNodeInfo.themes && selectedNodeInfo.themes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {selectedNodeInfo.themes.map((t, i) => (
                                  <span key={i} className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)", fontSize: 10, letterSpacing: 0.3 }}>{t.toLowerCase()}</span>
                                ))}
                              </div>
                            )}
                            {selectedNodeInfo.insights && selectedNodeInfo.insights.length > 0 && (
                              <ol className="space-y-4">
                                {selectedNodeInfo.insights.map((ins, i) => (
                                  <li key={i} className="flex gap-3">
                                    <span className="font-mono tabular-nums shrink-0" style={{ color: "var(--accent)", fontSize: 11, fontWeight: 700, marginTop: 4 }}>↳ {String(i + 1).padStart(2, "0")}</span>
                                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{ins}</p>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {!selectedNodeInfo.themes?.length && !selectedNodeInfo.insights?.length && (
                              <EmptyTab label="No insights yet" />
                            )}
                          </div>
                        )}

                        {/* READING tab — numbered list of doc titles +
                            optional reasoning footnote at bottom. */}
                        {analysisTab === "reading" && (
                          <div className="space-y-5">
                            {selectedNodeInfo.readingOrder && selectedNodeInfo.readingOrder.length > 0 ? (
                              <>
                                <ol className="space-y-1">
                                  {selectedNodeInfo.readingOrder.map((docId, i) => {
                                    const doc = documents.find(d => `doc:${d.id}` === docId);
                                    return doc ? (
                                      <li key={i}>
                                        <button
                                          onClick={() => renderDocument(doc)}
                                          onMouseEnter={() => setCanvasHoveredNode(`doc:${doc.id}`)}
                                          onMouseLeave={() => setCanvasHoveredNode(null)}
                                          className="w-full text-left text-sm flex items-baseline gap-3 py-1.5 px-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                                          style={{ color: "var(--text-primary)" }}
                                        >
                                          <span className="font-mono tabular-nums shrink-0" style={{ color: "var(--accent)", fontSize: 11, fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                                          <span className="truncate">{doc.title || "Untitled"}</span>
                                        </button>
                                      </li>
                                    ) : null;
                                  })}
                                </ol>
                                {selectedNodeInfo.readingOrderReason && (
                                  <p className="text-caption pt-3 leading-relaxed" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-dim)" }}>
                                    <span className="font-mono uppercase mr-2" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>Why</span>
                                    {selectedNodeInfo.readingOrderReason}
                                  </p>
                                )}
                              </>
                            ) : <EmptyTab label="No reading order yet" />}
                          </div>
                        )}

                        {/* LINKS tab — inter-doc connections + gaps. Same
                            magazine-list pattern, two visual columns split
                            by a separator. */}
                        {analysisTab === "links" && (
                          <div className="space-y-5">
                            {selectedNodeInfo.connections && selectedNodeInfo.connections.length > 0 && (
                              <div>
                                <h5 className="font-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>Connections</h5>
                                <ul className="space-y-3">
                                  {selectedNodeInfo.connections.map((c, i) => {
                                    const d1 = documents.find(d => `doc:${d.id}` === c.doc1);
                                    const d2 = documents.find(d => `doc:${d.id}` === c.doc2);
                                    return (
                                      <li key={i}>
                                        <div className="flex items-center gap-1.5 text-caption mb-0.5">
                                          <span className="font-medium truncate" style={{ color: "var(--accent)" }}>{d1?.title || c.doc1}</span>
                                          <ArrowLeftRight width={10} height={10} className="shrink-0" style={{ color: "var(--text-faint)" }} aria-hidden />
                                          <span className="font-medium truncate" style={{ color: "var(--accent)" }}>{d2?.title || c.doc2}</span>
                                        </div>
                                        <p className="text-caption leading-relaxed" style={{ color: "var(--text-muted)" }}>{c.relationship}</p>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {selectedNodeInfo.gaps && selectedNodeInfo.gaps.length > 0 && (
                              <div className={selectedNodeInfo.connections?.length ? "pt-4" : ""} style={selectedNodeInfo.connections?.length ? { borderTop: "1px solid var(--border-dim)" } : {}}>
                                <h5 className="font-mono uppercase mb-2 flex items-center gap-1.5" style={{ fontSize: 9, letterSpacing: 0.5, color: "#f87171" }}>
                                  <AlertTriangle width={10} height={10} aria-hidden /> Gaps
                                </h5>
                                <ul className="space-y-2">
                                  {selectedNodeInfo.gaps.map((gap, i) => (
                                    <li key={i} className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                      {gap}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!selectedNodeInfo.connections?.length && !selectedNodeInfo.gaps?.length && (
                              <EmptyTab label="No connections yet" />
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Concept/Entity/Tag panel */}
                  {(selectedNodeInfo.type === "concept" || selectedNodeInfo.type === "entity" || selectedNodeInfo.type === "tag") && (
                    <>
                      {/* Description — no duplicate badge/importance, header has it */}
                      {selectedNodeInfo.description && (
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{selectedNodeInfo.description}</p>
                      )}

                      {selectedNodeInfo.connectedDocs && selectedNodeInfo.connectedDocs.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Appears in {selectedNodeInfo.connectedDocs.length} document{selectedNodeInfo.connectedDocs.length > 1 ? "s" : ""}</h4>
                          <div className="space-y-1.5">
                            {selectedNodeInfo.connectedDocs.map((doc) => (
                              <button key={doc.id}
                                onClick={() => { const d = documents.find(dd => dd.id === doc.id); if (d) renderDocument(d); }}
                                onMouseEnter={() => setCanvasHoveredNode(`doc:${doc.id}`)}
                                onMouseLeave={() => setCanvasHoveredNode(null)}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--accent-dim)] flex items-center gap-2.5"
                                style={{ color: "var(--text-primary)", background: "var(--toggle-bg)" }}>
                                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: "var(--accent)" }} />
                                {doc.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedNodeInfo.relationships && selectedNodeInfo.relationships.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-faint)" }}>Relationships</h4>
                          <div className="space-y-1.5">
                            {selectedNodeInfo.relationships.map((rel, i) => (
                              <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--toggle-bg)" }}>
                                <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}>→</span>
                                <div>
                                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{rel.target}</span>
                                  <span className="ml-1.5 text-xs" style={{ color: "var(--text-muted)" }}>{rel.label}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Document info */}
                  {selectedNodeInfo.type === "document" && (
                    <div className="space-y-3 pb-4 mb-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                      {selectedNodeInfo.documentSummary && (
                        <p className="text-sm leading-relaxed px-4 py-3 rounded-lg" style={{ background: "var(--accent-dim)", color: "var(--text-primary)" }}>
                          {selectedNodeInfo.documentSummary}
                        </p>
                      )}
                      {selectedNodeInfo.connectedDocs && selectedNodeInfo.connectedDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedNodeInfo.connectedDocs.map((c, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>{c.title}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Promote band — only when the visitor is not the owner. The
          owner-redirect effect at the top of this component sends owners
          to /?bundle=<id> before this renders, so any signed-in viewer
          who actually lands here is non-owner and a valid funnel target. */}
      {showBadge && <ViewerPromoStrip />}

      {/* Shared footer */}
      <ViewerFooter
        stats={
          <>
            <span className="hidden sm:inline">{documentCount} {documentCount === 1 ? "doc" : "docs"}</span>
          </>
        }
      />
    </div>
  );
}
