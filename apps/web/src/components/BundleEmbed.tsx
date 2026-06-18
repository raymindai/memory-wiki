"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// BundleEmbed manipulates AI-extracted graph data whose shape is intentionally
// loose (nodes / edges with arbitrary metadata). The v6 Bundle MVP rewrite
// (W2-W4) will narrow these into typed primitives; until then `any` is the
// pragmatic stand-in. Disabling at file scope rather than line-by-line to
// keep the file readable.

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { render } from "@/lib/render";
import { parseSections, assembleSections, type Section } from "@/lib/parse-sections";
import { aggregateDiscoveries, type ChunkRef, type TensionItem, type ThreadItem } from "@/lib/discoveries";
import { stripMarkdownPreview } from "@/lib/strip-markdown-preview";
import { FEATURES } from "@/lib/feature-flags";
import Tooltip from "@/components/Tooltip";
import { showToast } from "@/components/Toast";
import { Button, Chip, Badge, ModalShell, EmptyState } from "@/components/ui";
import BundleOverview from "@/components/BundleOverview";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import { Layers, AlertTriangle, HelpCircle, GitBranch, Sparkles, Lightbulb, Zap, CheckSquare, Tag, FileText, X as XIcon, PanelLeft, List } from "lucide-react";

// Module-level cache so re-mounting a bundle tab paints instantly
// (stale-while-revalidate). Same pattern as HubEmbed. Cleared on full
// page reload; survives tab switches within a session. The fetch
// always fires after mount so a snapshot more than ~1 minute old
// gets refreshed before the user notices it's stale.
const bundleDataCache = new Map<string, { data: any; ts: number }>();

// Mirror of the AI route's response shape — kept inline to avoid a public type.
export interface SemanticChunk {
  id: string;
  type: string;
  label: string;
  content: string;
  weight: number;
  found?: boolean;
}
export interface SemanticEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
  weight: number;
}
export interface SemanticChunksResult {
  chunks: SemanticChunk[];
  edges: SemanticEdge[];
  version?: number;
}

const BundleCanvas = dynamic(() => import("@/components/BundleCanvas"), { ssr: false });

interface BundleDocument {
  id: string;
  title: string | null;
  markdown: string;
  created_at: string;
  updated_at: string;
  /** Per-doc note attached on bundle_documents — "why this doc belongs."
   *  Populated by AI Bundle Generation or edited inline in the list view. */
  annotation?: string | null;
}

interface BundleEmbedProps {
  bundleId: string;
  view?: "overview" | "canvas" | "list";
  /** Called by the overview's "Open canvas" / "List view" deep-links
   *  so the parent (MdEditor) can switch the bundleView state.
   *  Without this, those buttons are no-ops. */
  onChangeView?: (view: "overview" | "canvas" | "list") => void;
  onOpenDoc?: (docId: string) => void;
  // External "AI panel is open" signal — when true, the canvas auto-closes
  // its NodeInfoPanel (right side). Used to keep the right side of the screen
  // mutually exclusive between the canvas-info panel and the AI chat.
  aiPanelOpen?: boolean;
  // Called by the canvas right after it opens its NodeInfoPanel so the parent
  // (MdEditor) can close the AI panel. Same mutual-exclusivity pact.
  onSelectNodeInfo?: () => void;
  // Fires when this component creates a new doc (synthesis save, extract,
  // etc.). The parent (MdEditor) registers the new doc as a tab marked
  // `unread: true` so the sidebar shows a pulsing orange dot until the user
  // opens it.
  onDocCreated?: (info: { docId: string; title: string; markdown?: string }) => void;
  // Authoritative auth headers from the parent (MdEditor): Bearer JWT +
  // x-anonymous-id + x-user-id + x-user-email. When provided, BundleEmbed
  // uses these for ALL API calls instead of best-effort localStorage probing,
  // which fails for signed-in users (Supabase stores tokens in cookies, not
  // localStorage, so reading "mw-user-id" gives null → 403 Unauthorized).
  authHeaders?: Record<string, string>;
  // Conversational-query → canvas filter. When the user clicks
  // "Show on canvas" in BundleChat, the parent (MdEditor) stores
  // the cited doc id set per bundle and threads it down here so
  // BundleCanvas can fade non-matching nodes. Null = no filter.
  highlightedDocIds?: string[] | null;
  // Clear the filter (canvas's "Exit" banner click).
  onClearHighlight?: () => void;
}

/** Quiet pulsing placeholder used by the bundle's loading skeleton.
 *  Single source so List, Overview, and any future variant share
 *  exactly the same rhythm — no surprise mismatch when the loading
 *  state swaps in. */
function SkeletonBar({ width, height }: { width: number | string; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: "var(--toggle-bg)",
        animation: "mwSkelPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

export default function BundleEmbed({ bundleId, view = "canvas", onChangeView, onOpenDoc, aiPanelOpen, onSelectNodeInfo, onDocCreated, authHeaders: parentAuthHeaders, highlightedDocIds, onClearHighlight }: BundleEmbedProps) {
  const [documents, setDocuments] = useState<BundleDocument[]>([]);
  const [aiGraph, setAiGraph] = useState<any>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [bundleIntent, setBundleIntent] = useState<string>("");
  // Bundle metadata used by the overview-mode header + Deploy panel.
  // Populated from the /api/bundles/[id] response alongside intent.
  const [bundleTitle, setBundleTitle] = useState<string>("");
  const [bundleDescription, setBundleDescription] = useState<string | null>(null);
  const [bundleIsDraft, setBundleIsDraft] = useState<boolean>(false);
  const [bundleAllowedEmails, setBundleAllowedEmails] = useState<string[]>([]);
  const [bundleIsOwner, setBundleIsOwner] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Pipeline status — surfaced in the canvas toolbar so the user can tell at
  // a glance whether the bundle is current with its own AI analysis (graph
  // extraction) and embedding (vector for semantic recall). Without these,
  // there was no way to know if this bundle was "live" or stale.
  const [graphGeneratedAt, setGraphGeneratedAt] = useState<string | null>(null);
  const [embeddingUpdatedAt, setEmbeddingUpdatedAt] = useState<string | null>(null);
  const [isEmbedding, setIsEmbedding] = useState(false);
  // Set by /api/bundles/[id] when any member doc was updated AFTER
  // graph_generated_at — drives the "Stale" badge on the Analyzed pill.
  const [isAnalysisStale, setIsAnalysisStale] = useState(false);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<{
    type: string; label: string; weight?: number; description?: string;
    summary?: string; themes?: string[]; insights?: string[];
    keyTakeaways?: string[]; gaps?: string[];
    connectedDocs?: Array<{ id: string; title: string }>;
    relationships?: Array<{
      label: string;
      target: string;
      targetId?: string;
      targetKind?: "doc" | "concept" | "entity" | "tag" | "other";
      direction?: "in" | "out";
    }>;
    coverage?: {
      docs: number;
      concepts: number;
      entities: number;
      tags: number;
      connections: number;
      generatedAt: string | null;
    };
    connections?: Array<{
      doc1: string; doc2: string; doc1Id: string; doc2Id: string; relationship: string;
    }>;
    docId?: string;
    docContent?: string;
    docStats?: { wordCount: number; readingTime: number; sections: number; hasCode: boolean };
    documentSummary?: string;
  } | null>(null);

  // Fetch bundle data — stale-while-revalidate. The cache paint is
  // only used when fresh enough (≤ 30s old). Beyond that, we hold the
  // loading spinner until the network refresh lands — without this
  // cutoff users saw a flash of stale metadata ("Updated" missing or
  // showing an out-of-date timestamp) for the full duration of the
  // background refetch, which read as a bug rather than a fast paint.
  const CACHE_PAINT_TTL_MS = 30_000;
  useEffect(() => {
    const cached = bundleDataCache.get(bundleId);
    const cacheFresh = !!cached && (Date.now() - cached.ts) < CACHE_PAINT_TTL_MS;
    if (cached && cacheFresh) {
      const data = cached.data;
      setDocuments(data.documents || []);
      if (data.editToken) setEditToken(data.editToken);
      if (data.graph_data) setAiGraph(data.graph_data);
      if (typeof data.intent === "string") setBundleIntent(data.intent);
      if (typeof data.title === "string") setBundleTitle(data.title);
      if (typeof data.description === "string" || data.description === null) setBundleDescription(data.description);
      if (typeof data.is_draft === "boolean") setBundleIsDraft(data.is_draft);
      if (Array.isArray(data.allowed_emails)) setBundleAllowedEmails(data.allowed_emails);
      setBundleIsOwner(!!data.isOwner);
      setGraphGeneratedAt(data.graph_generated_at || null);
      setEmbeddingUpdatedAt(data.embedding_updated_at || null);
      setIsAnalysisStale(!!data.isAnalysisStale);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    // Prefer parent auth headers (Bearer JWT for signed-in users) — fall back
    // to localStorage for the standalone bundle viewer.
    let headers: Record<string, string> = {};
    if (parentAuthHeaders) {
      headers = { ...parentAuthHeaders };
    } else {
      const anonId = localStorage.getItem("mw-anonymous-id");
      if (anonId) headers["x-anonymous-id"] = anonId;
      const userId = localStorage.getItem("mw-user-id");
      if (userId) headers["x-user-id"] = userId;
    }

    fetch(`/api/bundles/${bundleId}`, { headers })
      .then(res => res.ok ? res.json() : null)
      .then(async (data) => {
        if (!data) { setIsLoading(false); return; }
        bundleDataCache.set(bundleId, { data, ts: Date.now() });
        setDocuments(data.documents || []);
        if (data.editToken) setEditToken(data.editToken);
        if (data.graph_data) setAiGraph(data.graph_data);
        if (typeof data.intent === "string") setBundleIntent(data.intent);
        if (typeof data.title === "string") setBundleTitle(data.title);
        if (typeof data.description === "string" || data.description === null) setBundleDescription(data.description);
        if (typeof data.is_draft === "boolean") setBundleIsDraft(data.is_draft);
        if (Array.isArray(data.allowed_emails)) setBundleAllowedEmails(data.allowed_emails);
        setBundleIsOwner(!!data.isOwner);
        setGraphGeneratedAt(data.graph_generated_at || null);
        setEmbeddingUpdatedAt(data.embedding_updated_at || null);
        setIsAnalysisStale(!!data.isAnalysisStale);
        setIsLoading(false);

        // Background: pull cached decompositions for every doc in parallel.
        // Each one that hits cache lights up Discoveries without the user
        // having to click "Run discovery". Cache misses (404s) are silent —
        // we don't auto-decompose, that's the user's deliberate action.
        const docList: Array<{ id: string }> = data.documents || [];
        if (docList.length > 0) {
          docList.forEach(d => {
            fetch(`/api/docs/${d.id}/decompose`, { headers })
              .then(r => r.ok ? r.json() : null)
              .then(payload => {
                if (payload?.semanticChunks) {
                  setDecompositionByDocId(prev => prev[d.id] ? prev : { ...prev, [d.id]: payload.semanticChunks });
                }
              })
              .catch(() => { /* missing cache — skip */ });
          });
        }

        // Auto-trigger AI analysis when there's no cached graph and at
        // least one member doc. Threshold used to be 2 — a single-doc
        // bundle was left unanalyzed, which read as "feature broken"
        // to founders adding docs one at a time. Owner-only: viewers
        // shouldn't pay for analysis on someone else's bundle.
        if (data.isOwner && !data.graph_data && (data.documents?.length || 0) >= 1) {
          setIsAnalyzing(true);
          try {
            const res = await fetch(`/api/bundles/${bundleId}/graph`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({ editToken: data.editToken }),
            });
            if (res.ok) {
              const g = await res.json();
              setAiGraph(g.graphData);
              setGraphGeneratedAt(g.generatedAt || new Date().toISOString());
            } else {
              const errBody = await res.json().catch(() => ({}));
              console.warn(`[bundle-auto-analyze] failed status=${res.status}`, errBody);
            }
          } catch (err) {
            console.warn(`[bundle-auto-analyze] threw`, err);
          }
          setIsAnalyzing(false);
        }
      })
      .catch(() => setIsLoading(false));
  }, [bundleId, parentAuthHeaders]);

  const handleCopyContext = useCallback(async () => {
    const context = documents.map((doc, i) => {
      return `--- Document ${i + 1}: ${doc.title || "Untitled"} ---\n\n${doc.markdown}`;
    }).join("\n\n---\n\n");
    try { await navigator.clipboard.writeText(context); } catch { /* clipboard error */ }
  }, [documents]);

  // Listen for "doc dragged onto this bundle" events from the
  // parent editor's drop handler. When a matching event fires we
  // re-fetch the bundle so the freshly-added doc shows in the
  // canvas/list views without a manual reload.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ bundleId: string }>).detail;
      if (!detail?.bundleId || detail.bundleId !== bundleId) return;
      const headers: Record<string, string> = { ...(parentAuthHeaders || {}) };
      fetch(`/api/bundles/${bundleId}`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          bundleDataCache.set(bundleId, { data, ts: Date.now() });
          setDocuments(data.documents || []);
          setGraphGeneratedAt(data.graph_generated_at || null);
          setEmbeddingUpdatedAt(data.embedding_updated_at || null);
          setIsAnalysisStale(!!data.isAnalysisStale);
        })
        .catch(() => {});
    };
    window.addEventListener("mw-bundle-doc-added", handler as EventListener);
    return () => window.removeEventListener("mw-bundle-doc-added", handler as EventListener);
  }, [bundleId, parentAuthHeaders]);

  // ─── Supabase Realtime: bundle_documents + bundles meta ───
  // Picks up external membership / meta changes (iOS adds a doc,
  // CLI mutates the title, another tab rearranges members) and
  // silently re-fetches the bundle so the canvas + list views
  // stay in sync without the user hitting Refresh.
  useEffect(() => {
    if (!bundleId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase || cancelled) return;
      let debounce: ReturnType<typeof setTimeout> | null = null;
      const reload = async () => {
        const headers: Record<string, string> = { ...(parentAuthHeaders || {}) };
        try {
          const r = await fetch(`/api/bundles/${bundleId}`, { headers, cache: "no-store" });
          if (!r.ok) return;
          const data = await r.json();
          if (!data) return;
          setDocuments(data.documents || []);
          if (typeof data.title === "string") setBundleTitle(data.title);
          if (typeof data.description === "string" || data.description === null) setBundleDescription(data.description);
          if (typeof data.intent === "string") setBundleIntent(data.intent);
          if (typeof data.is_draft === "boolean") setBundleIsDraft(data.is_draft);
          if (Array.isArray(data.allowed_emails)) setBundleAllowedEmails(data.allowed_emails);
          setGraphGeneratedAt(data.graph_generated_at || null);
          setEmbeddingUpdatedAt(data.embedding_updated_at || null);
          setIsAnalysisStale(!!data.isAnalysisStale);
        } catch { /* offline */ }
      };
      const ch = supabase
        .channel(`bundle-live-${bundleId}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'bundle_documents', filter: `bundle_id=eq.${bundleId}` },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(reload, 800);
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'bundles', filter: `id=eq.${bundleId}` },
          () => {
            if (debounce) clearTimeout(debounce);
            debounce = setTimeout(reload, 800);
          }
        )
        .subscribe();
      cleanup = () => {
        if (debounce) clearTimeout(debounce);
        supabase.removeChannel(ch);
      };
    })();
    return () => { cancelled = true; cleanup?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId]);

  const handleRegenerate = useCallback(async () => {
    // Keep the existing graph on screen under the busy state — Sonnet can take
    // 30-60s, and blanking it up front (then leaving it blank on failure) read
    // as "re-analyze did nothing". Replace only on success; surface failures
    // instead of swallowing them.
    setIsAnalyzing(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(parentAuthHeaders || {}) };
      const anonId = localStorage.getItem("mw-anonymous-id");
      if (anonId && !headers["x-anonymous-id"]) headers["x-anonymous-id"] = anonId;
      const res = await fetch(`/api/bundles/${bundleId}/graph`, {
        method: "POST", headers,
        body: JSON.stringify({ editToken }),
      });
      if (res.ok) {
        const g = await res.json();
        setAiGraph(g.graphData);
        setGraphGeneratedAt(g.generatedAt || new Date().toISOString());
        // Just regenerated — no longer stale.
        setIsAnalysisStale(false);
      } else {
        const j = await res.json().catch(() => ({} as { error?: string }));
        showToast(j.error ? `Re-analyze failed: ${j.error}` : `Re-analyze failed (${res.status})`, "error");
      }
    } catch {
      showToast("Re-analyze failed — network error", "error");
    }
    setIsAnalyzing(false);
  }, [bundleId, editToken, parentAuthHeaders]);

  // Re-embed the bundle for semantic recall (Phase 3 RAG). Owner-only.
  // Idempotent on the server (skips if hash unchanged), but we always show
  // the user a fresh "embedded" timestamp on success so they know the action
  // landed. Cache miss / unchanged still updates the chip's relative time.
  const handleEmbed = useCallback(async () => {
    if (!bundleIsOwner) return;
    setIsEmbedding(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(parentAuthHeaders || {}) };
      const anonId = localStorage.getItem("mw-anonymous-id");
      if (anonId && !headers["x-anonymous-id"]) headers["x-anonymous-id"] = anonId;
      const res = await fetch(`/api/embed/bundle/${bundleId}`, { method: "POST", headers });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        // Surface so the user doesn't think the click did nothing.
        const msg = typeof data.error === "string"
          ? data.error
          : `Embed failed (${res.status})`;
        showToast(msg, "error");
      } else if (data.embedded) {
        setEmbeddingUpdatedAt(new Date().toISOString());
        showToast("Bundle embedded", "success");
      } else if (data.skipped) {
        // Idempotent skip (hash unchanged or composite too short) —
        // surface the existing embedding_updated_at if any so the
        // chip stops reading "Not yet" when the bundle is already
        // embedded. If the row never had a timestamp at all, leave
        // it null so the chip honestly says "Not yet".
        if (typeof data.embedding_updated_at === "string" && data.embedding_updated_at) {
          setEmbeddingUpdatedAt(data.embedding_updated_at);
        }
        showToast(
          data.reason === "empty"
            ? "Nothing to embed — bundle has no title or members yet"
            : "Bundle is already up to date",
          "info",
        );
      }
    } catch {
      showToast("Embed failed — network error", "error");
    }
    setIsEmbedding(false);
  }, [bundleId, bundleIsOwner, parentAuthHeaders]);

  // Track when the user explicitly dismisses the prep banner so we don't
  // re-show it after the user has acknowledged the in-progress pipeline.
  const [prepBannerDismissed, setPrepBannerDismissed] = useState(false);

  // Poll /api/bundles/[id] while the auto-analyze + auto-embed kicked
  // off server-side in /api/bundles POST (and the client-side auto-graph
  // in the load effect above) are still in flight. Without this, a
  // freshly-created bundle would show "Not yet" on the embed pill
  // forever — the server completes the embed via after() but never
  // notifies the client. Owner-only. Stops as soon as both timestamps
  // are populated, or after a 3-minute ceiling, whichever comes first.
  useEffect(() => {
    if (!bundleIsOwner) return;
    if (isLoading) return;
    if (graphGeneratedAt && embeddingUpdatedAt) return;
    const headers: Record<string, string> = {};
    if (parentAuthHeaders) Object.assign(headers, parentAuthHeaders);
    else {
      try {
        const anonId = localStorage.getItem("mw-anonymous-id");
        if (anonId) headers["x-anonymous-id"] = anonId;
        const userId = localStorage.getItem("mw-user-id");
        if (userId) headers["x-user-id"] = userId;
      } catch { /* ignore */ }
    }
    const started = Date.now();
    const MAX_MS = 3 * 60 * 1000;
    const tick = async () => {
      try {
        const r = await fetch(`/api/bundles/${bundleId}`, { headers });
        if (!r.ok) return;
        const d = await r.json();
        if (d.graph_generated_at) setGraphGeneratedAt(d.graph_generated_at);
        if (d.embedding_updated_at) setEmbeddingUpdatedAt(d.embedding_updated_at);
      } catch { /* network blip — retry on next tick */ }
    };
    const id = setInterval(() => {
      if (Date.now() - started > MAX_MS) { clearInterval(id); return; }
      void tick();
    }, 5000);
    return () => clearInterval(id);
  }, [bundleId, bundleIsOwner, isLoading, graphGeneratedAt, embeddingUpdatedAt, parentAuthHeaders]);

  // Build auth headers for bundle PATCH (uses anonymousId or userId/email)
  // Mutual exclusivity with AI chat panel: when the parent opens the AI chat,
  // close our NodeInfoPanel so the right side doesn't show two stacked panels.
  useEffect(() => {
    if (aiPanelOpen && selectedNodeInfo) setSelectedNodeInfo(null);
  }, [aiPanelOpen, selectedNodeInfo]);

  // Wrap setSelectedNodeInfo with a notification to the parent — when we open
  // a node info panel, the parent should close the AI chat.
  const openNodeInfo = useCallback((info: typeof selectedNodeInfo) => {
    if (info) onSelectNodeInfo?.();
    setSelectedNodeInfo(info);
  }, [onSelectNodeInfo]);

  // Prefer parent (MdEditor) auth headers — they include the live Bearer JWT
  // for signed-in users, which the localStorage fallback below cannot provide
  // (Supabase stores tokens in cookies, not localStorage). Without this, the
  // decompose API returns 403 for every signed-in user even though they own
  // the doc.
  const buildPatchHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (parentAuthHeaders) {
      Object.assign(headers, parentAuthHeaders);
      return headers;
    }
    try {
      const anonId = localStorage.getItem("mw-anonymous-id");
      if (anonId) headers["x-anonymous-id"] = anonId;
      const userId = localStorage.getItem("mw-user-id");
      if (userId) headers["x-user-id"] = userId;
      const userEmail = localStorage.getItem("mw-user-email");
      if (userEmail) headers["x-user-email"] = userEmail;
    } catch { /* ignore */ }
    return headers;
  }, [parentAuthHeaders]);

  // Remove a single document from this bundle
  const handleRemoveDoc = useCallback(async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    const title = doc?.title || "this document";
    if (!confirm(`Remove "${title}" from this bundle?`)) return;
    // Optimistic update
    setDocuments(prev => prev.filter(d => d.id !== docId));
    if (selectedNodeInfo?.docId === docId) setSelectedNodeInfo(null);
    try {
      const res = await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: buildPatchHeaders(),
        body: JSON.stringify({ action: "remove-documents", documentIds: [docId], editToken }),
      });
      if (!res.ok) {
        // Rollback
        if (doc) setDocuments(prev => [...prev, doc]);
      }
    } catch {
      if (doc) setDocuments(prev => [...prev, doc]);
    }
  }, [bundleId, editToken, documents, selectedNodeInfo, buildPatchHeaders]);

  // ─── Decompose: explode a single doc into AI-derived semantic chunks ───
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [decompositionByDocId, setDecompositionByDocId] = useState<Record<string, SemanticChunksResult>>({});
  const [decomposingDocId, setDecomposingDocId] = useState<string | null>(null);
  const [decomposeError, setDecomposeError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<{ docId: string; section: Section } | null>(null);
  const [editingChunk, setEditingChunk] = useState<{ docId: string; chunk: SemanticChunk } | null>(null);
  const [sectionCtxMenu, setSectionCtxMenu] = useState<{ x: number; y: number; docId: string; section: Section } | null>(null);
  const [chunkCtxMenu, setChunkCtxMenu] = useState<{ x: number; y: number; docId: string; chunk: SemanticChunk } | null>(null);
  // Multi-select chunks for bulk actions (delete, extract, copy)
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());
  // "Add chunk" modal — when set, opens AddChunkModal to compose a new chunk
  // and append it to the source doc.
  const [addingChunkForDocId, setAddingChunkForDocId] = useState<string | null>(null);
  // Filter chunks by type (null = all)
  const [chunkTypeFilter, setChunkTypeFilter] = useState<string | null>(null);

  // Clear chunk selection on collapse / decomposition change
  useEffect(() => { setSelectedChunkIds(new Set()); setChunkTypeFilter(null); }, [expandedDocId]);

  // Save bundle title. Optimistic — the PATCH default branch on the
  // route accepts { title } directly (no action verb needed).
  const saveBundleTitle = useCallback(async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    setBundleTitle(trimmed);
    try {
      await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: buildPatchHeaders(),
        body: JSON.stringify({ title: trimmed, editToken }),
      });
    } catch { /* best-effort — sidebar will resync on next fetch */ }
  }, [bundleId, editToken, buildPatchHeaders]);

  // Save bundle intent. Optimistic — server-side persists via PATCH set-intent.
  const saveBundleIntent = useCallback(async (next: string) => {
    setBundleIntent(next);
    try {
      await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: buildPatchHeaders(),
        body: JSON.stringify({ action: "set-intent", intent: next, editToken }),
      });
    } catch { /* best-effort */ }
  }, [bundleId, buildPatchHeaders, editToken]);

  // ─── Synthesis (Memo / FAQ / Brief) ───
  const [synthesizing, setSynthesizing] = useState<null | "memo" | "faq" | "brief">(null);
  const [synthesisResult, setSynthesisResult] = useState<{ kind: string; markdown: string } | null>(null);
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);

  const runSynthesis = useCallback(async (kind: "memo" | "faq" | "brief") => {
    setSynthesizing(kind);
    setSynthesisResult(null);
    setShowSynthesisModal(true);
    try {
      const res = await fetch(`/api/bundles/${bundleId}/synthesize`, {
        method: "POST",
        headers: buildPatchHeaders(),
        body: JSON.stringify({ kind, editToken }),
      });
      if (res.ok) {
        const data = await res.json();
        setSynthesisResult({ kind: data.kind, markdown: data.markdown });
      } else {
        const err = await res.json().catch(() => ({}));
        setSynthesisResult({ kind, markdown: `> Synthesis failed: ${err.error || "unknown error"}` });
      }
    } catch {
      setSynthesisResult({ kind, markdown: "> Network error during synthesis." });
    } finally {
      setSynthesizing(null);
    }
  }, [bundleId, buildPatchHeaders, editToken]);

  // Save synthesis output as a *compiled* doc — it remembers its source
  // bundle/docs/intent so the user can later recompile and we can detect when
  // the source has drifted (compiled_at < MAX(source.updated_at)).
  const saveSynthesisAsDoc = useCallback(async (kind: string, markdown: string) => {
    const headers = buildPatchHeaders();
    const userId = (() => { try { return localStorage.getItem("mw-user-id") || undefined; } catch { return undefined; } })();
    const anonymousId = (() => { try { return localStorage.getItem("mw-anonymous-id") || undefined; } catch { return undefined; } })();
    const titles: Record<string, string> = { memo: "Memo", faq: "FAQ", brief: "Brief" };
    const title = `${titles[kind] || "Synthesis"} — ${new Date().toLocaleDateString()}`;
    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers,
        body: JSON.stringify({
          markdown, title, userId, anonymousId,
          editMode: userId ? "account" : "token",
          isDraft: true,
          // Provenance for recompile + outdated detection
          compileKind: kind,
          compileFrom: {
            bundleId,
            docIds: documents.map(d => d.id),
            intent: bundleIntent || null,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newDocId = data?.id;
      if (newDocId) {
        await fetch(`/api/bundles/${bundleId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "add-documents", documentIds: [newDocId], editToken }),
        });
        const r = await fetch(`/api/bundles/${bundleId}`, { headers });
        if (r.ok) {
          const bd = await r.json();
          if (bd?.documents) setDocuments(bd.documents);
        }
        // Surface the freshly created doc in the parent's sidebar with the
        // unread pulse — user can find it without scrolling 64 entries.
        onDocCreated?.({ docId: newDocId, title, markdown });
      }
      return newDocId as string | null;
    } catch { return null; }
  }, [bundleId, editToken, buildPatchHeaders, documents, bundleIntent, onDocCreated]);

  // ─── Tension resolutions cache (per tension id) ───
  const [tensionResolutions, setTensionResolutions] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});
  const resolveTension = useCallback(async (tension: TensionItem) => {
    setTensionResolutions(prev => ({ ...prev, [tension.id]: { loading: true } }));
    try {
      const res = await fetch(`/api/bundles/${bundleId}/resolve-tension`, {
        method: "POST",
        headers: buildPatchHeaders(),
        body: JSON.stringify({
          source: { docTitle: tension.source.docTitle, chunkLabel: tension.source.chunkLabel, chunkContent: tension.source.chunkContent, chunkType: tension.source.chunkType },
          target: { docTitle: tension.target.docTitle, chunkLabel: tension.target.chunkLabel, chunkContent: tension.target.chunkContent, chunkType: tension.target.chunkType },
          editToken,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTensionResolutions(prev => ({ ...prev, [tension.id]: { loading: false, text: data.resolution || "" } }));
      } else {
        const err = await res.json().catch(() => ({}));
        setTensionResolutions(prev => ({ ...prev, [tension.id]: { loading: false, error: err.error || "Failed" } }));
      }
    } catch {
      setTensionResolutions(prev => ({ ...prev, [tension.id]: { loading: false, error: "Network error" } }));
    }
  }, [bundleId, buildPatchHeaders, editToken]);

  // ─── Discoveries panel (default right-side view when nothing is selected) ───
  // Defaults open only when the thinking-surface flag is on. With the flag
  // off (v6 launch default) the panel never mounts and the surrounding
  // gating below short-circuits.
  const [showDiscoveries, setShowDiscoveries] = useState<boolean>(FEATURES.THINKING_SURFACE);
  const [bulkDecomposing, setBulkDecomposing] = useState<{ done: number; total: number } | null>(null);
  // Externally requested chunk to focus on canvas (Discoveries → fly-to)
  const [focusChunkId, setFocusChunkId] = useState<string | null>(null);

  // Fetch (or refetch) decomposition for a doc WITHOUT touching canvas state.
  // Used by both the canvas-expand path and the sidebar pane — the sidebar
  // calls this directly so it doesn't accidentally explode the doc on the
  // canvas (and close the very panel the user is working in).
  const fetchDecomposition = useCallback(async (docId: string, force = false) => {
    setDecomposeError(null);
    if (!force && decompositionByDocId[docId]) return;
    setDecomposingDocId(docId);
    const headers = buildPatchHeaders();
    try {
      if (!force) {
        const cached = await fetch(`/api/docs/${docId}/decompose`, { headers });
        if (cached.ok) {
          const data = await cached.json();
          if (data?.semanticChunks) {
            setDecompositionByDocId(prev => ({ ...prev, [docId]: data.semanticChunks }));
            setDecomposingDocId(null);
            return;
          }
        }
      }
      const res = await fetch(`/api/docs/${docId}/decompose${force ? "?force=1" : ""}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ intent: bundleIntent || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.semanticChunks) {
          setDecompositionByDocId(prev => ({ ...prev, [docId]: data.semanticChunks }));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setDecomposeError(err.error || "Decomposition failed");
      }
    } catch {
      setDecomposeError("Network error during decomposition");
    } finally {
      setDecomposingDocId(null);
    }
  }, [decompositionByDocId, buildPatchHeaders, bundleIntent]);

  // Canvas-mode decompose: explode the doc on the constellation. Closes the
  // node info panel because the canvas is taking the spotlight.
  const decomposeDoc = useCallback(async (docId: string, force = false) => {
    setExpandedDocId(docId);
    setSelectedNodeInfo(null);
    await fetchDecomposition(docId, force);
  }, [fetchDecomposition]);

  // Bulk decompose every doc in the bundle (sequential to avoid hammering
  // AI rate limits). Skips docs that already have a cached decomposition
  // unless force = true. Used by the Discoveries panel's "Run discovery"
  // CTA to populate cross-doc tensions/questions/actions/threads.
  const decomposeAllDocs = useCallback(async (force = false) => {
    const targets = documents.filter(d => force || !decompositionByDocId[d.id]);
    if (targets.length === 0) return;
    setBulkDecomposing({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await fetchDecomposition(targets[i].id, force);
      setBulkDecomposing({ done: i + 1, total: targets.length });
    }
    setBulkDecomposing(null);
  }, [documents, decompositionByDocId, fetchDecomposition]);

  // Aggregate discoveries from whatever decompositions we currently have,
  // PLUS the bundle-level AI graph (insights/gaps/connections). The combined
  // panel is the bundle "speaking" — both per-doc patterns and whole-bundle
  // observations flow into the same surface.
  const discoveries = useMemo(
    () => aggregateDiscoveries(documents, decompositionByDocId, aiGraph),
    [documents, decompositionByDocId, aiGraph]
  );

  // Click a discovery item → fly to the chunk on canvas. We expand the
  // owning doc so the chunk is rendered, ensure decomposition is loaded,
  // then request the canvas to fit-view + pulse that specific node.
  const flyToChunk = useCallback((ref: ChunkRef) => {
    setExpandedDocId(ref.docId);
    fetchDecomposition(ref.docId, false);
    setShowDiscoveries(false);
    setFocusChunkId(ref.chunkId);
  }, [fetchDecomposition]);
  useEffect(() => {
    if (!sectionCtxMenu && !chunkCtxMenu) return;
    const close = () => { setSectionCtxMenu(null); setChunkCtxMenu(null); };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [sectionCtxMenu, chunkCtxMenu]);

  /** Persist a new full markdown for a doc — optimistic update + PATCH /api/docs/[id]. */
  const updateDocMarkdown = useCallback(async (docId: string, newMd: string, newTitle?: string) => {
    setDocuments(prev => prev.map(d => d.id === docId
      ? { ...d, markdown: newMd, title: newTitle ?? d.title, updated_at: new Date().toISOString() }
      : d));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const anonId = localStorage.getItem("mw-anonymous-id");
        if (anonId) headers["x-anonymous-id"] = anonId;
        const userId = localStorage.getItem("mw-user-id");
        if (userId) headers["x-user-id"] = userId;
        const userEmail = localStorage.getItem("mw-user-email");
        if (userEmail) headers["x-user-email"] = userEmail;
      } catch { /* ignore */ }
      await fetch(`/api/docs/${docId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ action: "auto-save", markdown: newMd, title: newTitle }),
      });
    } catch { /* leave optimistic state in place */ }
  }, []);

  const replaceSection = useCallback(async (docId: string, sectionId: string, next: Section) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const sections = parseSections(doc.markdown);
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    sections[idx] = { ...sections[idx], heading: next.heading, body: next.body };
    const newMd = assembleSections(sections);
    await updateDocMarkdown(docId, newMd);
  }, [documents, updateDocMarkdown]);

  const removeSection = useCallback(async (docId: string, sectionId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    if (!confirm("Delete this section?")) return;
    const sections = parseSections(doc.markdown).filter(s => s.id !== sectionId);
    await updateDocMarkdown(docId, assembleSections(sections));
  }, [documents, updateDocMarkdown]);

  // ─── Semantic chunk edits ─────────────────────────────────────────────
  // The chunk's `content` field is verbatim text from the source doc, so we
  // edit by exact-substring replace. If the substring isn't found (doc drifted
  // since decomposition), we surface that to the user instead of silently
  // appending. After any chunk edit, we re-trigger decomposition so the canvas
  // rehydrates with fresh chunks/edges.
  const replaceChunkInDoc = useCallback(async (docId: string, chunk: SemanticChunk, newContent: string, newLabel: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return false;
    if (!doc.markdown.includes(chunk.content)) {
      setDecomposeError("Chunk text could not be located in source document. Edit it directly via the document tab.");
      return false;
    }
    const newMd = doc.markdown.replace(chunk.content, newContent);
    await updateDocMarkdown(docId, newMd);
    // Patch local cache so UI reflects the edit immediately; next decompose
    // will overwrite from the server.
    setDecompositionByDocId(prev => {
      const cur = prev[docId];
      if (!cur) return prev;
      return {
        ...prev,
        [docId]: {
          ...cur,
          chunks: cur.chunks.map(c => c.id === chunk.id ? { ...c, content: newContent, label: newLabel } : c),
        },
      };
    });
    return true;
  }, [documents, updateDocMarkdown]);

  const removeChunkFromDoc = useCallback(async (docId: string, chunk: SemanticChunk) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    if (!confirm(`Delete chunk "${chunk.label}" from the document? This removes its text from the source.`)) return;
    if (!doc.markdown.includes(chunk.content)) {
      setDecomposeError("Chunk text could not be located in source document.");
      return;
    }
    const newMd = doc.markdown.replace(chunk.content, "").replace(/\n{3,}/g, "\n\n");
    await updateDocMarkdown(docId, newMd);
    setDecompositionByDocId(prev => {
      const cur = prev[docId];
      if (!cur) return prev;
      return {
        ...prev,
        [docId]: {
          ...cur,
          chunks: cur.chunks.filter(c => c.id !== chunk.id),
          edges: cur.edges.filter(e => e.source !== chunk.id && e.target !== chunk.id),
        },
      };
    });
  }, [documents, updateDocMarkdown]);

  // ─── Add chunk: append a new chunk's content to the source doc ───
  const addChunk = useCallback(async (docId: string, label: string, content: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    // Append as a new section: an H2 heading with the label, then the body.
    // This guarantees the new content is detectable as its own chunk on the
    // next decompose run.
    const newMd = `${doc.markdown.trimEnd()}\n\n## ${label.trim()}\n\n${content.trim()}\n`;
    await updateDocMarkdown(docId, newMd);
    // Force re-decompose so the new chunk shows up in the canvas
    setDecompositionByDocId(prev => { const next = { ...prev }; delete next[docId]; return next; });
    decomposeDoc(docId, true);
  }, [documents, updateDocMarkdown, decomposeDoc]);

  // ─── Reorder a chunk within the source doc ───
  // We move the chunk's verbatim content to before/after another chunk's
  // content. This works because the AI prompt requires verbatim content;
  // when content drifts, the chunk is marked Stale and reorder is rejected.
  const reorderChunk = useCallback(async (docId: string, fromChunkId: string, targetChunkId: string, position: "before" | "after") => {
    if (fromChunkId === targetChunkId) return;
    const decomp = decompositionByDocId[docId];
    if (!decomp) return;
    const fromChunk = decomp.chunks.find(c => c.id === fromChunkId);
    const targetChunk = decomp.chunks.find(c => c.id === targetChunkId);
    if (!fromChunk || !targetChunk) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    if (!doc.markdown.includes(fromChunk.content) || !doc.markdown.includes(targetChunk.content)) {
      setDecomposeError("Chunk text drifted — re-analyze before reordering.");
      return;
    }
    // Cut the from-chunk out, then insert it relative to the target.
    let md = doc.markdown.replace(fromChunk.content, "");
    const targetIdx = md.indexOf(targetChunk.content);
    if (targetIdx < 0) { setDecomposeError("Reorder anchor missing."); return; }
    const insertIdx = position === "before" ? targetIdx : targetIdx + targetChunk.content.length;
    md = md.slice(0, insertIdx) + "\n\n" + fromChunk.content + "\n\n" + md.slice(insertIdx);
    md = md.replace(/\n{3,}/g, "\n\n");
    await updateDocMarkdown(docId, md);
    // Optimistically reorder the chunks array so the canvas updates without
    // waiting for re-decomposition.
    setDecompositionByDocId(prev => {
      const cur = prev[docId];
      if (!cur) return prev;
      const reordered = [...cur.chunks];
      const fromIdx = reordered.findIndex(c => c.id === fromChunkId);
      const [moved] = reordered.splice(fromIdx, 1);
      const tIdx = reordered.findIndex(c => c.id === targetChunkId);
      reordered.splice(position === "before" ? tIdx : tIdx + 1, 0, moved);
      return { ...prev, [docId]: { ...cur, chunks: reordered } };
    });
  }, [decompositionByDocId, documents, updateDocMarkdown]);

  // ─── Move a single chunk up/down within source doc ───
  const moveChunkUpDown = useCallback(async (docId: string, chunkId: string, direction: "up" | "down") => {
    const decomp = decompositionByDocId[docId];
    if (!decomp) return;
    const idx = decomp.chunks.findIndex(c => c.id === chunkId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= decomp.chunks.length) return;
    const targetChunk = decomp.chunks[targetIdx];
    await reorderChunk(docId, chunkId, targetChunk.id, direction === "up" ? "before" : "after");
  }, [decompositionByDocId, reorderChunk]);

  // ─── Bulk: delete N selected chunks ───
  const bulkDeleteChunks = useCallback(async (docId: string, chunkIds: string[]) => {
    if (chunkIds.length === 0) return;
    if (!confirm(`Delete ${chunkIds.length} chunk${chunkIds.length === 1 ? "" : "s"} from the source document?`)) return;
    const doc = documents.find(d => d.id === docId);
    const decomp = decompositionByDocId[docId];
    if (!doc || !decomp) return;
    let md = doc.markdown;
    const targets = decomp.chunks.filter(c => chunkIds.includes(c.id));
    for (const c of targets) {
      if (md.includes(c.content)) md = md.replace(c.content, "");
    }
    md = md.replace(/\n{3,}/g, "\n\n");
    await updateDocMarkdown(docId, md);
    setDecompositionByDocId(prev => {
      const cur = prev[docId];
      if (!cur) return prev;
      const removed = new Set(chunkIds);
      return {
        ...prev,
        [docId]: {
          ...cur,
          chunks: cur.chunks.filter(c => !removed.has(c.id)),
          edges: cur.edges.filter(e => !removed.has(e.source) && !removed.has(e.target)),
        },
      };
    });
    setSelectedChunkIds(new Set());
  }, [documents, decompositionByDocId, updateDocMarkdown]);

  // ─── Bulk: copy selected chunks' content to clipboard ───
  const bulkCopyChunks = useCallback(async (docId: string, chunkIds: string[]) => {
    const decomp = decompositionByDocId[docId];
    if (!decomp) return;
    const ordered = decomp.chunks.filter(c => chunkIds.includes(c.id));
    if (ordered.length === 0) return;
    const joined = ordered.map(c => `## ${c.label}\n\n${c.content}`).join("\n\n---\n\n");
    try { await navigator.clipboard.writeText(joined); } catch { /* ignore */ }
  }, [decompositionByDocId]);

  // ─── Extract chunks (1 or many) into a new document, optionally removing
  //     them from the source. The new doc is created via POST /api/docs and
  //     joined to the bundle so it shows up alongside the source. ───
  const extractChunksToNewDoc = useCallback(async (docId: string, chunkIds: string[], opts?: { removeFromSource?: boolean; title?: string }) => {
    const decomp = decompositionByDocId[docId];
    if (!decomp || chunkIds.length === 0) return;
    const ordered = decomp.chunks.filter(c => chunkIds.includes(c.id));
    if (ordered.length === 0) return;
    const removeFromSource = opts?.removeFromSource !== false;
    const sourceDoc = documents.find(d => d.id === docId);
    const baseTitle = opts?.title || (ordered.length === 1 ? ordered[0].label : `Extracted from ${sourceDoc?.title || "document"}`);

    // Build the new doc body
    const body = ordered.length === 1
      ? `# ${ordered[0].label}\n\n${ordered[0].content}\n`
      : `# ${baseTitle}\n\n${ordered.map(c => `## ${c.label}\n\n${c.content}`).join("\n\n")}\n`;

    const headers = buildPatchHeaders();
    let createdDocId: string | null = null;
    try {
      const userId = (() => { try { return localStorage.getItem("mw-user-id") || undefined; } catch { return undefined; } })();
      const anonymousId = (() => { try { return localStorage.getItem("mw-anonymous-id") || undefined; } catch { return undefined; } })();
      const res = await fetch("/api/docs", {
        method: "POST",
        headers,
        body: JSON.stringify({ markdown: body, title: baseTitle, userId, anonymousId, editMode: userId ? "account" : "token", isDraft: true }),
      });
      if (res.ok) {
        const data = await res.json();
        createdDocId = data?.id || null;
      } else {
        setDecomposeError("Failed to create extracted document.");
        return;
      }
    } catch {
      setDecomposeError("Network error during extraction.");
      return;
    }

    // Add the new doc to this bundle
    if (createdDocId) {
      try {
        await fetch(`/api/bundles/${bundleId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ action: "add-documents", documentIds: [createdDocId], editToken }),
        });
        const r = await fetch(`/api/bundles/${bundleId}`, { headers });
        if (r.ok) {
          const data = await r.json();
          if (data?.documents) setDocuments(data.documents);
        }
      } catch { /* ignore */ }
      // Mark unread in the parent's sidebar
      onDocCreated?.({ docId: createdDocId, title: baseTitle, markdown: body });
    }

    // Optionally remove from source
    if (removeFromSource && sourceDoc) {
      let md = sourceDoc.markdown;
      for (const c of ordered) {
        if (md.includes(c.content)) md = md.replace(c.content, "");
      }
      md = md.replace(/\n{3,}/g, "\n\n");
      await updateDocMarkdown(docId, md);
      setDecompositionByDocId(prev => {
        const cur = prev[docId];
        if (!cur) return prev;
        const removed = new Set(chunkIds);
        return {
          ...prev,
          [docId]: {
            ...cur,
            chunks: cur.chunks.filter(c => !removed.has(c.id)),
            edges: cur.edges.filter(e => !removed.has(e.source) && !removed.has(e.target)),
          },
        };
      });
    }
    setSelectedChunkIds(new Set());
  }, [decompositionByDocId, documents, bundleId, editToken, buildPatchHeaders, updateDocMarkdown, onDocCreated]);

  const insertSectionAfter = useCallback(async (docId: string, sectionId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    const sections = parseSections(doc.markdown);
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const fresh: Section = {
      id: `s${sections.length}`,
      level: Math.max(1, sections[idx].level) || 2,
      heading: "New section",
      body: "",
    };
    sections.splice(idx + 1, 0, fresh);
    await updateDocMarkdown(docId, assembleSections(sections));
    // Open the new section for immediate editing
    setEditingSection({ docId, section: fresh });
  }, [documents, updateDocMarkdown]);

  // Open the doc picker modal
  const [showAddPicker, setShowAddPicker] = useState(false);
  const handleAddDocs = useCallback(async (docIds: string[]) => {
    if (docIds.length === 0) return;
    try {
      const res = await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: buildPatchHeaders(),
        body: JSON.stringify({ action: "add-documents", documentIds: docIds, editToken }),
      });
      if (res.ok) {
        // Refetch to get full doc bodies
        const r = await fetch(`/api/bundles/${bundleId}`, { headers: buildPatchHeaders() });
        if (r.ok) {
          const data = await r.json();
          if (data?.documents) setDocuments(data.documents);
        }
      }
    } catch { /* ignore */ }
  }, [bundleId, editToken, buildPatchHeaders]);

  const handleNodeClick = useCallback(async (nodeId: string) => {
    // Document → show in side panel with rendered content
    if (nodeId.startsWith("doc:")) {
      const docId = nodeId.slice(4);
      const doc = documents.find(d => d.id === docId);
      if (!doc) return;
      const wc = doc.markdown.split(/\s+/).filter(Boolean).length;
      let html = "";
      try {
        const result = render(doc.markdown);
        html = result.html;
      } catch { /* render error */ }
      // Find connected concepts
      const connectedConcepts = aiGraph?.edges
        ?.filter((e: any) => (e.source === nodeId || e.target === nodeId))
        ?.map((e: any) => {
          const otherId = e.source === nodeId ? e.target : e.source;
          if (otherId.startsWith("concept:")) {
            const c = aiGraph.nodes.find((n: any) => n.id === otherId);
            return c ? { id: otherId, title: c.label } : null;
          }
          return null;
        })
        ?.filter(Boolean) || [];
      openNodeInfo({
        type: "document", label: doc.title || "Untitled",
        docId,
        docContent: html,
        documentSummary: aiGraph?.documentSummaries?.[nodeId],
        docStats: {
          wordCount: wc, readingTime: Math.max(1, Math.ceil(wc / 200)),
          sections: (doc.markdown.match(/^#{1,3}\s+/gm) || []).length,
          hasCode: /```\w+/.test(doc.markdown),
        },
        connectedDocs: connectedConcepts,
      });
      return;
    }
    // Concept/Entity/Tag → show in side panel. We match by exact node lookup
    // in aiGraph.nodes instead of a "concept:" prefix check because the LLM
    // sometimes returns entity:/tag: prefixes despite the prompt asking for
    // concept: only — that mismatch silently broke entity/tag clicks.
    if (aiGraph && (nodeId.startsWith("concept:") || nodeId.startsWith("entity:") || nodeId.startsWith("tag:"))) {
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
          const direction = e.source === nodeId ? "out" : "in";
          const targetNode = aiGraph.nodes.find((n: any) => n.id === targetId);
          const targetDoc = !targetNode ? documents.find(d => `doc:${d.id}` === targetId) : undefined;
          // targetKind drives the icon/color hint in NodeInfoPanel so the
          // viewer can tell at a glance whether this concept links to a
          // sibling concept, an entity, a tag, or a document.
          let targetKind: "doc" | "concept" | "entity" | "tag" | "other" = "other";
          if (targetDoc || targetId.startsWith("doc:")) targetKind = "doc";
          else if (targetNode?.type === "entity") targetKind = "entity";
          else if (targetNode?.type === "tag") targetKind = "tag";
          else if (targetNode?.type === "concept") targetKind = "concept";
          return {
            label: e.label || "related",
            target: targetNode?.label || targetDoc?.title || targetId,
            targetId,
            targetKind,
            direction,
          };
        });
      openNodeInfo({
        type: concept.type, label: concept.label, weight: concept.weight, description: concept.description,
        connectedDocs: connectedDocs.map(d => ({ id: d.id, title: d.title || "Untitled" })),
        relationships,
      });
      return;
    }
    // Summary node — surface the full extracted graph plus coverage stats
    // (doc/concept/connection counts) and freshness so the Bundle Analysis
    // sidebar can show "what was actually analyzed" instead of just an
    // unanchored prose blob.
    if (nodeId === "analysis:summary" && aiGraph) {
      const conceptCount = (aiGraph.nodes || []).filter((n: any) => n.type === "concept").length;
      const entityCount = (aiGraph.nodes || []).filter((n: any) => n.type === "entity").length;
      const tagCount = (aiGraph.nodes || []).filter((n: any) => n.type === "tag").length;
      const connections = Array.isArray(aiGraph.connections) ? aiGraph.connections : [];
      // Resolve doc ids in connections back to titles for display
      const docTitleById = new Map(documents.map(d => [d.id, d.title || "Untitled"] as const));
      const resolvedConnections = connections.map((c: any) => {
        const id1 = String(c.doc1 || "").replace(/^doc:/, "");
        const id2 = String(c.doc2 || "").replace(/^doc:/, "");
        return {
          doc1: docTitleById.get(id1) || id1,
          doc2: docTitleById.get(id2) || id2,
          doc1Id: id1,
          doc2Id: id2,
          relationship: c.relationship || "related",
        };
      });
      openNodeInfo({
        type: "analysis", label: "Bundle Analysis",
        summary: aiGraph.summary, themes: aiGraph.themes, insights: aiGraph.insights,
        keyTakeaways: aiGraph.keyTakeaways, gaps: aiGraph.gaps,
        coverage: {
          docs: documents.length,
          concepts: conceptCount,
          entities: entityCount,
          tags: tagCount,
          connections: connections.length,
          generatedAt: graphGeneratedAt,
        },
        connections: resolvedConnections,
      });
      return;
    }
    // Unknown node type (e.g. themeTag, or any future node kind that
    // doesn't have a dedicated panel). Closing the panel is the right
    // behaviour: it's confusing to leave the previous selection's content
    // visible after the user clicked a different node — looks like the
    // click was ignored when in fact the panel just has nothing to say.
    setSelectedNodeInfo(null);
  }, [onOpenDoc, aiGraph, documents, openNodeInfo, graphGeneratedAt]);

  // 2-3 sentence AI digest of the bundle, surfaced on the Overview
  // ("Bundle" tab) below the hero title. The owner-side editor opens
  // here by default, so this is where the gist needs to appear — not
  // on the public /b/<id> viewer (already shipped) and not on the
  // canvas (intentionally clean for graph work).
  const bundleSummary: string | null = (aiGraph?.summary && typeof aiGraph.summary === "string")
    ? aiGraph.summary.trim() || null
    : null;

  // Whether the bundle's auto-pipeline (graph analysis + vector embed,
  // both kicked from /api/bundles POST `after()`) is still in flight.
  // Banner is owner-only because viewers shouldn't see private prep state,
  // and only when the bundle actually has members (an empty bundle has
  // nothing to embed).
  const showPrepBanner =
    bundleIsOwner &&
    !isLoading &&
    documents.length > 0 &&
    !prepBannerDismissed &&
    (!graphGeneratedAt || !embeddingUpdatedAt);
  // Banner now renders inline inside BundleOverview's hero (passed
  // via prepStatus prop). The fixed-position floating toast was
  // founder-flagged as out-of-place — the contextual hero slot reads
  // as part of the same bundle surface the user is already looking
  // at. Canvas + List views drop the banner entirely; they're
  // working surfaces where the message would block the workflow.
  const prepStatusProp = showPrepBanner ? {
    graphReady: !!graphGeneratedAt,
    embedReady: !!embeddingUpdatedAt,
    hasMultipleDocs: documents.length >= 2,
    onDismiss: () => setPrepBannerDismissed(true),
  } : null;
  const prepBannerNode = null;

  if (isLoading) {
    // Layout-aware skeleton — mirrors the eventual frame (List has a
    // Contents rail + doc column; Overview has a centered hero) so
    // the swap to real content doesn't feel like a layout shift.
    if (view === "list") {
      return (
        <div className="w-full h-full flex flex-col" style={{ background: "var(--background)" }}>
          <div className="shrink-0 h-0.5" style={{ background: "var(--border-dim)" }} />
          <div className="flex-1 flex min-h-0">
            <aside className="shrink-0 w-64 overflow-hidden" style={{ borderRight: "1px solid var(--border-dim)" }}>
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-caption font-mono" style={{ color: "var(--text-primary)" }}>
                <List width={14} height={14} />
                <span>CONTENTS</span>
              </div>
              <div className="px-3 py-3 flex flex-col gap-3">
                <SkeletonBar width="100%" height={28} />
                <SkeletonBar width="85%" height={36} />
                <SkeletonBar width="78%" height={36} />
                <SkeletonBar width="92%" height={36} />
              </div>
            </aside>
            <div className="flex-1 overflow-hidden">
              <div className="max-w-3xl mx-auto px-8 py-10 flex flex-col gap-3">
                <SkeletonBar width="55%" height={32} />
                <SkeletonBar width="40%" height={14} />
                <div className="mt-8 flex flex-col gap-2">
                  <SkeletonBar width="60%" height={22} />
                  <SkeletonBar width="100%" height={14} />
                  <SkeletonBar width="95%" height={14} />
                  <SkeletonBar width="88%" height={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (view === "overview") {
      return (
        <div className="h-full overflow-y-auto" style={{ background: "var(--background)" }}>
          <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col items-center gap-3">
            <div
              className="rounded-2xl"
              style={{ width: 80, height: 80, background: "var(--border)", opacity: 0.5 }}
            />
            <SkeletonBar width={240} height={32} />
            <SkeletonBar width={320} height={14} />
            <SkeletonBar width={160} height={12} />
            <div className="w-full mt-8 flex flex-col gap-2">
              <SkeletonBar width="100%" height={42} />
              <SkeletonBar width="100%" height={120} />
            </div>
          </div>
        </div>
      );
    }
    // Canvas (default) — same MW-blob loader shape every other surface
    // uses (boot, inner doc, hub): animated symbol + caption only. The
    // progress bar was removed app-wide so the loading moment reads as
    // a brand pause, not a chrome filling.
    return (
      <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: "var(--background)", gap: 14 }}>
        <MemoryWikiLogo size={64} variant="icon-only" />
        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
          Loading bundle
        </span>
      </div>
    );
  }

  if (view === "overview") {
    return (
      <>
        <BundleOverview
          prepStatus={prepStatusProp}
          bundleId={bundleId}
          bundleTitle={bundleTitle}
          bundleDescription={bundleDescription}
          bundleSummary={bundleSummary}
          bundleIntent={bundleIntent}
          bundleIsDraft={bundleIsDraft}
          bundleAllowedEmails={bundleAllowedEmails}
          documents={documents.map(d => ({
            id: d.id,
            title: d.title,
            markdown: d.markdown,
            updated_at: d.updated_at,
            annotation: d.annotation ?? null,
          }))}
          hasDiscoveries={!!aiGraph && (aiGraph.themes?.length > 0 || aiGraph.insights?.length > 0)}
          hasGraph={!!aiGraph}
          isAnalysisStale={isAnalysisStale}
          themeCount={Array.isArray(aiGraph?.themes) ? aiGraph.themes.length : 0}
          insightCount={Array.isArray(aiGraph?.insights) ? aiGraph.insights.length : 0}
          lastUpdatedAt={(() => {
            const stamps = documents
              .map(d => (d.updated_at ? new Date(d.updated_at).getTime() : 0))
              .filter(t => t > 0);
            if (stamps.length === 0) return null;
            return new Date(Math.max(...stamps)).toISOString();
          })()}
          onOpenDoc={onOpenDoc}
          onSwitchToCanvas={() => onChangeView?.("canvas")}
          onSwitchToList={() => onChangeView?.("list")}
          onRenameBundle={bundleIsOwner ? saveBundleTitle : undefined}
        />
        {prepBannerNode}
      </>
    );
  }

  if (view === "list") {
    return (
      <>
        <BundleListView
          documents={documents}
          bundleId={bundleId}
          bundleTitle={bundleTitle}
          bundleDescription={bundleDescription}
          authHeaders={parentAuthHeaders}
          canEdit={bundleIsOwner}
          onOpenDoc={onOpenDoc}
          onSwitchToBundle={() => onChangeView?.("overview")}
          onAnnotationSaved={(docId, annotation) => {
            setDocuments(prev => prev.map(d => d.id === docId ? { ...d, annotation } : d));
          }}
        />
        {prepBannerNode}
      </>
    );
  }

  return (
    <>
    <BundleCanvasLayout
      selectedNodeInfo={selectedNodeInfo}
      onCloseNodeInfo={() => setSelectedNodeInfo(null)}
      onOpenDoc={onOpenDoc}
      canvas={
        <BundleCanvas
          documents={documents}
          aiGraph={aiGraph}
          isAnalyzing={isAnalyzing}
          graphGeneratedAt={graphGeneratedAt}
          embeddingUpdatedAt={embeddingUpdatedAt}
          isEmbedding={isEmbedding}
          isAnalysisStale={isAnalysisStale}
          isOwner={bundleIsOwner}
          onEmbed={handleEmbed}
          onDocumentClick={handleNodeClick}
          onCopyContext={handleCopyContext}
          onRegenerate={handleRegenerate}
          onRemoveDoc={handleRemoveDoc}
          onOpenDoc={onOpenDoc}
          onRequestAddDocs={() => setShowAddPicker(true)}
          onAddDocs={handleAddDocs}
          expandedDocId={expandedDocId}
          decomposition={expandedDocId ? decompositionByDocId[expandedDocId] || null : null}
          isDecomposing={decomposingDocId === expandedDocId}
          decomposeError={expandedDocId ? decomposeError : null}
          onDecomposeDoc={(docId) => decomposeDoc(docId)}
          onRedecomposeDoc={(docId) => decomposeDoc(docId, true)}
          onCollapseDoc={() => { setExpandedDocId(null); setDecomposeError(null); setSelectedChunkIds(new Set()); }}
          onSectionClick={(docId, section) => setEditingSection({ docId, section })}
          onSectionContextMenu={(docId, section, x, y) => setSectionCtxMenu({ docId, section, x, y })}
          onChunkClick={(docId, chunk, additive) => {
            // Additive (Cmd/Shift) → toggle in selection. Plain click on a
            // chunk → open the editor (replace any existing selection so the
            // edit feels focused). Functional setState avoids stale closure
            // captures of selectedChunkIds.
            if (additive) {
              setSelectedChunkIds(prev => {
                const next = new Set(prev);
                if (next.has(chunk.id)) next.delete(chunk.id); else next.add(chunk.id);
                return next;
              });
              return;
            }
            setSelectedChunkIds(new Set());
            setEditingChunk({ docId, chunk });
          }}
          onChunkContextMenu={(docId, chunk, x, y) => setChunkCtxMenu({ docId, chunk, x, y })}
          selectedChunkIds={selectedChunkIds}
          onClearChunkSelection={() => setSelectedChunkIds(new Set())}
          onPaneClose={() => setSelectedNodeInfo(null)}
          onChunkDragReorder={(docId, fromId, targetId, position) => reorderChunk(docId, fromId, targetId, position)}
          chunkTypeFilter={chunkTypeFilter}
          onAddChunk={(docId) => setAddingChunkForDocId(docId)}
          onChangeChunkTypeFilter={(t) => setChunkTypeFilter(t)}
          focusChunkId={focusChunkId}
          onFocusChunkSettled={() => setFocusChunkId(null)}
          highlightedDocIds={highlightedDocIds}
          onClearHighlight={onClearHighlight}
          onSynthesize={runSynthesis}
        />
      }
      bulkChunkBarNode={expandedDocId && selectedChunkIds.size > 0 && (
        <ChunkBulkBar
          count={selectedChunkIds.size}
          onClear={() => setSelectedChunkIds(new Set())}
          onCopy={() => bulkCopyChunks(expandedDocId, Array.from(selectedChunkIds))}
          onExtract={() => extractChunksToNewDoc(expandedDocId, Array.from(selectedChunkIds), { removeFromSource: true })}
          onExtractKeep={() => extractChunksToNewDoc(expandedDocId, Array.from(selectedChunkIds), { removeFromSource: false })}
          onDelete={() => bulkDeleteChunks(expandedDocId, Array.from(selectedChunkIds))}
        />
      )}
      addChunkModalNode={(
        <>
          {addingChunkForDocId && (
            <AddChunkModal
              onClose={() => setAddingChunkForDocId(null)}
              onCreate={async (label, content) => {
                await addChunk(addingChunkForDocId, label, content);
                setAddingChunkForDocId(null);
              }}
            />
          )}
          {showSynthesisModal && (
            <SynthesisModal
              kind={synthesizing || synthesisResult?.kind || "memo"}
              isLoading={!!synthesizing}
              markdown={synthesisResult?.markdown || ""}
              onClose={() => { setShowSynthesisModal(false); setSynthesisResult(null); }}
              onSaveAsDoc={async () => {
                if (!synthesisResult) return;
                const newId = await saveSynthesisAsDoc(synthesisResult.kind, synthesisResult.markdown);
                if (newId) { setShowSynthesisModal(false); setSynthesisResult(null); }
              }}
              onCopy={async () => {
                if (!synthesisResult) return;
                try { await navigator.clipboard.writeText(synthesisResult.markdown); } catch { /* ignore */ }
              }}
            />
          )}
        </>
      )}
      discoveriesPanel={FEATURES.THINKING_SURFACE && showDiscoveries ? (
        <DiscoveriesPanel
          discoveries={discoveries}
          totalDocs={documents.length}
          documents={documents}
          isBulkRunning={bulkDecomposing}
          onRun={() => decomposeAllDocs(false)}
          onClose={() => setShowDiscoveries(false)}
          onSelectChunk={flyToChunk}
          onOpenDoc={onOpenDoc}
          intent={bundleIntent}
          isOwner={bundleIsOwner}
          onSaveIntent={saveBundleIntent}
          tensionResolutions={tensionResolutions}
          onResolveTension={resolveTension}
        />
      ) : null}
      reopenDiscoveriesNode={FEATURES.THINKING_SURFACE && !showDiscoveries && !aiPanelOpen ? (
        <DiscoveriesReopenButton
          onClick={() => setShowDiscoveries(true)}
          count={discoveries.tensions.length + discoveries.questions.length + discoveries.threads.length + discoveries.insights.length + discoveries.gaps.length + discoveries.connections.length}
        />
      ) : null}
      decomposeBridge={selectedNodeInfo?.docId ? {
        decomposition: decompositionByDocId[selectedNodeInfo.docId] || null,
        isDecomposing: decomposingDocId === selectedNodeInfo.docId,
        // IMPORTANT: sidebar uses fetchDecomposition (data only) — not
        // decomposeDoc — so requesting a sidebar decompose does NOT
        // explode the doc on the canvas or close the panel.
        onRequestDecompose: () => fetchDecomposition(selectedNodeInfo.docId!, false),
        onRedecompose: () => fetchDecomposition(selectedNodeInfo.docId!, true),
        onEditChunk: (chunk) => setEditingChunk({ docId: selectedNodeInfo.docId!, chunk }),
        onDeleteChunk: (chunk) => removeChunkFromDoc(selectedNodeInfo.docId!, chunk),
        onAddChunk: () => setAddingChunkForDocId(selectedNodeInfo.docId!),
        onMoveChunk: (chunkId, direction) => moveChunkUpDown(selectedNodeInfo.docId!, chunkId, direction),
        onExtractChunk: (chunkId, removeFromSource) => extractChunksToNewDoc(selectedNodeInfo.docId!, [chunkId], { removeFromSource }),
      } : undefined}
      sectionEditorNode={(
        <>
          {editingSection && (
            <SectionEditor
              docId={editingSection.docId}
              section={editingSection.section}
              onClose={() => setEditingSection(null)}
              onSave={async (next) => {
                await replaceSection(editingSection.docId, editingSection.section.id, next);
                setEditingSection(null);
              }}
            />
          )}
          {editingChunk && (
            <ChunkEditor
              chunk={editingChunk.chunk}
              onClose={() => setEditingChunk(null)}
              onSave={async (newContent, newLabel) => {
                const ok = await replaceChunkInDoc(editingChunk.docId, editingChunk.chunk, newContent, newLabel);
                if (ok) setEditingChunk(null);
              }}
            />
          )}
        </>
      )}
      sectionCtxMenuNode={(
        <>
          {sectionCtxMenu && (
            <div
              className="fixed z-[200] py-1 rounded-lg shadow-xl"
              style={{
                left: Math.min(sectionCtxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 200),
                top: Math.min(sectionCtxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 768) - 120),
                minWidth: 200,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setEditingSection({ docId: sectionCtxMenu.docId, section: sectionCtxMenu.section }); setSectionCtxMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Edit section
              </button>
              <button
                onClick={() => { insertSectionAfter(sectionCtxMenu.docId, sectionCtxMenu.section.id); setSectionCtxMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Add section after
              </button>
              <button
                onClick={() => { removeSection(sectionCtxMenu.docId, sectionCtxMenu.section.id); setSectionCtxMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: "#ef4444" }}
              >
                Delete section
              </button>
            </div>
          )}
          {chunkCtxMenu && (
            <div
              className="fixed z-[200] py-1 rounded-lg shadow-xl"
              style={{
                left: Math.min(chunkCtxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 220),
                top: Math.min(chunkCtxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 768) - 140),
                minWidth: 220,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setEditingChunk({ docId: chunkCtxMenu.docId, chunk: chunkCtxMenu.chunk }); setChunkCtxMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                Edit chunk
              </button>
              <button
                onClick={() => { removeChunkFromDoc(chunkCtxMenu.docId, chunkCtxMenu.chunk); setChunkCtxMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-caption flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: "#ef4444" }}
              >
                Delete chunk from source
              </button>
            </div>
          )}
        </>
      )}
      addPickerNode={showAddPicker && (
        <AddDocsPicker
          existingIds={new Set(documents.map(d => d.id))}
          onClose={() => setShowAddPicker(false)}
          onAdd={(ids) => { handleAddDocs(ids); setShowAddPicker(false); }}
          authHeaders={parentAuthHeaders}
        />
      )}
    />
    {prepBannerNode}
    </>
  );
}

/**
 * Floating prep banner — owner-only, bottom-center, sticks until the
 * server-side auto-pipeline (graph analysis + vector embed) lands or
 * the user dismisses it. Pure design: warm zinc surface, small micro
 * dots for status, no progress bars (the work is bounded but variable
 * — a fake percentage would lie). The point is to close the gap where
 * a fresh bundle's URL exists but isn't yet useful to external AIs.
 */
function BundlePrepBanner({
  graphReady,
  embedReady,
  hasMultipleDocs,
  onDismiss,
}: {
  graphReady: boolean;
  embedReady: boolean;
  hasMultipleDocs: boolean;
  onDismiss: () => void;
}) {
  // Graph analysis only runs when there are 2+ docs (server-side
  // condition in /api/bundles POST after()). For single-doc bundles
  // there's no graph stage at all — drop it from the strip to avoid
  // confusing the user with a step that will never tick.
  const showGraph = hasMultipleDocs;
  const allDone = embedReady && (!showGraph || graphReady);
  if (allDone) return null;
  const Step = ({ label, ready, eta }: { label: string; ready: boolean; eta: string }) => (
    <span className="inline-flex items-center gap-1.5 text-caption" style={{ color: ready ? "var(--text-secondary)" : "var(--text-muted)" }}>
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: ready ? "var(--micro-lime)" : "var(--micro-info)",
          animation: ready ? undefined : "bundlePrepPulse 1.2s ease-in-out infinite",
        }}
      />
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span className="font-mono" style={{ color: "var(--text-faint)", fontSize: 10 }}>
        {ready ? "done" : eta}
      </span>
    </span>
  );
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[80] rounded-lg shadow-lg"
      style={{
        bottom: 20,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        padding: "10px 14px",
        maxWidth: "min(640px, calc(100vw - 32px))",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-caption font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Preparing this bundle for AI
          </div>
          <div className="flex items-center gap-3 flex-wrap mb-1.5">
            <Step label="Vector embed" ready={embedReady} eta="~5s" />
            {showGraph && <Step label="Graph analysis" ready={graphReady} eta="~1 min" />}
          </div>
          <div className="text-caption" style={{ color: "var(--text-faint)", fontSize: 11, lineHeight: 1.4 }}>
            The bundle URL works immediately for direct sharing. Semantic recall
            {showGraph ? " and the concept graph become" : " becomes"} available
            once this finishes — you can keep editing in the meantime.
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 -mt-1 -mr-1 w-6 h-6 inline-flex items-center justify-center rounded transition-colors hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-faint)" }}
          aria-label="Dismiss"
        >
          <XIcon width={12} height={12} />
        </button>
      </div>
      <style>{`@keyframes bundlePrepPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}

// ─── Layout wrapper: side-by-side when wide, drawer overlay when narrow ───
// Threshold = 700px. Below that, the NodeInfoPanel sits absolute over the
// canvas with a backdrop instead of pushing the canvas to a tiny strip.
function BundleCanvasLayout({
  canvas,
  selectedNodeInfo,
  onCloseNodeInfo,
  onOpenDoc,
  addPickerNode,
  sectionEditorNode,
  sectionCtxMenuNode,
  bulkChunkBarNode,
  addChunkModalNode,
  nodeInfoExtras,
  decomposeBridge,
  discoveriesPanel,
  reopenDiscoveriesNode,
}: {
  canvas: React.ReactNode;
  selectedNodeInfo: NodeInfoData | null;
  onCloseNodeInfo: () => void;
  onOpenDoc?: (docId: string) => void;
  addPickerNode: React.ReactNode;
  sectionEditorNode?: React.ReactNode;
  sectionCtxMenuNode?: React.ReactNode;
  bulkChunkBarNode?: React.ReactNode;
  addChunkModalNode?: React.ReactNode;
  nodeInfoExtras?: React.ReactNode;
  decomposeBridge?: DecomposeBridge;
  /** Discoveries panel — shown on the right when nothing is selected. */
  discoveriesPanel?: React.ReactNode;
  /** Floating "Discoveries" pill shown when the panel is hidden. */
  reopenDiscoveriesNode?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const obs = new ResizeObserver(() => setWidth(el.clientWidth));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const NARROW_THRESHOLD = 700;
  const isNarrow = width > 0 && width < NARROW_THRESHOLD;
  return (
    <div ref={containerRef} className="w-full h-full flex relative">
      <div className="flex-1 min-w-0">{canvas}</div>
      {/* Discoveries panel — default right-side when nothing is selected.
          Replaced by NodeInfoPanel as soon as a node is clicked, so the
          right side is always doing one focused thing. */}
      {!selectedNodeInfo && discoveriesPanel && !isNarrow && (
        <>{discoveriesPanel}</>
      )}
      {/* Re-open button when discoveries is hidden — only shown when nothing
          else is open on the right side. */}
      {!selectedNodeInfo && !discoveriesPanel && reopenDiscoveriesNode}
      {selectedNodeInfo && !isNarrow && (
        <NodeInfoPanel info={selectedNodeInfo} onClose={onCloseNodeInfo} onOpenDoc={onOpenDoc} decomposeBridge={decomposeBridge} />
      )}
      {selectedNodeInfo && isNarrow && (
        <>
          {/* Backdrop dismisses the drawer */}
          <div
            className="absolute inset-0 z-[150]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onCloseNodeInfo}
          />
          <div className="absolute top-0 bottom-0 right-0 z-[151] flex" style={{ maxWidth: "100%" }}>
            <NodeInfoPanel info={selectedNodeInfo} onClose={onCloseNodeInfo} onOpenDoc={onOpenDoc} decomposeBridge={decomposeBridge} />
          </div>
        </>
      )}
      {addPickerNode}
      {sectionEditorNode}
      {sectionCtxMenuNode}
      {addChunkModalNode}
      {/* Floating bulk-action bar — top-center, above canvas */}
      {bulkChunkBarNode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[40]">
          {bulkChunkBarNode}
        </div>
      )}
      {nodeInfoExtras}
    </div>
  );
}

function DiscoveriesReopenButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-[180px] z-[35] flex items-center gap-1.5 h-8 px-3 rounded-lg text-caption font-semibold transition-all hover:brightness-110"
      style={{ background: "var(--border)", border: "1px solid var(--text-primary)", color: "var(--text-primary)" }}
    >
      <Sparkles width={11} height={11} />
      <span>Discoveries</span>
      {count > 0 && (
        <span className="text-caption px-1 py-0 rounded font-mono tabular-nums" style={{ background: "var(--text-primary)", color: "var(--background)" }}>{count}</span>
      )}
    </button>
  );
}

// ─── Discoveries Panel — what the bundle wants to tell you ───
// Surfaces cross-doc tensions, open questions, action items, and recurring
// threads from AI-decomposed chunks. Default right-side view when nothing is
// selected; the bundle "talks first" instead of waiting for the user to dig.
function DiscoveriesPanel({
  discoveries,
  totalDocs,
  documents,
  isBulkRunning,
  onRun,
  onClose,
  onSelectChunk,
  onOpenDoc,
  intent,
  isOwner,
  onSaveIntent,
  tensionResolutions,
  onResolveTension,
}: {
  discoveries: {
    tensions: TensionItem[];
    questions: ChunkRef[];
    threads: ThreadItem[];
    insights: string[];
    gaps: string[];
    connections: { doc1Id: string; doc2Id: string; relationship: string }[];
    decomposedCount: number;
  };
  totalDocs: number;
  documents: Array<{ id: string; title: string | null }>;
  isBulkRunning: { done: number; total: number } | null;
  onRun: () => void;
  onClose: () => void;
  onSelectChunk: (ref: ChunkRef) => void;
  onOpenDoc?: (docId: string) => void;
  intent?: string;
  isOwner?: boolean;
  onSaveIntent?: (next: string) => void;
  tensionResolutions?: Record<string, { loading: boolean; text?: string; error?: string }>;
  onResolveTension?: (tension: TensionItem) => void;
}) {
  const { tensions, questions, threads, insights, gaps, connections, decomposedCount } = discoveries;
  const hasAny = tensions.length + questions.length + threads.length + insights.length + gaps.length + connections.length > 0;
  const fullyAnalyzed = decomposedCount === totalDocs && totalDocs > 0;
  const docTitleById = (id: string) => documents.find(d => d.id === id)?.title || "Untitled";

  return (
    <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: "min(420px, 50%)", borderLeft: "1px solid var(--border)", background: "var(--surface)" }}>
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles width={13} height={13} style={{ color: "var(--micro-ai)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Discoveries</span>
          <span className="text-caption px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)", color: "var(--text-faint)" }}>
            {decomposedCount} / {totalDocs} analyzed
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded transition-colors hover:bg-[var(--toggle-bg)] shrink-0" style={{ color: "var(--text-faint)" }} title="Hide discoveries">
          <XIcon width={14} height={14} />
        </button>
      </div>

      {/* Intent — the bundle's North Star. Owners can edit; viewers see it
          as a quoted purpose statement. The intent feeds into all AI prompts
          (decompose + bundle graph) so analysis is anchored. */}
      {(isOwner || intent) && (
        <BundleIntentBlock intent={intent || ""} canEdit={!!isOwner} onSave={onSaveIntent} />
      )}

      {/* Run / re-run CTA strip */}
      {(!fullyAnalyzed || isBulkRunning) && (
        <div className="shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-dim)", background: "var(--border)" }}>
          {isBulkRunning ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: "var(--text-primary)" }} />
                <span className="text-caption" style={{ color: "var(--text-primary)" }}>
                  Analyzing {isBulkRunning.done} / {isBulkRunning.total}…
                </span>
              </div>
              <div className="flex-1 ml-3 h-1 rounded-full overflow-hidden" style={{ background: "var(--toggle-bg)" }}>
                <div className="h-full transition-all" style={{ width: `${(isBulkRunning.done / isBulkRunning.total) * 100}%`, background: "var(--text-primary)" }} />
              </div>
            </>
          ) : (
            <>
              <span className="text-caption" style={{ color: "var(--text-secondary)" }}>
                {decomposedCount === 0
                  ? "Analyze every doc to surface cross-doc insights."
                  : `${totalDocs - decomposedCount} doc${totalDocs - decomposedCount === 1 ? "" : "s"} unanalyzed.`}
              </span>
              <button onClick={onRun}
                className="px-2.5 py-1 rounded-md text-caption font-semibold transition-colors hover:brightness-110 shrink-0"
                style={{ background: "var(--text-primary)", color: "var(--background)" }}>
                Run discovery
              </button>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {!hasAny && !isBulkRunning && (
          <div className="text-body text-center py-8 leading-relaxed" style={{ color: "var(--text-faint)" }}>
            {decomposedCount === 0
              ? "Run discovery to extract tensions, questions, action items, and cross-doc threads from your bundle."
              : "Nothing surfaced yet. Try analyzing more documents."}
          </div>
        )}

        {/* Tensions — left rail in danger color, no full-surface fill. Reads
            as a paragraph with citations instead of a colored alert box. */}
        {tensions.length > 0 && (
          <DiscoverySection
            icon={<AlertTriangle width={12} height={12} style={{ color: "var(--micro-red)" }} />}
            label="Tensions"
            count={tensions.length}
            color="var(--color-danger)"
            defaultOpen
          >
            {tensions.map(t => {
              const res = tensionResolutions?.[t.id];
              return (
                <div key={t.id} className="flex flex-col"
                  style={{ paddingLeft: 12, borderLeft: "2px solid var(--color-danger)", gap: 6 }}>
                  <button onClick={() => onSelectChunk(t.source)}
                    className="text-left text-caption leading-snug hover:underline"
                    style={{ color: "var(--text-primary)" }}>
                    <span className="font-semibold">{t.source.chunkLabel}</span>
                    <span className="text-caption ml-2" style={{ color: "var(--text-faint)" }}>{t.source.docTitle}</span>
                  </button>
                  <span className="font-mono uppercase self-start" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--color-danger)" }}>↔ {t.relation}</span>
                  <button onClick={() => onSelectChunk(t.target)}
                    className="text-left text-caption leading-snug hover:underline"
                    style={{ color: "var(--text-primary)" }}>
                    <span className="font-semibold">{t.target.chunkLabel}</span>
                    <span className="text-caption ml-2" style={{ color: "var(--text-faint)" }}>{t.target.docTitle}</span>
                  </button>
                  {!res && onResolveTension && (
                    <button
                      onClick={() => onResolveTension(t)}
                      className="self-start text-caption font-mono uppercase hover:underline"
                      style={{ fontSize: 10, letterSpacing: 0.4, color: "var(--color-danger)", padding: "2px 0" }}
                    >
                      Resolve with AI →
                    </button>
                  )}
                  {res?.loading && (
                    <div className="text-caption flex items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-danger)" }} />
                      Reconciling…
                    </div>
                  )}
                  {res?.error && (
                    <div className="text-caption" style={{ color: "var(--color-danger)" }}>Error: {res.error}</div>
                  )}
                  {res?.text && (
                    <div className="text-caption leading-relaxed whitespace-pre-wrap"
                      style={{ color: "var(--text-secondary)", paddingLeft: 8, borderLeft: "2px solid var(--color-success)", marginTop: 4 }}>
                      {res.text}
                    </div>
                  )}
                </div>
              );
            })}
          </DiscoverySection>
        )}

        {/* Bundle-level Insights — Zap icon (the "aha" moment) instead of
            Lightbulb, which is the canonical Concepts icon and was making
            insight rows look like another concept row. */}
        {insights.length > 0 && (
          <DiscoverySection
            icon={<Zap width={12} height={12} style={{ color: "var(--color-warm)" }} />}
            label="Insights"
            count={insights.length}
            color="var(--color-warm)"
            defaultOpen
          >
            {insights.map((ins, i) => (
              <div key={i} className="flex gap-2.5 items-baseline">
                <Zap width={11} height={11} style={{ color: "var(--color-warm)", flexShrink: 0, transform: "translateY(2px)" }} />
                <p className="text-caption leading-[1.55]" style={{ color: "var(--text-secondary)" }}>{ins}</p>
              </div>
            ))}
          </DiscoverySection>
        )}

        {/* Open Questions — clickable rows with hover row, no fill. */}
        {questions.length > 0 && (
          <DiscoverySection
            icon={<HelpCircle width={12} height={12} style={{ color: "var(--color-cool)" }} />}
            label="Open Questions"
            count={questions.length}
            color="var(--color-cool)"
            defaultOpen={false}
          >
            {questions.map(q => (
              <button key={`${q.docId}:${q.chunkId}`} onClick={() => onSelectChunk(q)}
                className="w-full text-left rounded transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ padding: "4px 6px" }}>
                <div className="text-caption font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
                  {q.chunkLabel}
                </div>
                <div className="text-caption" style={{ color: "var(--text-faint)" }}>{q.docTitle}</div>
              </button>
            ))}
          </DiscoverySection>
        )}

        {/* Gaps — left rail, plain text. Same pattern as Analysis panel. */}
        {gaps.length > 0 && (
          <DiscoverySection
            icon={<HelpCircle width={12} height={12} style={{ color: "var(--color-warm)" }} />}
            label="Gaps"
            count={gaps.length}
            color="var(--color-warm)"
            defaultOpen={false}
          >
            {gaps.map((g, i) => (
              <p key={i} className="text-caption leading-[1.55]" style={{ color: "var(--text-secondary)", paddingLeft: 12, borderLeft: "2px solid var(--color-warm)" }}>
                {g}
              </p>
            ))}
          </DiscoverySection>
        )}

        {/* Doc-to-doc Connections — clean row, no box outline. */}
        {connections.length > 0 && (
          <DiscoverySection
            icon={<GitBranch width={12} height={12} style={{ color: "var(--color-cool)" }} />}
            label="Connections"
            count={connections.length}
            color="var(--color-cool)"
            defaultOpen={false}
          >
            {connections.map((c, i) => (
              <div key={i} className="rounded transition-colors hover:bg-[var(--toggle-bg)]" style={{ padding: "4px 6px" }}>
                <div className="flex items-center flex-wrap" style={{ gap: 6, marginBottom: 2 }}>
                  <button onClick={() => onOpenDoc?.(c.doc1Id)}
                    className="text-caption font-medium hover:underline truncate"
                    style={{ color: "var(--text-primary)", maxWidth: "45%" }}>
                    {docTitleById(c.doc1Id)}
                  </button>
                  <span className="font-mono shrink-0" style={{ fontSize: 11, color: "var(--color-cool)", fontWeight: 600 }}>↔</span>
                  <button onClick={() => onOpenDoc?.(c.doc2Id)}
                    className="text-caption font-medium hover:underline truncate"
                    style={{ color: "var(--text-primary)", maxWidth: "45%" }}>
                    {docTitleById(c.doc2Id)}
                  </button>
                </div>
                <div className="text-caption leading-snug" style={{ color: "var(--text-muted)" }}>
                  {c.relationship}
                </div>
              </div>
            ))}
          </DiscoverySection>
        )}

        {/* Cross-doc Threads — header + nested doc list. No surrounding box. */}
        {threads.length > 0 && (
          <DiscoverySection
            icon={<GitBranch width={12} height={12} style={{ color: "var(--color-neutral)" }} />}
            label="Threads"
            count={threads.length}
            color="var(--color-neutral)"
            defaultOpen={false}
          >
            {threads.map(t => (
              <div key={t.id} className="flex flex-col" style={{ gap: 2 }}>
                <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: 0.4, color: "var(--color-neutral)" }}>
                  {t.label}
                </div>
                <div className="flex flex-col" style={{ gap: 0, paddingLeft: 8 }}>
                  {t.occurrences.map(ref => (
                    <button key={`${ref.docId}:${ref.chunkId}`} onClick={() => onSelectChunk(ref)}
                      className="text-left text-caption leading-snug hover:underline truncate"
                      style={{ color: "var(--text-secondary)" }}>
                      {ref.docTitle}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </DiscoverySection>
        )}
      </div>
    </div>
  );
}

// ─── Intent block — a single editable line that anchors AI analysis ───
function BundleIntentBlock({ intent, canEdit, onSave }: {
  intent: string;
  canEdit: boolean;
  onSave?: (next: string) => void;
}) {
  const [editing, setEditing] = useState(intent.length === 0 && canEdit);
  const [draft, setDraft] = useState(intent);
  useEffect(() => { setDraft(intent); }, [intent]);

  const commit = () => {
    const next = draft.trim();
    if (next !== intent) onSave?.(next);
    setEditing(false);
  };

  return (
    <div className="shrink-0 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-dim)", background: "var(--toggle-bg)" }}>
      <div className="text-caption font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-faint)" }}>
        Intent
      </div>
      {editing && canEdit ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(intent); setEditing(false); } }}
          placeholder="What question is this bundle here to answer?"
          className="w-full text-body px-2 py-1 rounded outline-none"
          style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--text-primary)" }}
        />
      ) : (
        <button
          onClick={() => canEdit && setEditing(true)}
          className="block w-full text-left text-body leading-snug rounded px-2 py-1 transition-colors hover:bg-[var(--menu-hover)]"
          style={{
            color: intent ? "var(--text-primary)" : "var(--text-faint)",
            cursor: canEdit ? "text" : "default",
            fontStyle: intent ? "normal" : "italic",
          }}
        >
          {intent || (canEdit ? "Click to set the question this bundle answers…" : "No intent set")}
        </button>
      )}
    </div>
  );
}

function DiscoverySection({ icon, label, count, color, defaultOpen = true, children }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full transition-colors rounded hover:bg-[var(--toggle-bg)]"
        style={{ gap: "var(--space-2)", padding: "var(--space-1) var(--space-1)", marginBottom: open ? "var(--space-2)" : 0 }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--text-faint)", transition: "transform var(--duration-fast)", transform: open ? "rotate(90deg)" : "none" }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {icon}
        <span className="text-caption font-semibold uppercase tracking-wider flex-1 text-left" style={{ color }}>{label}</span>
        <span className="text-caption font-mono tabular-nums rounded" style={{ background: `${color}18`, color, padding: "0 var(--space-1)" }}>{count}</span>
      </button>
      {open && <div className="flex flex-col" style={{ gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>{children}</div>}
    </div>
  );
}

// ─── Section Editor — modal for editing one section's heading + body ───
function SectionEditor({ docId, section, onClose, onSave }: {
  docId: string;
  section: Section;
  onClose: () => void;
  onSave: (next: Section) => void | Promise<void>;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [level, setLevel] = useState(section.level);
  const [saving, setSaving] = useState(false);
  const dirty = heading !== section.heading || body !== section.body || level !== section.level;
  void docId; // future: save under different doc
  return (
    <ModalShell
      open
      onClose={onClose}
      size="lg"
      title="Edit section"
      headerExtras={
        section.level > 0 ? (
          <select
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="text-caption rounded outline-none"
            style={{ background: "var(--toggle-bg)", color: "var(--text-secondary)", border: "1px solid var(--border-dim)", padding: "2px var(--space-2)" }}
          >
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>H{n}</option>)}
          </select>
        ) : (
          <Badge>Preamble</Badge>
        )
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || saving}
            loading={saving}
            onClick={async () => {
              if (!dirty || saving) return;
              setSaving(true);
              await onSave({ ...section, heading: heading.trim(), body, level });
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 min-h-0">
        {section.level > 0 && (
          <input
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Heading"
            className="text-heading rounded-md outline-none"
            style={{ background: "var(--toggle-bg)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)" }}
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Section content (markdown)…"
          spellCheck={false}
          className="text-body rounded-md outline-none resize-none flex-1"
          style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)", fontFamily: "var(--font-mono)", lineHeight: 1.55, minHeight: 240 }}
        />
      </div>
    </ModalShell>
  );
}

// ─── Chunk Editor — modal for editing one semantic chunk. Editing
// happens on the rendered output via the same Tiptap surface the main
// editor uses (no Source/Preview toggle, no markdown syntax exposed).
// The Tiptap bundle is lazy-loaded so opening other modals doesn't pay
// its cost.
const TiptapLiveEditor = dynamic(() => import("@/components/TiptapLiveEditor"), {
  ssr: false,
  loading: () => (
    <p className="text-caption" style={{ color: "var(--text-faint)" }}>Loading editor…</p>
  ),
});

function ChunkLiveEditor({ markdown, onChange }: { markdown: string; onChange: (md: string) => void }) {
  return (
    <TiptapLiveEditor
      markdown={markdown}
      onChange={onChange}
      canEdit
      narrowView={false}
    />
  );
}

const CHUNK_TYPE_RAIL: Record<string, string> = {
  concept: "#38bdf8",
  claim: "#fb923c",
  example: "#4ade80",
  definition: "#60a5fa",
  task: "#fbbf24",
  question: "#a78bfa",
  context: "#94a3b8",
  evidence: "#f472b6",
};

function ChunkEditor({ chunk, onClose, onSave }: {
  chunk: SemanticChunk;
  onClose: () => void;
  onSave: (newContent: string, newLabel: string) => void | Promise<void>;
}) {
  const [content, setContent] = useState(chunk.content);
  const [label, setLabel] = useState(chunk.label);
  const [saving, setSaving] = useState(false);
  const dirty = content !== chunk.content || label !== chunk.label;
  const railColor = CHUNK_TYPE_RAIL[chunk.type] || CHUNK_TYPE_RAIL.context;

  return (
    <ModalShell
      open
      onClose={onClose}
      size="lg"
      title="Edit chunk"
      headerExtras={
        <div className="flex items-center gap-1.5">
          {/* Type badge — same mono-9px contract as the chunk list +
              canvas card so we have one badge language across the bundle. */}
          <span
            className="font-mono uppercase px-1 py-px rounded shrink-0"
            style={{
              color: railColor,
              background: `${railColor}14`,
              fontSize: 9,
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            {chunk.type}
          </span>
          {chunk.found === false && (
            <Tooltip text="Source text drifted — edits cannot be located in the document. Re-run Decompose first." position="bottom">
              <span
                className="font-mono uppercase shrink-0 flex items-center gap-1"
                style={{ color: "#ef4444", fontSize: 9, letterSpacing: 0.4, fontWeight: 600 }}
              >
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                Stale
              </span>
            </Tooltip>
          )}
        </div>
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || saving}
            loading={saving}
            onClick={async () => {
              if (!dirty || saving) return;
              setSaving(true);
              await onSave(content, label.trim());
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 min-h-0">
        {/* Label row — small mono uppercase tag in front of the input
            (was an oversized header above it). */}
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase shrink-0"
            style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)", fontWeight: 600 }}
          >
            Label
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Short title (3-5 words)"
            className="flex-1 text-body font-semibold rounded-md outline-none"
            style={{ background: "var(--toggle-bg)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)" }}
          />
        </div>

        {/* Live editor — same Tiptap surface the main editor uses. No
            Source/Preview toggle: editing happens directly on the
            rendered output (markdown is the underlying format but the
            user never sees the syntax). Mounted dynamically so the
            Tiptap bundle isn't pulled in until someone opens the modal. */}
        <div className="flex-1 flex flex-col min-h-0">
          <span
            className="font-mono uppercase mb-2"
            style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)", fontWeight: 600 }}
          >
            Content
          </span>
          <div
            className="mdcore-rendered flex-1 overflow-auto rounded-md outline-none"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border-dim)",
              padding: "var(--space-3) var(--space-4)",
              minHeight: 220,
            }}
          >
            <ChunkLiveEditor markdown={content} onChange={setContent} />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Bulk action bar for multi-selected chunks ───
function ChunkBulkBar({ count, onClear, onCopy, onExtract, onExtractKeep, onDelete }: {
  count: number;
  onClear: () => void;
  onCopy: () => void;
  onExtract: () => void;
  onExtractKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-lg shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--text-primary)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
      <span className="text-caption font-semibold px-2 py-1 rounded-md"
        style={{ color: "var(--text-primary)", background: "var(--border)" }}>
        {count} selected
      </span>
      <div style={{ width: 1, height: 18, background: "var(--border-dim)" }} />
      <Tooltip text="Copy selected chunks to clipboard" position="bottom">
        <button onClick={onCopy}
          className="px-2 py-1 text-caption rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-secondary)" }}>
          Copy
        </button>
      </Tooltip>
      <Tooltip text="Move selected chunks into a new document (removes from source)" position="bottom">
        <button onClick={onExtract}
          className="px-2 py-1 text-caption rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-secondary)" }}>
          Extract → new doc
        </button>
      </Tooltip>
      <Tooltip text="Copy selected chunks into a new document (keeps in source)" position="bottom">
        <button onClick={onExtractKeep}
          className="px-2 py-1 text-caption rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-secondary)" }}>
          Branch → new doc
        </button>
      </Tooltip>
      <div style={{ width: 1, height: 18, background: "var(--border-dim)" }} />
      <Tooltip text="Delete selected chunks from source" position="bottom">
        <button onClick={onDelete}
          className="px-2 py-1 text-caption rounded-md transition-colors hover:bg-[rgba(239,68,68,0.12)]"
          style={{ color: "#ef4444" }}>
          Delete
        </button>
      </Tooltip>
      <div style={{ width: 1, height: 18, background: "var(--border-dim)" }} />
      <Tooltip text="Clear selection (Esc)" position="bottom">
        <button onClick={onClear}
          className="p-1 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-faint)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </Tooltip>
    </div>
  );
}

// ─── Add Chunk modal — composes a new chunk and appends to source doc ───
const ADD_CHUNK_TYPES = ["concept", "claim", "example", "definition", "task", "question", "context", "evidence"] as const;
function AddChunkModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (label: string, content: string) => void | Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const valid = label.trim().length > 0 && content.trim().length > 0;
  return (
    <ModalShell
      open
      onClose={onClose}
      size="md"
      title="Add new chunk"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!valid || creating}
            loading={creating}
            onClick={async () => {
              if (!valid || creating) return;
              setCreating(true);
              await onCreate(label.trim(), content.trim());
              setCreating(false);
            }}
          >
            {creating ? "Adding…" : "Add chunk"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 min-h-0">
        <div>
          <label className="text-caption font-semibold uppercase tracking-wider block" style={{ color: "var(--text-faint)", marginBottom: "var(--space-1)" }}>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Short title (3-5 words)"
            autoFocus
            className="w-full text-body font-semibold rounded-md outline-none"
            style={{ background: "var(--toggle-bg)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)" }}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <label className="text-caption font-semibold uppercase tracking-wider block" style={{ color: "var(--text-faint)", marginBottom: "var(--space-1)" }}>Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What does this chunk say? Markdown is fine."
            spellCheck={false}
            className="text-body rounded-md outline-none resize-none flex-1"
            style={{ background: "var(--background)", color: "var(--text-primary)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)", fontFamily: "var(--font-mono)", lineHeight: 1.55, minHeight: 200 }}
          />
          <p className="text-caption" style={{ color: "var(--text-faint)", marginTop: "var(--space-2)" }}>
            The chunk will be appended to the source document and re-classified by AI on the next decompose run.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
// expose chunk type list for the toolbar/filter (used elsewhere)
export const CHUNK_TYPES = ADD_CHUNK_TYPES;

// ─── Synthesis modal — preview AI-generated Memo / FAQ / Brief ───
function SynthesisModal({ kind, isLoading, markdown, onClose, onSaveAsDoc, onCopy }: {
  kind: string;
  isLoading: boolean;
  markdown: string;
  onClose: () => void;
  onSaveAsDoc: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
}) {
  const titles: Record<string, string> = { memo: "Decision Memo", faq: "Frequently Asked Questions", brief: "Brief" };
  const subs: Record<string, string> = {
    memo: "1-page synthesis with key findings, tensions, and recommendations.",
    faq: "Synthesized questions and answers across all docs.",
    brief: "Narrative essay tying the bundle together.",
  };
  return (
    <ModalShell
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles width={14} height={14} style={{ color: "var(--micro-ai)" }} />
          {titles[kind] || "Synthesis"}
        </span>
      }
      subtitle={subs[kind]}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button variant="secondary" size="sm" disabled={isLoading || !markdown} onClick={onCopy}>Copy</Button>
          <Button variant="primary" size="sm" disabled={isLoading || !markdown} onClick={onSaveAsDoc}>
            Save as document
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <MemoryWikiLogo size={48} variant="icon-only" />
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
            Synthesizing
          </span>
          <span className="text-caption" style={{ color: "var(--text-faint)" }}>Usually 5–15 seconds</span>
        </div>
      ) : (
        <pre className="text-body whitespace-pre-wrap font-sans" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>{markdown}</pre>
      )}
    </ModalShell>
  );
}

type NodeInfoData = {
  type: string; label: string; weight?: number; description?: string;
  summary?: string; themes?: string[]; insights?: string[];
  keyTakeaways?: string[]; gaps?: string[];
  connectedDocs?: Array<{ id: string; title: string }>;
  relationships?: Array<{
    label: string;
    target: string;
    targetId?: string;
    targetKind?: "doc" | "concept" | "entity" | "tag" | "other";
    direction?: "in" | "out";
  }>;
  coverage?: {
    docs: number;
    concepts: number;
    entities: number;
    tags: number;
    connections: number;
    generatedAt: string | null;
  };
  connections?: Array<{
    doc1: string; doc2: string; doc1Id: string; doc2Id: string; relationship: string;
  }>;
  docId?: string;
  docContent?: string;
  docStats?: { wordCount: number; readingTime: number; sections: number; hasCode: boolean };
  documentSummary?: string;
};

// ─── Add documents picker — modal listing user docs not yet in bundle ───

function AddDocsPicker({ existingIds, onClose, onAdd, authHeaders }: { existingIds: Set<string>; onClose: () => void; onAdd: (ids: string[]) => void; authHeaders?: Record<string, string> }) {
  const [docs, setDocs] = useState<Array<{ id: string; title: string | null; updated_at: string }>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let headers: Record<string, string> = {};
    if (authHeaders) {
      headers = { ...authHeaders };
    } else {
      try {
        const anonId = localStorage.getItem("mw-anonymous-id");
        if (anonId) headers["x-anonymous-id"] = anonId;
        const userId = localStorage.getItem("mw-user-id");
        if (userId) headers["x-user-id"] = userId;
        const userEmail = localStorage.getItem("mw-user-email");
        if (userEmail) headers["x-user-email"] = userEmail;
      } catch { /* ignore */ }
    }
    fetch("/api/user/documents", { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.documents) {
          // Exclude docs already in this bundle
          setDocs(data.documents.filter((d: { id: string }) => !existingIds.has(d.id)));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [existingIds, authHeaders]);

  const filtered = filter
    ? docs.filter(d => (d.title || "").toLowerCase().includes(filter.toLowerCase()))
    : docs;

  return (
    <ModalShell
      open
      onClose={onClose}
      size="sm"
      title="Add documents to bundle"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => onAdd(Array.from(selected))}
          >
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </>
      }
    >
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search documents…"
        className="w-full text-body rounded-md outline-none"
        style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", padding: "var(--space-1) var(--space-2)", marginBottom: "var(--space-3)" }}
      />
      {loading ? (
        <div className="text-center text-body" style={{ color: "var(--text-faint)", padding: "var(--space-8) 0" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-body" style={{ color: "var(--text-faint)", padding: "var(--space-8) 0" }}>
          {docs.length === 0 ? "No other documents available." : "No documents match your search."}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {filtered.map(d => {
            const checked = selected.has(d.id);
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(d.id)) next.delete(d.id); else next.add(d.id);
                    return next;
                  });
                }}
                className="w-full flex items-center text-left text-body transition-colors hover:bg-[var(--menu-hover)] rounded"
                style={{ color: "var(--text-secondary)", gap: "var(--space-2)", padding: "var(--space-2) var(--space-2)" }}
              >
                <span className="shrink-0 w-4 h-4 rounded border flex items-center justify-center" style={{
                  background: checked ? "var(--text-primary)" : "transparent",
                  borderColor: checked ? "var(--text-primary)" : "var(--border)",
                }}>
                  {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </span>
                <span className="flex-1 truncate">{d.title || "Untitled"}</span>
              </button>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

// ─── Node Info Side Panel — shows details for clicked concept/analysis node ───

interface DecomposeBridge {
  decomposition: SemanticChunksResult | null;
  isDecomposing: boolean;
  onRequestDecompose: () => void;
  onRedecompose: () => void;
  onEditChunk: (chunk: SemanticChunk) => void;
  onDeleteChunk: (chunk: SemanticChunk) => void;
  onAddChunk: () => void;
  onMoveChunk: (chunkId: string, direction: "up" | "down") => void;
  onExtractChunk: (chunkId: string, removeFromSource: boolean) => void;
}

function NodeInfoPanel({ info, onClose, onOpenDoc, decomposeBridge }: {
  info: any;
  onClose: () => void;
  onOpenDoc?: (docId: string) => void;
  decomposeBridge?: DecomposeBridge;
}) {
  // Lock the panel header color to the same hex the canvas node uses, so
  // the side-panel "icon + title" block reads as the exact same node the
  // user clicked. The previous theme-token mapping (--color-neutral for
  // tag, --color-cool for concept) drifted from the canvas hex (purple,
  // sky) which made the panel feel like a different object.
  const colorMap: Record<string, string> = {
    analysis: "#60a5fa",
    concept: "#38bdf8",
    entity: "#4ade80",
    tag: "#a78bfa",
    document: "#fb923c",
  };
  const color = colorMap[info.type] || "var(--text-faint)";
  const NodeIcon = info.type === "analysis" ? Sparkles
    : info.type === "entity" ? CheckSquare
    : info.type === "tag" ? Tag
    : info.type === "concept" ? Lightbulb
    : info.type === "document" ? FileText
    : Layers;

  // Resizable width — persists across selections in this session
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 420;
    try {
      const saved = localStorage.getItem("mw-bundle-info-panel-width");
      if (saved) return Math.max(280, Math.min(720, parseInt(saved) || 420));
    } catch { /* ignore */ }
    return 420;
  });
  const isDraggingRef = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newW = Math.max(280, Math.min(720, window.innerWidth - e.clientX));
      setWidth(newW);
    };
    const onUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem("mw-bundle-info-panel-width", String(width)); } catch { /* ignore */ }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  return (
    <div className="shrink-0 flex flex-col overflow-hidden relative" style={{ width, borderLeft: "1px solid var(--border)", background: "var(--surface)" }}>
      {/* Resize handle — same style as the left sidebar */}
      <div
        className="absolute top-0 bottom-0 cursor-col-resize z-[100]"
        style={{ width: 5, left: -2, background: "var(--border-dim)" }}
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-8" style={{ background: "var(--text-faint)", borderRadius: 2, opacity: 0.3 }} />
      </div>
      {/* Header */}
      <div className="shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <NodeIcon width={14} height={14} style={{ color, flexShrink: 0 }} />
          <span className="text-heading truncate" style={{ color: "var(--text-primary)" }}>{info.label}</span>
          {info.type === "document" && info.docId && onOpenDoc && (
            <button
              onClick={() => onOpenDoc(info.docId)}
              className="text-xs px-2 py-0.5 rounded shrink-0 transition-colors hover:text-[var(--text-primary)] hover:border-[var(--border)] hover:bg-[var(--toggle-bg)]"
              style={{ color: "var(--text-faint)", border: "1px solid var(--border-dim)", background: "transparent" }}
            >
              Open
            </button>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded transition-colors hover:bg-[var(--toggle-bg)] shrink-0" style={{ color: "var(--text-faint)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* For document type, split into Insights / Document tabs so the actual
          markdown content lives in its own scroll area, separated from AI
          analysis + metadata. Other node types render flat (no tabs). */}
      {info.type === "document" ? (
        <DocumentNodeBody info={info} decomposeBridge={decomposeBridge} onOpenDoc={onOpenDoc} />
      ) : (
      <div className="flex-1 overflow-auto" style={{ fontSize: 12 }}>

        {/* Analysis panel — sections render as alternating-background rows
            (table-zebra pattern) so each section has clear visual separation
            without colored boxes or left-rail accents. Body text is locked to
            12px (sidebar baseline) so the panel matches the rest of the app's
            type scale. Coverage stats render with icons + tooltip per metric
            so the user understands what each number means without guessing. */}
        {info.type === "analysis" && (() => {
          const cov = info.coverage;
          const ageStr = cov?.generatedAt ? (() => {
            const ms = Date.now() - new Date(cov.generatedAt!).getTime();
            const m = Math.floor(ms / 60000);
            if (m < 1) return "just now";
            if (m < 60) return `${m}m ago`;
            const h = Math.floor(m / 60);
            if (h < 24) return `${h}h ago`;
            const d = Math.floor(h / 24);
            return `${d}d ago`;
          })() : null;
          const SectionLabel = ({ children }: { children: React.ReactNode }) => (
            <h4 className="font-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>{children}</h4>
          );
          // Stat with icon + tooltip — each Coverage metric gets a quick
          // explanation on hover so "29 concepts" is no longer mysterious.
          const StatItem = ({ value, label, color, Icon, tooltip }: { value: number; label: string; color?: string; Icon: typeof Sparkles; tooltip: string }) => (
            <Tooltip text={tooltip} position="top">
              <div className="flex items-center" style={{ gap: 5, minWidth: 0 }}>
                <Icon width={11} height={11} style={{ color: color || "var(--text-faint)", flexShrink: 0 }} />
                <span className="tabular-nums font-semibold" style={{ fontSize: 13, color: color || "var(--text-primary)", lineHeight: 1.1 }}>{value.toLocaleString()}</span>
                <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>{label}</span>
              </div>
            </Tooltip>
          );
          // Section wrapper that applies the alternating background. Index
          // controlled by callsite so we don't have to plumb context.
          const Section = ({ index, children }: { index: number; children: React.ReactNode }) => (
            <section style={{
              padding: "14px 20px",
              background: index % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--toggle-bg) 45%, transparent)",
              borderTop: index === 0 ? "none" : "1px solid var(--border-dim)",
            }}>
              {children}
            </section>
          );
          // Compose the visible sections in order so the alternating row index
          // is correct even when some are absent (e.g. no Gaps).
          const sections: React.ReactNode[] = [];
          if (cov) {
            sections.push(
              <Section key="coverage" index={sections.length}>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel>Coverage</SectionLabel>
                  {ageStr && (
                    <span className="font-mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>analyzed {ageStr}</span>
                  )}
                </div>
                <div className="flex items-center flex-wrap" style={{ rowGap: 8, columnGap: 14 }}>
                  <StatItem value={cov.docs} label="docs" color="#fb923c" Icon={FileText} tooltip="Source documents in this bundle." />
                  {cov.concepts > 0 && <StatItem value={cov.concepts} label="concepts" color="#38bdf8" Icon={Lightbulb} tooltip="Distinct concepts the AI extracted across docs." />}
                  {cov.entities > 0 && <StatItem value={cov.entities} label="entities" color="#4ade80" Icon={CheckSquare} tooltip="Specific things the AI identified — products, people, projects." />}
                  {cov.tags > 0 && <StatItem value={cov.tags} label="tags" color="#a78bfa" Icon={Tag} tooltip="Topical tags the AI assigned across the bundle." />}
                  {cov.connections > 0 && <StatItem value={cov.connections} label="links" color="#60a5fa" Icon={GitBranch} tooltip="Doc-to-doc relationships the AI surfaced." />}
                </div>
              </Section>
            );
          }
          if (info.summary) {
            sections.push(
              <Section key="summary" index={sections.length}>
                <SectionLabel>Summary</SectionLabel>
                <p style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-primary)" }}>{info.summary}</p>
              </Section>
            );
          }
          if (info.keyTakeaways && info.keyTakeaways.length > 0) {
            sections.push(
              <Section key="takeaways" index={sections.length}>
                <SectionLabel>Key takeaways</SectionLabel>
                <ol className="space-y-2">
                  {info.keyTakeaways.map((t: string, i: number) => (
                    <li key={i} className="flex gap-3 items-baseline">
                      <span className="font-mono tabular-nums shrink-0" style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.5, minWidth: 22 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)" }}>{t}</p>
                    </li>
                  ))}
                </ol>
              </Section>
            );
          }
          if (info.themes && info.themes.length > 0) {
            sections.push(
              <Section key="themes" index={sections.length}>
                <SectionLabel>Themes</SectionLabel>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {info.themes.map((t: string, i: number) => (
                    <span key={i} className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: 0.5, color: "#60a5fa", padding: "2px 6px", border: "1px solid color-mix(in srgb, #60a5fa 30%, transparent)", borderRadius: 4 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            );
          }
          if (info.connections && info.connections.length > 0) {
            sections.push(
              <Section key="connections" index={sections.length}>
                <SectionLabel>Document connections</SectionLabel>
                <div className="space-y-1.5">
                  {(info.connections as Array<{ doc1: string; doc2: string; doc1Id: string; doc2Id: string; relationship: string }>).map((c, i) => (
                    <div key={i} className="rounded px-2 py-1.5" style={{ background: "var(--bg-elevated)" }}>
                      <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                        <button
                          onClick={() => onOpenDoc?.(c.doc1Id)}
                          className="font-medium truncate text-left hover:underline"
                          style={{ fontSize: 12, color: "var(--text-primary)", maxWidth: "45%" }}
                          title={c.doc1}
                        >
                          {c.doc1}
                        </button>
                        <span className="font-mono shrink-0" style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>↔</span>
                        <button
                          onClick={() => onOpenDoc?.(c.doc2Id)}
                          className="font-medium truncate text-left hover:underline"
                          style={{ fontSize: 12, color: "var(--text-primary)", maxWidth: "45%" }}
                          title={c.doc2}
                        >
                          {c.doc2}
                        </button>
                      </div>
                      <p className="leading-snug mt-1" style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.relationship}</p>
                    </div>
                  ))}
                </div>
              </Section>
            );
          }
          if (info.insights && info.insights.length > 0) {
            sections.push(
              <Section key="insights" index={sections.length}>
                <SectionLabel>Cross-doc insights</SectionLabel>
                <ul className="space-y-2">
                  {info.insights.map((ins: string, i: number) => (
                    <li key={i} className="flex gap-2.5 items-baseline">
                      <Zap width={11} height={11} style={{ color: "var(--text-primary)", flexShrink: 0, transform: "translateY(2px)" }} />
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)" }}>{ins}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          }
          if (info.gaps && info.gaps.length > 0) {
            sections.push(
              <Section key="gaps" index={sections.length}>
                <SectionLabel>Gaps</SectionLabel>
                <ul className="space-y-1.5">
                  {info.gaps.map((g: string, i: number) => (
                    <li key={i} className="flex gap-2 items-baseline">
                      <span className="shrink-0 font-mono" style={{ color: "#f87171", fontSize: 12, fontWeight: 700 }}>!</span>
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)" }}>{g}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          }
          return <>{sections}</>;
        })()}

        {/* Concept/Entity/Tag panel — the subject (this concept) is shown in
            the panel header, so each row reads as "{subject} —{verb}→ {object}"
            without restating the subject. The targetKind dot tells you at a
            glance whether the link points to a doc, another concept, an
            entity, or a tag. */}
        {/* Concept/Entity/Tag panel — uses the same alternating-section
            pattern as the analysis view + 12px body for consistency. */}
        {(info.type === "concept" || info.type === "entity" || info.type === "tag") && (() => {
          const SectionLabel = ({ children }: { children: React.ReactNode }) => (
            <h4 className="font-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>{children}</h4>
          );
          const Section = ({ index, children }: { index: number; children: React.ReactNode }) => (
            <section style={{
              padding: "14px 20px",
              background: index % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--toggle-bg) 45%, transparent)",
              borderTop: index === 0 ? "none" : "1px solid var(--border-dim)",
            }}>
              {children}
            </section>
          );
          const sections: React.ReactNode[] = [];
          // Subject's own type-color matches the canvas exactly (TYPE_COLORS),
          // so the relationship-row source dot reads as "this is the same
          // node you clicked on the canvas, in its canvas color".
          const subjectColor =
            info.type === "concept" ? "#38bdf8" :
            info.type === "entity" ? "#4ade80" :
            info.type === "tag" ? "#a78bfa" :
            "var(--text-faint)";
          if (info.weight || info.description) {
            // Importance — section label sits on its own row (so it lines
            // up with the other section labels in this panel), and the
            // value + band + gauge share a single second row. Gauge is a
            // 10-dot meter (filled vs hollow) so it reads as "9 of 10
            // beats" without repeating the prior horizontal-track or
            // mini-bars treatments.
            const w = info.weight || 0;
            const band = w >= 9 ? "Critical" : w >= 7 ? "High" : w >= 4 ? "Medium" : "Low";
            const importanceTooltip = "Importance is the weight (0–10) the AI assigned this node when it built the bundle graph. Higher = appeared in more docs and contributed more to the cross-doc analysis. Use it to decide which concepts deserve their own doc or bundle.";
            sections.push(
              <Section key="meta" index={sections.length}>
                {info.weight && (
                  <Tooltip text={importanceTooltip} position="bottom">
                    <div className="flex flex-col mb-3" style={{ gap: 8, cursor: "help" }}>
                      <SectionLabel>Importance</SectionLabel>
                      <div className="flex items-center" style={{ gap: 10 }}>
                        <span className="flex items-baseline" style={{ gap: 3 }}>
                          <span className="font-mono tabular-nums font-semibold" style={{ fontSize: 14, color: subjectColor, lineHeight: 1 }}>{w}</span>
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>/10</span>
                        </span>
                        <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: subjectColor }}>{band}</span>
                        <div className="flex items-center ml-auto" style={{ gap: 3 }}>
                          {Array.from({ length: 10 }).map((_, i) => {
                            const filled = i < w;
                            return (
                              <span
                                key={i}
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 999,
                                  background: filled ? subjectColor : "transparent",
                                  border: filled ? "none" : `1px solid var(--border)`,
                                  boxSizing: "border-box",
                                  display: "inline-block",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                )}
                {info.description && (
                  <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)" }}>{info.description}</p>
                )}
              </Section>
            );
          }
          if (info.connectedDocs && info.connectedDocs.length > 0) {
            sections.push(
              <Section key="docs" index={sections.length}>
                <SectionLabel>
                  &quot;{info.label}&quot; appears in {info.connectedDocs.length} document{info.connectedDocs.length > 1 ? "s" : ""}
                </SectionLabel>
                <div className="space-y-0.5">
                  {info.connectedDocs.map((doc: { id: string; title: string }) => (
                    <button key={doc.id} onClick={() => onOpenDoc?.(doc.id)}
                      className="w-full text-left px-2 py-1.5 rounded font-medium transition-colors hover:bg-[var(--bg-elevated)] flex items-center"
                      style={{ fontSize: 12, color: "var(--text-primary)", gap: 8 }}>
                      <FileText width={12} height={12} style={{ color: "#fb923c", flexShrink: 0 }} />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  ))}
                </div>
              </Section>
            );
          }
          if (info.relationships && info.relationships.length > 0) {
            sections.push(
              <Section key="rels" index={sections.length}>
                <SectionLabel>
                  Linked to {info.relationships.length} {info.relationships.length === 1 ? "node" : "nodes"}
                </SectionLabel>
                {/* Two-column rows: verb on the left (mono uppercase, fixed
                    width so all verbs line up), arrow + target on the right.
                    Stripped of subject dots, line strokes, and target dots —
                    they were stacking three colored markers per row for no
                    extra information. The target's canvas color survives on
                    its icon, which is enough to read "this is a Doc / Concept /
                    Entity / Tag at a glance." */}
                <div className="space-y-0.5">
                  {(info.relationships as Array<{ label: string; target: string; targetKind?: string; direction?: string }>).map((rel, i) => {
                    const kindColor =
                      rel.targetKind === "doc" ? "#fb923c" :
                      rel.targetKind === "entity" ? "#4ade80" :
                      rel.targetKind === "tag" ? "#a78bfa" :
                      rel.targetKind === "concept" ? "#38bdf8" :
                      "var(--text-faint)";
                    const TargetIcon =
                      rel.targetKind === "doc" ? FileText :
                      rel.targetKind === "entity" ? CheckSquare :
                      rel.targetKind === "tag" ? Tag :
                      rel.targetKind === "concept" ? Lightbulb :
                      Sparkles;
                    const arrow = rel.direction === "in" ? "←" : "→";
                    return (
                      <div key={i} className="grid items-center px-1 py-1 rounded transition-colors hover:bg-[var(--bg-elevated)]" style={{ gridTemplateColumns: "minmax(96px, 30%) 12px 1fr", gap: 8, fontSize: 12 }}>
                        <span className="font-mono uppercase truncate" style={{ fontSize: 10, letterSpacing: 0.5, color: "var(--text-muted)" }}>
                          {rel.label}
                        </span>
                        <span className="font-mono text-center" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                          {arrow}
                        </span>
                        <span className="flex items-center min-w-0" style={{ gap: 6 }}>
                          <TargetIcon width={11} height={11} style={{ color: kindColor, flexShrink: 0 }} />
                          <span className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{rel.target}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          }
          return <>{sections}</>;
        })()}
      </div>
      )}
    </div>
  );
}

// ─── Document body with Document / Insights / Decompose tabs ───
function DocumentNodeBody({ info, decomposeBridge, onOpenDoc }: { info: any; decomposeBridge?: DecomposeBridge; onOpenDoc?: (docId: string) => void }) {
  type TabId = "document" | "insights" | "decompose";
  const [tab, setTab] = useState<TabId>(info.docContent ? "document" : "insights");
  // Default to "document" so users see the actual content first; if there's
  // no rendered content, fall back to insights.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab switcher */}
      <div className="shrink-0 flex items-center gap-1 px-3 pt-2.5 pb-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        {([
          { id: "document" as const, label: "Document" },
          { id: "insights" as const, label: "Insights" },
          ...(decomposeBridge ? [{ id: "decompose" as const, label: "Decompose" }] : []),
        ]).map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 pt-1.5 pb-2 text-caption font-medium transition-colors relative"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-faint)",
                background: "transparent",
              }}
            >
              {t.label}
              {active && (
                <div className="absolute left-0 right-0 -bottom-px h-[2px]" style={{ background: "var(--text-primary)" }} />
              )}
            </button>
          );
        })}
      </div>

      {tab === "decompose" && decomposeBridge ? (
        <DecomposeListPane bridge={decomposeBridge} />
      ) : tab === "document" ? (
        // Pure markdown content — no AI/meta noise
        <div className="flex-1 overflow-auto px-5 py-5">
          {info.docContent ? (
            <div className="mdcore-rendered prose prose-invert" dangerouslySetInnerHTML={{ __html: info.docContent }} />
          ) : (
            <div className="text-body text-center py-8" style={{ color: "var(--text-faint)" }}>
              No content rendered.
            </div>
          )}
        </div>
      ) : (
        // Insights tab — alternating-row sections matching the Bundle
        // Analysis sidebar. Body locked to 12px so the type scale matches
        // the rest of the app.
        (() => {
          const SectionLabel = ({ children }: { children: React.ReactNode }) => (
            <h4 className="font-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: 0.5, color: "var(--text-faint)" }}>{children}</h4>
          );
          const Section = ({ index, children }: { index: number; children: React.ReactNode }) => (
            <section style={{
              padding: "14px 20px",
              background: index % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--toggle-bg) 45%, transparent)",
              borderTop: index === 0 ? "none" : "1px solid var(--border-dim)",
            }}>
              {children}
            </section>
          );
          const sections: React.ReactNode[] = [];
          if (info.docStats) {
            sections.push(
              <Section key="stats" index={sections.length}>
                <SectionLabel>Stats</SectionLabel>
                <div className="flex items-baseline font-mono" style={{ color: "var(--text-muted)", fontSize: 11, gap: 12 }}>
                  <span className="tabular-nums">{info.docStats.wordCount.toLocaleString()} words</span>
                  <span className="tabular-nums">~{info.docStats.readingTime} min read</span>
                  <span className="tabular-nums">{info.docStats.sections} sections</span>
                  {info.docStats.hasCode && (
                    <span className="uppercase" style={{ color: "#a78bfa", letterSpacing: 0.4, fontWeight: 600 }}>contains code</span>
                  )}
                </div>
              </Section>
            );
          }
          if (info.documentSummary) {
            sections.push(
              <Section key="summary" index={sections.length}>
                <SectionLabel>What this doc says</SectionLabel>
                <p style={{ fontSize: 12, lineHeight: 1.65, color: "var(--text-primary)" }}>{info.documentSummary}</p>
              </Section>
            );
          }
          // Per-chunk-type sections — each pushes its own Section so the
          // alternating rhythm continues across all of them. Type badges
          // pull color from the same CHUNK_TYPE_COLORS the canvas uses, so
          // a "claim" row in the sidebar wears the same orange as a claim
          // chunk on the graph.
          const chunkColors: Record<string, string> = {
            claim: "#fb923c", definition: "#60a5fa", example: "#4ade80",
            question: "#a78bfa", task: "#fbbf24", evidence: "#f472b6",
            concept: "#38bdf8", context: "#94a3b8",
          };
          const decomp = decomposeBridge?.decomposition;
          if (decomp) {
            const chunkSections: Array<{ type: string; header: string }> = [
              { type: "claim", header: "Claims it makes" },
              { type: "definition", header: "Definitions it gives" },
              { type: "example", header: "Examples it shows" },
              { type: "question", header: "Questions it raises" },
              { type: "task", header: "Open tasks" },
              { type: "evidence", header: "Evidence it cites" },
            ];
            for (const { type, header } of chunkSections) {
              const items = decomp.chunks.filter((c) => c.type === type);
              if (items.length === 0) continue;
              const typeColor = chunkColors[type] || "var(--text-faint)";
              sections.push(
                <Section key={type} index={sections.length}>
                  <div className="flex items-center mb-2" style={{ gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: typeColor, display: "inline-block" }} />
                    <h4 className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 0.5, color: typeColor }}>
                      {header}
                    </h4>
                    <span className="font-mono tabular-nums" style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: "auto" }}>
                      {items.length}
                    </span>
                  </div>
                  <ol className="space-y-1.5">
                    {items.map((c, i) => {
                      const preview = stripMarkdownPreview(c.content);
                      return (
                        <li
                          key={c.id}
                          className="flex leading-[1.55] cursor-pointer rounded transition-colors"
                          style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 6px", margin: "0 -6px", gap: 10 }}
                          onClick={() => decomposeBridge?.onEditChunk(c)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                        >
                          <span className="font-mono tabular-nums shrink-0" style={{ color: typeColor, fontSize: 10, fontWeight: 600, opacity: 0.7, paddingTop: 1 }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1">
                            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{c.label}</span>
                            {preview && (
                              <span style={{ color: "var(--text-muted)" }}> — {preview.slice(0, 140)}{preview.length > 140 ? "…" : ""}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              );
            }
          }
          if (info.connectedDocs && info.connectedDocs.length > 0) {
            sections.push(
              <Section key="related" index={sections.length}>
                <SectionLabel>Related concepts</SectionLabel>
                <div className="flex flex-wrap" style={{ gap: 4 }}>
                  {info.connectedDocs.map((c: { id: string; title: string }) => (
                    <button
                      key={c.id}
                      onClick={() => onOpenDoc?.(c.id)}
                      className="inline-flex items-center font-mono rounded transition-colors"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: 10, letterSpacing: 0.3, cursor: onOpenDoc ? "pointer" : "default", gap: 4, padding: "3px 7px", border: "1px solid var(--border-dim)" }}
                      onMouseEnter={(e) => { if (onOpenDoc) { (e.currentTarget as HTMLElement).style.background = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--text-primary)"; } }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; }}
                    >
                      <Lightbulb width={9} height={9} style={{ color: "#38bdf8" }} />
                      {c.title}
                    </button>
                  ))}
                </div>
              </Section>
            );
          }
          if (sections.length === 0) {
            return (
              <div className="flex-1 overflow-auto px-5 py-8 text-center" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                No insights yet. Run Decompose or Analyze to generate.
              </div>
            );
          }
          return <div className="flex-1 overflow-auto" style={{ fontSize: 12 }}>{sections}</div>;
        })()
      )}
    </div>
  );
}

// ─── Sidebar decompose pane: focused vertical chunk list editor ───
// Same data + handlers as the canvas decomposition, but rendered as a
// top-to-bottom sortable list inside the right side panel. Optimized for
// quick edit / add / delete / extract on a single document without the
// visual constellation around it.
function DecomposeListPane({ bridge }: { bridge: DecomposeBridge }) {
  const decomp = bridge.decomposition;
  if (bridge.isDecomposing && !decomp) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <MemoryWikiLogo size={48} variant="icon-only" />
          <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
            Analyzing
          </span>
        </div>
      </div>
    );
  }
  if (!decomp) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState
          icon={<Layers width={28} height={28} style={{ color: "var(--text-primary)" }} />}
          heading="Not decomposed yet"
          guidance="Break this doc into AI-classified semantic chunks (concepts, claims, examples…) and edit each piece independently."
          cta={
            <Button variant="primary" size="sm" onClick={bridge.onRequestDecompose}>
              Decompose with AI
            </Button>
          }
        />
        <span className="hidden">{/* placeholder */}</span>
      </div>
    );
  }
  return <DecomposeListPaneBody bridge={bridge} decomp={decomp} />;
}

const SIDEBAR_CHUNK_TYPES = ["concept", "claim", "example", "definition", "task", "question", "context", "evidence"] as const;
const SIDEBAR_CHUNK_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  concept: { border: "#38bdf8", text: "#38bdf8", bg: "rgba(56,189,248,0.06)" },
  claim: { border: "#fb923c", text: "#fb923c", bg: "rgba(251,146,60,0.06)" },
  example: { border: "#4ade80", text: "#4ade80", bg: "rgba(74,222,128,0.06)" },
  definition: { border: "#60a5fa", text: "#60a5fa", bg: "rgba(96,165,250,0.06)" },
  task: { border: "#fbbf24", text: "#fbbf24", bg: "rgba(251,191,36,0.06)" },
  question: { border: "#a78bfa", text: "#a78bfa", bg: "rgba(167,139,250,0.06)" },
  context: { border: "#94a3b8", text: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
  evidence: { border: "#f472b6", text: "#f472b6", bg: "rgba(244,114,182,0.06)" },
};

// Tiny dismissible banner that explains what Decompose does. Shown the
// first time a user opens the Decompose pane; remembered via
// localStorage so it doesn't keep nagging.
function DecomposeExplainerBanner() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("mw-decompose-explainer-seen");
    if (!seen) setDismissed(false);
  }, []);
  if (dismissed) return null;
  return (
    <div
      className="shrink-0 px-3 py-2.5 text-caption flex items-start gap-2.5"
      style={{ background: "var(--toggle-bg)", borderBottom: "1px solid var(--border-dim)" }}
    >
      <span
        className="font-mono uppercase shrink-0 mt-0.5"
        style={{ color: "var(--text-primary)", fontSize: 9, letterSpacing: 0.5, fontWeight: 700 }}
      >
        About
      </span>
      <p className="flex-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        Decompose splits a document into smaller meaning-bearing chunks (claims, concepts, context, etc.) so each one can be cited, edited, or pulled into other bundles independently. The AI assigns a type to every chunk; you can rename, re-rank, extract, or delete from the list below. Re-run from the refresh button when the source doc changes.
      </p>
      <button
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem("mw-decompose-explainer-seen", "1"); } catch {}
        }}
        className="shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--menu-hover)]"
        style={{ color: "var(--text-faint)" }}
        aria-label="Dismiss explainer"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}

function DecomposeListPaneBody({ bridge, decomp }: { bridge: DecomposeBridge; decomp: SemanticChunksResult }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = decomp.chunks.filter(c => {
    if (filter && c.type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.label.toLowerCase().includes(q) && !c.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const presentTypes = Array.from(new Set(decomp.chunks.map(c => c.type)));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Decompose explainer — small dismissible banner above the
          toolbar. First-time users have no idea what "Decompose" means
          or why a doc is being split into Context / Concept / Claim. */}
      <DecomposeExplainerBanner />

      {/* Toolbar: search + actions */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chunks…"
          className="flex-1 text-caption px-2 py-1 rounded-md outline-none"
          style={{ background: "var(--toggle-bg)", color: "var(--text-primary)", border: "1px solid var(--border-dim)" }}
        />
        <Tooltip text="Add a new chunk" position="bottom">
          <button onClick={bridge.onAddChunk}
            className="p-1 rounded-md hover:bg-[var(--menu-hover)] transition-colors"
            style={{ color: "var(--text-primary)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </Tooltip>
        <Tooltip text="Re-analyze with AI" position="bottom">
          <button onClick={bridge.onRedecompose}
            className="p-1 rounded-md hover:bg-[var(--menu-hover)] transition-colors"
            style={{ color: "var(--text-muted)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          </button>
        </Tooltip>
      </div>

      {/* Type filter pills — single accent state, count in mono. Same
          chip pattern as MdEditor's left sidebar (All / Private / etc.)
          and the canvas filter row, so the user sees one filter language
          everywhere. Per-type color is reserved for the chunk's own
          identity (its left rail), not the filter button. */}
      {presentTypes.length > 1 && (
        <div className="shrink-0 px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-md"
            style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
          >
            {[null, ...presentTypes].map((t) => {
              const isActive = filter === t;
              const label = t ?? "All";
              const count = t === null ? decomp.chunks.length : decomp.chunks.filter(c => c.type === t).length;
              return (
                <button
                  key={label}
                  onClick={() => setFilter(t === null ? null : (isActive ? null : t))}
                  className="px-2 py-1 text-caption rounded transition-colors capitalize flex items-center gap-1"
                  style={{
                    background: isActive ? "var(--border)" : "transparent",
                    color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                    fontWeight: isActive ? 600 : 500,
                  }}
                  onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; } }}
                >
                  {label}
                  <span className="font-mono tabular-nums" style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chunk list — flat rows separated by hairline, no per-card box.
          Each row shows: a left color-rail keyed by chunk type, a small
          mono type badge, the chunk label, and a stripped one-line
          preview. Stale uses a dot + caption text rather than a red box. */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-2">
            <EmptyState
              compact
              icon={<Layers width={20} height={20} />}
              heading={search || filter ? "No matching chunks" : "No chunks yet"}
              guidance={search || filter ? "Try a different filter or search term." : "Run Decompose to extract chunks from this document."}
            />
          </div>
        ) : (
          filtered.map((c, i) => {
            const palette = SIDEBAR_CHUNK_COLORS[c.type] || SIDEBAR_CHUNK_COLORS.context;
            const fullIdx = decomp.chunks.findIndex(x => x.id === c.id);
            const isFirst = fullIdx === 0;
            const isLast = fullIdx === decomp.chunks.length - 1;
            const preview = stripMarkdownPreview(c.content);
            const truncated = preview.length > 200 ? preview.slice(0, 199).trim() + "…" : preview;
            // Zebra-stripe rows match the alternating-section pattern in
            // the Bundle Analysis sidebar — same visual rhythm in both
            // panels. The per-chunk-type color lives on the badge below
            // (palette.text on palette.bg) instead of a left rail.
            const baseBg = i % 2 === 0 ? "transparent" : "color-mix(in srgb, var(--toggle-bg) 45%, transparent)";
            return (
              <div
                key={c.id}
                className="group/chunk px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  borderBottom: "1px solid var(--border-dim)",
                  background: baseBg,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = baseBg; }}
                onClick={() => bridge.onEditChunk(c)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="font-mono uppercase px-1 py-px rounded shrink-0"
                    style={{
                      color: palette.text,
                      background: `${palette.border}14`,
                      fontSize: 9,
                      letterSpacing: 0.4,
                      fontWeight: 600,
                    }}
                  >
                    {c.type}
                  </span>
                  <span className="text-caption font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>
                    {c.label}
                  </span>
                  {c.found === false && (
                    <span
                      className="font-mono uppercase shrink-0 flex items-center gap-1"
                      style={{ color: "#ef4444", fontSize: 9, letterSpacing: 0.4, fontWeight: 600 }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                      Stale
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 transition-opacity opacity-50 group-hover/chunk:opacity-100">
                    <Tooltip text="Move up" position="top">
                      <button onClick={() => bridge.onMoveChunk(c.id, "up")} disabled={isFirst}
                        className="p-0.5 rounded hover:bg-[var(--menu-hover)] disabled:opacity-30"
                        style={{ color: "var(--text-faint)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                      </button>
                    </Tooltip>
                    <Tooltip text="Move down" position="top">
                      <button onClick={() => bridge.onMoveChunk(c.id, "down")} disabled={isLast}
                        className="p-0.5 rounded hover:bg-[var(--menu-hover)] disabled:opacity-30"
                        style={{ color: "var(--text-faint)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                    </Tooltip>
                    <Tooltip text="Edit chunk" position="top">
                      <button onClick={() => bridge.onEditChunk(c)}
                        className="p-0.5 rounded hover:bg-[var(--menu-hover)]"
                        style={{ color: "var(--text-faint)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                      </button>
                    </Tooltip>
                    <Tooltip text="Extract to new doc (and remove from source)" position="top">
                      <button onClick={() => bridge.onExtractChunk(c.id, true)}
                        className="p-0.5 rounded hover:bg-[var(--menu-hover)]"
                        style={{ color: "var(--text-faint)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7"/><path d="M10 14L21 3"/><path d="M21 14v7H3V3h7"/></svg>
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete chunk" position="top">
                      <button onClick={() => bridge.onDeleteChunk(c)}
                        className="p-0.5 rounded hover:bg-[rgba(239,68,68,0.12)]"
                        style={{ color: "#ef4444" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <p className="text-caption leading-[1.55]" style={{ color: "var(--text-muted)" }}>
                  {truncated || <span style={{ fontStyle: "italic", opacity: 0.6 }}>(no content)</span>}
                </p>
                <span className="hidden">{i}</span>
              </div>
            );
          })
        )}
      </div>
      {/* Footer summary */}
      <div className="shrink-0 px-3 py-1.5 text-caption flex items-center justify-between" style={{ borderTop: "1px solid var(--border-dim)", color: "var(--text-faint)" }}>
        <span>{decomp.chunks.length} chunk{decomp.chunks.length === 1 ? "" : "s"} — {decomp.edges.length} relation{decomp.edges.length === 1 ? "" : "s"}</span>
        {void SIDEBAR_CHUNK_TYPES /* keep tree-shaking happy */}
      </div>
    </div>
  );
}

// ─── Bundle List View — sequential document rendering with TOC ───

function BundleListView({
  documents,
  bundleId,
  bundleTitle,
  bundleDescription,
  authHeaders,
  canEdit,
  onOpenDoc,
  onSwitchToBundle,
  onAnnotationSaved,
}: {
  documents: BundleDocument[];
  bundleId: string;
  bundleTitle?: string;
  bundleDescription?: string | null;
  authHeaders?: Record<string, string>;
  canEdit?: boolean;
  onOpenDoc?: (docId: string) => void;
  onSwitchToBundle?: () => void;
  onAnnotationSaved?: (docId: string, annotation: string | null) => void;
}) {
  const [renderedDocs, setRenderedDocs] = useState<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(documents[0]?.id || null);
  // Reading progress (0-1) — drives the slim progress bar at the
  // top of the main area so users can see how far they are in a
  // multi-doc bundle. Computed from the scroll position of the
  // rendering container against its total scroll height.
  const [progress, setProgress] = useState(0);
  // Local TOC filter so the sidebar can be searched. Empty = show
  // all. Case-insensitive title match (also matches annotation).
  const [tocFilter, setTocFilter] = useState("");
  // Collapsed Contents column — mirrors the Library rail's
  // expand/collapse pattern. Persisted across reloads so the user's
  // preference sticks for this surface.
  const [contentsCollapsed, setContentsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("mw-bundle-contents-collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mw-bundle-contents-collapsed", contentsCollapsed ? "1" : "0");
  }, [contentsCollapsed]);
  // Per-doc copy-state — used to flash the inline Copy URL button.
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  // Per-doc word counts memoised once per documents change so the
  // TOC rows + section headers can both reuse the value without
  // recounting on every render.
  const wordCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) {
      m.set(d.id, (d.markdown || "").trim().split(/\s+/).filter(Boolean).length);
    }
    return m;
  }, [documents]);
  const totalWords = useMemo(() => {
    let n = 0;
    for (const c of wordCounts.values()) n += c;
    return n;
  }, [wordCounts]);
  const filteredDocs = useMemo(() => {
    const q = tocFilter.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => {
      const t = (d.title || "").toLowerCase();
      const a = (d.annotation || "").toLowerCase();
      return t.includes(q) || a.includes(q);
    });
  }, [documents, tocFilter]);

  // Local edit state — keyed by docId. While the user is typing, we don't
  // round-trip to the server; commit on blur.
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [draftAnnotation, setDraftAnnotation] = useState("");
  const [savingDocId, setSavingDocId] = useState<string | null>(null);

  const startEdit = (doc: BundleDocument) => {
    if (!canEdit) return;
    setEditingDocId(doc.id);
    setDraftAnnotation(doc.annotation || "");
  };
  const cancelEdit = () => { setEditingDocId(null); setDraftAnnotation(""); };
  const saveEdit = async (doc: BundleDocument) => {
    const next = draftAnnotation.trim();
    const prev = (doc.annotation || "").trim();
    if (next === prev) { cancelEdit(); return; }
    setSavingDocId(doc.id);
    try {
      const res = await fetch(`/api/bundles/${bundleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
        body: JSON.stringify({
          action: "set-annotations",
          annotations: { [doc.id]: next },
        }),
      });
      if (res.ok) {
        onAnnotationSaved?.(doc.id, next || null);
      }
    } catch { /* swallow — user can retry */ }
    finally {
      setSavingDocId(null);
      cancelEdit();
    }
  };

  // Render all documents — render() is synchronous now (markdown-it, no
  // WASM await needed), so we can build the map in a single pass without
  // the cancelled-flag dance protecting against mid-iteration state writes.
  useEffect(() => {
    const newMap = new Map<string, string>();
    for (const doc of documents) {
      try {
        newMap.set(doc.id, render(doc.markdown).html);
      } catch {
        newMap.set(doc.id, `<p style="color: var(--text-muted)">Failed to render</p>`);
      }
    }
    setRenderedDocs(newMap);
  }, [documents]);

  // Track which doc is active in viewport + reading progress
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const sections = container.querySelectorAll("[data-doc-section]");
      let closestId: string | null = null;
      let closestDistance = Infinity;
      sections.forEach(s => {
        const rect = s.getBoundingClientRect();
        const distance = Math.abs(rect.top - 100); // 100px from top
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = s.getAttribute("data-doc-section");
        }
      });
      if (closestId) setActiveDocId(closestId);
      // Progress = scrolled / max-scrollable. Clamped to [0,1]
      // so the bar never overshoots even with overscroll bounce.
      const max = container.scrollHeight - container.clientHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, container.scrollTop / max)) : 0;
      setProgress(pct);
    };
    container.addEventListener("scroll", onScroll);
    // Initial read so the bar isn't empty before the first scroll.
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [renderedDocs]);

  const copyDocUrl = async (docId: string) => {
    if (typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(`https://memory.wiki/${docId}`);
      setCopiedDocId(docId);
      setTimeout(() => setCopiedDocId((v) => v === docId ? null : v), 1200);
    } catch { /* ignore */ }
  };
  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const scrollToDoc = (docId: string) => {
    const el = containerRef.current?.querySelector(`[data-doc-section="${docId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "var(--background)" }}>
      {/* Reading-progress bar — slim accent stripe pinned to the top
          of the main area. Drives no semantic behaviour; the user
          can see how far they are through the bundle without
          having to scan the TOC. */}
      <div className="shrink-0 h-0.5" style={{ background: "var(--border-dim)" }}>
        <div className="h-full transition-all duration-150" style={{ background: "var(--text-primary)", width: `${(progress * 100).toFixed(1)}%` }} />
      </div>
      <div className="flex-1 flex min-h-0">
      {/* ─── TOC sidebar — search, per-doc word counts, active-row
            highlight. Width matches the Hub overview sidebar so all
            three bundle views share one rhythm. Collapsible the same
            way the Library rail is, with a thin re-open strip when
            shut. ─── */}
      {contentsCollapsed ? (
        <aside
          className="shrink-0 flex flex-col items-center pt-1.5"
          style={{ width: 28, borderRight: "1px solid var(--border-dim)" }}
        >
          <Tooltip text="Open Contents">
            <button
              onClick={() => setContentsCollapsed(false)}
              className="p-1 rounded transition-colors shrink-0"
              style={{ color: "var(--text-primary)" }}
            >
              <List width={14} height={14} />
            </button>
          </Tooltip>
        </aside>
      ) : (
      <aside className="shrink-0 w-64 overflow-auto" style={{ borderRight: "1px solid var(--border-dim)" }}>
        {/* Header — matches the LIBRARY rail header verbatim: same
            padding, same font-mono caption, same accent treatment. The
            only intentional difference is the icon (List vs
            PanelLeft) so the two rails are distinguishable at a
            glance. */}
        <div className="shrink-0 select-none">
          <div
            className="flex items-center justify-between px-2 py-1.5 text-caption font-mono"
            style={{ color: "var(--text-muted)", cursor: "default" }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Tooltip text="Close Contents">
                <button
                  onClick={() => setContentsCollapsed(true)}
                  className="p-1 rounded transition-colors shrink-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  <List width={14} height={14} />
                </button>
              </Tooltip>
              <span style={{ color: "var(--text-primary)" }} className="shrink-0">CONTENTS</span>
            </div>
            {/* Removed "← Bundle" back link — bundle row already lives at
                the top of the parent tab bar, so the same navigation is
                always available without the extra chrome. */}
          </div>
        </div>
        <div className="px-3 py-3">
          <input
            type="text"
            value={tocFilter}
            onChange={(e) => setTocFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none mb-3"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          {filteredDocs.length === 0 ? (
            <p className="text-caption px-2" style={{ color: "var(--text-faint)" }}>No matches.</p>
          ) : (
            filteredDocs.map((doc) => {
              const i = documents.indexOf(doc);
              const isActive = activeDocId === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => scrollToDoc(doc.id)}
                  className="w-full text-left px-2.5 py-2 rounded-md flex items-start gap-2 transition-colors hover:bg-[var(--toggle-bg)] mb-0.5"
                  style={{ background: isActive ? "var(--border)" : "transparent" }}
                >
                  <span className="text-caption font-mono w-4 shrink-0 mt-0.5 tabular-nums" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs truncate" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isActive ? 600 : 400 }}>
                      {doc.title || "Untitled"}
                    </div>
                    <div className="text-caption mt-0.5 tabular-nums" style={{ color: "var(--text-faint)" }}>
                      {fmt(wordCounts.get(doc.id) || 0)} words
                    </div>
                  </div>
                </button>
              );
            })
          )}
          <div className="text-caption mt-3 pt-3 tabular-nums" style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-dim)" }}>
            {documents.length} {documents.length === 1 ? "doc" : "docs"}, {fmt(totalWords)} words total
          </div>
        </div>
      </aside>
      )}

      {/* ─── Sequential rendering ─── */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="max-w-3xl mx-auto px-8 py-10">
          {/* Bundle header — same shape as HubEmbed / BundleOverview
              so List opens with a recognisable destination frame
              before the doc sequence starts. */}
          <header className="mb-10">
            <h1 className="text-display font-bold tracking-tight" style={{ color: "var(--text-primary)", lineHeight: 1.2 }}>
              {bundleTitle || "Untitled bundle"}
            </h1>
            {bundleDescription && (
              <p className="text-body mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {bundleDescription}
              </p>
            )}
            <p className="text-caption font-mono mt-3" style={{ color: "var(--text-faint)" }}>
              /b/{bundleId}{"   "}{documents.length} {documents.length === 1 ? "doc" : "docs"}, {fmt(totalWords)} words
            </p>
          </header>
          {documents.length === 0 && (
            <div className="text-caption px-3 py-10 rounded-lg text-center" style={{ color: "var(--text-faint)", background: "var(--surface)", border: "1px dashed var(--border-dim)" }}>
              No documents in this bundle yet.
            </div>
          )}
          {documents.map((doc, i) => {
            const isEditing = editingDocId === doc.id;
            const hasAnnotation = !!(doc.annotation && doc.annotation.trim());
            return (
            <article key={doc.id} data-doc-section={doc.id} className="mb-12 pb-8" style={{ borderBottom: i < documents.length - 1 ? "1px solid var(--border-dim)" : "none" }}>
              <div className="flex items-start gap-2.5 mb-3">
                {/* Doc number — small mono index, quieter than the
                    title. Section number should sit BELOW the title
                    in visual weight, not compete with it. */}
                <span
                  className="font-mono tabular-nums shrink-0 text-caption"
                  style={{
                    color: "var(--text-faint)",
                    paddingTop: 6,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)", lineHeight: 1.25 }}>{doc.title || "Untitled"}</h2>
                  <div className="flex items-center gap-3 mt-1 text-caption" style={{ color: "var(--text-faint)" }}>
                    <span className="tabular-nums">{fmt(wordCounts.get(doc.id) || 0)} words</span>
                    {doc.updated_at && (
                      <span>Updated {new Date(doc.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                    <span className="font-mono">/{doc.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyDocUrl(doc.id)}
                    className="text-caption px-2 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                    style={{ color: copiedDocId === doc.id ? "var(--text-primary)" : "var(--text-muted)", border: `1px solid ${copiedDocId === doc.id ? "var(--text-primary)" : "var(--border-dim)"}` }}
                    title="Copy doc URL"
                  >
                    {copiedDocId === doc.id ? "Copied" : "Copy URL"}
                  </button>
                  {onOpenDoc && (
                    <button
                      onClick={() => onOpenDoc(doc.id)}
                      className="text-caption px-2 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
                    >
                      Open
                    </button>
                  )}
                </div>
              </div>
              {/* Annotation row — "why this doc belongs in the bundle." Editable
                  inline for owners, read-only for viewers. Empty + non-owner
                  → row is hidden. Empty + owner → "Add note" CTA. */}
              {isEditing ? (
                <div className="mb-4 px-3 py-2 rounded-md" style={{ background: "var(--border)", border: "1px solid var(--text-primary)" }}>
                  <textarea
                    autoFocus
                    value={draftAnnotation}
                    onChange={(e) => setDraftAnnotation(e.target.value)}
                    onBlur={() => saveEdit(doc)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveEdit(doc); }
                    }}
                    placeholder="Why this doc belongs here…"
                    rows={2}
                    maxLength={500}
                    className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
                    style={{ color: "var(--text-primary)" }}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-caption" style={{ color: "var(--text-faint)" }}>
                      {savingDocId === doc.id ? "Saving…" : "Esc to cancel — ⌘↵ to save"}
                    </span>
                    <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                      {draftAnnotation.length}/500
                    </span>
                  </div>
                </div>
              ) : hasAnnotation ? (
                <button
                  onClick={() => startEdit(doc)}
                  className="w-full text-left mb-4 px-3 py-2 rounded-md transition-colors group"
                  style={{
                    background: "var(--border)",
                    border: "1px solid transparent",
                    cursor: canEdit ? "pointer" : "default",
                  }}
                  disabled={!canEdit}
                  title={canEdit ? "Edit this note — explains why the doc belongs in this bundle" : "Note: why this doc belongs in this bundle"}
                >
                  <div className="text-caption font-mono uppercase tracking-wider mb-0.5" style={{ color: "var(--text-primary)", fontSize: 9, letterSpacing: 0.6 }}>
                    Why this doc belongs
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {doc.annotation}
                  </p>
                </button>
              ) : canEdit ? (
                <button
                  onClick={() => startEdit(doc)}
                  className="text-caption mb-4 px-2 py-1 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{ color: "var(--text-faint)", border: "1px dashed var(--border-dim)" }}
                  title="Add a one-line note explaining why this doc is in this bundle. Sent to the AI as context."
                >
                  + Note why this doc belongs
                </button>
              ) : null}
              <div className="mdcore-rendered prose prose-invert" dangerouslySetInnerHTML={{ __html: renderedDocs.get(doc.id) || "" }} />
            </article>
            );
          })}
          {documents.length > 0 && (
            <div className="text-caption text-center py-6" style={{ color: "var(--text-faint)" }}>
              End of bundle
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
