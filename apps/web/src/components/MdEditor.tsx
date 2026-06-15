"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
// Aliased because lucide-react also exports a `Link` icon used
// elsewhere in this file. NextLink is the routing component.
import NextLink from "next/link";
import nextDynamic from "next/dynamic";
import { userColor } from "@/lib/user-color";
import { useCursorPresence } from "@/lib/useCursorPresence";
import { render } from "@/lib/render";
import { isLocalDirty } from "@/lib/external-update-dirty";
import katex from "katex";
import { htmlToMarkdown, isHtmlContent } from "@/lib/html-to-md";
import {
  isAiConversation,
  parseConversation,
  formatConversation,
} from "@/lib/ai-conversation";
import MdCanvas from "@/components/MdCanvas";
// Hidden 2026-05-17 — Pulse/Constellation/Frontier Start surface paused.
// Uncomment these three imports + the matching JSX block to re-enable.
// import HubPulse from "@/components/HubPulse";
// import HubConstellation from "@/components/HubConstellation";
// import HubFrontier from "@/components/HubFrontier";
import BundleEmbed from "@/components/BundleEmbed";
import HubEmbed from "@/components/HubEmbed";
// HubGalaxy depends on xyflow + elkjs — heavy. Keep it out of the
// editor's initial bundle and load only when the Galaxy overlay opens.
const HubGalaxy = nextDynamic(() => import("@/components/HubGalaxy"), { ssr: false, loading: () => null });
import SettingsEmbed from "@/components/SettingsEmbed";
import BundleChat from "@/components/BundleChat";
import HubChat from "@/components/HubChat";
import SidebarFolderTree from "@/components/SidebarFolder";
import FolderEmojiPicker from "@/components/FolderEmojiPicker";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import MathEditor from "@/components/MathEditor";
import Tooltip from "@/components/Tooltip";
import SynthesisDiff from "@/components/SynthesisDiff";
import { Button, Badge, ModalShell } from "@/components/ui";
import DocStatusIcon from "@/components/DocStatusIcon";
import RelatedDocsWidget from "@/components/RelatedDocsWidget";
import ImportModal from "@/components/ImportModal";
import { loadCuratorSettings, autoHandles, type CuratorSettings, defaultCuratorSettings } from "@/lib/curator-options";
import { extractTitleFromMd } from "@/lib/extract-title";
import { useCodeMirror } from "@/components/useCodeMirror";
import ShareModal from "@/components/ShareModal";
import ToastContainer, { showToast } from "@/components/Toast";
import { FEATURES } from "@/lib/feature-flags";
import { importFile, getSupportedAcceptString, mwText } from "@/lib/file-import";
import { isCliOutput, cliToMarkdown } from "@/lib/cli-to-md";
import {
  Undo2, Redo2, List, ListOrdered, Indent, Outdent, Quote, Minus, Link,
  Image as ImageIcon, RemoveFormatting, Table, Code, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Copy, Eye,
  Columns2, Bell, Share2, Menu, PanelLeft, Download, Plus, ArrowUpDown,
  FolderPlus, Folder, FolderOpen, File as FileIcon, MoreHorizontal,
  User, Users, Search, X, Trash2, RefreshCw, Lock, ShieldAlert, FileX,
  LogOut, HelpCircle, Clock, Upload, FileText, Sparkles, Zap, Loader2, RotateCcw, AlignLeft, BookOpen, CircleCheck, Layers, Check, Globe, Network, LayoutDashboard, Smile, Settings, Cloud, MessageSquarePlus, Wand2, Atom,
  ChevronsDownUp, ChevronsUpDown, ArrowUpRight, Star, Locate,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { buildAuthHeaders } from "@/lib/auth-fetch";
import { useAutoSave } from "@/lib/useAutoSave";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { usePresence } from "@/lib/usePresence";
import { useCollaboration } from "@/lib/useCollaboration";
import { getAnonymousId, ensureAnonymousId, clearAnonymousId } from "@/lib/anonymous-id";
import TiptapLiveEditor from "@/components/TiptapLiveEditor";
import type { TiptapLiveEditorHandle } from "@/components/TiptapLiveEditor";
import BacklinksPanel from "@/components/BacklinksPanel";
import {
  createShareUrl,
  createShortUrl,
  saveEditToken,
  getEditToken,
  updateDocument,
  deleteDocument,
  softDeleteDocument,
  restoreDocument,
  rotateEditToken,
  extractFromUrl,
  copyToClipboard,
  fetchVersions,
  fetchVersion,
} from "@/lib/share";
import type {
  // Aliased — lucide-react already exports a `Folder` icon component
  // in the same scope, so we name the data type FolderType to avoid
  // the collision.
  Folder as FolderType,
  Tab,
  ViewMode,
  Theme,
} from "@/lib/editor-types";
import {
  FOLDER_FILTER_MY,
  FOLDER_FILTER_BUNDLES,
  SYNCED_SOURCES,
} from "@/lib/editor-types";
import {
  SAMPLE_WELCOME,
  SAMPLE_FORMATTING,
  SAMPLE_DIAGRAMS,
  SAMPLE_ASCII,
  SAMPLE_IMPORT_EXPORT,
  SAMPLE_FEATURES,
  SAMPLE_CHROME_EXT,
  SAMPLE_VSCODE_EXT,
  SAMPLE_DESKTOP,
  SAMPLE_CLI,
  SAMPLE_MCP,
  SAMPLE_FRESHNESS,
  SAMPLE_QUICKLOOK,
  SAMPLE_BUNDLES,
  SAMPLE_AI_CAPTURE,
  DOCUMENT_TEMPLATES,
  EXAMPLE_BUNDLE_ID,
  EXAMPLE_OWNER,
  EXAMPLES_FOLDER_ID,
  EXAMPLE_TABS,
  EXAMPLE_TAB_IDS,
  INITIAL_FOLDERS,
  INITIAL_TABS,
} from "@/lib/editor-samples";
import { InlineInput, TBtn } from "@/components/editor-primitives";
import FlyoutMenu from "@/components/FlyoutMenu";
import { truncateTitle, dicebearUrl, resolveAvatar, rewriteH1, suggestBundleTitle } from "@/lib/editor-helpers";
import WysiwygToolbar from "@/components/WysiwygToolbar";
import BundleCreatorModal from "@/components/modals/BundleCreatorModal";
import BundleShareModal from "@/components/modals/BundleShareModal";









import {
  ACCENT_COLORS,
  COLOR_SCHEMES,
  type AccentColor,
  type ColorScheme,
} from "@/lib/theme-options";

/**
 * When the AI's EDIT response looks like a section fragment (much
 * shorter than the original), try to figure out which section it
 * meant to replace and splice it into the original so the rest of
 * the document survives.
 *
 * Strategy: take the first markdown heading in the fragment, find
 * the same heading in the original, and replace from that heading
 * up to (but not including) the next heading at the same or
 * shallower depth. Returns null if either side has no usable
 * heading anchor, or if the same heading appears more than once in
 * the original (ambiguous — safer to refuse).
 */
function trySpliceFragmentIntoOriginal(original: string, fragment: string): string | null {
  const headingRe = /^(#{1,6})\s+(.+?)\s*$/m;
  const fragMatch = fragment.match(headingRe);
  if (!fragMatch) return null;
  const fragHeadingLine = fragMatch[0].trim();
  const fragHeadingLevel = fragMatch[1].length;

  const lines = original.split("\n");
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === fragHeadingLine) matches.push(i);
  }
  if (matches.length !== 1) return null;
  const startIdx = matches[0];

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= fragHeadingLevel) {
      endIdx = i;
      break;
    }
  }

  const before = lines.slice(0, startIdx).join("\n");
  const after = lines.slice(endIdx).join("\n");
  const middle = fragment.trim();
  return [before, middle, after].filter((s) => s.length > 0).join("\n\n");
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("mw-theme") as Theme) || "dark";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window === "undefined") return "orange";
    return (localStorage.getItem("mw-accent") as AccentColor) || "lime";
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    if (typeof window === "undefined") return "default";
    return (localStorage.getItem("mw-scheme") as ColorScheme) || "default";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Owner brand override — when the visitor is reading someone
  // else's shared doc, paint the page in that owner's accent /
  // scheme (pulled from their profile and shipped by /api/docs/[id]
  // as ownerAccent / ownerScheme). Stored as a per-tab override on
  // the Tab type; null/empty means "fall back to visitor's own
  // accent / scheme."
  const [activeOwnerAccent, setActiveOwnerAccent] = useState<string | null>(null);
  const [activeOwnerScheme, setActiveOwnerScheme] = useState<string | null>(null);

  useEffect(() => {
    // Lime is the root default (CSS :root --accent), so removing
    // the data-accent attribute lets the root value apply. The old
    // literal "orange" here mismatched SettingsEmbed (which writes
    // data-accent="orange" on click), causing this effect to undo
    // the SettingsEmbed write on every accent change — the user
    // had to click twice for the preview to stick.
    const effective = activeOwnerAccent || accentColor;
    if (effective === "lime") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", effective);
    }
  }, [accentColor, activeOwnerAccent]);

  useEffect(() => {
    const effective = activeOwnerScheme || colorScheme;
    if (effective === "default") {
      document.documentElement.removeAttribute("data-scheme");
    } else {
      document.documentElement.setAttribute("data-scheme", effective);
    }
  }, [colorScheme, activeOwnerScheme]);

  // Cross-component sync — when SettingsEmbed (or any future caller)
  // changes the saved theme/accent/scheme without going through this
  // hook's setters, it dispatches "mw-theme-changed" so the values
  // re-hydrate from localStorage here. Without this, the profile
  // menu's FlyoutMenu (which reads colorScheme/accentColor from
  // useTheme) shows the OLD selection after the user picked a new
  // one in Settings.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = () => {
      try {
        const nextTheme = (localStorage.getItem("mw-theme") as Theme) || "dark";
        const nextAccent = (localStorage.getItem("mw-accent") as AccentColor) || "lime";
        const nextScheme = (localStorage.getItem("mw-scheme") as ColorScheme) || "default";
        setThemeState(nextTheme);
        setAccentColorState(nextAccent);
        setColorSchemeState(nextScheme);
      } catch { /* ignore */ }
    };
    window.addEventListener("mw-theme-changed", onSync);
    return () => window.removeEventListener("mw-theme-changed", onSync);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("mw-theme", t); } catch { /* quota exceeded */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Persist the change to profiles.accent_color / color_scheme too,
  // so the picker SettingsEmbed reads from the same source on
  // mount, and the choice survives across devices.
  const syncPrefToProfile = useCallback(async (col: "accent_color" | "color_scheme", value: string) => {
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return;
      await supabase.from("profiles").update({ [col]: value }).eq("id", uid);
    } catch { /* offline ok — localStorage carries the value */ }
  }, []);

  const setAccentColor = useCallback((a: AccentColor) => {
    setAccentColorState(a);
    // Lime is the root default — removing data-accent lets the
    // CSS :root value apply; anything else writes the override.
    if (a === "lime") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", a);
    }
    try { localStorage.setItem("mw-accent", a); } catch { /* quota exceeded */ }
    // Broadcast so SettingsEmbed re-reads — without this, the
    // Appearance picker showed the OLD selection after the user
    // changed key color via the profile menu.
    try { window.dispatchEvent(new CustomEvent("mw-theme-changed")); } catch { /* ignore */ }
    syncPrefToProfile("accent_color", a);
  }, [syncPrefToProfile]);

  const setColorScheme = useCallback((s: ColorScheme) => {
    setColorSchemeState(s);
    if (s === "default") {
      document.documentElement.removeAttribute("data-scheme");
    } else {
      document.documentElement.setAttribute("data-scheme", s);
    }
    try { localStorage.setItem("mw-scheme", s); } catch { /* quota exceeded */ }
    // Skin and key color are independent — user can combine any skin with any key color
    try { window.dispatchEvent(new CustomEvent("mw-theme-changed")); } catch { /* ignore */ }
    syncPrefToProfile("color_scheme", s);
  }, [syncPrefToProfile]);

  return {
    theme, toggleTheme,
    accentColor, setAccentColor,
    colorScheme, setColorScheme,
    setActiveOwnerAccent, setActiveOwnerScheme,
  };
}




let tabIdCounter = Date.now();


// ─── Portal-based Tooltip (never clipped by overflow) ───
// Tooltip is now in /components/Tooltip.tsx so SidebarFolder + others can use it



export default function MdEditor() {
  // Mark editor as opened — the root `/` page route reads this flag
  // and only routes returning visitors here instead of /about. First
  // run with no flag still passes through /about; the moment the
  // editor mounts, future visits land straight in the editor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("mw-editor-opened", "1"); } catch { /* private mode */ }
    // Lift the pre-paint auth-flash gate (data-mw-auth-pending on
    // <html>) as soon as MdEditor mounts. The viewer's auth-check
    // keeps the gate up across the window.location.replace into the
    // editor, so the editor itself owns releasing it — otherwise the
    // gate would sit until the 3.5s fallback timeout in layout.tsx.
    document.documentElement.removeAttribute("data-mw-auth-pending");
  }, []);
  const isMobile = useIsMobile();
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  const mod = isMac ? "Cmd" : "Ctrl";
  const { theme, toggleTheme, accentColor, setAccentColor, colorScheme, setColorScheme, setActiveOwnerAccent, setActiveOwnerScheme } = useTheme();
  const { user, profile, loading: authLoading, accessToken, isAuthenticated, signInWithGoogle, signInWithGitHub, signInWithApple, signInWithEmail, signOut } = useAuth();
  // Only use anonymousId when not logged in
  const anonymousId = (!user?.id && typeof window !== "undefined") ? getAnonymousId() : "";
  const authHeaders = useMemo(() => buildAuthHeaders({ accessToken, userId: user?.id, userEmail: user?.email, anonymousId }), [accessToken, user?.id, user?.email, anonymousId]);
  const authHeadersRef = useRef(authHeaders);
  authHeadersRef.current = authHeaders;
  const autoSave = useAutoSave({ debounceMs: 2500 });
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const authMenuTriggerRef = useRef<HTMLDivElement>(null);
  const authMenuPanelRef = useRef<HTMLDivElement>(null);
  // Outside-click + Escape dismissal for the profile menu. Replaces
  // the prior backdrop approach which couldn't escape the sidebar's
  // transform stacking context — the portalled backdrop ended up
  // ABOVE the menu (sidebar at root-z 201 vs backdrop at z-9998),
  // so the menu's own z-9999 was useless against it and the inner
  // buttons stopped responding to clicks. A document-level listener
  // sidesteps the stacking question entirely.
  //
  // Only active when authenticated: the same `showAuthMenu` state
  // also drives the logged-out Sign-In modal, which has its own
  // backdrop click handler. Listening unconditionally was closing
  // the modal on every internal button click (Google OAuth row,
  // email field, etc.) because those clicks weren't inside the
  // profile menu refs.
  useEffect(() => {
    if (!showAuthMenu || !isAuthenticated) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (authMenuTriggerRef.current?.contains(t)) return;
      if (authMenuPanelRef.current?.contains(t)) return;
      // FlyoutMenu (Skin Theme / Key Color submenus) portals its
      // panel into document.body to escape the auth menu's
      // overflow-hidden. Without this check the outside-click
      // handler would treat clicks inside the portaled flyout as
      // "outside" and close the auth menu before the click landed.
      if (t instanceof Element && t.closest('[data-flyout-portal]')) return;
      setShowAuthMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAuthMenu(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [showAuthMenu, isAuthenticated]);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [authEmailInput, setAuthEmailInput] = useState("");
  const [authEmailSent, setAuthEmailSent] = useState(false);
  // Email pill behaves like the other OAuth pills until clicked. On
  // click, it expands inline (input swaps in below the wordmark + OAuth
  // pills) so there's no "or with email" divider — keeps the modal
  // visually one region instead of three.
  const [authEmailMode, setAuthEmailMode] = useState(false);
  const [folders, setFolders] = useState<FolderType[]>(() => {
    if (typeof window === "undefined") return INITIAL_FOLDERS;
    try { const s = localStorage.getItem("mw-folders"); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length > 0) return p; } } catch { /* */ }
    return INITIAL_FOLDERS;
  });
  const [showMyDocs, setShowMyDocs] = useState(true);
  const [showMyBundles, setShowMyBundles] = useState(true);
  const [bundleView, setBundleView] = useState<"overview" | "canvas" | "list">("overview");
  const [_showBundleChat, setShowBundleChat] = useState(false);
  // Conversational-query → canvas filter: BundleChat's "Show on
  // canvas" action stores the cited doc ids here keyed by bundle id,
  // BundleEmbed consumes them as a highlight filter on BundleCanvas.
  // Per-bundle so switching tabs doesn't leak a previous bundle's
  // filter into the new one.
  const [bundleHighlights, setBundleHighlights] = useState<Record<string, string[]>>({});
  const [activeBundleDocIds, setActiveBundleDocIds] = useState<Set<string>>(new Set());
  const [showSharedDocs, setShowSharedDocs] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mw-show-shared") === "true";
  });
  const [showTrash, setShowTrash] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mw-show-trash") === "true";
  });
  // Hub lint surface (Hermes Step 4: Review/Lint). Findings are
  // computed server-side from concept_index + bundle_documents +
  // embeddings; we cache them in component state so the section
  // doesn't refetch on every keystroke. Fetched on mount when
  // signed in, and re-fetched after operations that change the
  // hub shape (doc create/delete/restore).
  // Doc intent chip dropdown — toggled from the LIVE bar; owner-only.
  // The PATCH happens optimistically: we update the tab state first
  // and fire the request in the background, reverting on error.
  const [intentMenuOpen, setIntentMenuOpen] = useState(false);
  // Unified Import modal (replaces the old per-source inline-input
  // prompts that hung off the Library + menu).
  const [showImportModal, setShowImportModal] = useState(false);
  // True while the sidebar refresh icon is spinning. Used to drive the
  // animation on the ICON element only — the previous implementation
  // toggled `animate-spin` on the button itself, which also rotated
  // the hover-state rounded background, producing a "the whole button
  // is spinning" effect.
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [showLint, setShowLint] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("mw-show-lint");
    return saved === null ? true : saved === "true";
  });
  const [lintReport, setLintReport] = useState<{
    orphans: { id: string; title: string | null }[];
    duplicates: { a: { id: string; title: string | null }; b: { id: string; title: string | null }; distance: number }[];
    titleMismatches: { id: string; title: string | null; topConcept: string; concepts: string[] }[];
    staleClaims: { id: string; title: string | null; updatedAt: string | null; ageDays: number; referenceCount: number }[];
    mergeSuggestions: { a: { id: string; title: string | null }; b: { id: string; title: string | null }; distance: number }[];
    rollupSuggestions: { concept: string; docIds: string[]; docCount: number }[];
    autoArchive: { id: string; title: string | null; updatedAt: string | null; ageDays: number }[];
    bundleSuggestions: { clusterId: string; suggestedTitle: string; docIds: string[]; docCount: number }[];
    citationRot: { docId: string; docTitle: string | null; url: string; statusCode: number | null; firstFailedAt: string | null }[];
    totalDocs: number;
  } | null>(null);
  const [lintLoading, setLintLoading] = useState(false);
  // Hub concept-index freshness — populated from
  // /api/user/hub/freshness when the Hub view opens. Drives the
  // "Concepts out of date · Re-analyze (N)" banner inside HubEmbed.
  const [hubFreshness, setHubFreshness] = useState<{
    isStale: boolean;
    staleDocCount: number;
    conceptsBuiltAt: string | null;
  } | null>(null);
  const [hubReanalyzing, setHubReanalyzing] = useState(false);
  // Track resolved findings within this session so they stay hidden
  // even if a re-scan returns them (backend concept-extraction is
  // async and can lag). Cleared on hard refresh.
  const [lintResolved, setLintResolved] = useState<{ orphans: Set<string>; duplicates: Set<string>; titleMismatches: Set<string>; staleClaims: Set<string>; mergeSuggestions: Set<string>; rollupSuggestions: Set<string>; autoArchive: Set<string>; bundleSuggestions: Set<string>; citationRot: Set<string> }>({ orphans: new Set(), duplicates: new Set(), titleMismatches: new Set(), staleClaims: new Set(), mergeSuggestions: new Set(), rollupSuggestions: new Set(), autoArchive: new Set(), bundleSuggestions: new Set(), citationRot: new Set() });
  // User's curator preferences — drives which lint categories show
  // up in Needs Review. Hydrated from localStorage on mount and
  // refreshed whenever Settings broadcasts a change so the section
  // updates without a reload.
  const [curatorSettings, setCuratorSettings] = useState<CuratorSettings>(() => defaultCuratorSettings());
  useEffect(() => {
    setCuratorSettings(loadCuratorSettings());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<CuratorSettings>).detail;
      if (detail) setCuratorSettings(detail);
    };
    window.addEventListener("mw-curator-settings-changed", onChange as EventListener);
    return () => window.removeEventListener("mw-curator-settings-changed", onChange as EventListener);
  }, []);
  // Auto-resolve any "safe" curator findings — currently just
  // orphans, which trigger a non-destructive refresh-concepts
  // PATCH. Duplicates stay manual because soft-deleting requires
  // the user to confirm the merge direction. Stored as a ref so
  // the autoResolve effects can call into it without re-rendering.
  const lintRunningAutoRef = useRef(false);
  const autoResolveSafeFindings = useCallback(async (opts: { manual?: boolean } = {}) => {
    if (lintRunningAutoRef.current) return;
    if (!user?.id) {
      if (opts.manual) showToast("Sign in to run auto-management", "info");
      return;
    }
    if (curatorSettings.autoLevel === "off") {
      if (opts.manual) showToast("Auto-management is off — change level in Settings", "info");
      return;
    }
    lintRunningAutoRef.current = true;

    // Manual Run-now: fetch a fresh lint report first so we resolve
    // against current state. The background passes rely on the periodic
    // fetch that populates lintReport; clicking Run-now needs to feel
    // immediate even when no fetch has landed yet, otherwise the button
    // silently no-ops with "lintReport is null".
    let report = lintReport;
    if (opts.manual) {
      showToast("Running auto-management…", "info");
      try {
        const res = await fetch("/api/user/hub/lint", { headers: authHeaders });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            report = { orphans: data.orphans || [], duplicates: data.duplicates || [], titleMismatches: data.titleMismatches || [], staleClaims: data.staleClaims || [], mergeSuggestions: data.mergeSuggestions || [], rollupSuggestions: data.rollupSuggestions || [], autoArchive: data.autoArchive || [], bundleSuggestions: data.bundleSuggestions || [], citationRot: data.citationRot || [], totalDocs: data.totalDocs || 0 };
            setLintReport(report);
          }
        }
      } catch { /* fall through with existing report */ }
    }
    if (!report) {
      lintRunningAutoRef.current = false;
      if (opts.manual) showToast("Couldn't load lint report — try again", "error");
      return;
    }

    let orphansResolved = 0;
    let duplicatesResolved = 0;
    // Orphan refresh — handled at every level above Off.
    if (curatorSettings.orphan && autoHandles(curatorSettings.autoLevel, "orphan-refresh")) {
      const orphans = report.orphans.filter((o) => !lintResolved.orphans.has(o.id));
      for (const o of orphans) {
        try {
          const res = await fetch(`/api/docs/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ action: "refresh-concepts", userId: user.id }),
          });
          if (res.ok) orphansResolved++;
        } catch { /* ignore; next pass retries */ }
      }
      if (orphansResolved > 0) {
        const ids = orphans.slice(0, orphansResolved).map((o) => o.id);
        setLintResolved((prev) => ({ ...prev, orphans: new Set([...prev.orphans, ...ids]) }));
        setLintReport((prev) => prev ? { ...prev, orphans: prev.orphans.filter((x) => !ids.includes(x.id)) } : prev);
      }
    }
    // Duplicate trash — Aggressive only. Soft-deletes the older copy
    // of each pair; recoverable from Trash. We do NOT prompt here —
    // the user picked Aggressive knowing this acts without asking.
    if (curatorSettings.duplicate && autoHandles(curatorSettings.autoLevel, "duplicate-trash")) {
      const dups = report.duplicates.filter((p) => !lintResolved.duplicates.has(`${p.a.id}|${p.b.id}`));
      for (const p of dups) {
        try {
          const res = await fetch(`/api/docs/${p.a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ action: "soft-delete", userId: user.id }),
          });
          if (res.ok) {
            duplicatesResolved++;
            const pairKey = `${p.a.id}|${p.b.id}`;
            setLintResolved((prev) => ({ ...prev, duplicates: new Set([...prev.duplicates, pairKey]) }));
            setLintReport((prev) => prev ? { ...prev, duplicates: prev.duplicates.filter((x) => x.a.id !== p.a.id || x.b.id !== p.b.id) } : prev);
          }
        } catch { /* ignore; next pass retries */ }
      }
    }
    // Single toast summarising the run so the user always knows what
    // auto-management did. For background passes we stay silent when
    // nothing happened; for manual Run-now we always confirm so the
    // user knows the button worked.
    const total = orphansResolved + duplicatesResolved;
    if (total > 0) {
      const parts: string[] = [];
      if (orphansResolved > 0) parts.push(`${orphansResolved} orphan${orphansResolved === 1 ? "" : "s"} refreshed`);
      if (duplicatesResolved > 0) parts.push(`${duplicatesResolved} duplicate${duplicatesResolved === 1 ? "" : "s"} trashed`);
      showToast(`Auto-managed: ${parts.join(", ")}.`, "success");
    } else if (opts.manual) {
      showToast("Nothing to auto-manage — your hub is clean.", "info");
    }
    lintRunningAutoRef.current = false;
  }, [user?.id, lintReport, curatorSettings.autoLevel, curatorSettings.orphan, curatorSettings.duplicate, lintResolved.orphans, lintResolved.duplicates, authHeaders]);
  // (Trigger useEffects for showHub on-open / interval live further
  //  down — see the block right after the showHub state declaration.
  //  TS doesn't allow forward-referencing a let/const in the same
  //  function, so the effects sit alongside the state.)
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{ x: number; y: number; section?: "my" | "bundles" } | null>(null);
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  // Synchronous flag: true while ANY HTML5 drag is in progress in the sidebar.
  // Server realtime updates and async fetches gate on this to avoid recreating
  // tab DOM nodes mid-drag — Chrome cancels the drag the instant the dragged
  // element is unmounted/reordered, which is why drag "stops working" once the
  // user is logged in (realtime channel for documents fires constantly).
  const isDraggingSidebarRef = useRef(false);
  useEffect(() => {
    const onStart = (e: DragEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-sidebar-tab-id], [data-sidebar-folder-id]")) {
        isDraggingSidebarRef.current = true;
      }
    };
    const onEnd = () => { isDraggingSidebarRef.current = false; };
    document.addEventListener("dragstart", onStart, true);
    document.addEventListener("dragend", onEnd, true);
    return () => {
      document.removeEventListener("dragstart", onStart, true);
      document.removeEventListener("dragend", onEnd, true);
    };
  }, []);
  // Cloud docs section removed — all docs auto-save to cloud
  const [recentDocs, setRecentDocs] = useState<{ id: string; title: string; visitedAt: string; isOwner: boolean; editMode: string }[]>([]);
  const [_serverDocs, setServerDocs] = useState<{ id: string; title: string; createdAt: string }[]>([]);
  // v8 W4 — auto-organize metadata mirror keyed by doc id. Populated
  // from /api/user/documents responses (which JOIN
  // document_ai_metadata). Sidebar reads it inside renderTabIcon to
  // show a tiny cluster-color dot + ai_summary tooltip on hover,
  // without round-tripping per row or extending the Tab type.
  const [docAiMeta, setDocAiMeta] = useState<Record<string, { clusterId: string | null; summary: string | null; tags: string[] }>>({});
  const ingestDocAiMeta = useCallback((docs: unknown) => {
    if (!Array.isArray(docs)) return;
    const next: Record<string, { clusterId: string | null; summary: string | null; tags: string[] }> = {};
    let any = false;
    for (const d of docs as Array<Record<string, unknown>>) {
      const id = typeof d.id === "string" ? d.id : null;
      if (!id) continue;
      const cluster = typeof d.ai_cluster_id === "string" ? d.ai_cluster_id : null;
      const summary = typeof d.ai_summary === "string" ? d.ai_summary : null;
      const tags = Array.isArray(d.ai_tags) ? (d.ai_tags as string[]) : [];
      if (cluster || summary || tags.length > 0) {
        next[id] = { clusterId: cluster, summary, tags };
        any = true;
      }
    }
    if (any) setDocAiMeta((prev) => ({ ...prev, ...next }));
  }, []);
  // Deterministic HSL color per cluster slug — same slug renders the
  // same dot color across the sidebar so the user can scan visually
  // for grouped docs. Hash collapses to a single hue; saturation +
  // lightness tuned to read against both dark and light backgrounds.
  const clusterColor = useCallback((slug: string | null | undefined): string | null => {
    if (!slug || slug === "misc") return null;
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 60% 55%)`;
  }, []);
  // Hydrate bundles from localStorage so the sidebar section renders on first paint
  // (otherwise it pops in after the /api/bundles fetch resolves).
  const [bundles, setBundles] = useState<Array<{ id: string; title: string; description: string | null; documentCount: number; updated_at: string; is_draft: boolean; has_password?: boolean; allowed_emails_count?: number; folder_id?: string | null; visibility?: "public" | "unlisted" | "private" | "restricted"; creator_type?: "user" | "ai"; creator_agent?: string | null; user_edits_count?: number }>>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("mw-bundles");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showShareModal, setShowShareModal] = useState(false);
  // True while the Share modal is open and the parent is rehydrating
  // the doc's authoritative permission state from the server. Drives
  // the ShareModal's skeleton — without it the modal would render
  // with stale "Anyone with the link" defaults for ~2s, then flip to
  // the real state, which read as a bug.
  const [shareModalLoading, setShareModalLoading] = useState(false);
  const [showViewerShareModal, setShowViewerShareModal] = useState(false);
  const [allowedEmails, setAllowedEmailsState] = useState<string[]>([]);
  const [allowedEditors, setAllowedEditorsState] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<{ id: number; type: string; documentId: string; documentTitle: string; fromUserName: string; message: string; read: boolean; createdAt: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mwPrompt, setMdfyPrompt] = useState<{ text: string; filename: string; tabId: string } | null>(null);
  const [mwLoading, setMdfyLoading] = useState(false);
  const [mwElapsed, setMdfyElapsed] = useState(0);
  const [showFlavorMenu, setShowFlavorMenu] = useState(false);

  // Tick elapsed time while AI processing
  useEffect(() => {
    if (!mwLoading) {
      setMdfyElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setMdfyElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [mwLoading]);

  // Diagram rendering mode removed — ASCII diagrams use "Convert to Mermaid" button per diagram

  // Tab system — persist to localStorage (version check to refresh samples)
  const TABS_VERSION = "10";
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (typeof window === "undefined") return INITIAL_TABS;
    try {
      const ver = localStorage.getItem("mw-tabs-version");
      if (ver === TABS_VERSION) {
        const saved = localStorage.getItem("mw-tabs");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Deduplicate by ID and cloudId
            const seenIds = new Set<string>();
            const seenCloudIds = new Set<string>();
            const deduped = parsed.filter((t: Tab) => {
              // Drop legacy hub tabs — Hub is now an overlay, not a tab.
              // Any leftover hub-<slug> entries from earlier sessions are
              // stale and would re-create the deselect-on-click bug.
              if (t.kind === "hub" || (typeof t.id === "string" && t.id.startsWith("hub-"))) return false;
              if (seenIds.has(t.id)) return false;
              seenIds.add(t.id);
              if (t.cloudId) {
                if (seenCloudIds.has(t.cloudId)) return false;
                seenCloudIds.add(t.cloudId);
              }
              return true;
            });
            // Remove duplicate example docs (same ownerEmail but non-canonical IDs)
            // and strip folderId — examples live in their own section now
            const canonicalExampleIds = new Set(EXAMPLE_TABS.map(e => e.id));
            const cleaned = deduped.filter((t: Tab) => {
              if (t.ownerEmail === EXAMPLE_OWNER && !canonicalExampleIds.has(t.id)) return false;
              return true;
            }).map((t: Tab) => {
              if (canonicalExampleIds.has(t.id)) { const { folderId: __, ...rest } = t; return rest; }
              // Backfill lastOpenedAt for tabs that don't have it (random: 1-7 days ago)
              if (!t.lastOpenedAt) {
                const now = Date.now();
                const dayMs = 24 * 60 * 60 * 1000;
                t = { ...t, lastOpenedAt: now - dayMs - Math.floor(Math.random() * 6 * dayMs) };
              }
              return t;
            });
            // If there's no Supabase auth token in localStorage, the user is
            // signed out — drop cloud-tied DOC tabs at hydration so they don't
            // flash on screen before the auth-state effect cleans them up.
            // Bundle tabs are kept because bundles also support anonymous
            // ownership (anonymous_id), so an anonymous user's bundle Recent
            // entries would otherwise vanish on every refresh.
            const hasSupabaseSession = (() => {
              try {
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i) || "";
                  if (key.startsWith("sb-") && key.endsWith("-auth-token")) return true;
                }
              } catch { /* ignore */ }
              return false;
            })();
            if (!hasSupabaseSession) {
              return cleaned.filter((t: Tab) => !t.cloudId);
            }
            return cleaned;
          }
        }
      } else {
        // New version — only merge missing EXAMPLE_TABS into the user's
        // saved list instead of nuking mw-tabs (the old reset wiped
        // every cloud-tied user doc from the sidebar Recent state and
        // made it look like docs had been deleted). The example pool
        // refresh is the only thing version bumps need to do; everything
        // else can survive across versions.
        localStorage.setItem("mw-tabs-version", TABS_VERSION);
        try {
          const saved = localStorage.getItem("mw-tabs");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              // Always re-seed example tabs from canonical EXAMPLE_TABS.
              // They're readonly so the user can never have edited them,
              // and prior bugs (or any path that wrote `markdown: ""`
              // back into mw-tabs) could leave the example body empty —
              // which then renders as a Read-only example banner with
              // nothing below. Resetting on every load keeps them
              // bulletproof.
              const exampleById = new Map(EXAMPLE_TABS.map((e) => [e.id, e]));
              const reseeded = parsed.map((t: Tab) => {
                const canon = exampleById.get(t.id);
                if (!canon) return t;
                // Preserve UI-only state (deleted, folderId), force
                // markdown / title / readonly / permission back to
                // canonical so a stale empty body can't persist.
                return {
                  ...t,
                  markdown: canon.markdown,
                  title: canon.title,
                  readonly: canon.readonly,
                  permission: canon.permission,
                  ownerEmail: canon.ownerEmail,
                };
              });
              const existingIds = new Set(reseeded.map((t: Tab) => t.id));
              const missing = EXAMPLE_TABS.filter((e) => !existingIds.has(e.id));
              const merged = missing.length > 0 ? [...reseeded, ...missing] : reseeded;
              localStorage.setItem("mw-tabs", JSON.stringify(merged));
              return merged;
            }
          }
        } catch { /* fall through to INITIAL_TABS */ }
      }
    } catch { /* ignore */ }
    return INITIAL_TABS;
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    if (typeof window === "undefined") return "";
    // Root URL contract: visiting memory.wiki/ (no doc path, no
    // ?from=/?doc=/?bundle=, no hash share) means "I'm starting
    // fresh — show me Home." Restoring a stale activeTab from
    // localStorage here was confusing: the user types memory.wiki,
    // expects a landing page, instead lands inside the editor on
    // whatever doc they last looked at (often with an empty body
    // because the doc's cloud markdown wasn't fetched yet).
    // Defer Home → Start overlay handles the empty state.
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const isBareRoot = path === "/" && !search && !hash;
    if (isBareRoot) return "";
    const saved = localStorage.getItem("mw-active-tab");
    if (!saved) return "";
    // Stale localStorage from older sessions can pin us on either
    //   1) `tab-welcome` (or any example tutorial tab), or
    //   2) `hub-<slug>` from when Hub used to live as a tab (it's
    //      an overlay now, so no tab matches that id any more).
    // Both cases leave activeTab undefined on lookup → initialMd
    // falls back to SAMPLE_WELCOME → the editor renders the
    // tutorial blurb on refresh even for users with their own
    // docs. Drop those ids here so we fall through to the
    // owned-doc / Home logic below.
    if (saved.startsWith("tab-") && EXAMPLE_TAB_IDS.has(saved)) return "";
    if (saved.startsWith("hub-")) return "";
    return saved;
  });
  const activeTabIdRef = useRef(activeTabId);
  const [_reorderedTabId, _setReorderedTabId] = useState<string | null>(null);
  const _sidebarItemRectsRef = useRef<Map<string, DOMRect>>(new Map());
  activeTabIdRef.current = activeTabId;
  // activeTab fallback was `tabs[0]` which is the Welcome example tab
  // (INITIAL_TABS[0] = tab-welcome). That meant every fresh load with
  // an empty / stale activeTabId would render the welcome blurb in the
  // editor before the user clicked anything — repeatedly, even on
  // return visits.
  //
  // The activeTabId useState init above already strips stale
  // EXAMPLE_TAB_IDS / hub-* from localStorage on reload, so by the
  // time we land here, an activeTabId pointing at an example means
  // the user is *intentionally* viewing it (they just clicked it in
  // the Guides sidebar / Start grid). Honour that click — previously
  // we filtered it out and silently fell back to an owned doc, which
  // is why clicking "Sample Bundle: Tour of memory.wiki" in the sidebar
  // showed someone else's doc (or blank) instead of the bundle.
  const activeTab = (() => {
    const isOwn = (t: typeof tabs[number]) => !t.deleted && t.ownerEmail !== EXAMPLE_OWNER;
    const explicit = activeTabId ? tabs.find((t) => t.id === activeTabId) : undefined;
    if (explicit) return explicit;
    return tabs.find(isOwn);
  })();

  // Track active bundle's document IDs for sidebar highlighting.
  // Root-cause cleanup: when the server returns 404/403 we drop the
  // stale tab from tabs[] (and switch off it if it was active). That
  // way a deleted/inaccessible bundle id triggers AT MOST ONE 404
  // per session — after the tab is gone, this effect doesn't run for
  // it again. We can't pre-gate on `bundles[]` membership because
  // shared / anonymous-editToken bundles aren't in /api/bundles
  // listing yet still have legitimate access (see comment near
  // /api/bundles load below).
  useEffect(() => {
    if (activeTab?.kind !== "bundle" || !activeTab.bundleId) {
      setActiveBundleDocIds(new Set());
      return;
    }
    const bid = activeTab.bundleId;
    const tabId = activeTab.id;
    fetch(`/api/bundles/${bid}`, { headers: authHeadersRef.current })
      .then(async (r) => {
        if (r.status === 404 || r.status === 403) {
          // Stale tab — bundle no longer exists or no access. Drop
          // it from tabs[] so subsequent renders don't keep probing
          // and BundleEmbed never mounts against a dead reference.
          setTabs((prev) => prev.filter((t) => t.id !== tabId));
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data?.documents) {
          setActiveBundleDocIds(new Set(data.documents.map((d: { id: string }) => d.id)));
        }
      })
      .catch(() => {});
  }, [activeTab?.kind, activeTab?.bundleId, activeTab?.id]);

  // Persist bundles to localStorage so the sidebar section is hydrated instantly on next load
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("mw-bundles", JSON.stringify(bundles)); } catch { /* quota */ }
  }, [bundles]);


  // CRITICAL: never seed a cloud doc's editor with SAMPLE_WELCOME.
  // If activeTab has a cloudId but its body hasn't been hydrated yet
  // (rehydrate fetch in flight), substituting the sample causes
  // Tiptap's first onUpdate to autosave the sample over the real
  // doc — which is exactly how Project Acme / Claude Memory /
  // AI Bundle docs got their bodies replaced with the welcome blurb.
  // Use empty string instead; the editor stays blank until the fetch
  // returns, after which setMarkdownRaw fills it in.
  //
  // Also: when there's NO activeTab at all (rare — happens when
  // Hub used to be the active "tab" and that id is now stale, or
  // when localStorage has examples only), don't fall back to
  // SAMPLE_WELCOME either. The Start screen handles the empty-
  // state case; the editor staying blank prevents the
  // "# Welcome to memory.wiki" blurb from auto-rendering on refresh.
  const initialMd = activeTab?.markdown
    || (activeTab ? "" : "");
  const [markdown, setMarkdownRaw] = useState(initialMd);
  const undoStack = useRef<string[]>([initialMd]);
  const redoStack = useRef<string[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Per-tab in-flight guard for the triggerAutoSave create-on-first-edit
  // backstop. Without this a keystroke storm in a brand-new tab would
  // fire N parallel POST /api/docs requests; the helper inside useAutoSave
  // also dedupes by fingerprint, but per-tab tracking here keeps the
  // setTabs callback from racing against itself.
  const inflightCreateByTabIdRef = useRef<Set<string>>(new Set());

  // Global safety net: immediately remove cloudId duplicates from state
  useEffect(() => {
    const seen = new Set<string>();
    let hasDup = false;
    for (const t of tabs) {
      if (t.cloudId) {
        if (seen.has(t.cloudId)) { hasDup = true; break; }
        seen.add(t.cloudId);
      }
    }
    if (hasDup) {
      const keep = new Set<string>();
      setTabs(prev => prev.filter(t => {
        if (!t.cloudId) return true;
        if (keep.has(t.cloudId)) return false;
        keep.add(t.cloudId);
        return true;
      }));
    }
  }, [tabs]);

  // Sync document folder changes to server
  const prevFolderMapRef = useRef<Map<string, string | undefined>>(new Map());
  useEffect(() => {
    const newMap = new Map<string, string | undefined>();
    for (const t of tabs) {
      if (t.cloudId) newMap.set(t.cloudId, t.folderId);
    }
    // Compare and sync changes
    for (const [cloudId, folderId] of newMap) {
      const prev = prevFolderMapRef.current.get(cloudId);
      if (prev !== folderId && prevFolderMapRef.current.has(cloudId)) {
        // Folder changed — update server
        fetch(`/api/docs/${cloudId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeadersRef.current },
          body: JSON.stringify({ action: "move-to-folder", folderId: folderId || null }),
        }).catch(() => {});
      }
    }
    prevFolderMapRef.current = newMap;
  }, [tabs]);

  // Persist tabs + folders + active tab to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, markdown } : t);
        // Deduplicate by cloudId + strip non-canonical example docs before persisting
        const seenCloud = new Set<string>();
        const _canonicalIds = new Set(EXAMPLE_TABS.map(e => e.id));
        const cleanTabs = updatedTabs.filter(t => {
          if (t.cloudId) {
            if (seenCloud.has(t.cloudId)) return false;
            seenCloud.add(t.cloudId);
          }
          if (t.ownerEmail === EXAMPLE_OWNER && !_canonicalIds.has(t.id)) return false;
          return true;
        });
        localStorage.setItem("mw-tabs", JSON.stringify(cleanTabs));
        localStorage.setItem("mw-active-tab", activeTabId);
        localStorage.setItem("mw-folders", JSON.stringify(folders));
        localStorage.setItem("mw-hidden-examples", JSON.stringify([...hiddenExampleIds]));
        localStorage.setItem("mw-show-examples", JSON.stringify(showExamples));
      } catch {
        // Quota exceeded — try saving without markdown bodies for cloud-synced tabs
        try {
          const lightTabs = tabs.map(t => {
            if (t.cloudId) {
              // Cloud-synced: strip markdown body (will reload from server)
              return { ...t, markdown: "" };
            }
            return t.id === activeTabId ? { ...t, markdown } : t;
          });
          localStorage.setItem("mw-tabs", JSON.stringify(lightTabs));
          localStorage.setItem("mw-active-tab", activeTabId);
          localStorage.setItem("mw-folders", JSON.stringify(folders));
        } catch { /* truly out of space */ }
      }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, activeTabId, markdown, folders]);

  // Ref for isCollaborating to avoid stale closures in triggerAutoSave
  const isCollaboratingRef2 = useRef(false);

  // Trigger auto-save without undo tracking (used by undo/redo)
  const triggerAutoSave = useCallback((val: string) => {
    // Drop stale callbacks: if the editor's current ref has moved on, the
    // val we were passed is no longer the truth. Saving it would PATCH the
    // current active doc with whatever stale content the original caller
    // captured. This is the cheapest "right thing wins" guard against
    // tab-switch races feeding old content into the new doc's cloudId.
    if (val !== markdownRef.current) return;
    const currentTab = tabs.find(t => t.id === activeTabIdRef.current);

    // ── Create-on-first-edit backstop ──
    // Many tab-creation paths add the tab to local state without firing
    // autoSave.createDocument. When the user then types, the original
    // branch below skipped because cloudId was missing — so the tab
    // never got a cloud id, no public URL, never appeared in the MDs
    // sidebar serverDocs sync, and was effectively local-only forever.
    // This block defensively creates a cloud row the first time the
    // user's draft becomes substantial (≥ 10 trimmed chars), then
    // attaches cloudId/editToken to the tab and refreshes serverDocs.
    // De-duped per-tab so a flurry of keystrokes only fires one create.
    if (!currentTab?.cloudId && currentTab && !currentTab.readonly && !currentTab.deleted && val.trim().length >= 10) {
      const tabId = currentTab.id;
      if (!inflightCreateByTabIdRef.current.has(tabId)) {
        inflightCreateByTabIdRef.current.add(tabId);
        const anonId = user?.id ? undefined : ensureAnonymousId();
        autoSave.createDocument({
          markdown: val,
          title: extractTitleFromMd(val) || currentTab.title || "Untitled",
          userId: user?.id,
          anonymousId: anonId,
        }).then(result => {
          inflightCreateByTabIdRef.current.delete(tabId);
          if (!result) return;
          setTabs(prev => prev.map(t => t.id === tabId
            ? { ...t, cloudId: result.id, editToken: result.editToken, isDraft: true, permission: "mine" as const }
            : t,
          ));
          if (tabId === activeTabIdRef.current) {
            try { window.history.replaceState(null, "", `/${result.id}`); } catch { /* SSR / iframe — ignore */ }
            setDocId(result.id);
          }
          // Refresh sidebar serverDocs so MDs section reflects the
          // newly-created doc without a page reload.
          fetch("/api/user/documents?includeDeleted=1", { headers: authHeadersRef.current })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents); })
            .catch(() => {});
        });
      }
      return;
    }

    if (currentTab?.cloudId && !currentTab.readonly && !currentTab.deleted) {
      // CRITICAL: refuse to save while the tab's body hasn't been
      // hydrated from the server yet. An empty tab.markdown means the
      // rehydrate fetch is still in flight; any val we have right now
      // is either the editor's seed (used to be SAMPLE_WELCOME!) or
      // a Tiptap-normalized version of it. Saving would clobber the
      // real doc body with the seed — which is the failure mode that
      // produced the "Welcome to [memory.wiki]..." corruption.
      if (!currentTab.markdown) return;
      // Hold off saving while a tab switch is mid-flight. handleTiptapChange
      // already gates on this flag for direct edits, but other call sites
      // (undo/redo, paste, programmatic setMarkdown) come straight through
      // setMarkdown → triggerAutoSave with no flag check. Without this gate,
      // a re-mount or content-replacement during loadTab can fire one last
      // save with stale content under the NEW tab's cloudId.
      if (tabSwitchInFlightRef.current) return;
      maybeCreateSessionSnapshot(currentTab.cloudId);
      // When Yjs collaboration is active, skip conflict detection
      // (CRDT handles merging, so both users save the same merged content)
      if (isCollaboratingRef2.current) {
        autoSave.setLastServerUpdatedAt("");
      }
      autoSave.scheduleSave({
        cloudId: currentTab.cloudId,
        markdown: val,
        title: extractTitleFromMd(val) || currentTab.title,
        userId: user?.id,
        userEmail: user?.email,
        anonymousId,
        editToken: currentTab.editToken,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, user?.id, user?.email, anonymousId, autoSave]);

  // Ref for Yjs collaboration — populated later, used by setMarkdown
  const collabApplyLocalRef = useRef<((md: string) => void) | null>(null);

  // Wrapper that tracks undo history + triggers auto-save + broadcasts via Yjs
  const setMarkdown = useCallback((val: string) => {
    // CRITICAL: update markdownRef synchronously BEFORE triggering
    // auto-save. triggerAutoSave's first guard is
    // `if (val !== markdownRef.current) return` — meant to drop
    // stale callbacks from tab-switch races — but React's setState
    // hasn't committed yet at this point, so the ref still holds the
    // OLD value. Without this assignment EVERY save from a non-
    // TipTap path (AI Polish / Format / chat, paste, programmatic
    // setMarkdown, undo/redo) would silently bail. handleTiptapChange
    // sets the ref the same way for the same reason.
    markdownRef.current = val;
    setMarkdownRaw(val);
    // Debounce undo snapshots (don't save every keystroke)
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      const last = undoStack.current[undoStack.current.length - 1];
      if (val !== last) {
        undoStack.current.push(val);
        // Trim stack: max 50 entries, max ~5MB total
        while (undoStack.current.length > 50) undoStack.current.shift();
        let totalSize = undoStack.current.reduce((sum, s) => sum + s.length, 0);
        while (totalSize > 5 * 1024 * 1024 && undoStack.current.length > 1) {
          totalSize -= undoStack.current.shift()!.length;
        }
        redoStack.current = [];
      }
    }, 500);
    triggerAutoSave(val);
    // Broadcast local change to Yjs peers
    collabApplyLocalRef.current?.(val);
  }, [triggerAutoSave]);

  // Undo / redo must push the restored markdown into every writer
  // the AI actions touch — markdownRaw, the legacy preview, the
  // CodeMirror source buffer, the TipTap Live tree, the tab object,
  // and the Yjs CRDT if collab is active. The previous version only
  // updated markdownRaw + the preview, so when the user hit Undo
  // after an AI Polish / Chat edit, CodeMirror and TipTap kept
  // showing the AI result and the change didn't actually revert in
  // the editor they were looking at. Reported case: AI chat wiped
  // the doc, Undo button looked like a no-op because Live tab still
  // showed the empty TipTap state.
  const applyHistoryEntry = useCallback((md: string) => {
    setMarkdownRaw(md);
    // doRender is declared later in the file — keep it out of the
    // deps array (used before declaration TDZ) but still callable
    // inside the body at runtime. Same pattern the original undo
    // used. Same goes for cmSetDocRef / tiptapRef / collabForceResetRef:
    // all are refs whose .current is read at invoke time.
    doRender(md);
    cmSetDocRef.current?.(md);
    tiptapRef.current?.setMarkdown(md);
    setTabs((prev) => prev.map((t) => t.id === activeTabIdRef.current ? { ...t, markdown: md } : t));
    // CRDT reset, otherwise peers (and the next change) will yank
    // us back to the post-AI state because Yjs has it in its log.
    collabForceResetRef.current?.(md);
    triggerAutoSave(md);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerAutoSave]);

  const undo = useCallback(() => {
    if (undoStack.current.length <= 1) return;
    const current = undoStack.current.pop()!;
    redoStack.current.push(current);
    const prev = undoStack.current[undoStack.current.length - 1];
    applyHistoryEntry(prev);
  }, [applyHistoryEntry]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(next);
    applyHistoryEntry(next);
  }, [applyHistoryEntry]);

  // Tab functions use doRenderRef to avoid circular dependency
  const doRenderRef = useRef<(md: string) => void>(() => {});

  const [html, setHtml] = useState("");
  const [flavor, setFlavor] = useState<string>("detecting...");
  const [flavorDetails, setFlavorDetails] = useState<Record<string, boolean>>(
    {}
  );
  const [title, setTitle] = useState<string | undefined>();
  const [renderTime, setRenderTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  // Delayed loader visibility — only show the inner loader if
  // isLoading stays true for more than 250ms. Fast renders (typical
  // for the sample welcome doc and cached cloud docs) finish well
  // under that, so the loader never flashes on initial mount or
  // quick tab switches. Eliminates the "big logo flickered before
  // UI" complaint without sacrificing the slower-fetch UX.
  const [showInnerLoader, setShowInnerLoader] = useState(false);
  useEffect(() => {
    if (!isLoading) { setShowInnerLoader(false); return; }
    const t = setTimeout(() => setShowInnerLoader(true), 250);
    return () => clearTimeout(t);
  }, [isLoading]);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);
  const [shareState, setShareState] = useState<
    "idle" | "sharing" | "copied" | "error"
  >("idle");
  // Persisted across reloads — without this, hitting refresh on a
  // doc URL forced the user back into Live view ("preview") even
  // when they'd been working in Split or Source. Reads at mount,
  // writes whenever viewMode changes (see effect below).
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "preview";
    try {
      const saved = localStorage.getItem("mw-view-mode");
      if (saved === "preview" || saved === "split" || saved === "editor") return saved;
    } catch { /* localStorage unavailable */ }
    return "preview";
  });
  useEffect(() => {
    try { localStorage.setItem("mw-view-mode", viewMode); } catch { /* ignore */ }
  }, [viewMode]);
  // Sync editors on view switch
  const prevViewModeRef = useRef<ViewMode>("preview");
  useEffect(() => {
    const prev = prevViewModeRef.current;
    prevViewModeRef.current = viewMode;
    // Source → Live/Split: sync markdown to Tiptap
    if (prev === "editor" && (viewMode === "preview" || viewMode === "split")) {
      tiptapRef.current?.setMarkdown(markdownRef.current);
    }
    // Live → Source/Split: sync markdown state + CM6
    if (prev === "preview" && (viewMode === "editor" || viewMode === "split")) {
      const md = markdownRef.current;
      setMarkdownRaw(md);
      cmSetDocRef.current?.(md);
      doRenderRef.current(md);
    }
  }, [viewMode]);
  const [isSharedDoc, setIsSharedDoc] = useState(false); // opened from URL — read-only unless owner
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  // Both panes default to narrow (book-like reading/editing width). The button
  // toggles "Wide view" — active when narrow=false.
  const [narrowView, setNarrowView] = useState(true);
  const [narrowSource, setNarrowSource] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("mw-panel-ai") === "true";
  });
  // AI panel mode override. "auto" resolves from activeTab.kind (doc/bundle).
  // "hub" forces the hub-wide assistant — surfaced only when the user has a
  // hub_slug. Persisted so the mode survives reloads.
  const [aiPanelMode, setAiPanelMode] = useState<"auto" | "hub">(() => {
    if (typeof window === "undefined") return "auto";
    return (localStorage.getItem("mw-ai-panel-mode") as "auto" | "hub") || "auto";
  });
  useEffect(() => { try { localStorage.setItem("mw-ai-panel-mode", aiPanelMode); } catch {} }, [aiPanelMode]);
  // Concept count for the hub — surfaced in HubChat's empty state.
  const [hubConceptCount, setHubConceptCount] = useState<number>(0);
  const [showOutlinePanel, setShowOutlinePanel] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("mw-panel-outline");
    return saved === null ? true : saved === "true";
  });
  const [showImagePanel, setShowImagePanel] = useState(() => {
    if (typeof window === "undefined") return false;
    // Deep-link: ?panel=images opens the My Images sidebar on load,
    // used by the chrome extension's 'saved → Open library' toast.
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("panel") === "images") return true;
    } catch { /* noop */ }
    return localStorage.getItem("mw-panel-image") === "true";
  });
  // Persist right panel state
  useEffect(() => { try { localStorage.setItem("mw-panel-ai", String(showAIPanel)); localStorage.setItem("mw-panel-outline", String(showOutlinePanel)); localStorage.setItem("mw-panel-image", String(showImagePanel)); } catch {} }, [showAIPanel, showOutlinePanel, showImagePanel]);
  // Resizable Assistant (right) panel width — persisted, drag handle on left edge.
  const [aiPanelWidth, setAiPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 360;
    const saved = parseInt(localStorage.getItem("mw-ai-panel-width") || "");
    return Number.isFinite(saved) && saved >= 280 && saved <= 720 ? saved : 360;
  });
  // Resizable image panel width. Drag handle on the panel's left edge.
  const [imagePanelWidth, setImagePanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 320;
    const saved = parseInt(localStorage.getItem("mw-image-panel-width") || "");
    return Number.isFinite(saved) && saved >= 240 && saved <= 720 ? saved : 320;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-image-panel-width", String(imagePanelWidth));
  }, [imagePanelWidth]);
  const isDraggingImagePanel = useRef(false);
  const imagePanelPendingWidthRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-ai-panel-width", String(aiPanelWidth));
  }, [aiPanelWidth]);
  // Load concept count for the user's hub once we know the slug. Used by
  // HubChat's empty state ("78 concepts indexed — ask anything"). The count
  // endpoint is cheap (HEAD on concept_index for the user) so we re-fetch
  // any time the panel opens in hub mode to stay roughly fresh.
  const hubSlug = (profile as { hub_slug?: string | null } | null)?.hub_slug || null;
  useEffect(() => {
    if (!hubSlug) { setHubConceptCount(0); return; }
    if (!showAIPanel || aiPanelMode !== "hub") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/hub/${hubSlug}/concepts/count`, { headers: authHeaders });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && typeof j?.count === "number") setHubConceptCount(j.count);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [hubSlug, showAIPanel, aiPanelMode, authHeaders]);
  const isDraggingAiPanel = useRef(false);
  const aiPanelPendingWidthRef = useRef<number | null>(null);

  const [userImages, setUserImages] = useState<{ name: string; url: string; size: number; createdAt: string }[]>([]);
  const [imageQuota, setImageQuota] = useState<{ used: number; total: number; plan: string } | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Load images when panel is open (including on initial mount)
  useEffect(() => {
    if (!showImagePanel || !isAuthenticated) return;
    if (userImages.length > 0) return; // already loaded
    fetch("/api/upload/list", { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setUserImages(d.images || []); setImageQuota(d.quota); } })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImagePanel, isAuthenticated]);

  const [aiProcessing, setAiProcessing] = useState<string | null>(null);
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<{ role: "user" | "ai"; text: string; canUndo?: boolean }[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  // When the user creates a new doc *inside* a specific folder (via folder hover "+"),
  // we stash the folderId here so the template picker → addTabWithContent flow can
  // assign the new doc's folderId once it lands. Cleared after consumed.
  const [pendingNewDocFolderId, setPendingNewDocFolderId] = useState<string | null>(null);
  // Same idea for bundles — set when user clicks "+" on a bundle folder so the
  // bundle creator modal can drop the new bundle into that folder.
  const [pendingNewBundleFolderId, setPendingNewBundleFolderId] = useState<string | null>(null);
  // Folder id whose emoji is currently being edited via the picker modal
  const [emojiPickerFolderId, setEmojiPickerFolderId] = useState<string | null>(null);
  const [inlineInput, setInlineInput] = useState<{ label: string; defaultValue?: string; onSubmit: (v: string) => void; position?: { x: number; y: number } } | null>(null);
  // Inline rename state for the sidebar. When non-null, the matching
  // row in <SidebarFolderTree> swaps its title for an in-place input.
  // Driven by double-click on the row OR the kebab/context-menu
  // "Rename" entries (which call setRenamingItem instead of opening
  // the bottom prompt).
  const [renamingItem, setRenamingItem] = useState<{ kind: "folder" | "tab"; id: string } | null>(null);
  // Starred / pinned items — flat list of {kind, id}. Surfaced as a
  // dedicated "Starred" section at the top of the sidebar so the user
  // can pin frequent docs/bundles for quick recall without burying
  // them in folders.
  const [pins, setPins] = useState<Array<{ kind: "document" | "bundle"; id: string }>>([]);
  const pinKeySet = useMemo(() => new Set(pins.map((p) => `${p.kind}:${p.id}`)), [pins]);
  const isPinned = useCallback((kind: "document" | "bundle", id: string) => pinKeySet.has(`${kind}:${id}`), [pinKeySet]);
  const togglePin = useCallback(async (kind: "document" | "bundle", id: string) => {
    const key = `${kind}:${id}`;
    const wasPinned = pinKeySet.has(key);
    // Optimistic update. New pins land at the FRONT so the most recent
    // star sits on top of the Starred section.
    setPins((prev) => wasPinned ? prev.filter((p) => `${p.kind}:${p.id}` !== key) : [{ kind, id }, ...prev]);
    try {
      if (wasPinned) {
        await fetch(`/api/user/pins?kind=${kind}&id=${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeadersRef.current });
      } else {
        await fetch("/api/user/pins", { method: "POST", headers: { "Content-Type": "application/json", ...authHeadersRef.current }, body: JSON.stringify({ kind, id }) });
      }
    } catch { /* swallow — optimistic state stays */ }
  }, [pinKeySet]);
  const [docId, setDocId] = useState<string | null>(null);
  // Presence: track other editors on the same document
  const presenceUser = useMemo(() => user ? { id: user.id, email: user.email, displayName: profile?.display_name || user.email, avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || null } : null, [user, profile]);
  const { otherEditors } = usePresence(docId, presenceUser);

  // ─── Yjs CRDT Collaboration ───
  // Remote change handler: update markdown, render, and sync CM6 +
  // the Live tab's Tiptap editor. Tiptap was previously left out
  // here, so a viewer on the Live tab never saw the remote peer's
  // edits stream in — they only got the final markdown after
  // auto-save. Tiptap's setMarkdown flips isSettingContent so the
  // resulting onUpdate doesn't echo back into Yjs.
  const collabRemoteHandler = useCallback((newMarkdown: string) => {
    setMarkdownRaw(newMarkdown);
    doRenderRef.current(newMarkdown);
    cmSetDocRef.current?.(newMarkdown);
    tiptapRef.current?.setMarkdown(newMarkdown);
    triggerAutoSave(newMarkdown);
  }, [triggerAutoSave]);
  const { applyLocalChange: collabApplyLocal, forceReset: collabForceReset, peerCount: _collabPeerCount, isCollaborating } = useCollaboration(
    docId,
    markdown,
    collabRemoteHandler,
  );
  collabApplyLocalRef.current = collabApplyLocal;
  const collabForceResetRef = useRef(collabForceReset);
  collabForceResetRef.current = collabForceReset;
  isCollaboratingRef2.current = isCollaborating;

  const [isOwner, setIsOwner] = useState(false);
  const [docEditMode, setDocEditMode] = useState<"owner" | "account" | "token" | "view" | "public">("token");
  // Editor role: non-owner who's been explicitly added to a doc's
  // allowed_editors. Comes from /api/docs/[id]'s isEditor flag and
  // unlocks the Tiptap + CM6 editing surface (the PATCH endpoint
  // already accepts edits from editors — only the client gate was
  // missing).
  const [isEditor, setIsEditor] = useState(false);
  // Edit access. Four positive cases:
  //   1. local-only / I created the tab → !isSharedDoc
  //   2. cloud owner (token OR account)
  //   3. owner explicitly invited me as an editor (allowed_editors)
  //   4. edit_mode === "public" → "anyone with link can edit",
  //      a legacy mode some old docs still use
  const canEdit = !isSharedDoc || isOwner || isEditor || docEditMode === "public";
  const [showQr, setShowQr] = useState(false);
  const [showAiBanner, setShowAiBanner] = useState(false);
  const [canvasMermaid, setCanvasMermaid] = useState<string | undefined>();
  const mermaidIsNewRef = useRef(false); // true = inserting new, false = editing existing
  const mermaidSourceIndexRef = useRef<number>(-1); // character offset of mermaid block in markdown
  const prevMermaidCodesRef = useRef<string[]>([]); // track mermaid codes to skip redundant re-renders
  const [showMermaidModal, setShowMermaidModal] = useState(false);
  // History panel state
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<{ id: number; version_number: number; title: string | null; created_at: string; change_summary: string | null; markdown?: string }[]>([]);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  // Permission / edit mode state
  const [editMode, setEditMode] = useState<"owner" | "account" | "token" | "view" | "public">("owner");
  const [showEditModeMenu, setShowEditModeMenu] = useState(false);
  const [initialMath, setInitialMath] = useState<string | undefined>();
  const mathOriginalRef = useRef<string | null>(null); // original MD syntax for replacement
  const mathSourceIndexRef = useRef<number>(-1); // character offset of the math block in markdown
  const [showMathModal, setShowMathModal] = useState(false);
  const [codeEditState, setCodeEditState] = useState<{ lang: string; code: string } | null>(null);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const closeSidebar = useCallback(() => {
    if (isMobile) {
      setSidebarClosing(true);
      setTimeout(() => { setShowSidebar(false); setSidebarClosing(false); }, 250);
    } else {
      setShowSidebar(false);
    }
  }, [isMobile]);
  const [editorPlaceholder, setEditorPlaceholder] = useState<"sign-in" | "restricted" | "not-found" | "deleted" | null>(null);
  // Stuck-loader watchdog — if isLoading stays true for >8s without
  // any code path flipping it (the success path's doRender, an
  // explicit setIsLoading(false), or an error placeholder), force
  // dismiss and surface "not-found". Safety net for the
  // "open a private link while logged-out → infinite logo" class of
  // bugs: any future early-return that forgets to clear isLoading
  // still recovers within 8 seconds instead of stranding the visitor
  // on a perpetual loader. Loader being permanently stuck is the
  // worst possible failure mode — nothing on screen, no recourse.
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      setIsLoading(false);
      setEditorPlaceholder((cur) => cur ?? "not-found");
    }, 8000);
    return () => clearTimeout(t);
  }, [isLoading]);
  const [deletedDocId, setDeletedDocId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 240;
    const saved = parseInt(localStorage.getItem("mw-sidebar-width") || "");
    return Number.isFinite(saved) && saved >= 240 && saved <= 600 ? saved : 240;
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);
  const isDraggingSidebar = useRef(false);
  const sidebarResizePendingWidthRef = useRef<number | null>(null);

  // Document-level resize listeners. Bound on mousedown of either the sidebar
  // or AI panel handle, removed on mouseup. Using window/document instead of
  // the wrapper's onMouseMove fixes a subtle bug: when the cursor crossed over
  // the BundleCanvas during a drag, ReactFlow's internal pointermove handlers
  // would capture the event before our bubbling onMouseMove ran — sidebar and
  // AI panel resizing would stall as soon as the cursor entered the canvas.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const wrapper = document.querySelector('[data-resize-wrapper]') as HTMLElement | null;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      if (isDraggingSidebar.current) {
        const w = Math.max(240, Math.min(600, e.clientX - rect.left));
        const el = wrapper.querySelector('[data-pane="sidebar"]') as HTMLElement | null;
        if (el) el.style.width = `${w}px`;
        sidebarResizePendingWidthRef.current = w;
      } else if (isDraggingAiPanel.current) {
        const w = Math.max(280, Math.min(720, rect.right - e.clientX));
        const el = wrapper.querySelector('[data-pane="ai-panel"]') as HTMLElement | null;
        if (el) el.style.width = `${w}px`;
        aiPanelPendingWidthRef.current = w;
      } else if (isDraggingImagePanel.current) {
        const w = Math.max(240, Math.min(720, rect.right - e.clientX));
        const el = wrapper.querySelector('[data-pane="image-panel"]') as HTMLElement | null;
        if (el) el.style.width = `${w}px`;
        // The absolute-positioned overlay surfaces (hub/galaxy/settings/
        // bundle canvas embed) use `right:` to reserve room for the
        // panel. Without this live update they don't reflow until
        // mouseup — so growing the panel makes them overlap or get
        // hidden underneath. Sync them in real time.
        wrapper.querySelectorAll('[data-reserves-right-panel]').forEach((node) => {
          (node as HTMLElement).style.right = `${w}px`;
        });
        imagePanelPendingWidthRef.current = w;
      }
    };
    const onUp = () => {
      if (isDraggingSidebar.current) {
        isDraggingSidebar.current = false;
        if (sidebarResizePendingWidthRef.current != null) {
          setSidebarWidth(sidebarResizePendingWidthRef.current);
          sidebarResizePendingWidthRef.current = null;
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      if (isDraggingAiPanel.current) {
        isDraggingAiPanel.current = false;
        if (aiPanelPendingWidthRef.current != null) {
          setAiPanelWidth(aiPanelPendingWidthRef.current);
          aiPanelPendingWidthRef.current = null;
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      if (isDraggingImagePanel.current) {
        isDraggingImagePanel.current = false;
        if (imagePanelPendingWidthRef.current != null) {
          setImagePanelWidth(imagePanelPendingWidthRef.current);
          imagePanelPendingWidthRef.current = null;
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const importFileRef = useRef<HTMLInputElement>(null);
  // Separate ref for Obsidian ZIP uploads so the ZIP picker doesn't
  // appear in the same accept list as the document import picker.
  const obsidianFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [docContextMenu, setDocContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folderId: string; confirmDelete?: boolean } | null>(null);
  const [bundleContextMenu, setBundleContextMenu] = useState<{ x: number; y: number; bundleId: string; confirmDelete?: boolean } | null>(null);
  const [bundleShareModal, setBundleShareModal] = useState<{ bundleId: string } | null>(null);
  const [dragFolderId, setDragFolderId] = useState<string | null>(null);
  // Global Library sort (legacy — drives the small Library-header
  // button). Kept as a fallback / "set both at once" affordance.
  const [sortMode, _setSortMode] = useState<"az" | "za" | "custom">(() => {
    if (typeof window === "undefined") return "az";
    const saved = localStorage.getItem("mw-sort-mode");
    return (saved === "az" || saved === "za" || saved === "custom") ? saved : "az";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-sort-mode", sortMode);
  }, [sortMode]);
  // Per-section sort modes. The user wanted MD Bundles and MDs to
  // sort independently — e.g. bundles by date, docs alphabetical.
  // Includes "newest"/"oldest" (by lastOpenedAt) in addition to the
  // legacy az/za/custom.
  type SectionSortMode = "newest" | "oldest" | "az" | "za" | "custom";
  const SECTION_SORT_OPTIONS: { value: SectionSortMode; label: string }[] = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "az",     label: "A → Z" },
    { value: "za",     label: "Z → A" },
    { value: "custom", label: "Custom (drag)" },
  ];
  const [mdsSortMode, setMdsSortMode] = useState<SectionSortMode>(() => {
    if (typeof window === "undefined") return "newest";
    const s = localStorage.getItem("mw-mds-sort");
    return (s && SECTION_SORT_OPTIONS.find((o) => o.value === s)) ? (s as SectionSortMode) : "newest";
  });
  const [bundlesSortMode, setBundlesSortMode] = useState<SectionSortMode>(() => {
    if (typeof window === "undefined") return "newest";
    const s = localStorage.getItem("mw-bundles-sort");
    return (s && SECTION_SORT_OPTIONS.find((o) => o.value === s)) ? (s as SectionSortMode) : "newest";
  });
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("mw-mds-sort", mdsSortMode); }, [mdsSortMode]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("mw-bundles-sort", bundlesSortMode); }, [bundlesSortMode]);
  // Which section's sort menu is currently open (null = none).
  const [openSortMenu, setOpenSortMenu] = useState<"mds" | "bundles" | null>(null);
  // Recently visited tabs (max 7, most-recent-first). Stored separately from
  // `tabs` so clicking a tab does NOT re-sort the main tree (jumpy UX).
  const [recentTabIds, setRecentTabIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("mw-recent-tabs");
      if (saved) {
        const arr = JSON.parse(saved);
        // Strip any leftover hub tab ids from older sessions — the
        // policy is now "Hub never enters Recent", so we drop them
        // on load instead of letting them linger forever.
        return Array.isArray(arr) ? arr.filter((id: string) => typeof id === "string" && !id.startsWith("hub-")) : [];
      }
    } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      try { localStorage.setItem("mw-recent-tabs", JSON.stringify(recentTabIds)); } catch { /* quota */ }
    }
  }, [recentTabIds]);

  // Server-fetched recent docs — supplements localStorage recentTabIds
  // with docs the user created from other surfaces (chrome extension,
  // VS Code, desktop, etc.) so the Start screen shows EVERYTHING they
  // recently made, not just what they opened in this browser.
  type ServerRecentDoc = { id: string; title: string; source: string; ts: number };
  const [serverRecentDocs, setServerRecentDocs] = useState<ServerRecentDoc[]>([]);
  const fetchServerRecent = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/docs/recent?limit=15", { headers: authHeaders });
      if (!res.ok) return;
      const data = await res.json();
      setServerRecentDocs(Array.isArray(data.items) ? data.items : []);
    } catch { /* noop */ }
  }, [isAuthenticated, authHeaders]);
  useEffect(() => { void fetchServerRecent(); }, [fetchServerRecent]);
  // Refresh on window focus — picks up docs created in other tabs /
  // chrome ext / desktop without a hard reload.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => { void fetchServerRecent(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchServerRecent]);
  // Always reflect the active tab at the top of Recent — including on initial
  // mount, history-driven navigation, or any non-click switch. Idempotent: skips
  // when activeTabId is already first. Hub tabs are excluded: the Hub button
  // in the centre toolbar is always reachable, so seeing "My Hub" eat a slot
  // in Recent pushes out the doc/bundle entries that actually benefit from
  // recency tracking. handleDocClick has the same skip; this effect is the
  // catch-all path (switchTab call from the Hub button, history nav, etc.).
  useEffect(() => {
    if (!activeTabId) return;
    if (isDraggingSidebarRef.current) return;
    if (activeTabId.startsWith("hub-")) return;
    setRecentTabIds(prev => prev[0] === activeTabId ? prev : [activeTabId, ...prev.filter(id => id !== activeTabId)].slice(0, 25));
  }, [activeTabId]);
  // Start surface Recent + Starred — show 5 by default, See more
  // expands to the full 25-item ceiling. Per-session state (resets
  // on reload) so opening a fresh page always leads with the tight
  // 5-row view.
  const [recentExpandedStart, setRecentExpandedStart] = useState(false);
  const [starredExpandedStart, setStarredExpandedStart] = useState(false);
  const START_PREVIEW_COUNT = 5;
  const [showRecent, setShowRecent] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mw-show-recent") !== "false";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-show-recent", String(showRecent));
  }, [showRecent]);
  const [showStarred, setShowStarred] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mw-show-starred") !== "false";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mw-show-starred", String(showStarred));
  }, [showStarred]);
  const [_showSortMenu, _setShowSortMenu] = useState(false);
  const [_sharedSortMode, _setSharedSortMode] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [docFilter, setDocFilter] = useState<"all" | "private" | "shared" | "synced">(() => {
    if (typeof window === "undefined") return "all";
    return (localStorage.getItem("mw-doc-filter") as "all" | "private" | "shared" | "synced") || "all";
  });
  // Per-section filter for MD Bundles. Bundles don't have a "source"
  // axis (they're always created in-app), so the synced tab is
  // omitted. visibility + is_draft drive the private/shared split.
  const [bundleFilter, setBundleFilter] = useState<"all" | "private" | "shared">(() => {
    if (typeof window === "undefined") return "all";
    return (localStorage.getItem("mw-bundle-filter") as "all" | "private" | "shared") || "all";
  });
  const [sidebarSearch, setSidebarSearch] = useState("");
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  // Scroll container for the sections list — used by IntersectionObserver to
  // detect which section headers are currently OFF-screen (below viewport) so
  // a small navigator can be shown at the bottom for jumping to them.
  const sectionsScrollRef = useRef<HTMLDivElement>(null);
  const [belowViewportSections, setBelowViewportSections] = useState<Set<string>>(new Set());
  useEffect(() => {
    const root = sectionsScrollRef.current;
    if (!root) return;
    const headers = Array.from(root.querySelectorAll<HTMLElement>("[data-section-id]"));
    if (headers.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      setBelowViewportSections(prev => {
        const next = new Set(prev);
        for (const e of entries) {
          const id = (e.target as HTMLElement).getAttribute("data-section-id");
          if (!id) continue;
          // "Below viewport" = not intersecting AND its top is below the root bottom
          const bottom = (e.rootBounds?.bottom ?? 0);
          const headerTop = e.boundingClientRect.top;
          if (!e.isIntersecting && headerTop >= bottom) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    }, { root, threshold: 0 });
    headers.forEach(h => obs.observe(h));
    return () => obs.disconnect();
  // Re-observe when section visibility (collapsed state of major toggles) changes
  }, [showRecent, showMyBundles, showMyDocs, showSharedDocs, showTrash]);
  // Debounced version used in heavy filter/sort paths. Raw `sidebarSearch` is
  // only for the input element value; the rest of the tree filters off the
  // debounced value so typing stays smooth even with 100+ tabs.
  const [sidebarSearchDebounced, setSidebarSearchDebounced] = useState("");
  useEffect(() => {
    const q = sidebarSearch.trim();
    if (!q) { setSidebarSearchDebounced(""); return; }
    const t = setTimeout(() => setSidebarSearchDebounced(q), 200);
    return () => clearTimeout(t);
  }, [sidebarSearch]);
  // NOTE: ⌘K is the command palette (handled in the main keydown
  // effect below). It used to ALSO focus the sidebar search here, so
  // both handlers fired on every ⌘K — the palette opened AND focus
  // jumped to the sidebar input, a race. The palette already does
  // global doc search (server FTS at 3+ chars), so the separate
  // sidebar-focus shortcut was redundant. The sidebar search input
  // stays click-to-focus; ⌘K now unambiguously opens the palette.
  const [cloudSearchResults, setCloudSearchResults] = useState<Array<{ id: string; title: string; snippet: string; isDraft: boolean; viewCount: number; source: string | null; updatedAt: string }>>([]);
  const [isCloudSearching, setIsCloudSearching] = useState(false);
  const cloudSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [_showAllDocs, _setShowAllDocs] = useState(false);
  const [showSidebarHelp, setShowSidebarHelp] = useState(false);
  const [_showSidebarSearch, _setShowSidebarSearch] = useState(false);

  // ─── Cross-doc concept index ("knowledge compounds") ───
  // Aggregated from semantic_chunks across the user's docs by /api/user/concepts.
  // Drives the Concepts sidebar section + concept detail drawer + home stats.
  interface ConceptOccurrence { docId: string; docTitle: string; chunkId: string; chunkType: string; snippet: string }
  interface ConceptEntry { id: string; label: string; types: string[]; occurrenceCount: number; docCount: number; occurrences: ConceptOccurrence[] }
  const [conceptIndex, setConceptIndex] = useState<{
    concepts: ConceptEntry[];
    stats: { totalDocs: number; decomposedDocs: number; totalConcepts: number; crossLinkedConcepts: number };
  } | null>(null);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [openedConceptId, setOpenedConceptId] = useState<string | null>(null);
  const [showConcepts, setShowConcepts] = useState(false);
  // Single-doc concepts (docCount === 1) are noisy — they're not the "knowledge
  // compound" surface the section is selling. Hidden under a fold by default;
  // cross-linked concepts surface first.
  const [showSingleDocConcepts, setShowSingleDocConcepts] = useState(false);
  // AI-synthesized canonical definitions for concepts. Cached in-memory by
  // concept id — first request triggers AI, subsequent opens of the same
  // drawer reuse the cached paragraph.
  const [conceptDefinitions, setConceptDefinitions] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});

  const fetchConceptDefinition = useCallback(async (conceptId: string, label: string, occurrences: ConceptOccurrence[]) => {
    setConceptDefinitions(prev => ({ ...prev, [conceptId]: { loading: true } }));
    try {
      const res = await fetch(`/api/user/concepts/${encodeURIComponent(conceptId)}/define`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeadersRef.current },
        body: JSON.stringify({
          label,
          occurrences: occurrences.map(o => ({ docTitle: o.docTitle, snippet: o.snippet, chunkType: o.chunkType })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConceptDefinitions(prev => ({ ...prev, [conceptId]: { loading: false, text: data.definition || "" } }));
      } else {
        const err = await res.json().catch(() => ({}));
        setConceptDefinitions(prev => ({ ...prev, [conceptId]: { loading: false, error: err.error || "Failed" } }));
      }
    } catch {
      setConceptDefinitions(prev => ({ ...prev, [conceptId]: { loading: false, error: "Network error" } }));
    }
  }, []);

  // Detect concepts mentioned in the active doc's text — auto-cross-link
  // surface that doesn't require Tiptap-level decoration. We look at the
  // current `markdown` (lowercased + normalized) and check which concept
  // labels appear as substrings. Limited to top 80 most-cross-linked
  // concepts to keep the per-keystroke check cheap.
  const relatedConcepts = useMemo(() => {
    if (!conceptIndex || !markdown) return [] as ConceptEntry[];
    const text = markdown.toLowerCase();
    const candidates = conceptIndex.concepts.slice(0, 80);
    const found: ConceptEntry[] = [];
    for (const c of candidates) {
      const norm = c.label.toLowerCase();
      if (norm.length < 3) continue;
      if (text.includes(norm)) found.push(c);
    }
    // Don't show concepts that ONLY come from the current doc — prefer ones
    // that link OUT to other docs.
    const activeCloudId = tabs.find(t => t.id === activeTabId)?.cloudId;
    return found
      .filter(c => !activeCloudId || c.occurrences.some(o => o.docId !== activeCloudId))
      .slice(0, 10);
  }, [conceptIndex, markdown, tabs, activeTabId]);

  const refreshConcepts = useCallback(async () => {
    if (!isAuthenticated) return;
    setConceptsLoading(true);
    try {
      const res = await fetch("/api/user/concepts", { headers: authHeadersRef.current });
      if (res.ok) {
        const data = await res.json();
        setConceptIndex(data);
      }
    } catch { /* ignore */ }
    finally { setConceptsLoading(false); }
  }, [isAuthenticated]);

  // Initial load + periodic refresh on doc/decomposition changes. Cheap query
  // (just reads cached semantic_chunks JSONB) so refreshing is fine.
  useEffect(() => {
    if (!isAuthenticated) { setConceptIndex(null); return; }
    refreshConcepts();
  }, [isAuthenticated, refreshConcepts]);
  const [_showLibraryNewMenu, _setShowLibraryNewMenu] = useState(false);
  const [showSharedOwner, _setShowSharedOwner] = useState(false);
  const [sidebarMode, setSidebarModeRaw] = useState<"simple" | "detailed">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("mw-sidebar-mode") as "simple" | "detailed") || "simple";
    }
    return "detailed";
  });
  const setSidebarMode = useCallback((updater: "simple" | "detailed" | ((prev: "simple" | "detailed") => "simple" | "detailed")) => {
    setSidebarModeRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("mw-sidebar-mode", next); } catch { /* quota exceeded */ }
      return next;
    });
  }, []);
  // Onboarding banner — first visit only
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    // Doc / bundle / hub deep-link refresh — the user is pointing at a
    // specific surface, not the Start landing. Show the doc, not Home.
    // Without this, a refresh on /<id> with no cached own-docs would
    // flip showOnboarding=true, and the URL-mirroring effect would
    // immediately rewrite the address bar back to "/" while the
    // doc-load was still in flight.
    const isDeepLink = path !== "/" || !!search || !!hash;
    if (isDeepLink) return false;
    // First visit — always show
    if (!localStorage.getItem("mw-onboarded")) return true;
    // Bare root URL (memory.wiki/ with no query / hash / doc path)
    // means the user wants the Home landing, not a restored doc.
    // Pair with the activeTabId useState which already clears in
    // this case — together they make the root URL contract honest.
    if (path === "/" && !search && !hash) return true;
    // Return visit — show if user has no own documents (only examples)
    try {
      const saved = localStorage.getItem("mw-tabs");
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasOwnDocs = Array.isArray(parsed) && parsed.some((t: { ownerEmail?: string; deleted?: boolean }) => !t.deleted && t.ownerEmail !== "master@mdfy.app");
        if (!hasOwnDocs) return true;
      }
    } catch {}
    return false;
  });
  // Hub overlay — same mental model as showOnboarding. The Hub button
  // shows the public hub view on top of the current tab WITHOUT
  // changing activeTabId, so opening Hub from a bundle keeps that
  // bundle "selected" in the sidebar (and one click on the bundle row
  // brings you right back). Earlier Hub lived as its own tab, which
  // meant clicking Hub deselected whatever was in the sidebar — that's
  // the founder complaint this state replaces.
  const [showHub, setShowHub] = useState(false);
  // Galaxy overlay — owner's full hub as a force-laid-out graph.
  // Same overlay slot as Hub / Bundle; mutually exclusive with the
  // other surface overlays. Opens via the Atom pill next to Hub.
  // Deep-link support: if the URL starts at /galaxy, boot with the
  // overlay open so a refresh / direct hit preserves the editor
  // chrome (sidebar + toolbar) instead of stripping to a bare
  // canvas like the old standalone /galaxy/page.tsx did.
  const [showGalaxy, setShowGalaxy] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname === "/galaxy" || window.location.pathname.startsWith("/galaxy/");
  });
  // Per-section fold state for the Start screen. Hot sections
  // (Recent, Create, Drop, Deploy) stay open by default; learning
  // sections (Cases, Guides, Explore) collapse so the surface stops
  // feeling like a card farm. localStorage-backed so user toggles
  // survive reloads.
  type StartSectionKey = "starred" | "recent" | "create" | "deploy" | "cases" | "guides" | "explore";
  const START_SECTION_DEFAULTS: Record<StartSectionKey, boolean> = {
    starred: true, recent: true, create: true, deploy: true,
    cases: false, guides: false, explore: false,
  };
  const [startSections, setStartSections] = useState<Record<StartSectionKey, boolean>>(() => {
    if (typeof window === "undefined") return START_SECTION_DEFAULTS;
    try {
      const raw = localStorage.getItem("mw-start-sections");
      if (!raw) return START_SECTION_DEFAULTS;
      const parsed = JSON.parse(raw);
      return { ...START_SECTION_DEFAULTS, ...parsed };
    } catch { return START_SECTION_DEFAULTS; }
  });
  const toggleStartSection = useCallback((k: StartSectionKey) => {
    setStartSections(prev => {
      const next = { ...prev, [k]: !prev[k] };
      try { localStorage.setItem("mw-start-sections", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  // Auto-resolve trigger A — fires when the Hub overlay opens and
  // the user picked "on-open" as their auto-management trigger. The
  // overlay opening is the user's intent-signal that they care
  // about the curator state right now — good moment to clean up.
  useEffect(() => {
    if (!showHub) return;
    if (curatorSettings.autoTrigger !== "on-open") return;
    autoResolveSafeFindings();
  }, [showHub, curatorSettings.autoTrigger, autoResolveSafeFindings]);
  // Fetch concept-index freshness whenever the Hub opens. Owner-only.
  // Cheap (two indexed SELECTs server-side) so we don't bother caching.
  useEffect(() => {
    if (!showHub || !user?.id) { setHubFreshness(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/hub/freshness", { headers: authHeaders });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setHubFreshness(json);
      } catch { /* silent — banner just doesn't show */ }
    })();
    return () => { cancelled = true; };
  }, [showHub, user?.id, authHeaders]);
  const handleHubReanalyze = useCallback(async () => {
    if (hubReanalyzing) return;
    setHubReanalyzing(true);
    try {
      const res = await fetch("/api/user/hub/reanalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error || "Re-analyze failed", "error");
        return;
      }
      const json = await res.json();
      const msg = json.capped
        ? `Re-analyzing ${json.enqueued} docs now; ${json.totalStale - json.enqueued} more queued in background.`
        : `Re-analyzing ${json.enqueued} ${json.enqueued === 1 ? "doc" : "docs"}.`;
      showToast(msg, "success");
      // Optimistic: hide the banner immediately. The next Hub open
      // re-fetches freshness and will resurrect it if jobs are still
      // pending (most fast-path runs finish within seconds).
      setHubFreshness((prev) => prev ? { ...prev, isStale: false, staleDocCount: 0 } : prev);
    } catch {
      showToast("Re-analyze failed", "error");
    } finally {
      setHubReanalyzing(false);
    }
  }, [hubReanalyzing, authHeaders, showToast]);
  // Open an explainer / case-study doc as an in-app tab instead of
  // a new browser window. The slug IS the document id (see the
  // next.config rewrites — each /case-* or /how-memorywiki-* path maps to
  // /d/<same-slug>). Falls back to opening the public URL in a new
  // tab if the API call fails, so the link is never a dead-end.
  // switchTab is declared later in this component, so we route the
  // call through a ref populated below.
  const switchTabRef = useRef<((id: string) => void) | null>(null);
  const openDocBySlug = useCallback(async (slug: string, fallbackUrl?: string) => {
    setShowOnboarding(false);
    try { localStorage.setItem("mw-onboarded", "1"); } catch {}
    const existing = tabs.find(t => t.cloudId === slug);
    if (existing) { switchTabRef.current?.(existing.id); return; }
    try {
      const res = await fetch(`/api/docs/${slug}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const d = await res.json();
      const newId = `doc-${slug}-${Date.now()}`;
      const newTab: Tab = {
        id: newId,
        kind: "doc",
        title: d.title || "Untitled",
        markdown: d.markdown || "",
        cloudId: slug,
        isDraft: d.is_draft,
        shared: !d.isOwner,
        readonly: !d.isOwner && !d.isEditor && d.editMode !== "public",
        ownerEmail: d.ownerEmail,
      };
      setTabs(prev => [...prev, newTab]);
      switchTabRef.current?.(newId);
    } catch {
      if (fallbackUrl && typeof window !== "undefined") {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    }
  }, [tabs, authHeaders]);
  // Auto-resolve trigger B — background interval. Cheap because
  // autoResolveSafeFindings short-circuits when there's nothing to do.
  useEffect(() => {
    if (curatorSettings.autoTrigger !== "interval") return;
    if (curatorSettings.autoLevel === "off") return;
    const id = setInterval(() => { autoResolveSafeFindings(); }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [curatorSettings.autoTrigger, curatorSettings.autoLevel, autoResolveSafeFindings]);
  // Account Settings overlay — same overlay treatment as Hub. Founder
  // ask: Settings shouldn't open as a separate page navigation, it
  // should layer in-place. /settings still works for deep links but
  // the profile-menu entry now toggles this overlay instead.
  const [showSettings, setShowSettings] = useState(() => {
    // Deep-link support — if the URL is /settings (or /settings/anything)
    // we boot with the overlay already open. Without this initial
    // detection, hitting /settings rendered the full editor without
    // Settings visible, because showSettings defaulted to false and
    // only the profile-menu click could flip it on.
    if (typeof window === "undefined") return false;
    return window.location.pathname === "/settings" || window.location.pathname.startsWith("/settings/");
  });
  // Browser URL mirrors the overlay surface so a paste/share of
  // the URL bar resolves to where the user actually IS — not the
  // tab sitting underneath. Hub → /hub/<slug>, Settings → /settings,
  // Start → /. When overlays close, we restore the activeTab's
  // canonical URL via the next switchTab / loadTab call (already
  // does replaceState for doc + bundle tabs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showSettings) {
      window.history.replaceState(null, "", "/settings");
    } else if (showGalaxy) {
      window.history.replaceState(null, "", "/galaxy");
    } else if (showHub && hubSlug) {
      window.history.replaceState(null, "", `/hub/${hubSlug}`);
    } else if (showOnboarding) {
      window.history.replaceState(null, "", "/");
    }
  }, [showSettings, showGalaxy, showHub, showOnboarding, hubSlug]);
  // Optional deep-link target when opening Settings. Hub's
  // "Auto-management" link sets this to "auto-management" so the
  // overlay opens on that tab instead of the user's last-active
  // one. Cleared the next time Settings closes.
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);
  const [toolbarHintDismissed, setToolbarHintDismissed] = useState(() => typeof window !== "undefined" ? !!localStorage.getItem("mw-toolbar-hint-dismissed") : true);
  // Document view count (owner only)
  const [viewCount, setViewCount] = useState(0);
  // Command palette (Cmd+K)
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [cmdSearch, setCmdSearch] = useState("");
  const [cmdSearchResults, setCmdSearchResults] = useState<Array<{ id: string; title: string; snippet: string }>>([]);
  const [isCmdSearching, setIsCmdSearching] = useState(false);
  const cmdSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keyboard selection cursor across the flat (sectioned) result
  // list. Reset to 0 whenever the query or results change so Enter
  // always runs the top-listed item by default.
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState(0);
  useEffect(() => { setCmdSelectedIdx(0); }, [cmdSearch, cmdSearchResults]);
  const [showExamples, setShowExamples] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mw-show-examples") !== "false";
  });
  const [examplesCollapsed, setExamplesCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("mw-examples-collapsed");
    // First visit: no saved state → open (false)
    return saved === "true";
  });
  const [selectedTabIds, setSelectedTabIds] = useState<Set<string>>(new Set());
  const [hiddenExampleIds, setHiddenExampleIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("mw-hidden-examples");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const lastClickedTabIdRef = useRef<string | null>(null);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [showBundleCreator, setShowBundleCreator] = useState(false);
  const [bundleCreatorDocs, setBundleCreatorDocs] = useState<Array<{ id: string; title: string }>>([]);
  const [_renderPaneNarrow, setRenderPaneNarrow] = useState(false);
  const [renderPaneUnderNarrowWidth, setRenderPaneUnderNarrowWidth] = useState(false);
  const [_editorPaneNarrow, setEditorPaneNarrow] = useState(false);
  const [editorPaneUnderNarrowWidth, setEditorPaneUnderNarrowWidth] = useState(false);
  const splitPercentRef = useRef(60);
  const isDraggingSplit = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const previewRef = useRef<HTMLDivElement>(null);
  const tiptapRef = useRef<TiptapLiveEditorHandle>(null);
  // ─── Image upload helper ───
  /** Compress image client-side before upload (max 2000px, 0.85 quality) */
  const compressImage = useCallback(async (file: File): Promise<File> => {
    // Skip compression for SVG, GIF (animated), or small files (<200KB)
    if (file.type === "image/svg+xml" || file.type === "image/gif" || file.size < 200 * 1024) return file;
    return new Promise((resolve) => {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        const MAX = 2000;
        let { width, height } = img;
        if (width <= MAX && height <= MAX && file.size < 1024 * 1024) { resolve(file); return; }
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          canvas.toBlob((blob) => {
            if (blob && blob.size < file.size) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" }));
            } else { resolve(file); }
          }, "image/webp", 0.85);
        } catch { resolve(file); }
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(file); };
      img.src = blobUrl;
    });
  }, []);

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressed);
    const uploadHeaders: Record<string, string> = { ...authHeaders };
    if (!user?.id) { const anonId = ensureAnonymousId(); if (anonId) uploadHeaders["x-anonymous-id"] = anonId; }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        if (err.requiresAuth) setShowAuthMenu(true);
        else showToast(err.error || "Upload failed", "error");
        return null;
      }
      const data = await res.json();
      if (!data.url) { showToast("Upload failed — no URL returned", "error"); return null; }
      // Refresh image panel if it's open
      if (showImagePanel) {
        fetch("/api/upload/list", { headers: authHeaders })
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) { setUserImages(d.images || []); setImageQuota(d.quota); } })
          .catch(() => {});
      }
      return data.url;
    } catch (e) {
      showToast(e instanceof DOMException && e.name === "AbortError" ? "Upload timed out" : "Upload failed", "error");
      return null;
    }
  }, [user, compressImage, showImagePanel, authHeaders]);

  // CodeMirror 6 editor — replaces plain textarea
  const handleChangeRef = useRef<(value: string) => void>(() => {});
  const handlePasteForCM = useCallback((text: string, html: string): string | null => {
    if (html && isHtmlContent(html)) {
      return htmlToMarkdown(html);
    }
    if (text && !html && isHtmlContent(text)) {
      return htmlToMarkdown(text);
    }
    // Detect CLI/terminal output and convert to markdown
    if (text && isCliOutput(text)) {
      return cliToMarkdown(text);
    }
    return null;
  }, []);
  const cmSetDocRef = useRef<((doc: string) => void) | null>(null);
  const markdownForImageRef = useRef(markdown);
  markdownForImageRef.current = markdown;
  const handlePasteImageForCM = useCallback(async (file: File, cursorOffset: number) => {
    const placeholder = `![Uploading ${file.name}...]()\n`;
    // Insert placeholder at cursor position instead of appending to end
    const md = markdownForImageRef.current;
    const before = md.slice(0, cursorOffset);
    const after = md.slice(cursorOffset);
    const withPlaceholder = before + placeholder + after;
    setMarkdown(withPlaceholder);
    doRenderRef.current(withPlaceholder);
    cmSetDocRef.current?.(withPlaceholder);
    const url = await uploadImage(file);
    const current = markdownForImageRef.current;
    const imageTag = url ? `![${file.name}](${url})\n` : "";
    if (current.includes(placeholder)) {
      const updated = current.replace(placeholder, imageTag);
      setMarkdown(updated);
      doRenderRef.current(updated);
      cmSetDocRef.current?.(updated);
    } else if (url) {
      // Placeholder was lost (e.g. user edited) — append image at end
      const updated = current + "\n" + imageTag;
      setMarkdown(updated);
      doRenderRef.current(updated);
      cmSetDocRef.current?.(updated);
    }
  }, [uploadImage, setMarkdown]);
  const {
    containerRef: editorContainerRef,
    focus: cmFocus,
    setDoc: cmSetDoc,
    scrollToLine: cmScrollToLine,
    setSelection: cmSetSelection,
    getCursorPos: cmGetCursorPos,
    refresh: cmRefresh,
    wrapSelection: cmWrapSelection,
    insertAtCursor: cmInsertAtCursor,
    setRemoteCursors: cmSetRemoteCursors,
  } = useCodeMirror({
    initialDoc: markdown,
    onChange: (value: string) => handleChangeRef.current(value),
    onCursorActivity: (line: number, col: number) => onCursorActivityRef.current?.(line, col),
    onPaste: handlePasteForCM,
    onPasteImage: handlePasteImageForCM,
    theme,
    placeholder: "Paste any Markdown here — GFM, Obsidian, MDX, Pandoc, anything...",
  });
  cmSetDocRef.current = cmSetDoc;
  // Remote-cursor wiring. broadcastCursor is called from CM6's
  // selection-change listener and from Tiptap focus events;
  // remoteCursors flows back into CM6 via cmSetRemoteCursors so
  // the visible bars track other collaborators in real time.
  const { remoteCursors, broadcastCursor } = useCursorPresence(docId, presenceUser);
  useEffect(() => {
    // CM6 only renders cursors that originated from a CM6 sender —
    // a Tiptap-origin cursor carries pmPos and would otherwise show
    // up at (0, 0) in the Source pane (which is meaningless and
    // confusing). Tiptap-origin cursors are picked up by the
    // remoteCursors prop passed to <TiptapLiveEditor> below.
    cmSetRemoteCursors(
      remoteCursors
        .filter((c) => typeof c.pmPos !== "number")
        .map((c) => ({
          userId: c.userId,
          line: c.line,
          col: c.col,
          name: c.name,
          color: c.color,
        })),
    );
  }, [remoteCursors, cmSetRemoteCursors]);
  const broadcastCursorRef = useRef(broadcastCursor);
  broadcastCursorRef.current = broadcastCursor;

  // Source → Preview sync: highlight corresponding preview element when cursor moves in CM
  const prevHighlightRef = useRef<HTMLElement | null>(null);
  const cursorSyncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearHighlight = useCallback(() => {
    if (prevHighlightRef.current) {
      prevHighlightRef.current.style.boxShadow = "";
      prevHighlightRef.current.style.background = "";
      prevHighlightRef.current.style.borderRadius = "";
      prevHighlightRef.current.style.transition = "";
      prevHighlightRef.current = null;
    }
  }, []);

  const lastCursorPosRef = useRef(0);
  const onCursorActivityRef = useRef<((line: number, col: number) => void) | null>(null);
  onCursorActivityRef.current = (line: number, col: number) => {
    // Save cursor position for image insert etc.
    const pos = cmGetCursorPos();
    if (pos > 0) lastCursorPosRef.current = pos;
    // Broadcast for remote-cursor presence — useCursorPresence
    // throttles internally so we don't need to debounce here. Line
    // arrives 1-indexed from CM6; the broadcast schema uses
    // 0-indexed for portability across editors.
    broadcastCursorRef.current?.(line - 1, col);
    // Debounce to avoid scroll jank during selection drag
    if (cursorSyncTimer.current) clearTimeout(cursorSyncTimer.current);
    cursorSyncTimer.current = setTimeout(() => {
      if (viewMode === "editor") return;
      const article = previewRef.current?.querySelector("article");
      if (!article) return;

      clearHighlight();

      // Account for frontmatter offset
      const mdLines = markdownRef.current.split("\n");
      let fmOffset = 0;
      if (mdLines[0]?.trim() === "---") {
        for (let i = 1; i < mdLines.length; i++) {
          if (mdLines[i]?.trim() === "---") { fmOffset = i + 1; break; }
        }
      }
      const sourceLine = line - fmOffset;

      // Find the tightest data-sourcepos range containing this line
      const els = article.querySelectorAll("[data-sourcepos]");
      let bestEl: HTMLElement | null = null;
      let bestRange = Infinity;
      els.forEach(el => {
        const sp = el.getAttribute("data-sourcepos");
        if (!sp) return;
        const m = sp.match(/^(\d+):\d+-(\d+):\d+$/);
        if (!m) return;
        const start = parseInt(m[1]);
        const end = parseInt(m[2]);
        if (sourceLine >= start && sourceLine <= end) {
          const range = end - start;
          if (range < bestRange) {
            bestRange = range;
            bestEl = el as HTMLElement;
          }
        }
      });

      if (bestEl) {
        (bestEl as HTMLElement).style.boxShadow = "inset 3px 0 0 var(--text-primary)";
        (bestEl as HTMLElement).style.background = "color-mix(in srgb, var(--text-primary) 6%, transparent)";
        (bestEl as HTMLElement).style.borderRadius = "0 4px 4px 0";
        (bestEl as HTMLElement).style.transition = "background 0.2s, box-shadow 0.2s";
        (bestEl as HTMLElement).scrollIntoView({ block: "nearest", behavior: "smooth" });
        prevHighlightRef.current = bestEl;
      }
    }, 80);
  };

  // Clean up highlight on tab switch or unmount
  useEffect(() => clearHighlight, [clearHighlight]);

  const menuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Set default view mode based on screen size + auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode("preview"); // Live view only on mobile by default
      setShowSidebar(false); // Auto-close sidebar when entering mobile viewport
    }
  }, [isMobile]);

  // Refresh CM6 when editor pane becomes visible
  useEffect(() => {
    if (viewMode !== "preview") {
      requestAnimationFrame(() => cmRefresh());
    }
  }, [viewMode, cmRefresh]);

  // Track pane widths for responsive button labels
  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const w = entry.contentRect.width;
        if (el.dataset.pane === "render") { setRenderPaneNarrow(w < 500); setRenderPaneUnderNarrowWidth(w < 768); }
        if (el.dataset.pane === "editor") { setEditorPaneNarrow(w < 500); setEditorPaneUnderNarrowWidth(w < 768); }
      }
    });
    // Observe both panes directly
    const renderPane = container.querySelector('[data-pane="render"]');
    const editorPane = container.querySelector('[data-pane="editor"]');
    if (renderPane) observer.observe(renderPane);
    if (editorPane) observer.observe(editorPane);
    // Also observe container for full-width mode changes
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewMode]);

  const renderIdRef = useRef(0);
  const doRender = useCallback(async (md: string) => {
    const thisRender = ++renderIdRef.current;
    setIsLoading(true);
    try {
      const start = performance.now();
      const result = render(md);
      if (thisRender !== renderIdRef.current) return; // stale render, discard
      const elapsed = performance.now() - start;

      setHtml(result.html);
      // Reset mermaid cache so diagrams re-render after full HTML replacement
      prevMermaidCodesRef.current = [];
      setFlavor(result.flavor.primary);
      setFlavorDetails({
        math: result.flavor.math,
        mermaid: result.flavor.mermaid,
        wikilinks: result.flavor.wikilinks,
        jsx: result.flavor.jsx,
      });
      setTitle(result.title);
      // Sync title to sidebar tab immediately (use ref to avoid stale closure)
      if (result.title) {
        const currentTabId = activeTabIdRef.current;
        const newTitle = result.title;
        setTabs((prev) => prev.map((t) => t.id === currentTabId ? { ...t, title: newTitle } : t));
      }
      setRenderTime(elapsed);
      setCharCount(md.length);
      setIsLoading(false);

      // Defer expensive stats and AI detection for large documents
      const computeStats = () => {
        if (thisRender !== renderIdRef.current) return;
        setWordCount(md.trim() ? md.trim().split(/\s+/).length : 0);
        setLineCount(md.split("\n").length);
        const ct = tabs.find(t => t.id === activeTabIdRef.current);
        if (md.length > 50 && isAiConversation(md) && !ct?.readonly && ct?.ownerEmail !== EXAMPLE_OWNER) {
          setShowAiBanner(true);
        } else {
          setShowAiBanner(false);
        }
      };
      if (md.length > 50000 && typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(computeStats);
      } else {
        computeStats();
      }
    } catch (e) {
      console.error("Render error:", e);
      setIsLoading(false);
    }
  }, []);

  // Keep doRenderRef in sync
  doRenderRef.current = doRender;

  // ─── Tab management ───
  // Guard: while a tab switch is in flight, Tiptap may still hold the previous tab's
  // content. Any onUpdate that fires in this window would mis-attribute the old content
  // to the new tab's cloudId via triggerAutoSave, overwriting the new tab on the server.
  const tabSwitchInFlightRef = useRef(false);

  // Watchdog: clear tabSwitchInFlightRef 1.5s after any activeTabId
  // change. The loadTab finally-callbacks only clear when
  // activeTabIdRef.current matches the tab they own — if the user
  // switches tabs again before either load resolves, neither clears
  // and the flag is stuck true. With the flag stuck, handleTiptapChange
  // silently drops every keystroke and triggerAutoSave bails before
  // scheduleSave. Reported symptom: typing in TipTap stops saving
  // out of nowhere. 1.5s is way past any normal tab-load round-trip.
  useEffect(() => {
    const t = setTimeout(() => { tabSwitchInFlightRef.current = false; }, 1500);
    return () => clearTimeout(t);
  }, [activeTabId]);

  const loadTab = useCallback((tab: Tab) => {
    // Clear any placeholder overlay when loading a real document
    setEditorPlaceholder(null);
    // Close the Start overlay. Without this, the URL-mirroring effect
    // (showOnboarding → "/") would immediately reset the address bar
    // back to "/" right after loadTab's own replaceState set it to
    // `/${cloudId}` — the user sees "click did nothing, URL didn't
    // change" on the first click after refresh / Home.
    setShowOnboarding(false);
    // Mark this tab as read — kills the orange pulse dot in the sidebar.
    if (tab.unread) {
      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, unread: false } : t));
    }
    // Hold off Tiptap onUpdate-driven autosave until this tab's content is actually loaded
    // into the editor. Pending saves scheduled for the previous tab keep their original
    // cloudId/markdown args, so we don't cancel them — they will save to the correct doc.
    tabSwitchInFlightRef.current = true;
    // Clear any sticky save error / conflict from the previous tab so
    // the header doesn't show "Failed to save" on a doc the user has
    // just opened (the error belonged to a different doc).
    autoSave.clearError();
    // Update ref IMMEDIATELY so doRender uses correct tab ID
    activeTabIdRef.current = tab.id;
    setActiveTabId(tab.id);
    // Header title MUST follow the document's first H1. If the stored
    // tab.title and the H1 in tab.markdown disagree (e.g., the row was
    // legacy-created with a custom title that doesn't match the heading,
    // or some external sync wrote one without the other), trust the H1.
    // Otherwise the header would briefly show the stale stored title and
    // then visibly "change" the moment the user typed (handleTiptapChange
    // re-derives from H1 + persists). That flicker is what the user has
    // been hitting.
    const h1Title = tab.markdown ? extractTitleFromMd(tab.markdown) : "";
    const initialTitle = (h1Title && h1Title !== "Untitled") ? h1Title : tab.title;
    setTitle(initialTitle || undefined);
    // Backfill the in-memory tab + auto-save when the stored title was
    // out of sync with the H1. Without this the next save would still
    // carry the stale title; with this, server + UI converge on H1.
    if (h1Title && h1Title !== "Untitled" && h1Title !== tab.title) {
      setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, title: h1Title } : t));
      if (tab.cloudId) {
        autoSave.scheduleSave({
          cloudId: tab.cloudId,
          markdown: tab.markdown,
          title: h1Title,
          userId: user?.id,
          userEmail: user?.email,
          anonymousId,
          editToken: tab.editToken,
        });
      }
    }
    // Cancel any pending debounced render from CodeMirror
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Update permission + doc state based on tab
    setDocId(tab.cloudId || null);
    setIsSharedDoc(tab.permission === "readonly" || tab.permission === "editable");
    setIsOwner(tab.permission === "mine" || !tab.permission);
    // Editor role is preserved on the tab itself via permission ===
    // "editable". The canEdit gate looks at this; without it, switching
    // away and back to a doc you have edit access to would land in
    // read-only state again.
    setIsEditor(tab.permission === "editable");
    // Reset share modal state + view count for the new tab. Hydrate
    // the allowed-email/editor lists from the tab's cached values so
    // a tab we've already opened once renders the right ShareModal
    // defaults the instant Share is clicked — no skeleton flicker
    // from a stale empty list while the GET refresh resolves.
    setViewCount(0);
    setAllowedEmailsState(tab.allowedEmails ?? []);
    setAllowedEditorsState(tab.allowedEditors ?? []);
    // Fetch view count for cloud docs (suppress 500 errors in console)
    if (tab.cloudId && (tab.permission === "mine" || !tab.permission)) {
      fetch(`/api/docs/${tab.cloudId}`, { method: "HEAD", headers: { "x-no-view-count": "1" } })
        .then(r => { if (r.ok) { const vc = r.headers.get("x-view-count"); if (vc) setViewCount(parseInt(vc) || 0); } })
        .catch(() => {});
    }
    setShowViewerShareModal(false);
    // Update browser URL to reflect current document
    if (tab.cloudId) {
      window.history.replaceState(null, "", `/${tab.cloudId}`);
    } else {
      window.history.replaceState(null, "", "/");
    }

    // If cloud tab has no content, fetch it from server
    if (tab.cloudId && !tab.markdown) {
      setMarkdownRaw("");
      // Clear TipTap content IMMEDIATELY so the editor doesn't show the
      // previous tab's body during the fetch. Without this, switching
      // from tab A (with content) to tab B (cloud-only, empty local md)
      // would render A's content in TipTap until B's fetch returned —
      // and any keystroke during that window would PATCH B with A's
      // content under B's cloudId.
      tiptapRef.current?.setMarkdown("");
      setIsLoading(true);
      fetch(`/api/docs/${tab.cloudId}`, { headers: authHeadersRef.current })
        .then(res => res.ok ? res.json() : null)
        .then(doc => {
          if (!doc || activeTabIdRef.current !== tab.id) return;
          const md = doc.markdown || "";
          // Title invariant: first H1 of the doc IS the title. Fall back
          // to the server's stored title only when no H1 exists. Schedule
          // a save when they disagree so the server converges on the H1
          // — otherwise the next session would re-show the stale title.
          const fetchedH1 = md ? extractTitleFromMd(md) : "";
          const t = (fetchedH1 && fetchedH1 !== "Untitled") ? fetchedH1 : (doc.title || tab.title);
          setMarkdownRaw(md);
          setTitle(t);
          undoStack.current = [md];
          redoStack.current = [];
          doRenderRef.current(md);
          tiptapRef.current?.setMarkdown(md);
          // Seed the conflict detection timestamp
          if (doc.updated_at) autoSave.setLastServerUpdatedAt(doc.updated_at);
          // Tab body just fetched from server is the in-sync baseline.
          // Without this, the init effect leaves lastSynced=null (the
          // tab was activated before the body arrived) and the next
          // external edit would false-flag dirty.
          lastSyncedMdRef.current = md;
          // Seed the body-hash conflict baseline so the first edit's
          // expectedHash matches the server body (not hash("")).
          autoSave.setLastServerBody(md);
          // Reconcile permission from the server. Sidebar entries
          // populated from the recent-visit / notification feeds
          // didn't always have an up-to-date role (the cached tab
          // might say "readonly" even though the owner promoted us
          // to Editor since). Trust the freshly-fetched isOwner /
          // isEditor flags and update the tab + the canEdit state
          // setters in lockstep — otherwise the View-only banner
          // sticks even for legitimate editors.
          const freshPerm: "mine" | "editable" | "readonly" =
            doc.isOwner ? "mine"
            : doc.isEditor ? "editable"
            : "readonly";
          setIsOwner(freshPerm === "mine");
          setIsSharedDoc(freshPerm !== "mine");
          setIsEditor(freshPerm === "editable");
          if (doc.editMode) setDocEditMode(doc.editMode);
          setTabs(prev => prev.map(x => x.id === tab.id ? {
            ...x,
            markdown: md,
            title: t,
            permission: freshPerm,
            shared: freshPerm !== "mine",
            editMode: doc.editMode || x.editMode,
            ownerEmail: doc.ownerEmail || x.ownerEmail,
            allowedEmails: Array.isArray(doc.allowedEmails) ? doc.allowedEmails : x.allowedEmails,
            allowedEditors: Array.isArray(doc.allowedEditors) ? doc.allowedEditors : x.allowedEditors,
            compileKind: doc.compile_kind || undefined,
            compileFrom: doc.compile_from || undefined,
            compiledAt: doc.compiled_at || undefined,
            inBundles: Array.isArray(doc.inBundles) ? doc.inBundles : undefined,
            intent: doc.intent || null,
          } : x));
          // PREVIOUSLY: when server's stored title disagreed with the
          // first H1, loadTab fired a scheduleSave to push the H1 back.
          // That save included expectedUpdatedAt, so any concurrent
          // server-side edit (another device, hub regen, etc.) made
          // the user see a "Document Conflict" modal even though they
          // hadn't typed a single character.
          //
          // The local tab title is already set to the H1-derived value
          // above, so MDs / Recent / the editor header all read it
          // correctly for this session. The next time the user makes
          // any actual edit, triggerAutoSave will include this same
          // title in its body and the server converges naturally — no
          // ghost conflict modal in the meantime.
        })
        .catch(() => {
          doRenderRef.current("");
          tiptapRef.current?.setMarkdown("");
        })
        .finally(() => {
          // Only clear the autosave guard if THIS load is still the active one.
          // If the user clicked away to a different tab, that newer loadTab will
          // own the flag and clear it on its own completion.
          if (activeTabIdRef.current === tab.id) {
            setIsLoading(false);
            queueMicrotask(() => {
              if (activeTabIdRef.current === tab.id) {
                tabSwitchInFlightRef.current = false;
              }
            });
          }
        });
    } else {
      setMarkdownRaw(tab.markdown);
      undoStack.current = [tab.markdown];
      redoStack.current = [];
      doRenderRef.current(tab.markdown);
      tiptapRef.current?.setMarkdown(tab.markdown);
      queueMicrotask(() => {
        if (activeTabIdRef.current === tab.id) {
          tabSwitchInFlightRef.current = false;
        }
      });
    }
  }, []);

  // Track whether current navigation is from popstate (back/forward) to avoid pushing duplicate history entries
  const isPopstateRef = useRef(false);

  // ─── Synthesis diff/accept overlay state (W4 exceed-move) ───
  // When a user clicks "Update synthesis" we open the SynthesisDiff
  // component which previews the LLM's proposed update inline as a
  // line-level diff, then PATCHes the doc on Accept. This is the
  // capability Karpathy's regenerate-only pattern can't offer.
  const [synthesisDiffDocId, setSynthesisDiffDocId] = useState<string | null>(null);
  const _openSynthesisDiff = useCallback((docId: string) => {
    setSynthesisDiffDocId(docId);
  }, []);
  const closeSynthesisDiff = useCallback(() => {
    setSynthesisDiffDocId(null);
  }, []);
  const onSynthesisAccepted = useCallback((newMarkdown: string) => {
    if (!synthesisDiffDocId) return;
    const docId = synthesisDiffDocId;
    const now = new Date().toISOString();
    setTabs((prev) =>
      prev.map((t) =>
        t.cloudId === docId ? { ...t, markdown: newMarkdown, compiledAt: now } : t
      )
    );
    if (
      activeTabIdRef.current &&
      tabs.find((t) => t.id === activeTabIdRef.current && t.cloudId === docId)
    ) {
      setMarkdownRaw(newMarkdown);
      markdownRef.current = newMarkdown;
      doRenderRef.current(newMarkdown);
      tiptapRef.current?.setMarkdown(newMarkdown);
      // Synthesis-accept persisted newMarkdown server-side → in-sync.
      lastSyncedMdRef.current = newMarkdown;
    }
    showToast("Synthesis updated.", "info");
  }, [synthesisDiffDocId, tabs]);

  // ─── Recompile a compiled doc (Memo / FAQ / Brief) from its source bundle ───
  const [_recompilingDocId, setRecompilingDocId] = useState<string | null>(null);
  const _recompileDoc = useCallback(async (docId: string) => {
    setRecompilingDocId(docId);
    try {
      const res = await fetch(`/api/docs/${docId}/recompile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeadersRef.current },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setTabs(prev => prev.map(t => t.cloudId === docId ? {
          ...t,
          markdown: data.markdown,
          compiledAt: data.compiledAt,
        } : t));
        // If this is the active tab, refresh the editor viewport
        if (activeTabIdRef.current && tabs.find(t => t.id === activeTabIdRef.current && t.cloudId === docId)) {
          setMarkdownRaw(data.markdown);
          markdownRef.current = data.markdown;
          doRenderRef.current(data.markdown);
          tiptapRef.current?.setMarkdown(data.markdown);
          // Recompile persisted server-side → in-sync.
          lastSyncedMdRef.current = data.markdown;
        }
        showToast("Recompiled with latest sources.", "info");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Recompile failed: ${err.error || "unknown"}`, "info");
      }
    } catch {
      showToast("Recompile failed: network error", "info");
    } finally {
      setRecompilingDocId(null);
    }
  }, [tabs]);

  // ─── Tab navigation history (in-app back/forward chevrons) ───
  // Records the order of activated tabs (docs + bundles) the user has visited
  // in this session. Decoupled from browser history so a back-click jumps to
  // the previous tab regardless of URL state, and the chevrons enable/disable
  // based on the user's actual visit history.
  const navHistoryRef = useRef<string[]>([]);
  const navIndexRef = useRef<number>(-1);
  const isNavigatingHistoryRef = useRef(false);
  const [navTick, setNavTick] = useState(0); // forces re-render when history changes

  const switchTab = useCallback((tabId: string) => {
    // Any explicit tab switch dismisses the Hub / Galaxy / Settings
    // overlays — the user is leaving them to view that tab. Mirrors
    // the showOnboarding=false calls scattered across the tab-open
    // paths.
    setShowHub(false);
    setShowGalaxy(false);
    setShowSettings(false);
    // Flush any pending WYSIWYG edits before switching
    if (wysiwygDebounce.current) {
      clearTimeout(wysiwygDebounce.current);
      wysiwygDebounce.current = undefined;
      const article = previewRef.current?.querySelector("article");
      if (article) {
        const clone = article.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".code-copy-btn, .code-header, .code-lang-label, .mermaid-edit-btn, .mermaid-toolbar, .ascii-render-btn, .ascii-toggle-btn, .ce-spacer").forEach(n => n.remove());
        clone.querySelectorAll(".table-wrapper").forEach(w => { const t = w.querySelector("table"); if (t) w.replaceWith(t); });
        const flushedMd = htmlToMarkdown(clone.innerHTML);
        setMarkdownRaw(flushedMd);
        markdownRef.current = flushedMd;
      }
    }
    // Use refs to get current values (avoid stale closures)
    const currentMd = markdownRef.current;
    const currentTabId = activeTabIdRef.current;
    const fromPopstate = isPopstateRef.current;
    isPopstateRef.current = false;

    setTabs((prev) => {
      const saved = prev.map((t) => {
        if (t.id !== currentTabId || t.readonly) return t;
        return { ...t, markdown: currentMd };
      });
      const target = saved.find((t) => t.id === tabId);
      if (target) {
        queueMicrotask(() => {
          loadTab(target);
          if (!fromPopstate) {
            // Local-only example tabs (Guides & Examples) have no cloudId
            // and no bundleId, so they used to fall through to "/", which
            // left the address bar blank and broke shareability + refresh
            // continuity. Use the tab.id (already a stable kebab slug like
            // "tab-welcome") as a /?guide=<slug> query param so the URL
            // reads as a real location and the mount handler can re-open
            // the same guide on refresh.
            const isExample = EXAMPLE_TAB_IDS.has(target.id);
            const guideSlug = isExample && !target.cloudId && !target.bundleId
              ? target.id.replace(/^tab-/, "")
              : null;
            const url = target.kind === "bundle" && target.bundleId
              ? `/b/${target.bundleId}`
              : target.cloudId
                ? `/${target.cloudId}`
                : guideSlug
                  ? `/?guide=${guideSlug}`
                  : "/";
            window.history.pushState({ mwTabId: target.id, mwDocId: target.cloudId || null, mwBundleId: target.bundleId || null }, "", url);
          }
        });
      }
      // Don't update lastOpenedAt on tab click — that would re-sort the sidebar
      // and make the clicked tab jump to a new position with no transition,
      // which is jarring. The active highlight already tells the user which tab
      // is current. lastOpenedAt is set on tab creation/initial load only.
      return saved;
    });
  }, [loadTab]);

  // Bind the switchTab ref so the earlier-declared openDocBySlug
  // helper (used by Start screen cards) can invoke it.
  useEffect(() => {
    switchTabRef.current = switchTab;
  }, [switchTab]);

  // ─── Tab nav: back/forward chevrons ───
  // Home (dashboard) is represented in nav history with the sentinel
  // "__home__" so back/forward can return to the dashboard the same way
  // they return to any other tab. Without the sentinel, opening a tab
  // from the dashboard erased the dashboard from history and the user
  // had no way to chevron-back to it.
  const HOME_SENTINEL = "__home__";

  const goBack = useCallback(() => {
    if (navIndexRef.current <= 0) return;
    navIndexRef.current = navIndexRef.current - 1;
    const tid = navHistoryRef.current[navIndexRef.current];
    if (!tid) return;
    isNavigatingHistoryRef.current = true;
    if (tid === HOME_SENTINEL) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
      switchTab(tid);
    }
    setNavTick(t => t + 1);
    setTimeout(() => { isNavigatingHistoryRef.current = false; }, 0);
  }, [switchTab]);

  const goForward = useCallback(() => {
    if (navIndexRef.current >= navHistoryRef.current.length - 1) return;
    navIndexRef.current = navIndexRef.current + 1;
    const tid = navHistoryRef.current[navIndexRef.current];
    if (!tid) return;
    isNavigatingHistoryRef.current = true;
    if (tid === HOME_SENTINEL) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
      switchTab(tid);
    }
    setNavTick(t => t + 1);
    setTimeout(() => { isNavigatingHistoryRef.current = false; }, 0);
  }, [switchTab]);

  // Track activeTabId changes into nav history (skip when navigating via chevrons).
  // Active tab pushes are skipped while showOnboarding is true so a Home
  // entry isn't immediately overwritten by the still-mounted previous tab.
  useEffect(() => {
    if (!activeTabId) return;
    if (showOnboarding) return;
    if (isNavigatingHistoryRef.current) return;
    if (navIndexRef.current < navHistoryRef.current.length - 1) {
      navHistoryRef.current = navHistoryRef.current.slice(0, navIndexRef.current + 1);
    }
    if (navHistoryRef.current[navIndexRef.current] === activeTabId) return;
    navHistoryRef.current.push(activeTabId);
    navIndexRef.current = navHistoryRef.current.length - 1;
    if (navHistoryRef.current.length > 50) {
      navHistoryRef.current.shift();
      navIndexRef.current--;
    }
    setNavTick(t => t + 1);
  }, [activeTabId, showOnboarding]);

  // Reveal active tab in sidebar — auto-expand parent folders and
  // scroll the row into view. Used to fire on every activeTabId
  // change, which scrolled the MDs tree under the user's cursor
  // every time they clicked a Recent or Starred row (annoying).
  // Now exposed as an imperative function — the doc header has a
  // small Locate button that fires it explicitly, so the reveal
  // happens only when the user asks for it.
  const tabsRefForReveal = useRef(tabs);
  const foldersRefForReveal = useRef(folders);
  tabsRefForReveal.current = tabs;
  foldersRefForReveal.current = folders;
  const revealActiveInSidebar = useCallback(() => {
    const id = activeTabIdRef.current;
    if (!id) return;
    const tab = tabsRefForReveal.current.find((t) => t.id === id);
    if (!tab) return;
    if (tab.folderId) {
      const expandAncestors = (fid: string | undefined | null) => {
        if (!fid) return;
        const f = foldersRefForReveal.current.find((x) => x.id === fid);
        if (!f) return;
        if (f.collapsed) {
          setFolders((prev) => prev.map((x) => x.id === fid ? { ...x, collapsed: false } : x));
          fetch("/api/user/folders", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeadersRef.current },
            body: JSON.stringify({ id: fid, collapsed: false }),
          }).catch(() => {});
        }
        expandAncestors(f.parentId ?? null);
      };
      expandAncestors(tab.folderId);
    }
    // 50ms gives the folder-expand state update time to paint the
    // hidden row into the DOM before we query for it.
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-sidebar-tab-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      // Brief flash so the user can spot the row after scroll. The
      // class is cleared 1.4s later; the CSS rule lives in globals.css.
      row.classList.add("mw-sidebar-reveal-flash");
      setTimeout(() => row.classList.remove("mw-sidebar-reveal-flash"), 1400);
    }, 50);
  }, []);

  // Track Home (dashboard) entries into nav history. Fires when
  // showOnboarding flips true via the Home button or Alt+H.
  useEffect(() => {
    if (!showOnboarding) return;
    if (isNavigatingHistoryRef.current) return;
    if (navIndexRef.current < navHistoryRef.current.length - 1) {
      navHistoryRef.current = navHistoryRef.current.slice(0, navIndexRef.current + 1);
    }
    if (navHistoryRef.current[navIndexRef.current] === HOME_SENTINEL) return;
    navHistoryRef.current.push(HOME_SENTINEL);
    navIndexRef.current = navHistoryRef.current.length - 1;
    if (navHistoryRef.current.length > 50) {
      navHistoryRef.current.shift();
      navIndexRef.current--;
    }
    setNavTick(t => t + 1);
  }, [showOnboarding]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const docParam = params.get("doc");
      if (docParam) {
        const existing = tabs.find(t => t.cloudId === docParam && !t.deleted);
        if (existing) {
          isPopstateRef.current = true;
          switchTab(existing.id);
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [tabs, switchTab]);

  // Multi-select: shift-range needs the SAME order the sidebar actually
  // paints, so the previous version (which used the unrelated `sortMode`
  // and put root tabs BEFORE folder contents) selected what looked like
  // random rows whenever the visible order didn't match A-Z.
  //
  // Visible order is dictated by:
  //   - SidebarFolderTree (apps/web/src/components/SidebarFolder.tsx)
  //     renders root folders sorted by `sortFolders(mdsSortMode)` FIRST,
  //     then root tabs sorted by `sortTabs(mdsSortMode)`. Each folder
  //     descends depth-first: subfolders (sortFolders) → tabs (sortTabs).
  //   - The Shared section is hand-rolled in this file and uses tab
  //     insertion order, so we mirror that — no sorting.
  // Collapsed folders contribute zero ids (their children aren't visible
  // so they can't be in a visible range).
  const visibleMyDocIds = useMemo(() => {
    const allMyTabs = tabs.filter(t => !t.deleted && !t.readonly && t.permission !== "readonly" && t.permission !== "editable" && t.kind !== "bundle" && t.kind !== "hub");
    const myTabs = docFilter === "all" ? allMyTabs
      : docFilter === "private" ? allMyTabs.filter(t => !t.isSharedByMe && !t.isRestricted)
      : docFilter === "shared" ? allMyTabs.filter(t => t.isSharedByMe || t.isRestricted)
      : docFilter === "synced" ? allMyTabs.filter(t => t.source && SYNCED_SOURCES.includes(t.source))
      : allMyTabs;

    // Mirror SidebarFolder.sortTabs — same enum, same tie-break behavior.
    const tabSort = (a: Tab, b: Tab) => {
      if (mdsSortMode === "custom") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (mdsSortMode === "za") return (b.title || "").localeCompare(a.title || "");
      if (mdsSortMode === "newest") return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
      if (mdsSortMode === "oldest") return (a.lastOpenedAt ?? 0) - (b.lastOpenedAt ?? 0);
      return (a.title || "").localeCompare(b.title || ""); // az default
    };
    // Mirror SidebarFolder.sortFolders — folders fall back to alphabetical
    // when sort mode is newest/oldest (folders carry no timestamp).
    const folderSort = (a: FolderType, b: FolderType) => {
      if (mdsSortMode === "custom") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (mdsSortMode === "za") return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    };

    const q = sidebarSearchDebounced.toLowerCase();
    const matches = (t: Tab) => {
      if (!q) return true;
      if ((t.title || "").toLowerCase().includes(q)) return true;
      return (t.markdown || "").slice(0, 3000).toLowerCase().includes(q);
    };

    // Recurse depth-first through a folder: subfolders first, then tabs,
    // each sorted to match the sidebar. Returns empty list if the folder
    // is collapsed (its contents aren't visible, so they can't be in a
    // visible range).
    const walkFolder = (f: FolderType): string[] => {
      if (f.collapsed) return [];
      const out: string[] = [];
      const subfolders = folders
        .filter(sub => sub.parentId === f.id && (!sub.section || sub.section === "my"))
        .sort(folderSort);
      for (const sub of subfolders) out.push(...walkFolder(sub));
      const folderTabs = myTabs
        .filter(t => t.folderId === f.id && matches(t))
        .sort(tabSort);
      for (const t of folderTabs) out.push(t.id);
      return out;
    };

    // MDs section: root folders (sorted) → root tabs (sorted).
    const rootFolders = folders
      .filter(f => !f.parentId && (!f.section || f.section === "my"))
      .sort(folderSort);
    const mdsIds: string[] = [];
    for (const rf of rootFolders) mdsIds.push(...walkFolder(rf));
    const rootTabs = myTabs.filter(t => !t.folderId && matches(t)).sort(tabSort);
    for (const t of rootTabs) mdsIds.push(t.id);

    // Shared section (hand-rolled below; insertion order only).
    const sharedRootIds = tabs
      .filter(t => !t.deleted && !t.folderId && (t.permission === "readonly" || t.permission === "editable") && !hiddenExampleIds.has(t.id))
      .map(t => t.id);
    const sharedFolderIds = folders
      .filter(f => f.section === "shared" && !f.collapsed)
      .flatMap(f => tabs.filter(t => !t.deleted && t.folderId === f.id && !hiddenExampleIds.has(t.id)).map(t => t.id));

    return [...mdsIds, ...sharedRootIds, ...sharedFolderIds];
  }, [tabs, docFilter, mdsSortMode, sidebarSearchDebounced, folders, hiddenExampleIds]);

  // FLIP-style reorder animation for the Recent list. When a click
  // promotes an item to the top of the list, we capture each row's
  // bounding box BEFORE the state change, then in useLayoutEffect we
  // measure the new position and apply an inverted translate that
  // animates back to identity — so the row visibly slides from its
  // old slot to the top while the others shift down.
  const recentRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const _recentFlipPending = useRef(false);
  const recentFlipRects = useRef<Map<string, DOMRect>>(new Map());
  // Tracks which Recent ids have rendered at least once, so a new
  // entry — opening a doc that wasn't in the list — can fade + slide
  // in instead of popping into existence. Skips animating the very
  // first paint (everything is "new" then) so the sidebar doesn't
  // strobe on initial load.
  const recentSeenIds = useRef<Set<string>>(new Set());
  const recentFirstPaint = useRef(true);
  // captureRecentRects is now a no-op kept for source compat with the
  // call sites in handleDocClick — the useLayoutEffect below decides
  // when to FLIP based on whether the Recent order actually changed.
  const captureRecentRects = useCallback(() => { /* gated below */ }, []);

  // FLIP for Recent — ONLY when the recentTabIds order actually
  // changed. The previous "auto-capture every render" version ran
  // on every commit and produced jitter when an unrelated re-render
  // shifted rows for any reason. We compare a stringified snapshot
  // of the last recentTabIds against the current one; if equal, we
  // skip the animation entirely.
  const lastRecentOrderRef = useRef<string>("");
  useLayoutEffect(() => {
    const orderKey = recentTabIds.join("|");
    const changed = orderKey !== lastRecentOrderRef.current;

    if (changed) {
      const prev = recentFlipRects.current;
      for (const [id, el] of recentRowRefs.current) {
        if (!el) continue;
        const before = prev.get(id);
        if (!before) continue;
        const after = el.getBoundingClientRect();
        const dy = before.top - after.top;
        if (Math.abs(dy) < 1) continue;
        el.style.transition = "none";
        el.style.transform = `translateY(${dy}px)`;
        void el.offsetHeight;
        requestAnimationFrame(() => {
          el.style.transition = "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)";
          el.style.transform = "translateY(0)";
          const onEnd = () => {
            el.style.transition = "";
            el.style.transform = "";
            el.removeEventListener("transitionend", onEnd);
          };
          el.addEventListener("transitionend", onEnd);
        });
      }
    }

    // Always recapture rects + order key. Unrelated renders refresh
    // the captured rects so the NEXT real reorder animates from the
    // current visual state, not a stale one.
    const next = new Map<string, DOMRect>();
    for (const [id, el] of recentRowRefs.current) {
      if (el) next.set(id, el.getBoundingClientRect());
    }
    recentFlipRects.current = next;
    lastRecentOrderRef.current = orderKey;
  });

  // Sync the seen-ids ref AFTER each render so the next render's
  // entering-ids set is computed against this render's roster.
  // Skips the very first paint (we record everything as seen so
  // the boot doesn't strobe N rows fading in at once).
  useEffect(() => {
    for (const id of recentRowRefs.current.keys()) recentSeenIds.current.add(id);
    if (recentFirstPaint.current) recentFirstPaint.current = false;
    // Drop ids that are no longer rendered so a tab opened, removed,
    // and re-opened animates again.
    const live = new Set(recentRowRefs.current.keys());
    for (const id of [...recentSeenIds.current]) {
      if (!live.has(id)) recentSeenIds.current.delete(id);
    }
  });

  const handleDocClick = useCallback((tabId: string, e: React.MouseEvent) => {
    setShowOnboarding(false);
    setActiveBundleDocIds(new Set()); // clear bundle highlight when selecting MD
    setShowBundleChat(false); // close bundle chat if open
    if (e.metaKey || e.ctrlKey) {
      setSelectedTabIds(prev => { const next = new Set(prev); if (next.has(tabId)) next.delete(tabId); else next.add(tabId); return next; });
      lastClickedTabIdRef.current = tabId;
    } else if (e.shiftKey && lastClickedTabIdRef.current) {
      const lastIdx = visibleMyDocIds.indexOf(lastClickedTabIdRef.current);
      const curIdx = visibleMyDocIds.indexOf(tabId);
      if (lastIdx >= 0 && curIdx >= 0) {
        setSelectedTabIds(new Set(visibleMyDocIds.slice(Math.min(lastIdx, curIdx), Math.max(lastIdx, curIdx) + 1)));
      }
    } else {
      setSelectedTabIds(new Set());
      lastClickedTabIdRef.current = tabId;
      if (tabId !== activeTabId) {
        // IMPORTANT: do NOT pre-update activeTabIdRef here. switchTab uses
        // activeTabIdRef.current to identify which tab the *current* markdown
        // belongs to so it can persist it. If we flip the ref to the new tab
        // first, switchTab will write the previous doc's content into the new
        // tab's slot — corrupting it locally, and the next autosave will then
        // PATCH the cloud doc with the wrong markdown + title.
        switchTab(tabId);
        // Push to Recent (most-recent-first, max 7, dedup). Skip mid-drag so
        // we don't recreate sidebar DOM nodes mid-flight. Capture rects
        // first so the FLIP useLayoutEffect animates the slide-to-top.
        if (!isDraggingSidebarRef.current) {
          if (recentTabIds.includes(tabId) && recentTabIds[0] !== tabId) captureRecentRects();
          setRecentTabIds(prev => [tabId, ...prev.filter(id => id !== tabId)].slice(0, 25));
        }
      } else if (recentTabIds.includes(tabId) && recentTabIds[0] !== tabId) {
        // Already active and already in Recent but not at the top —
        // promote it. Capture rects first so the FLIP useLayoutEffect
        // can animate the move-to-top.
        captureRecentRects();
        if (!isDraggingSidebarRef.current) {
          setRecentTabIds(prev => [tabId, ...prev.filter(id => id !== tabId)].slice(0, 25));
        }
      }
    }
  }, [visibleMyDocIds, activeTabId, switchTab, captureRecentRects, recentTabIds]);

  // Clear selection on filter/search change
  useEffect(() => { setSelectedTabIds(new Set()); }, [docFilter, sidebarSearch, mdsSortMode]);

  // Debounced cloud search when sidebarSearch has 3+ chars
  useEffect(() => {
    if (cloudSearchTimerRef.current) clearTimeout(cloudSearchTimerRef.current);
    if (sidebarSearch.length < 3) {
      setCloudSearchResults([]);
      setIsCloudSearching(false);
      return;
    }
    setIsCloudSearching(true);
    const controller = new AbortController();
    cloudSearchTimerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(sidebarSearch)}`, { headers: authHeadersRef.current, signal: controller.signal })
        .then(res => res.ok ? res.json() : { results: [] })
        .then(data => {
          setCloudSearchResults(data.results || []);
          setIsCloudSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCloudSearchResults([]);
            setIsCloudSearching(false);
          }
        });
    }, 400);
    return () => { if (cloudSearchTimerRef.current) clearTimeout(cloudSearchTimerRef.current); controller.abort(); };
  }, [sidebarSearch]);

  // Debounced search for Cmd+K palette (3+ chars, no matching commands)
  useEffect(() => {
    if (cmdSearchTimerRef.current) clearTimeout(cmdSearchTimerRef.current);
    if (!showCommandPalette || cmdSearch.length < 3) {
      setCmdSearchResults([]);
      setIsCmdSearching(false);
      return;
    }
    setIsCmdSearching(true);
    const controller = new AbortController();
    cmdSearchTimerRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(cmdSearch)}`, { headers: authHeadersRef.current, signal: controller.signal })
        .then(res => res.ok ? res.json() : { results: [] })
        .then(data => {
          setCmdSearchResults(data.results || []);
          setIsCmdSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCmdSearchResults([]);
            setIsCmdSearching(false);
          }
        });
    }, 400);
    return () => { if (cmdSearchTimerRef.current) clearTimeout(cmdSearchTimerRef.current); controller.abort(); };
  }, [cmdSearch, showCommandPalette]);

  const addTabWithContent = useCallback(async (initialMd: string) => {
    const currentMd = markdownRef.current;
    const currentTabId = activeTabIdRef.current;

    const id = `tab-${tabIdCounter++}`;
    const tabTitle = extractTitleFromMd(initialMd) || "Untitled";
    // If a folder was targeted (via folder hover "+"), drop the new doc into it
    const targetFolderId = pendingNewDocFolderId || undefined;
    if (pendingNewDocFolderId) setPendingNewDocFolderId(null);
    const newTab: Tab = { id, title: tabTitle, markdown: initialMd, isDraft: true, permission: "mine", lastOpenedAt: Date.now(), folderId: targetFolderId };

    setTabs((prev) => {
      const saved = prev.map((t) => {
        if (t.id !== currentTabId || t.readonly) return t;
        return { ...t, markdown: currentMd };
      });
      return [...saved, newTab];
    });

    loadTab(newTab);
    setTitle(tabTitle);
    // Switch to LIVE view when creating a new document (exit Home screen)
    setShowOnboarding(false);
    if (viewMode !== "preview" && viewMode !== "split") setViewMode("preview");

    // Auto-create on server (ensure anonymous ID for non-logged-in users)
    const anonId = user?.id ? undefined : ensureAnonymousId();
    const result = await autoSave.createDocument({
      markdown: initialMd,
      title: tabTitle,
      userId: user?.id,
      anonymousId: anonId,
    });
    if (result) {
      setTabs(prev => {
        // Remove any duplicate cloud-tab that server sync may have created for this cloudId
        const withoutDup = prev.filter(t => !(t.cloudId === result.id && t.id !== id));
        return withoutDup.map(t => t.id === id ? { ...t, cloudId: result.id, editToken: result.editToken } : t);
      });
      setDocId(result.id);
      // Update URL without navigation
      window.history.replaceState(null, "", `/${result.id}`);
      // If this doc was created inside a folder via the sidebar "+" action, persist
      // its folder assignment to the server now that we have a cloudId.
      if (targetFolderId) {
        fetch(`/api/docs/${result.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeadersRef.current },
          body: JSON.stringify({ action: "move-to-folder", folderId: targetFolderId }),
        }).catch(() => {});
      }
      // BUG 8 fix: If content changed during cloud creation window, trigger save
      const currentMd = markdownRef.current;
      if (currentMd !== initialMd) {
        autoSave.scheduleSave({
          cloudId: result.id,
          markdown: currentMd,
          title: tabTitle,
          userId: user?.id,
          userEmail: user?.email,
          anonymousId: anonId,
          editToken: result.editToken,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTab, autoSave, user?.id, user?.email, anonymousId]);

  const addTab = useCallback(() => {
    setShowTemplatePicker(true);
  }, []);

  // Duplicate the current read-only tab into a new editable tab.
  const duplicateCurrentTabAsEditable = useCallback(() => {
    const src = tabs.find((t) => t.id === activeTabIdRef.current);
    if (!src) return;
    const md = markdownRef.current || src.markdown || "";
    const newId = `tab-copy-${Date.now()}`;
    const newTab = {
      id: newId,
      title: `${src.title || "Untitled"} (copy)`,
      markdown: md,
      readonly: false,
      permission: "mine" as const,
    };
    setTabs((prev) => [...prev, newTab]);
    queueMicrotask(() => loadTab(newTab));
  }, [tabs, loadTab]);

  const _closeTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (tabId === activeTabId) {
      const next = newTabs[Math.min(idx, newTabs.length - 1)];
      loadTab(next); // Use loadTab to properly sync all state (docId, URL, permissions)
    }
  }, [tabs, activeTabId, loadTab]);

  // Mermaid rendering after DOM update
  // Finds <pre lang="mermaid"> directly in DOM (no regex on HTML strings)
  useEffect(() => {
    if (!previewRef.current || isLoading) return;

    // Find all <pre> with lang="mermaid" that haven't been rendered yet
    const mermaidPres = previewRef.current.querySelectorAll('pre[lang="mermaid"]');
    if (mermaidPres.length === 0) { prevMermaidCodesRef.current = []; return; }

    // Extract current mermaid codes and skip re-render if unchanged
    const currentCodes = Array.from(mermaidPres).map(pre => {
      const codeEl = pre.querySelector("code");
      return (codeEl?.textContent || pre.textContent || "").trim();
    });
    const prev = prevMermaidCodesRef.current;
    if (prev.length === currentCodes.length && prev.every((c, i) => c === currentCodes[i])) return;
    prevMermaidCodesRef.current = currentCodes;

    const isDark = theme === "dark";

    // Use mermaid from CDN (window.mermaid) — webpack can't handle mermaid's dynamic chunk imports
    const waitForMermaid = (): Promise<typeof import("mermaid").default> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).mermaid) return Promise.resolve((window as any).mermaid);
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((window as any).mermaid) { clearInterval(check); resolve((window as any).mermaid); }
        }, 50);
        setTimeout(() => { clearInterval(check); reject(new Error("Mermaid load timeout")); }, 10000);
      });
    };

    waitForMermaid().catch(() => { console.warn("[memory.wiki] Mermaid failed to load"); return null; }).then(async (mermaid) => {
      if (!mermaid) return;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: isDark ? "dark" : "default",
        // Mermaid renders to SVG and sets font-family as a presentation
        // attribute, so CSS var() doesn't resolve. Use a literal cascade
        // that matches the body font (Noto Sans + Pretendard for KR).
        fontFamily: "'Noto Sans', 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif",
        fontSize: 15,
        // Layout config — generous spacing to match AI render feel
        flowchart: {
          padding: 16,
          nodeSpacing: 30,
          rankSpacing: 40,
          htmlLabels: true,
          curve: "basis",
        },
        sequence: {
          actorMargin: 60,
          messageMargin: 40,
          boxMargin: 8,
          noteMargin: 12,
          messageAlign: "center" as const,
        },
        themeCSS: `
          .nodeLabel { font-size: 14px; font-weight: 500; }
          .edgeLabel { font-size: 12px; }
          .cluster-label .nodeLabel { font-size: 13px; font-weight: 600; }
          .messageText { font-size: 13px; }
          text.actor { font-size: 14px; font-weight: 500; }
        `,
        themeVariables: isDark ? {
          background: "transparent",
          primaryColor: "#222230",
          primaryTextColor: "#ededf0",
          primaryBorderColor: "#3a3a48",
          lineColor: "#50505e",
          secondaryColor: "#1a1a24",
          tertiaryColor: "#1a1a24",
          // Pie chart colors (layout needs these)
          pie1: "#fb923c", pie2: "#818cf8", pie3: "#4ade80", pie4: "#fb7185",
          pie5: "#60a5fa", pie6: "#c084fc", pie7: "#fbbf24", pie8: "#2dd4bf",
          // Git colors
          git0: "#fb923c", git1: "#818cf8", git2: "#4ade80", git3: "#fb7185",
          git4: "#60a5fa", git5: "#c084fc", git6: "#fbbf24", git7: "#2dd4bf",
        } : {
          background: "transparent",
          primaryColor: "#ffffff",
          primaryTextColor: "#1a1a2e",
          primaryBorderColor: "#e0e0e8",
          lineColor: "#b0b0c0",
          secondaryColor: "#f7f7fa",
          tertiaryColor: "#f7f7fa",
          pie1: "#ea580c", pie2: "#6366f1", pie3: "#16a34a", pie4: "#e11d48",
          pie5: "#2563eb", pie6: "#9333ea", pie7: "#ca8a04", pie8: "#0d9488",
          git0: "#ea580c", git1: "#6366f1", git2: "#16a34a", git3: "#e11d48",
          git4: "#2563eb", git5: "#9333ea", git6: "#ca8a04", git7: "#0d9488",
        },
      });

      const ts = Date.now();
      // Process sequentially to avoid mermaid ID conflicts
      for (let idx = 0; idx < mermaidPres.length; idx++) {
        const pre = mermaidPres[idx];
        const codeEl = pre.querySelector("code");
        const code = (codeEl?.textContent || pre.textContent || "").trim();
        if (!code) continue;

        const id = `mermaid-${ts}-${idx}`;

        try {
          const { svg: rawSvg } = await mermaid.render(id, code);
          const { styleMermaidSvg } = await import("@/lib/mermaid-style");
          const svg = styleMermaidSvg(rawSvg, isDark);

          // Build container — store original source for Turndown roundtrip
          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";
          wrapper.setAttribute("data-original-code", code);
          const sourcepos = pre.getAttribute("data-sourcepos");
          if (sourcepos) wrapper.setAttribute("data-sourcepos", sourcepos);

          // Toolbar: Edit | Copy
          const toolbar = document.createElement("div");
          toolbar.className = "mermaid-toolbar";
          toolbar.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:8px 10px 0;flex-wrap:nowrap;opacity:0;transition:opacity 0.15s";

          const btnStyle = "padding:4px 10px;font-size:11px;font-family:var(--font-mono);border-radius:4px;cursor:pointer;line-height:14px";

          // "Edit" button — Mermaid visual editor
          const editBtn = document.createElement("button");
          editBtn.textContent = "Edit";
          editBtn.style.cssText = `${btnStyle};background:none;color:var(--text-muted);border:1px solid var(--border-dim)`;
          editBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            mermaidIsNewRef.current = false;
            mermaidSourceIndexRef.current = -1;
            setCanvasMermaid(code);
            setShowMermaidModal(true);
          });
          toolbar.appendChild(editBtn);

          // Copy button
          const copySvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="9" height="10" rx="1"/><path d="M2 6v7a1 1 0 001 1h7"/></svg>';
          const checkSvg = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 8 7 11 12 5"/></svg>';
          const copyBtn = document.createElement("button");
          copyBtn.title = "Copy source";
          copyBtn.style.cssText = "padding:4px;background:var(--code-copy-bg);color:var(--code-copy-color);border:1px solid var(--code-copy-border);border-radius:4px;cursor:pointer;display:flex;align-items:center";
          copyBtn.innerHTML = copySvg;
          copyBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            navigator.clipboard.writeText(code).then(() => {
              copyBtn.innerHTML = checkSvg;
              setTimeout(() => { copyBtn.innerHTML = copySvg; }, 1500);
            });
          });
          toolbar.appendChild(copyBtn);

          wrapper.appendChild(toolbar);

          // Default: mermaid.js SVG rendering
          const rendered = document.createElement("div");
          rendered.className = "mermaid-rendered";
          rendered.innerHTML = svg;
          wrapper.appendChild(rendered);

          // Show toolbar on hover
          wrapper.addEventListener("mouseenter", () => { toolbar.style.opacity = "1"; });
          wrapper.addEventListener("mouseleave", () => { toolbar.style.opacity = "0"; });

          // Double-click → open in Mermaid editor
          wrapper.addEventListener("dblclick", (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            // Find the exact character offset of this mermaid block in markdown
            const block = "```mermaid\n" + code + "\n```";
            const md = markdownRef.current;
            // Count which occurrence of this exact block is being edited
            // by checking the order of mermaid containers in the rendered output
            const allMermaidWrappers = previewRef.current?.querySelectorAll(".mermaid-container") || [];
            let occurrenceIndex = 0;
            for (const mw of allMermaidWrappers) {
              if (mw === wrapper) break;
              // Check if this wrapper has the same code via data-original-code
              const mwOrigCode = mw.getAttribute("data-original-code") || "";
              if (mwOrigCode === code) {
                occurrenceIndex++;
              }
            }
            let searchFrom = 0;
            for (let n = 0; n <= occurrenceIndex; n++) {
              const idx = md.indexOf(block, searchFrom);
              if (idx === -1) { searchFrom = -1; break; }
              searchFrom = n < occurrenceIndex ? idx + block.length : idx;
            }
            if (searchFrom === -1) return;
            mermaidSourceIndexRef.current = searchFrom;
            setCanvasMermaid(code);
            setShowMermaidModal(true);
          });
          wrapper.style.cursor = "pointer";

          pre.replaceWith(wrapper);

        } catch (err) {
          console.warn(`Mermaid render failed for "${code.substring(0, 30)}...":`, err);
          // mermaid injects error SVGs into DOM — remove them
          document.querySelectorAll(`#d${id}, [id^="d${id}"]`).forEach((el) => el.remove());
          // Also remove any mermaid error containers
          document.querySelectorAll(".mermaid-error, [id*='mermaid-'] .error-icon").forEach((el) => {
            const parent = el.closest("[id*='mermaid-']");
            if (parent) parent.remove();
            else el.remove();
          });
        }
      }
    });
  }, [html, isLoading, theme, viewMode]);

  // ASCII diagram — add "Render" button (user-controlled, not auto)
  useEffect(() => {
    if (!previewRef.current || isLoading) return;

    // Clean up previous dynamically-created ASCII toolbar elements (removing them also removes their listeners)
    previewRef.current.querySelectorAll(".ascii-render-btn, .ascii-toolbar").forEach(el => el.remove());

    const asciiDiagrams = previewRef.current.querySelectorAll(".ascii-diagram");
    if (asciiDiagrams.length === 0) return;

    // Remove any leftover code-header Copy buttons from highlightCode
    asciiDiagrams.forEach(el => {
      el.querySelectorAll(".code-header, .code-copy-btn").forEach(btn => btn.remove());
    });

    asciiDiagrams.forEach((el) => {
      // Skip if already has toolbar or already rendered
      if (el.querySelector(".ascii-toolbar")) return;
      if ((el as HTMLElement).dataset.asciiRendered) return;

      // Toolbar at top — always visible
      const toolbar = document.createElement("div");
      toolbar.className = "ascii-toolbar";
      toolbar.style.cssText = "display:flex;align-items:center;justify-content:flex-end;gap:6px;padding:8px 10px 0;flex-wrap:nowrap";

      const btn = document.createElement("button");
      btn.className = "ascii-render-btn";
      btn.textContent = "Convert to Mermaid";
      btn.title = "Convert this ASCII diagram to Mermaid code using AI";
      btn.style.cssText = `
        padding:4px 10px;font-size:11px;font-family:var(--font-mono);
        background:var(--border);color:var(--text-primary);border:1px solid var(--text-primary);
        border-radius:4px;cursor:pointer;line-height:14px;
      `;
      toolbar.appendChild(btn);

      // Copy button
      const srcText = el.querySelector("code")?.textContent || el.textContent || "";
      const copyBtn = document.createElement("button");
      copyBtn.title = "Copy ASCII source";
      copyBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5"/></svg><span style="margin-left:4px">Copy</span>';
      copyBtn.style.cssText = "display:flex;align-items:center;padding:4px 10px;font-size:11px;font-family:var(--font-mono);background:var(--code-copy-bg);color:var(--code-copy-color);border:1px solid var(--code-copy-border);border-radius:4px;cursor:pointer;line-height:14px";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(srcText).then(() => {
          const orig = copyBtn.innerHTML;
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
        });
      });
      toolbar.appendChild(copyBtn);

      el.insertBefore(toolbar, el.firstChild);

      btn.addEventListener("click", async () => {
        const codeEl = el.querySelector("code");
        const asciiText = codeEl?.textContent || el.textContent || "";
        if (!asciiText.trim()) return;

        btn.textContent = "Converting...";
        btn.style.opacity = "0.7";
        btn.style.pointerEvents = "none";

        try {
          // Render ASCII to canvas image for vision AI
          let imageBase64: string | undefined;
          try {
            const lines = asciiText.split("\n");
            const fontSize = 14;
            const lineHeight = fontSize * 1.5;
            const charWidth = fontSize * 0.6;
            const padding = 24;
            const maxLineLen = Math.max(...lines.map(l => l.length));
            const canvasW = Math.ceil(maxLineLen * charWidth + padding * 2);
            const canvasH = Math.ceil(lines.length * lineHeight + padding * 2);
            const canvas = document.createElement("canvas");
            canvas.width = canvasW * 2;
            canvas.height = canvasH * 2;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.scale(2, 2);
              ctx.fillStyle = "#0a0a0c";
              ctx.fillRect(0, 0, canvasW, canvasH);
              ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
              ctx.fillStyle = "#e4e4e7";
              ctx.textBaseline = "top";
              lines.forEach((line, i) => {
                ctx.fillText(line, padding, padding + i * lineHeight);
              });
              imageBase64 = canvas.toDataURL("image/png");
            }
          } catch { /* fallback to text-only */ }

          const docContext = markdown?.substring(0, 2000) || "";
          const res = await fetch("/api/ascii-to-mermaid", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ascii: asciiText, image: imageBase64, context: docContext }),
          });

          if (!res.ok) throw new Error("API error");
          const data = await res.json();
          const mermaidCode = data.mermaid;
          if (!mermaidCode) throw new Error("No mermaid output");

          // Replace ASCII block with ```mermaid block in markdown source
          // Find the ASCII text in markdown and replace with mermaid code block
          const currentMd = markdown || "";
          // The ASCII is inside a ```text or ``` block — find and replace
          // Use indexOf instead of dynamic regex to avoid ReDoS
          let newMd = currentMd;
          const asciiIdx = currentMd.indexOf(asciiText);
          if (asciiIdx !== -1) {
            // Find the enclosing ``` block
            const before = currentMd.lastIndexOf("```", asciiIdx);
            const after = currentMd.indexOf("```", asciiIdx + asciiText.length);
            if (before !== -1 && after !== -1) {
              newMd = currentMd.substring(0, before) + "```mermaid\n" + mermaidCode + "\n" + currentMd.substring(after);
            }
          }

          if (newMd !== currentMd) {
            setMarkdown(newMd);
            cmSetDoc(newMd);
            doRender(newMd);
          }
        } catch {
          btn.textContent = "Failed";
          btn.style.color = "#ef4444";
          setTimeout(() => {
            btn.textContent = "Convert to Mermaid";
            btn.style.opacity = "1";
            btn.style.pointerEvents = "";
            btn.style.color = "var(--text-primary)";
          }, 2000);
        }
      });
      // User clicks Render button manually per diagram
    });
  }, [html, isLoading, theme]);

  // Math: double-click to edit in MathEditor
  useEffect(() => {
    if (!previewRef.current || isLoading) return;
    const mathEls = previewRef.current.querySelectorAll(".math-rendered[data-math-src]");
    mathEls.forEach((el) => {
      if ((el as HTMLElement).dataset.mathHandled) return;
      (el as HTMLElement).dataset.mathHandled = "1";
      el.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const src = decodeURIComponent((el as HTMLElement).dataset.mathSrc || "");
        const mode = (el as HTMLElement).dataset.mathMode;
        if (src) {
          // Store original MD syntax for replacement
          const orig = mode === "display" ? `$$\n${src}\n$$` : `$${src}$`;
          mathOriginalRef.current = orig;
          // Find the exact character offset of THIS math block (not just the first match)
          // by counting which occurrence of this math text it is in the rendered output
          const allMathEls = previewRef.current?.querySelectorAll(".math-rendered[data-math-src]") || [];
          let occurrenceIndex = 0;
          for (const mel of allMathEls) {
            const mSrc = decodeURIComponent((mel as HTMLElement).dataset.mathSrc || "");
            const mMode = (mel as HTMLElement).dataset.mathMode;
            const mOrig = mMode === "display" ? `$$\n${mSrc}\n$$` : `$${mSrc}$`;
            if (mOrig === orig) {
              if (mel === el) break;
              occurrenceIndex++;
            }
          }
          // Find the nth occurrence of this math block in markdown
          const md = markdownRef.current;
          let searchFrom = 0;
          for (let n = 0; n <= occurrenceIndex; n++) {
            const idx = md.indexOf(orig, searchFrom);
            if (idx === -1) { searchFrom = -1; break; }
            searchFrom = n < occurrenceIndex ? idx + orig.length : idx;
          }
          mathSourceIndexRef.current = searchFrom;
          setInitialMath(src);
          setShowMathModal(true);
        }
      });
    });
  }, [html, isLoading]);

  // Track auth state changes: notify user when session expires silently AND
  // purge cached server data so a signed-out user doesn't see another account's
  // cloud docs / bundles / folders / recent list.
  //
  // Purge ONLY when transitioning from signed-in (mw-was-logged-in) to
  // signed-out. Pure anonymous sessions (never signed in) must keep their
  // bundles + recent list — those are tied to anonymous_id on the server, not
  // to a user account, and would otherwise vanish on every refresh.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && user === null) {
      const wasLoggedIn = localStorage.getItem("mw-was-logged-in");
      if (wasLoggedIn) {
        showToast("You've been signed out. Sign in again to sync.", "info");
        localStorage.removeItem("mw-was-logged-in");
        setTabs(prev => prev.some(t => t.cloudId || t.kind === "bundle")
          ? prev.filter(t => !t.cloudId && t.kind !== "bundle")
          : prev);
        setBundles(prev => prev.length === 0 ? prev : []);
        // Folders: keep only the "Examples" group. Write the cleaned
        // list to localStorage synchronously here — the persistence
        // effect debounces by 500ms, and if the user closes the tab
        // or refreshes within that window, the stale user folders
        // would survive into the next anon session ("folders from
        // when I was logged in are still there after sign-out").
        setFolders(prev => {
          const filtered = prev.filter(f => f.id === EXAMPLES_FOLDER_ID);
          try { localStorage.setItem("mw-folders", JSON.stringify(filtered)); } catch { /* quota */ }
          return filtered.length === prev.length ? prev : filtered;
        });
        // Same race applies to the bundles cache; clear it directly
        // so a refresh-during-sign-out doesn't repaint the previous
        // owner's bundles in the sidebar.
        try { localStorage.removeItem("mw-bundles"); } catch { /* quota */ }
        // Keep recentTabIds + bundles localStorage cache so re-login restores
        // Recent immediately. The bundle/cloud tabs themselves are wiped above
        // for privacy, but Recent IDs alone don't reveal sensitive data and
        // the render-time fallback (parses bundleId out of "bundle-X-time"
        // IDs and resolves via bundles[]) lets entries display before the
        // user re-clicks them.
        setServerDocs(prev => prev.length === 0 ? prev : []);
        setRecentDocs(prev => prev.length === 0 ? prev : []);
        setNotifications(prev => prev.length === 0 ? prev : []);
        setUnreadCount(prev => prev === 0 ? prev : 0);
      }
    }
    if (isAuthenticated && user) {
      localStorage.setItem("mw-was-logged-in", "1");
    }
  }, [isAuthenticated, user, authLoading]);

  // Listen for session expiry events from useAuth
  useEffect(() => {
    const handler = () => {
      showToast("Session expired. Please sign in again.", "info");
    };
    window.addEventListener("mw-session-expired", handler);
    return () => window.removeEventListener("mw-session-expired", handler);
  }, []);

  // Hub auto-creation notice — fires the first time useAuth gets
  // back a fresh slug from /api/user/hub/ensure. Tell the user
  // where their hub lives + where to rename it. Persistent toast
  // so they have time to read; click dismisses.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ slug: string }>).detail;
      if (!detail?.slug) return;
      showToast(
        `Your hub is live at memory.wiki/hub/${detail.slug}. Rename it any time in Settings → Hub.`,
        "success",
      );
    };
    window.addEventListener("mw-hub-auto-created", handler as EventListener);
    return () => window.removeEventListener("mw-hub-auto-created", handler as EventListener);
  }, []);

  // Anonymous-to-account claim notice. Fired by useAuth's
  // tryClaimAnonymousContent after a fresh sign-in absorbs the
  // anonymous browser's docs / bundles. Without this listener the
  // user just sees their newly-claimed content "appear" in the
  // sidebar with no explanation. We:
  //   1. Toast a clear summary so they know what just moved.
  //   2. Refresh the sidebar's serverDocs so claimed items show
  //      up immediately (don't wait for the next manual reload).
  //   3. Expand MDs + Recent sections so the new entries are
  //      visible without the user hunting for them.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ documents: number; bundles: number }>).detail;
      if (!detail) return;
      const docs = detail.documents || 0;
      const bundles = detail.bundles || 0;
      if (docs === 0 && bundles === 0) return;
      const parts: string[] = [];
      if (docs > 0) parts.push(`${docs} ${docs === 1 ? "doc" : "docs"}`);
      if (bundles > 0) parts.push(`${bundles} ${bundles === 1 ? "bundle" : "bundles"}`);
      showToast(`Claimed ${parts.join(" + ")} from your anonymous session.`, "success");
      setShowMyDocs(true);
      setShowRecent(true);
      // Pull the fresh list so claimed items render right away.
      fetch("/api/user/documents?includeDeleted=1", { headers: authHeadersRef.current })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents); })
        .catch(() => {});
    };
    window.addEventListener("mw-anon-claimed", handler as EventListener);
    return () => window.removeEventListener("mw-anon-claimed", handler as EventListener);
  }, []);

  // Load shared content from URL — wait for auth to resolve first
  useEffect(() => {
    if (authLoading) return; // Wait until auth state is known
    (async () => {
      // Check hash-based sharing first
      const shared = await extractFromUrl();
      if (shared) {
        // Check if this is a desktop file open (has filename in hash)
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const desktopFile = hashParams.get("file");

        if (desktopFile) {
          // Desktop app: create new tab with local filename
          const tabId = `tab-${Date.now()}`;
          const title = desktopFile.replace(/\.[^.]+$/, "");
          setTabs(prev => [...prev, { id: tabId, title, markdown: shared }]);
          setActiveTabId(tabId);
          setMarkdown(shared);
          setIsSharedDoc(false);
          /* viewMode preserved — user controls it */
          await doRender(shared);
          cmSetDocRef.current?.(shared);
          // Clear hash to prevent reload issues
          window.history.replaceState(null, "", "/");
          return;
        }

        // Create new tab for shared content (don't overwrite current tab)
        const sharedTabId = `tab-${Date.now()}`;
        const sharedTitle = extractTitleFromMd(shared) || "Shared Document";
        const sharedTab: Tab = { id: sharedTabId, title: sharedTitle, markdown: shared, shared: true };
        setTabs(prev => {
          const curTabId = activeTabIdRef.current;
          const saved = prev.map(t => t.id === curTabId ? { ...t, markdown: markdownRef.current } : t);
          return [...saved, sharedTab];
        });
        loadTab(sharedTab);
        setIsSharedDoc(true);
        setViewMode("preview");
        // loadTab already triggers doRender — no duplicate call
        window.history.replaceState(null, "", "/");
        return;
      }

      // Handle PWA share_target: ?title=...&text=...&url=...
      const shareParams = new URLSearchParams(window.location.search);
      const shareText = shareParams.get("text");
      const shareUrl = shareParams.get("url");
      if (shareText || shareUrl) {
        const shareTitle = shareParams.get("title") || "";
        const parts: string[] = [];
        if (shareTitle) parts.push(`# ${shareTitle}\n`);
        if (shareText) parts.push(shareText);
        if (shareUrl) parts.push(`\n${shareUrl}`);
        const shareMd = parts.join("\n");
        const tabId = `tab-${Date.now()}`;
        const tab: Tab = { id: tabId, title: shareTitle || "Shared", markdown: shareMd };
        setTabs(prev => [...prev, tab]);
        loadTab(tab);
        window.history.replaceState(null, "", "/");
        return;
      }

      // Check ?from= or ?doc= parameter
      const params = new URLSearchParams(window.location.search);
      const docParam = params.get("from") || params.get("doc");

      // ?guide=<slug> — refresh / shared link to a Guides & Examples
      // tab (local seed content). The slug is the tab.id with the
      // "tab-" prefix stripped. Resolve back to the tab id and activate.
      const guideParam = params.get("guide");
      if (guideParam && /^[a-z0-9-]+$/.test(guideParam)) {
        const targetId = `tab-${guideParam}`;
        if (EXAMPLE_TAB_IDS.has(targetId)) {
          // setTabs already includes EXAMPLE_TABS via INITIAL_TABS, but
          // hidden-examples filtering may have removed this one. Force
          // it back into the list and activate.
          setTabs((prev) => {
            const exists = prev.find((t) => t.id === targetId);
            if (exists) return prev;
            const seed = EXAMPLE_TABS.find((t) => t.id === targetId);
            return seed ? [...prev, seed] : prev;
          });
          activeTabIdRef.current = targetId;
          setActiveTabId(targetId);
          setShowOnboarding(false);
          return;
        }
      }
      // ?fork=<id> — visitor clicked "Save in memory.wiki" on the public
      // viewer's Ask AI panel. Fetch the source doc, drop it into a
      // fresh local tab as a draft (no cloudId — autoSave creates a
      // new row under the signed-in user's account, or anon cookie
      // if not signed in). Title gets a "(forked)" suffix so the
      // user knows it's their own copy.
      const forkParam = params.get("fork");
      if (forkParam && /^[\w-]+$/.test(forkParam)) {
        try {
          const res = await fetch(`/api/docs/${forkParam}`);
          if (res.ok) {
            const d = await res.json();
            const id = `tab-${tabIdCounter++}`;
            const baseTitle = (d.title || "Untitled").trim();
            const forkedTitle = baseTitle.endsWith("(forked)") ? baseTitle : `${baseTitle} (forked)`;
            const forkedMd = (d.markdown || "").replace(/^#\s+.+$/m, `# ${forkedTitle}`);
            setTabs((prev) => [
              ...prev,
              { id, title: forkedTitle, markdown: forkedMd, permission: "mine", isDraft: true, lastOpenedAt: Date.now() },
            ]);
            setShowOnboarding(false);
            setActiveTabId(id);
            activeTabIdRef.current = id;
            window.history.replaceState(null, "", "/");
            return;
          }
        } catch { /* fall through to default landing */ }
      }
      // Also accept the bare short-URL form `memory.wiki/<id>` — the
      // /[id]/page.tsx route re-exports this editor, so when a user
      // refreshes (or clicks the URL chip) on a doc URL, the editor
      // must extract the id from the pathname and treat it as `from`.
      // Without this, the page mounts blank because no loader fires,
      // even though the stats bar shows the markdown length (the
      // markdown bleeds in from sidebar click but Tiptap never paints).
      //
      // RESERVED_PATHS guards against the 8-char "settings" collision
      // (the {6,16} length window happily matched any app-route name)
      // — without it /settings, /galaxy, /discover etc. all 404'd
      // through /api/docs/<route-name> and surfaced "Document Not
      // Found" on top of what should be the overlay.
      const RESERVED_PATHS = new Set([
        "settings", "galaxy", "discover", "install", "shared",
        "hubs", "manifesto", "plugins", "spec", "privacy", "terms",
        "about", "auth", "admin", "trending", "bookmarklet",
      ]);
      const pathnameMatch = !docParam
        ? window.location.pathname.match(/^\/([A-Za-z0-9_-]{6,16})$/)
        : null;
      const pathDocId = pathnameMatch && !RESERVED_PATHS.has(pathnameMatch[1].toLowerCase())
        ? pathnameMatch[1]
        : null;
      const candidate = docParam || pathDocId;
      // Validate doc ID: only allow alphanumeric, hyphen, underscore (nanoid charset)
      const fromId = candidate && /^[\w-]+$/.test(candidate) ? candidate : null;

      // Check ?bundle= parameter — fired by /b/<id> viewer when the
      // signed-in visitor is the bundle owner. Opens the bundle as an
      // editable tab in the main editor and rewrites the URL back to
      // /b/<id> so refresh stays on the same flow.
      const bundleParam = params.get("bundle");
      const bundleId = bundleParam && /^[\w-]+$/.test(bundleParam) ? bundleParam : null;
      if (bundleId) {
        try {
          const headers: Record<string, string> = { ...authHeaders };
          const res = await fetch(`/api/bundles/${bundleId}`, { headers });
          if (res.ok) {
            const bundleData = await res.json();
            setTabs(prev => {
              const existing = prev.find(t => t.kind === "bundle" && t.bundleId === bundleId);
              if (existing) {
                activeTabIdRef.current = existing.id;
                setActiveTabId(existing.id);
                return prev;
              }
              const newTabId = `bundle-${bundleId}-${Date.now()}`;
              const newTab: Tab = {
                id: newTabId,
                kind: "bundle",
                bundleId,
                title: bundleData.title || "Untitled Bundle",
                markdown: "",
              };
              activeTabIdRef.current = newTab.id;
              setActiveTabId(newTab.id);
              return [...prev, newTab];
            });
            setShowOnboarding(false);
            // The doc-editor loading overlay (MemoryWikiLogo at z-10) starts as true
            // and is cleared by doRender(). The bundle handler doesn't render
            // any markdown, so without this clear the overlay would sit on
            // top of BundleEmbed (same z-index, later DOM sibling) until the
            // user clicks the sidebar bundle item — which is exactly the
            // "blank logo screen" symptom we saw on /b/<id> when signed in.
            setIsLoading(false);
            window.history.replaceState(null, "", `/b/${bundleId}`);
            return;
          }
        } catch { /* fall through to default flow */ }
      }

      // Save editToken from URL if provided (from Chrome extension)
      const urlToken = params.get("token");
      if (fromId && urlToken) {
        saveEditToken(fromId, urlToken);
        // Clean up URL to remove token
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("token");
        window.history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search);
      }
      if (fromId) {
        try {
          const headers: Record<string, string> = { ...authHeaders };
          // Check for password from viewer (stored in sessionStorage)
          try {
            const savedPw = sessionStorage.getItem(`mw-pw-${fromId}`);
            if (savedPw) {
              headers["x-document-password"] = savedPw;
              sessionStorage.removeItem(`mw-pw-${fromId}`); // One-time use
            }
          } catch { /* sessionStorage unavailable */ }
          const res = await fetch(`/api/docs/${fromId}`, { headers });
          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            if (errorBody.restricted) {
              setEditorPlaceholder("restricted");
            } else if (!isAuthenticated) {
              setEditorPlaceholder("sign-in");
            } else {
              setEditorPlaceholder("not-found");
            }
            // Dismiss the boot loader so the placeholder (sign-in /
            // restricted / not-found) is actually visible. Previously
            // we returned without flipping isLoading → the inner
            // MemoryWikiLogo loader stayed on top forever, exactly the
            // "open a private link while logged-out → infinite loading"
            // symptom.
            setIsLoading(false);
            return;
          }
          {
            // Check if this doc was previously deleted by the user BEFORE loading content
            const prevDeleted = tabs.find(t => t.cloudId === fromId && t.deleted);
            if (prevDeleted) {
              setDeletedDocId(fromId);
              setEditorPlaceholder("deleted");
              setIsLoading(false);
              return;
            }

            const doc = await res.json();
            setEditorPlaceholder(null);
            // Deep-link entry (memory.wiki/<id>) — the user came in
            // pointing at this specific doc, not the dashboard. The
            // Start screen would otherwise stay visible on top of
            // the loaded tab (showOnboarding is initialized true
            // when no own-docs are cached locally yet, which is the
            // common case for a non-owner editor opening a shared
            // link). Force-flip it off so the doc body actually
            // shows once the load resolves.
            setShowOnboarding(false);
            try { localStorage.setItem("mw-onboarded", "1"); } catch {}
            setMarkdownRaw(doc.markdown);
            if (doc.title) setTitle(doc.title);
            setDocId(fromId);
            setDocEditMode(doc.editMode || "token");
            if (doc.allowedEmails) setAllowedEmailsState(doc.allowedEmails);
            if (doc.allowedEditors) setAllowedEditorsState(doc.allowedEditors);
            if (typeof doc.view_count === "number") setViewCount(doc.view_count);

            const token = getEditToken(fromId);
            const ownerByToken = !!token;
            const ownerByAccount = !!doc.isOwner;

            // Owner brand override — apply the doc owner's accent +
            // color scheme when the visitor isn't the owner. When the
            // visitor IS the owner, clear the override so their own
            // saved accent stays in charge.
            if (!ownerByToken && !ownerByAccount) {
              setActiveOwnerAccent((doc.ownerAccent as string | undefined) || null);
              setActiveOwnerScheme((doc.ownerScheme as string | undefined) || null);
            } else {
              setActiveOwnerAccent(null);
              setActiveOwnerScheme(null);
            }

            // Determine permission — three roles now:
            //   mine     — I created (token OR account ownership)
            //   editable — owner added me to allowed_editors
            //   readonly — I have view access but can't edit
            let perm: "mine" | "editable" | "readonly" = "readonly";
            if (ownerByToken || ownerByAccount) {
              perm = "mine";
              setIsOwner(true);
              setIsSharedDoc(false);
              setIsEditor(false);
              // Keep the user's persisted viewMode (Live / Split / Source).
              // Previously this forced "preview" — so a refresh on a doc URL
              // dropped users out of Split/Source back into Live view, which
              // read as "the editor turned into a viewer."
            } else if (doc.isEditor) {
              perm = "editable";
              setIsOwner(false);
              setIsSharedDoc(true);
              setIsEditor(true);
              // Don't force viewMode — editor-role users typically want
              // the same Live/Split/Source they used on their own docs.
            } else {
              perm = "readonly";
              setIsOwner(false);
              setIsSharedDoc(true);
              setIsEditor(false);
              // Don't force viewMode for readonly either. Forcing
              // "preview" on every refresh dropped users out of
              // whatever Live / Split / Source they had into the
              // read-only viewer surface, even though the editor
              // already disables editing via canEdit=false in
              // every view. Reported as "shared doc refresh opens
              // it in viewer." TipTap / CodeMirror render the body
              // as text either way; canEdit handles the lock.
            }

            // Seed the conflict-detection timestamp from the bootstrap
            // load, same as loadTab does. Without this seed the
            // updated_at comparison in the realtime / poll refetch
            // has no baseline and treats every server fetch as "newer"
            // — which is what caused the false "updated elsewhere"
            // toast for a user editing their own doc after a deep-
            // link entry.
            if (doc.updated_at) autoSave.setLastServerUpdatedAt(doc.updated_at as string);
            // Seed the body-hash conflict baseline (deep-link bootstrap).
            autoSave.setLastServerBody(doc.markdown as string);

            // "Shared by me" = the doc is published (visible to anyone
            // with the URL), regardless of edit_mode. Matching the
            // sidebar's bulk-load semantics: sharedDocIds is derived
            // from is_draft===false. Earlier this checked editMode
            // ("view"/"public"), which mis-flagged published-but-
            // owner-edit docs as Private the moment the user opened
            // them — Private filter then surfaced them incorrectly.
            const docIsSharedByMe = perm === "mine" && doc.is_draft === false;
            const othersCount = doc.allowedEmails?.filter((e: string) => e.toLowerCase() !== (user?.email || "").toLowerCase()).length || 0;
            const tabProps = {
              markdown: doc.markdown,
              title: doc.title || undefined,
              permission: perm,
              editToken: token || undefined,
              isDraft: doc.is_draft === false ? false : true,
              isSharedByMe: docIsSharedByMe || false,
              isRestricted: othersCount > 0,
              editMode: doc.editMode || "token",
              sharedWithCount: othersCount,
              ownerEmail: doc.ownerEmail || undefined,
              allowedEmails: Array.isArray(doc.allowedEmails) ? doc.allowedEmails : undefined,
              allowedEditors: Array.isArray(doc.allowedEditors) ? doc.allowedEditors : undefined,
            };

            // Render content immediately (don't depend on setTabs callback timing)
            const prevActiveId = activeTabIdRef.current; // Save before overwriting
            activeTabIdRef.current = "";
            await doRender(doc.markdown);
            // Push the loaded markdown into the Live (Tiptap) editor.
            // setMarkdownRaw + doRender feed the preview/Source side but
            // Tiptap holds its own ProseMirror doc and only updates via
            // the imperative setMarkdown handle. Skipping this call left
            // the Live tab blank on URL-paste opens (the user had to
            // toggle to Source and back to trigger the view-mode sync
            // effect, which finally pushed the body in).
            tiptapRef.current?.setMarkdown(doc.markdown);

            // Update tabs state (functional updater for latest state)
            const newTabId = `tab-${Date.now()}`;
            setTabs(prev => {
              const existing = prev.find(t => t.cloudId === fromId);
              if (existing) {
                const merged = { ...existing, ...tabProps, title: doc.title || existing.title, editToken: existing.editToken || token || undefined };
                activeTabIdRef.current = merged.id;
                setActiveTabId(merged.id);
                return prev.map(t => t.cloudId === fromId ? merged : t);
              }
              const newTab: Tab = {
                id: newTabId, cloudId: fromId, ...tabProps,
                title: doc.title || "Shared Document",
                shared: perm !== "mine",
                lastOpenedAt: Date.now(),
              };
              activeTabIdRef.current = newTab.id;
              setActiveTabId(newTab.id);
              // Save previous tab's markdown before adding new one
              const saved = prev.map(t => t.id === prevActiveId && !t.readonly ? { ...t, markdown: markdownRef.current } : t);
              return [...saved, newTab];
            });
            window.history.replaceState(null, "", `/${fromId}`);

            // Record visit (fire-and-forget)
            if (user?.id) {
              fetch("/api/user/visit", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ documentId: fromId }),
              }).catch(() => {});
            }

            // loadTab already triggers doRender — no duplicate call needed
            return;
          }
        } catch {
          // ignore, fall through to default
        }
      }

      await doRender(markdown);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Migrate anonymous documents to user account on sign-in (only on actual sign-in transition)
  const prevUserRef = useRef<string | undefined>(undefined); // undefined = not initialized
  useEffect(() => {
    if (authLoading) return; // Wait for auth to resolve

    const prevId = prevUserRef.current;
    const currentId = user?.id;

    // Only migrate on actual sign-in transition: was anonymous → now logged in
    // Read anonymousId directly from localStorage because the reactive `anonymousId` is already "" when user signs in
    const savedAnonId = typeof window !== "undefined" ? localStorage.getItem("mw-anon-id") || "" : "";
    if (currentId && prevId === "" && savedAnonId) {
      fetch("/api/user/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ anonymousId: savedAnonId }),
      }).then(res => res.json()).then(data => {
        if (data.migrated > 0) {
          clearAnonymousId();
          setTabs(prev => prev.map(t => t.cloudId ? { ...t, permission: "mine" } : t));
        }
      }).catch(() => {});
    }

    // Track: "" means anonymous, user.id means logged in, undefined means not yet initialized
    prevUserRef.current = currentId || "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, anonymousId]);

  // Auto-create cloud IDs for tabs that don't have one (one-time migration, after auth resolves)
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (authLoading || migrationDoneRef.current) return;
    migrationDoneRef.current = true;

    const tabsToMigrate = tabs.filter(t => !t.cloudId && !t.readonly && !t.deleted && t.markdown.length > 5);
    if (tabsToMigrate.length === 0) return;

    const uid = user?.id;
    const anonId = uid ? undefined : ensureAnonymousId();

    (async () => {
      for (const tab of tabsToMigrate.slice(0, 5)) {
        const result = await autoSave.createDocument({
          markdown: tab.markdown,
          title: tab.title,
          userId: uid,
          anonymousId: anonId,
        });
        if (result) {
          setTabs(prev => prev.map(t => t.id === tab.id
            ? { ...t, cloudId: result.id, editToken: result.editToken, isDraft: true, permission: "mine" }
            : t
          ));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Rehydrate cloud tabs that have empty markdown (e.g., after localStorage quota fallback)
  useEffect(() => {
    if (authLoading) return;
    const emptyCloudTabs = tabs.filter(t => t.cloudId && !t.markdown && !t.readonly && !t.deleted);
    if (emptyCloudTabs.length === 0) return;

    // Suppress autosave for the duration of the rehydrate. Without
    // this, Tiptap's first onUpdate (autolink normalization of the
    // editor's seed content) can race ahead of the fetch and PATCH
    // the cloud doc with seed content. triggerAutoSave already
    // refuses to save when tab.markdown is empty (the primary
    // guard); this flag layers a second guard that survives between
    // the moment we call setMarkdownRaw(doc.markdown) and the
    // moment React reconciles tab.markdown.
    const wasInFlight = tabSwitchInFlightRef.current;
    tabSwitchInFlightRef.current = true;

    (async () => {
      for (const tab of emptyCloudTabs) {
        try {
          const res = await fetch(`/api/docs/${tab.cloudId}`, { headers: authHeaders });
          if (res.ok) {
            const doc = await res.json();
            if (doc.markdown) {
              setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, markdown: doc.markdown, title: doc.title || t.title } : t));
              // If this is the active tab, update the editor too.
              // Tiptap is the Live-preview renderer — without
              // setMarkdown here, doRender's HTML fills the preview
              // pane only while Tiptap's internal doc stays empty,
              // so Live shows blank until the user clicks the tab
              // in the sidebar (which triggers loadTab → tiptap
              // setMarkdown). Match loadTab's hydration shape.
              if (tab.id === activeTabIdRef.current) {
                setMarkdownRaw(doc.markdown);
                doRender(doc.markdown);
                tiptapRef.current?.setMarkdown(doc.markdown);
                // Rehydrate just replaced the editor body with the fresh
                // server copy — that IS the new in-sync baseline. Without
                // this update, an external edit landing right after
                // rehydrate would see lastSynced = the (now-overwritten)
                // cached body and false-flag a conflict.
                lastSyncedMdRef.current = doc.markdown;
              }
            }
          } else if (res.status === 404 || res.status === 410) {
            // Doc gone (hard-deleted, soft-deleted for non-owner, or expired).
            // Mark the local tab deleted so we don't keep firing the same
            // 404 on every reload — the rehydrate loop only runs on tabs
            // where !deleted. The Trash UI renders deleted tabs separately
            // so the user can still discover/restore by id if needed.
            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, deleted: true, deletedAt: Date.now() } : t));
          }
        } catch { /* silent — localStorage still has the tab metadata */ }
      }
      // Drop the autosave gate after the React state update settles.
      queueMicrotask(() => { tabSwitchInFlightRef.current = wasInFlight; });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Flush pending auto-save before page unload (refresh, close, navigate)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentTab = tabs.find(t => t.id === activeTabIdRef.current);
      if (!currentTab?.cloudId || currentTab.readonly || currentTab.deleted) return;

      // BUG 15 fix: Skip if no edits were made during this session
      if (!sessionSnapshotCreated.current.has(currentTab.cloudId)) return;

      // Use sendBeacon for reliable delivery during unload
      // 1. Save current content
      const payload = JSON.stringify({
        action: "auto-save",
        markdown: markdownRef.current,
        title: currentTab.title,
        userId: user?.id,
        userEmail: user?.email,
        anonymousId: (!user?.id) ? getAnonymousId() : undefined,
        editToken: currentTab.editToken,
      });
      navigator.sendBeacon(`/api/docs/${currentTab.cloudId}`, new Blob([payload], { type: "application/json" }));

      // 2. Create session-end snapshot (version history)
      const snapshotPayload = JSON.stringify({
        action: "snapshot",
        userId: user?.id,
        userEmail: user?.email,
        anonymousId: (!user?.id) ? getAnonymousId() : undefined,
        editToken: currentTab.editToken,
        changeSummary: "Session end",
      });
      navigator.sendBeacon(`/api/docs/${currentTab.cloudId}`, new Blob([snapshotPayload], { type: "application/json" }));
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, user?.id]);

  // Show conflict modal when auto-save detects a 409
  useEffect(() => {
    if (autoSave.conflict) {
      setShowConflictModal(true);
    }
  }, [autoSave.conflict]);

  // Session-based version snapshots:
  // - Create a snapshot when editing session begins (first edit on a doc with cloudId)
  // - Create a snapshot on beforeunload (session end)
  const sessionSnapshotCreated = useRef<Set<string>>(new Set());

  // Trigger snapshot on first edit of a document in this session
  const maybeCreateSessionSnapshot = useCallback((cloudId: string) => {
    if (sessionSnapshotCreated.current.has(cloudId)) return;
    sessionSnapshotCreated.current.add(cloudId);

    // Fire-and-forget: create snapshot of current server content
    const currentTab = tabs.find(t => t.cloudId === cloudId);
    fetch(`/api/docs/${cloudId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeadersRef.current },
      body: JSON.stringify({
        action: "snapshot",
        userId: user?.id,
        userEmail: user?.email,
        anonymousId: (!user?.id) ? getAnonymousId() : undefined,
        editToken: currentTab?.editToken,
        changeSummary: "Session start",
      }),
    }).catch(() => {});
  }, [tabs, user?.id, user?.email]);

  // Fetch recently visited (shared with me) + server docs for logged-in OR anonymous users
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id && !anonymousId) {
      setRecentDocs([]);
      setServerDocs([]);
      return;
    }
    // Fetch recent visits — only for logged-in users (Shared With Me)
    if (user?.id) fetch("/api/user/recent", { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.recent) {
          setRecentDocs(data.recent.filter((d: { isOwner: boolean }) => !d.isOwner));
        }
      })
      .catch(() => {});
    // Fetch user's bundles. Also reconciles tab state — closes any open bundle
    // tab whose id is no longer on the server.
    // IMPORTANT: do NOT drop bundle tabs whose bundleId isn't returned here.
    // /api/bundles only lists bundles owned by `user_id` (or `anonymous_id`),
    // but a user may legitimately have open bundle tabs that aren't in that
    // list — e.g. bundles created while anonymous but still accessible by
    // editToken, or bundles shared via `allowed_emails`. Filtering against
    // `liveIds` here was wiping those tabs after every refresh, which made
    // bundles vanish from Recent while docs (which aren't filtered this way)
    // persisted. Stale-deleted bundles are caught by the per-bundle GET on
    // tab open (404 → tab can be closed there), not here.
    fetch("/api/bundles", { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.bundles) return;
        setBundles(data.bundles);
      })
      .catch(() => {});
    // Hub lint — orphans + likely-duplicate pairs. Fired once on mount
    // when the user is signed in. We don't poll; the user can re-run
    // via the section's refresh button after an ingest / cleanup.
    if (user?.id) {
      setLintLoading(true);
      fetch("/api/user/hub/lint", { headers: authHeaders })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setLintReport({ orphans: data.orphans || [], duplicates: data.duplicates || [], titleMismatches: data.titleMismatches || [], staleClaims: data.staleClaims || [], mergeSuggestions: data.mergeSuggestions || [], rollupSuggestions: data.rollupSuggestions || [], autoArchive: data.autoArchive || [], bundleSuggestions: data.bundleSuggestions || [], citationRot: data.citationRot || [], totalDocs: data.totalDocs || 0 }); })
        .catch(() => {})
        .finally(() => setLintLoading(false));
    }
    // Fetch user's own documents from server
    fetch("/api/user/documents?includeDeleted=1", { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.documents) {
          setServerDocs(data.documents); ingestDocAiMeta(data.documents);
          // "Shared by me" = published (is_draft===false). MUST match
          // publishedIds — they are the same axis (read visibility),
          // and the DocStatusIcon already keys off isDraft, so deriving
          // isSharedByMe from edit_mode (a write-permission field)
          // produced the bug where green-Globe published docs landed
          // in the Private filter because their edit_mode stayed at
          // "token" after publish.
          const publishedIds = new Set(
            data.documents
              .filter((d: { is_draft?: boolean }) => d.is_draft === false)
              .map((d: { id: string }) => d.id)
          );
          const sharedDocIds = publishedIds;
          const ownerEmailLower = user?.email?.toLowerCase();
          const restrictedIds = new Set(
            data.documents
              .filter((d: { allowed_emails?: string[]; edit_mode?: string }) => {
                // Only "restricted" if there are actual non-owner recipients
                if (!d.allowed_emails || d.allowed_emails.length === 0) return false;
                // Filter out owner email (case-insensitive)
                const others = d.allowed_emails.filter((e: string) => e.toLowerCase() !== ownerEmailLower);
                return others.length > 0;
              })
              .map((d: { id: string }) => d.id)
          );
          // Build source + folder + editMode + sharedCount maps from server docs
          const sourceMap = new Map<string, string | null>(
            data.documents.map((d: { id: string; source?: string | null }) => [d.id, d.source ?? null])
          );
          const folderMap = new Map<string, string | null>(
            data.documents.map((d: { id: string; folder_id?: string | null }) => [d.id, d.folder_id ?? null])
          );
          const editModeMap = new Map<string, string>(
            data.documents.map((d: { id: string; edit_mode?: string }) => [d.id, d.edit_mode || "token"])
          );
          const computeSharedCount = (allowedEmails: string[] | undefined, ownerEmail: string | undefined) => {
            if (!allowedEmails) return 0;
            return allowedEmails.filter(e => e.toLowerCase() !== (ownerEmail || "").toLowerCase()).length;
          };
          const sharedCountMap = new Map<string, number>(
            data.documents.map((d: { id: string; allowed_emails?: string[] }) => [d.id, computeSharedCount(d.allowed_emails, ownerEmailLower)])
          );
          const viewCountMap = new Map<string, number>(
            data.documents.map((d: { id: string; view_count?: number }) => [d.id, d.view_count || 0])
          );
          // Password presence — drives the "Shared" tier in
          // DocStatusIcon when the doc is published-but-restricted.
          const hasPasswordMap = new Map<string, boolean>(
            data.documents.map((d: { id: string; hasPassword?: boolean }) => [d.id, !!d.hasPassword])
          );
          setTabs(prev => {
            // Update existing tabs with server state
            const updated = prev.map(t => {
              if (!t.cloudId) return t;
              const serverFolderId = folderMap.get(t.cloudId);
              const newDraft = publishedIds.has(t.cloudId) ? false : true;
              const newShared = sharedDocIds.has(t.cloudId) ? true : false;
              const newRestricted = restrictedIds.has(t.cloudId) ? true : false;
              const newSource = sourceMap.get(t.cloudId) || undefined;
              const newFolder = serverFolderId || t.folderId;
              const newEditMode = editModeMap.get(t.cloudId) || "token";
              const newSharedCount = sharedCountMap.get(t.cloudId) || 0;
              const newViewCount = viewCountMap.get(t.cloudId) || 0;
              const newHasPassword = hasPasswordMap.get(t.cloudId) || false;
              if (t.isDraft === newDraft && t.isSharedByMe === newShared && t.isRestricted === newRestricted && t.source === newSource && t.folderId === newFolder && t.editMode === newEditMode && t.sharedWithCount === newSharedCount && t.viewCount === newViewCount && t.hasPassword === newHasPassword) return t;
              return { ...t, isDraft: newDraft, isSharedByMe: newShared, isRestricted: newRestricted, source: newSource, folderId: newFolder, editMode: newEditMode, sharedWithCount: newSharedCount, viewCount: newViewCount, hasPassword: newHasPassword };
            });
            // Create tabs for server docs that don't have local tabs.
            // CRITICAL: also seed the share-state fields here. The
            // existing-tab branch above already syncs them, but new
            // server-only docs (the ones the user has never opened
            // locally) used to come in with NO isRestricted /
            // sharedWithCount / hasPassword data — so they all looked
            // like Private (Cloud icon) regardless of actual sharing
            // state. Founder spotted this on the MDs section: docs
            // they HAD shared with people showed the Private icon.
            const existingCloudIds = new Set(updated.filter(t => t.cloudId).map(t => t.cloudId!));
            const newTabs = data.documents
              .filter((d: { id: string }) => !existingCloudIds.has(d.id))
              .map((d: { id: string; title?: string; source?: string; is_draft?: boolean; folder_id?: string; sort_order?: number; deleted_at?: string | null; updated_at?: string; created_at?: string }) => ({
                id: `cloud-${d.id}`,
                title: d.title || "Untitled",
                markdown: "",
                cloudId: d.id,
                isDraft: d.is_draft !== false,
                source: d.source || undefined,
                folderId: d.folder_id || undefined,
                sortOrder: d.sort_order ?? 0,
                permission: "mine" as const,
                deleted: !!d.deleted_at,
                deletedAt: d.deleted_at ? new Date(d.deleted_at).getTime() : undefined,
                lastOpenedAt: d.updated_at ? new Date(d.updated_at).getTime() : d.created_at ? new Date(d.created_at).getTime() : Date.now(),
                isSharedByMe: sharedDocIds.has(d.id),
                isRestricted: restrictedIds.has(d.id),
                editMode: editModeMap.get(d.id) || "token",
                sharedWithCount: sharedCountMap.get(d.id) || 0,
                viewCount: viewCountMap.get(d.id) || 0,
                hasPassword: hasPasswordMap.get(d.id) || false,
              }));
            return [...updated, ...newTabs];
          });
        }
      })
      .catch(() => {});
    // Fetch starred pins. Owner-only; no anonymous pin support.
    if (user?.id) {
      fetch("/api/user/pins", { headers: authHeaders })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.pins && Array.isArray(d.pins)) {
            setPins(d.pins.map((p: { kind: "document" | "bundle"; id: string }) => ({ kind: p.kind, id: p.id })));
          }
        })
        .catch(() => {});
    }
    // (reveal-active sidebar effect lives in its own effect below — see
    // "Reveal active tab in sidebar" further down in this component.)
    // Fetch server folders and merge with local (skip Examples folder)
    if (user?.id) fetch("/api/user/folders", { headers: authHeaders })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.folders) {
          setFolders(prev => {
            const serverFolders = data.folders.map((f: { id: string; name: string; section?: string; collapsed?: boolean; sort_order?: number; parent_id?: string | null; emoji?: string | null }) => ({
              id: f.id, name: f.name, collapsed: f.collapsed || false, section: (f.section || "my") as "my" | "shared",
              parentId: f.parent_id || null, emoji: f.emoji || undefined, sortOrder: f.sort_order ?? 0,
            }));
            // Merge server folders (server wins on conflict), drop legacy Examples folder
            const serverIds = new Set(serverFolders.map((f: { id: string }) => f.id));
            const localOnly = prev.filter(f => f.id !== EXAMPLES_FOLDER_ID && !serverIds.has(f.id) && !f.id.startsWith("folder-"));
            // Upload local-only folders to server (one-time migration)
            const toUpload = prev.filter(f => f.id !== EXAMPLES_FOLDER_ID && !serverIds.has(f.id) && f.id.startsWith("folder-"));
            for (const f of toUpload) {
              fetch("/api/user/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ id: f.id, name: f.name, section: f.section || "my" }),
              }).catch(() => {});
            }
            return [...localOnly, ...serverFolders, ...toUpload];
          });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  // Keep local bundle Tab.title in lockstep with the server's bundles[].title.
  // Runs every time the `bundles` state mutates (initial fetch, rename via UI,
  // realtime postgres_changes, bundle creation, etc.). Solves the case where
  // the sidebar's MD Bundles section shows the fresh title (because it reads
  // `b.title` directly) while Recent / bundle viewer header still display
  // the stale title baked into the local Tab object when the bundle tab was
  // first opened. Also dedupes duplicate bundle tabs that share a bundleId
  // — older versions of the code created multiple tabs for the same bundle
  // through different code paths, leaving phantom rows that resolved to the
  // same Tab.find() key but kept stale titles.
  useEffect(() => {
    if (bundles.length === 0) return;
    const titleByBundleId = new Map<string, string>(
      bundles.map(b => [b.id, b.title || "Untitled Bundle"])
    );
    setTabs(prev => {
      const seenBundleIds = new Set<string>();
      let changed = false;
      const next: Tab[] = [];
      for (const t of prev) {
        if (t.kind !== "bundle" || !t.bundleId) {
          next.push(t);
          continue;
        }
        // Drop secondary duplicate bundle tabs (same bundleId, later in array).
        if (seenBundleIds.has(t.bundleId)) {
          changed = true;
          continue;
        }
        seenBundleIds.add(t.bundleId);
        const fresh = titleByBundleId.get(t.bundleId);
        if (fresh && fresh !== t.title) {
          changed = true;
          next.push({ ...t, title: fresh });
        } else {
          next.push(t);
        }
      }
      return changed ? next : prev;
    });
  }, [bundles]);

  // Notification initial fetch (Realtime handles subsequent updates)
  useEffect(() => {
    if (!user?.email) { setNotifications([]); setUnreadCount(0); return; }
    const controller = new AbortController();
    fetch("/api/notifications", { headers: authHeadersRef.current, signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      })
      .catch(() => {});
    return () => { controller.abort(); };
  }, [user?.email]);

  // Ref for latest markdown (avoids stale closures in Realtime + preview handlers)
  const markdownRef = useRef(markdown);
  markdownRef.current = markdown;

  // Last body we know matches the server.
  //
  // The dirty check in the realtime + focus/visibility handlers must
  // compare localMd against SOMETHING — and `currentTab.markdown`
  // from the closure goes stale the moment we apply the first
  // auto-pull (the closure rebinds only on activeTabId/docId, not
  // on setTabs). With only a stale baseline:
  //   1) viewer-only doc, 1st external edit → clean → auto-pull ✓
  //   2) 2nd external edit → localMd matches the JUST-pulled body,
  //      but baseline still has the load-time body → false "updated
  //      elsewhere" toast on a clean viewer.
  //
  // This ref is the single source of truth for "what body is in-sync
  // with the server right now". It's set on:
  //   - tab activation (init = the body the tab loaded with)
  //   - successful auto-pull (= the just-pulled serverMd)
  //   - user "Keep theirs" conflict resolve (= the chosen serverMd)
  //
  // null sentinel = "not yet initialized" so an empty doc ("" body)
  // is still considered a valid in-sync state.
  const lastSyncedMdRef = useRef<string | null>(null);
  const lastSyncedCloudIdRef = useRef<string>("");

  // Ref for Yjs collaboration state (avoids stale closures in Realtime handler)
  const isCollaboratingRef = useRef(isCollaborating);
  isCollaboratingRef.current = isCollaborating;

  // ─── Supabase Realtime: Editor document changes ───
  // Cloud IDs that received an external update (from MCP / CLI / iOS /
  // another browser / Bundle/Hub auto-organize) within the last few
  // seconds. The sidebar reads this set to render a brief pulse + dot
  // on the matching row so the user can SEE that a doc changed even
  // when they're not looking at it. Entries auto-expire after 4.5s.
  const [recentlyUpdatedCloudIds, setRecentlyUpdatedCloudIds] = useState<Set<string>>(new Set());
  const recentlyUpdatedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const markTabFresh = useCallback((cloudId: string) => {
    if (!cloudId) return;
    setRecentlyUpdatedCloudIds((prev) => {
      if (prev.has(cloudId)) return prev;
      const next = new Set(prev);
      next.add(cloudId);
      return next;
    });
    const existing = recentlyUpdatedTimersRef.current.get(cloudId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setRecentlyUpdatedCloudIds((prev) => {
        if (!prev.has(cloudId)) return prev;
        const next = new Set(prev);
        next.delete(cloudId);
        return next;
      });
      recentlyUpdatedTimersRef.current.delete(cloudId);
    }, 4500);
    recentlyUpdatedTimersRef.current.set(cloudId, t);
  }, []);
  // Clear all pending fresh-flash timers on unmount so they don't
  // fire setRecentlyUpdatedCloudIds on a torn-down tree (React
  // warning + wasted work).
  useEffect(() => {
    const timers = recentlyUpdatedTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  // Initialize lastSyncedMdRef on tab activation.
  //
  //   tab switch (different cloudId) →
  //     - tab.markdown already populated → seed lastSynced from it.
  //     - tab.markdown still "" (cloudId set, body fetch pending) →
  //       leave null. The loadTab fetch result will set it. Treating
  //       null as "no baseline" keeps the dirty check safely
  //       conservative if a realtime payload lands during the
  //       fetch window.
  //
  //   same cloudId, lastSynced still null, tab.markdown now populated →
  //     backfill (the deferred-fetch path).
  //
  //   same cloudId, lastSynced already set → no-op. The auto-pull /
  //     rehydrate / conflict-resolve sites update lastSyncedMdRef
  //     synchronously and we must not stomp on those values.
  useEffect(() => {
    const t = tabs.find(t => t.id === activeTabId);
    if (!t?.cloudId) return;
    if (lastSyncedCloudIdRef.current !== t.cloudId) {
      lastSyncedMdRef.current = t.markdown !== "" ? t.markdown : null;
      lastSyncedCloudIdRef.current = t.cloudId;
      // Seed the body-hash conflict baseline for tabs hydrated straight
      // from localStorage (no server fetch ran, so loadTab's seeding
      // never fired). Without this, lastSavedMd stays "" and the first
      // edit sends expectedHash=hash("") which mismatches the real
      // server body → a false conflict on the very first keystroke.
      if (t.markdown !== "") autoSave.setLastServerBody(t.markdown);
      return;
    }
    if (lastSyncedMdRef.current === null && t.markdown !== "") {
      lastSyncedMdRef.current = t.markdown;
      autoSave.setLastServerBody(t.markdown);
    }
  }, [activeTabId, tabs, autoSave]);

  // Subscribe to document updates when a cloud document is active in the editor.
  // If local is clean → auto-pull; if dirty → show toast with Pull/Ignore.
  const realtimeLastSaveRef = useRef<number>(0); // timestamp of our own last save
  // Transient "Saved" pill state — flips true when autoSave reports a
  // successful save, then drops back to false after 2.5s so the
  // header indicator doesn't camp on screen for the whole session.
  // The lastSaved Date itself stays around (other code reads it for
  // stale-conflict checks); this is just a UI fade flag.
  const [recentlySaved, setRecentlySaved] = useState(false);
  useEffect(() => {
    if (autoSave.lastSaved) {
      realtimeLastSaveRef.current = autoSave.lastSaved.getTime();
      setRecentlySaved(true);
      const t = setTimeout(() => setRecentlySaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [autoSave.lastSaved]);

  useEffect(() => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const cloudId = currentTab?.cloudId;
    if (!cloudId) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`editor-doc-${cloudId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${cloudId}` },
        async (payload: { new: Record<string, unknown> }) => {
          // Skip if this update was triggered by our own save. The
          // synchronous getter is critical here — the older
          // useEffect-mirrored ref was set AFTER React commit, so a
          // WebSocket frame landing ahead of the HTTP response left
          // the ref stale and the guard would fail, surfacing a false
          // "updated elsewhere" toast while the user was typing.
          if (autoSave.isRecentSave(5000)) return;
          // Don't blow away tabs DOM mid-drag — Chrome cancels HTML5 drag
          // the moment the dragged element is unmounted/reordered.
          if (isDraggingSidebarRef.current) return;

          const newData = payload.new;

          // Handle permission/meta changes
          if (newData.edit_mode !== undefined) {
            setDocEditMode(newData.edit_mode as "owner" | "account" | "token" | "view" | "public");
            setEditMode(newData.edit_mode as "owner" | "account" | "token" | "view" | "public");
          }
          if (newData.is_draft !== undefined) {
            setTabs(prev => prev.map(t => t.cloudId === cloudId ? { ...t, isDraft: newData.is_draft as boolean } : t));
          }

          // When Yjs collaboration is active, content sync is handled by useCollaboration.
          // Skip the postgres_changes content fetch to avoid conflicts with CRDT merging.
          if (isCollaboratingRef.current) return;

          // Fetch the latest document content from server
          // (Realtime payload.new may not include all columns depending on REPLICA IDENTITY)
          // cache: no-store — browser HTTP cache was returning a stale
          // copy even when realtime fired correctly, so the auto-pull
          // looked like nothing happened.
          try {
            const res = await fetch(`/api/docs/${cloudId}`, { headers: authHeadersRef.current, cache: "no-store" });
            if (!res.ok) return;
            const doc = await res.json();
            const serverMd = doc.markdown as string;
            const serverTitle = (doc.title as string) || undefined;
            const serverUpdatedAt = (doc.updated_at as string) || "";

            // "External update" = server's updated_at moved past the
            // timestamp WE last saved or fetched. Body comparison
            // (serverMd vs cached tab.markdown) doesn't work because
            // tab.markdown is the load-time body, not the last-saved
            // body — so it always looked diverged after a self-save.
            const lastKnown = autoSave.getLastServerUpdatedAt();
            if (lastKnown && serverUpdatedAt && serverUpdatedAt <= lastKnown) return;

            const localMd = markdownRef.current;
            if (serverMd === localMd) {
              // Body matches anyway (somehow updated_at moved without
              // a body change, or our lastKnown was empty). Sync the
              // timestamp so the next check is accurate.
              if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
              return;
            }
            // Echo-of-our-own-save check. The realtime payload can land
            // more than 5s after our PATCH on a slow connection, past
            // isRecentSave's window. If the server's body matches what
            // we last successfully sent, this UPDATE is just our own
            // save reflected back — skip it. Without this the user
            // gets a false "updated elsewhere" toast while their own
            // edits are still in the editor.
            if (serverMd === autoSave.getLastSavedMarkdown()) {
              if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
              return;
            }

            // Local is dirty if EITHER an autosave is in flight OR the
            // live markdown differs from the baseline we know matches
            // server. The previous check used `autoSave.isSaving` alone,
            // which is FALSE during the 2.5s debounce window after a
            // keystroke. A realtime payload landing in that window would
            // overwrite the user's typing without a conflict notice —
            // exact data-loss bug founder reported (input vanishes,
            // cursor jumps to end via setMarkdown -> setContent).
            // Cleanness check — see lib/external-update-dirty.ts for the rule.
            const localIsDirty = isLocalDirty({
              localMd,
              lastSaved: autoSave.getLastSavedMarkdown(),
              lastSynced: lastSyncedMdRef.current,
              isSaving: autoSave.isSaving,
            });

            if (!localIsDirty) {
              // Server changed, local clean → auto-pull. Previously
              // silent except for highlightDiff's 1.5s background tint
              // on the preview pane, which the user only saw on the
              // Preview tab (and easily missed). Surface a short toast
              // so the change is acknowledged regardless of view mode.
              const oldMd = localMd;
              setMarkdownRaw(serverMd);
              if (serverTitle) setTitle(serverTitle);
              doRender(serverMd);
              cmSetDocRef.current?.(serverMd);
              tiptapRef.current?.setMarkdown(serverMd);
              if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
              lastSyncedMdRef.current = serverMd;
              autoSave.setLastServerBody(serverMd);
              setTabs(prev => prev.map(t => t.cloudId === cloudId ? { ...t, markdown: serverMd, title: serverTitle || t.title } : t));
              markTabFresh(cloudId);
              highlightDiff(oldMd, serverMd);
              showToast("Synced — this document was updated from another surface", "info");
            } else {
              // True conflict — server moved forward AND local has
              // uncommitted edits. Notify but don't overwrite.
              showToast("This document was updated elsewhere. Your changes are preserved. Save to keep yours, or reload to see theirs.", "info");
            }
          } catch { /* fetch failed, ignore */ }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, docId]);

  // ─── Visibility / focus refetch ───
  // Belt-and-suspenders for the realtime channel above: when the user
  // returns to the tab (visibilitychange) or window (focus), refetch
  // the active doc and pull cleanly if it's changed server-side AND
  // the local copy is clean. Realtime can silently miss a payload
  // (RLS hiccup, dropped websocket frame, suspended tab) — this
  // makes sure no one ever has to hit refresh to see an update they
  // made from another surface (MCP / iOS / CLI / another browser).
  useEffect(() => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const cloudId = currentTab?.cloudId;
    if (!cloudId) return;

    const refetchIfStale = async () => {
      // Same sync-getter guard as the realtime channel — the older
      // ref-based check was async and produced false "updated
      // elsewhere" surfacing under typing-during-save races.
      if (autoSave.isRecentSave(5000)) return;
      if (autoSave.isSaving) return;
      try {
        // cache: no-store — browser HTTP cache was returning a stale
        // copy on revisit, so the auto-pull looked like nothing happened.
        const res = await fetch(`/api/docs/${cloudId}`, { headers: authHeadersRef.current, cache: "no-store" });
        if (!res.ok) return;
        const doc = await res.json();
        const serverMd = doc.markdown as string;
        const serverUpdatedAt = (doc.updated_at as string) || "";
        // External-update signal: server's updated_at moved past what
        // we last saved or fetched. Body comparison doesn't work
        // because tab.markdown is load-time only, never updated on
        // autosave success, so it always looked diverged after a
        // self-save and falsely flagged the user's own typing as an
        // external conflict.
        const lastKnown = autoSave.getLastServerUpdatedAt();
        if (lastKnown && serverUpdatedAt && serverUpdatedAt <= lastKnown) return;

        const localMd = markdownRef.current;
        if (serverMd === localMd) {
          if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
          return;
        }
        // Echo-of-our-own-save check (same as realtime channel above).
        // serverMd may match what we last successfully PATCH'd even
        // if the user has typed more since — that's not an external
        // advance, just our own save reflected back.
        if (serverMd === autoSave.getLastSavedMarkdown()) {
          if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
          return;
        }
        // Genuine external advance. The dirty check is the SAME shape
        // as the realtime channel above: isSaving alone misses the
        // 2.5s debounce window where the user just typed but the
        // PATCH hasn't fired yet. Compare against the last persisted
        // body, or — if we haven't saved this session — the body the
        // tab loaded with, so a focus-return mid-typing never wipes
        // the buffer.
        // Cleanness check — same as the realtime channel above. See
        // lib/external-update-dirty.ts for the rule.
        const localIsDirty = isLocalDirty({
          localMd,
          lastSaved: autoSave.getLastSavedMarkdown(),
          lastSynced: lastSyncedMdRef.current,
          isSaving: autoSave.isSaving,
        });
        if (localIsDirty) {
          showToast("This document was updated elsewhere. Your changes are preserved. Save to keep yours, or reload to see theirs.", "info");
          return;
        }
        const oldMd = localMd;
        setMarkdownRaw(serverMd);
        if (doc.title) setTitle(doc.title as string);
        doRender(serverMd);
        cmSetDocRef.current?.(serverMd);
        tiptapRef.current?.setMarkdown(serverMd);
        if (serverUpdatedAt) autoSave.setLastServerUpdatedAt(serverUpdatedAt);
        lastSyncedMdRef.current = serverMd;
        autoSave.setLastServerBody(serverMd);
        setTabs(prev => prev.map(t => t.cloudId === cloudId ? { ...t, markdown: serverMd, title: (doc.title as string) || t.title } : t));
        markTabFresh(cloudId);
        highlightDiff(oldMd, serverMd);
        showToast("Synced — this document was updated from another surface", "info");
      } catch { /* ignore */ }
    };

    const onVisibility = () => { if (!document.hidden) refetchIfStale(); };
    const onFocus = () => refetchIfStale();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    // Foreground poll — visibilitychange/focus don't fire while the
    // user keeps the tab in front the whole time, so a long-lived
    // viewer never sees an external update (MCP/iOS/CLI) until they
    // tab away and back. Poll every 15s when the page is visible so
    // the worst-case staleness for an open page is ~15s, not "until
    // I switch tabs." Skips when document.hidden so background tabs
    // don't burn API calls. Bails inside refetchIfStale if local has
    // unsaved edits or we just saved.
    const pollId = window.setInterval(() => {
      if (!document.hidden) refetchIfStale();
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(pollId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, docId]);

  // ─── Supabase Realtime: Notifications ───
  // Subscribe to new notifications for the logged-in user.
  useEffect(() => {
    if (!user?.email) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`notifications-${user.email}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${user.email}` },
        (payload: { new: Record<string, unknown> }) => {
          const notif = payload.new as unknown as { id: number; type: string; document_id: string; document_title: string; from_user_name: string; message: string; read: boolean; created_at: string };
          // Add to notifications state
          setNotifications(prev => [{
            id: notif.id,
            type: notif.type,
            documentId: notif.document_id,
            documentTitle: notif.document_title,
            fromUserName: notif.from_user_name,
            message: notif.message,
            read: notif.read,
            createdAt: notif.created_at,
          }, ...prev]);
          setUnreadCount(prev => prev + 1);
          showToast(notif.message || "New notification", "info");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.email]);

  // ─── Supabase Realtime: Sidebar document list ───
  // Subscribe to document changes for the current user to auto-update the sidebar.
  useEffect(() => {
    if (!user?.id) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`sidebar-docs-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
        () => {
          // Tiny coalesce window — just long enough to merge a single
          // save's worth of bursts (auto-save fires PATCH, server
          // emits one UPDATE row, sometimes a follow-up summary write
          // emits another). 5s was wrong here: it suppressed
          // MCP / iOS / other-browser writes to a DIFFERENT doc that
          // landed in the same window as our local save, so the
          // sidebar never saw them. The 1.5s debounce below already
          // coalesces real bursts.
          if (autoSave.isRecentSave(1000)) return;
          // Debounce: coalesce rapid updates into a single fetch
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
          // Don't blow away the sidebar DOM mid-drag — Chrome cancels HTML5 drag
          // the moment the dragged element is unmounted/reordered. Bail; the next
          // postgres_changes event (or the user's own drop completing) will re-trigger.
          if (isDraggingSidebarRef.current) return;
          try {
            const res = await fetch("/api/user/documents?includeDeleted=1", { headers: authHeadersRef.current });
            if (!res.ok) return;
            const data = await res.json();
            if (!data?.documents) return;
            setServerDocs(data.documents); ingestDocAiMeta(data.documents);

            // Sync tab state from server (isDraft, isSharedByMe, isRestricted, source, folderId).
            // Keep sharedDocIds === publishedIds — both express read
            // visibility (is_draft). edit_mode is a write-perm axis and
            // must not influence isSharedByMe (see the bulk loader for
            // the bug this divergence caused in the Private filter).
            const publishedIds = new Set(
              data.documents
                .filter((d: { is_draft?: boolean }) => d.is_draft === false)
                .map((d: { id: string }) => d.id)
            );
            const sharedDocIds = publishedIds;
            const ownerEmailLower2 = user?.email?.toLowerCase();
            const restrictedIds = new Set(
              data.documents
                .filter((d: { allowed_emails?: string[] }) => {
                  if (!d.allowed_emails || d.allowed_emails.length === 0) return false;
                  const others = d.allowed_emails.filter((e: string) => e.toLowerCase() !== ownerEmailLower2);
                  return others.length > 0;
                })
                .map((d: { id: string }) => d.id)
            );
            const sourceMap = new Map<string, string | null>(
              data.documents.map((d: { id: string; source?: string | null }) => [d.id, d.source ?? null])
            );
            const editModeMap2 = new Map<string, string>(
              data.documents.map((d: { id: string; edit_mode?: string }) => [d.id, d.edit_mode || "token"])
            );
            const computeSharedCount2 = (allowedEmails: string[] | undefined, ownerEmail: string | undefined) => {
              if (!allowedEmails) return 0;
              return allowedEmails.filter(e => e.toLowerCase() !== (ownerEmail || "").toLowerCase()).length;
            };
            const sharedCountMap2 = new Map<string, number>(
              data.documents.map((d: { id: string; allowed_emails?: string[] }) => [d.id, computeSharedCount2(d.allowed_emails, ownerEmailLower2)])
            );

            // Build server-doc map up front so we can compare each tab's
            // current state against the server snapshot AND collect
            // freshness signals (title change, new draft state, new
            // doc landed) in one pass. The sidebar reads
            // recentlyUpdatedCloudIds to animate the affected row.
            const serverDocByIdForFresh = new Map<string, { title?: string }>(
              data.documents.map((d: { id: string; title?: string }) => [d.id, d])
            );
            const freshCloudIds: string[] = [];
            setTabs(prev => {
              const existingCloudIds = new Set(prev.filter(t => t.cloudId).map(t => t.cloudId!));
              // Update existing tabs
              const updated = prev.map(t => {
                if (!t.cloudId) return t;
                const newDraft = publishedIds.has(t.cloudId) ? false : true;
                const newShared = sharedDocIds.has(t.cloudId) ? true : false;
                const newRestricted = restrictedIds.has(t.cloudId) ? true : false;
                const newSource = sourceMap.get(t.cloudId) || undefined;
                const newEditMode = editModeMap2.get(t.cloudId) || "token";
                const newSharedCount = sharedCountMap2.get(t.cloudId) || 0;
                const sd = serverDocByIdForFresh.get(t.cloudId);
                const newTitle = sd?.title || t.title;
                // Title sync — same fix as the Refresh button. Without
                // it a doc renamed from another surface kept the stale
                // title in the sidebar.
                const titleChanged = newTitle !== t.title;
                const stateChanged = t.isDraft !== newDraft || t.isSharedByMe !== newShared || t.isRestricted !== newRestricted || t.source !== newSource || t.editMode !== newEditMode || t.sharedWithCount !== newSharedCount;
                if (!titleChanged && !stateChanged) return t;
                if (titleChanged || stateChanged) freshCloudIds.push(t.cloudId);
                return { ...t, title: newTitle, isDraft: newDraft, isSharedByMe: newShared, isRestricted: newRestricted, source: newSource, editMode: newEditMode, sharedWithCount: newSharedCount };
              });
              // Add new server docs that don't have local tabs
              const newTabs = data.documents
                .filter((d: { id: string }) => !existingCloudIds.has(d.id))
                .map((d: { id: string; title?: string; source?: string; is_draft?: boolean; folder_id?: string; updated_at?: string; created_at?: string }) => {
                  freshCloudIds.push(d.id);
                  return {
                    id: `cloud-${d.id}`,
                    title: d.title || "Untitled",
                    markdown: "",
                    cloudId: d.id,
                    isDraft: d.is_draft !== false,
                    source: d.source || undefined,
                    folderId: d.folder_id || undefined,
                    permission: "mine" as const,
                    lastOpenedAt: d.updated_at ? new Date(d.updated_at).getTime() : d.created_at ? new Date(d.created_at).getTime() : Date.now(),
                  };
                });
              // Reflect server delete state on local tabs:
              //  - cloudId not in server response → hard-deleted, remove (keep
              //    active tab so editor can show "deleted" placeholder)
              //  - cloudId present and deleted_at set → soft-deleted, mark
              //    `deleted: true` so it appears in Trash (don't strip from state)
              const serverDocsById = new Map<string, { deleted_at?: string | null; updated_at?: string }>(
                data.documents.map((d: { id: string; deleted_at?: string | null; updated_at?: string }) => [d.id, d])
              );
              const filtered = updated.flatMap(t => {
                if (!t.cloudId) return [t];
                const serverDoc = serverDocsById.get(t.cloudId);
                if (!serverDoc) {
                  if (t.id === activeTabIdRef.current) return [t];
                  return [];
                }
                const isSoftDeleted = !!serverDoc.deleted_at;
                if (isSoftDeleted && !t.deleted) return [{ ...t, deleted: true, deletedAt: new Date(serverDoc.deleted_at!).getTime() }];
                // Auto-restore only when the server actually saw a row update *after*
                // we marked it deleted locally. Otherwise this races with our own
                // pending soft-delete: realtime fires for an unrelated update,
                // server still has deleted_at=null, and we'd incorrectly revive
                // a tab the user just trashed. Compare server.updated_at to
                // local deletedAt — if server is older, the soft-delete just
                // hasn't propagated yet; keep local deleted state.
                if (!isSoftDeleted && t.deleted) {
                  const serverUpdated = serverDoc.updated_at ? new Date(serverDoc.updated_at).getTime() : 0;
                  const localDeletedAt = t.deletedAt || 0;
                  if (serverUpdated > localDeletedAt) {
                    return [{ ...t, deleted: false, deletedAt: undefined }];
                  }
                  return [t];
                }
                return [t];
              });
              return [...filtered, ...newTabs];
            });
            // Flash the sidebar rows that just changed (renamed, share
            // toggled, draft state, NEW doc landed) so the user can SEE
            // that something moved without watching the list. The set
            // is read by SidebarFolder via `recentlyUpdatedCloudIds`.
            for (const cid of freshCloudIds) markTabFresh(cid);
          } catch { /* offline */ }
          }, 1500);
        }
      )
      .subscribe();

    return () => { if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ─── Supabase Realtime: Bundles + folders ───
  // Subscribe to bundles + folders so the sidebar reflects changes
  // made on iOS / another tab / another device without forcing the
  // user to hit Refresh. Documents had its own channel above; this
  // closes the gap for the other two sidebar surfaces.
  useEffect(() => {
    if (!user?.id) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let bundleDebounce: ReturnType<typeof setTimeout> | null = null;
    let folderDebounce: ReturnType<typeof setTimeout> | null = null;

    const reloadBundles = async () => {
      try {
        const res = await fetch("/api/bundles", { headers: authHeadersRef.current, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.bundles) setBundles(data.bundles);
      } catch { /* offline */ }
    };
    const reloadFolders = async () => {
      try {
        const res = await fetch("/api/user/folders", { headers: authHeadersRef.current, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.folders) return;
        setFolders(data.folders.map((f: { id: string; name: string; collapsed?: boolean; section?: string; parent_id?: string | null; emoji?: string; sort_order?: number }) => ({
          id: f.id,
          name: f.name,
          collapsed: f.collapsed || false,
          section: (f.section || "my") as "my" | "shared",
          parentId: f.parent_id || null,
          emoji: f.emoji || undefined,
          sortOrder: f.sort_order ?? 0,
        })));
      } catch { /* offline */ }
    };

    const channel = supabase
      .channel(`sidebar-aux-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bundles', filter: `user_id=eq.${user.id}` },
        () => {
          if (bundleDebounce) clearTimeout(bundleDebounce);
          bundleDebounce = setTimeout(reloadBundles, 1200);
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${user.id}` },
        () => {
          if (folderDebounce) clearTimeout(folderDebounce);
          folderDebounce = setTimeout(reloadFolders, 1200);
        }
      )
      .subscribe();

    return () => {
      if (bundleDebounce) clearTimeout(bundleDebounce);
      if (folderDebounce) clearTimeout(folderDebounce);
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Preview: click to scroll to source + double-click to inline edit

  // Uses comrak's data-sourcepos="startLine:startCol-endLine:endCol" for accurate mapping
  useEffect(() => {
    if (!previewRef.current || viewMode === "editor") return;
    const preview = previewRef.current;

    // Parse sourcepos attribute → { startLine, endLine }
    const getSourcePos = (el: HTMLElement): { startLine: number; endLine: number } | null => {
      const sp = el.getAttribute("data-sourcepos") || el.closest("[data-sourcepos]")?.getAttribute("data-sourcepos");
      if (!sp) return null;
      const match = sp.match(/^(\d+):\d+-(\d+):\d+$/);
      if (!match) return null;
      return { startLine: parseInt(match[1]) - 1, endLine: parseInt(match[2]) - 1 }; // 0-indexed
    };

    // Account for frontmatter offset — use ref for fresh data in async handlers
    const lines = markdownRef.current.split("\n");
    let frontmatterOffset = 0;
    if (lines[0]?.trim() === "---") {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === "---") {
          frontmatterOffset = i + 1;
          // Skip blank lines after frontmatter
          while (frontmatterOffset < lines.length && !lines[frontmatterOffset]?.trim()) {
            frontmatterOffset++;
          }
          break;
        }
      }
    }

    // Click in preview → scroll + highlight corresponding block in source
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button,a,input")) return;

      const sourceEl = target.closest("[data-sourcepos]") as HTMLElement | null;
      if (!sourceEl) return;
      const pos = getSourcePos(sourceEl);
      if (!pos) return;
      const actualStart = pos.startLine + frontmatterOffset;
      const actualEnd = pos.endLine + frontmatterOffset;
      const freshLines = markdownRef.current.split("\n");
      let startChar = 0;
      for (let i = 0; i < actualStart && i < freshLines.length; i++) {
        startChar += freshLines[i].length + 1;
      }
      let endChar = startChar;
      for (let i = actualStart; i <= actualEnd && i < freshLines.length; i++) {
        endChar += freshLines[i].length + 1;
      }
      cmScrollToLine(actualStart);
      cmSetSelection(startChar, endChar);
    };

    // contentEditable on the article handles Word-like editing natively.
    // Double-click only for special elements (code blocks, mermaid, math).

    // Double-click → code block modal / special elements
    const handleDblClick = (e: Event) => {
      const target = e.target as HTMLElement;
      // Only handle double-click on non-editable islands (code, table, mermaid, math)
      const nonEditable = target.closest("[contenteditable=false]");
      if (!nonEditable) return; // inside editable content — let native dblclick work
      // Skip table cells — handled by handleTableDblClick
      if (target.closest("td,th,table")) return;
      // Skip mermaid, math — handled separately
      if (target.closest(".mermaid-container,.math-rendered")) return;

      // Code block → mini editor modal
      const preEl = target.closest("pre") as HTMLElement | null;
      if (preEl) {
        const codeEl = preEl.querySelector("code");
        if (!codeEl) return;
        const pos = getSourcePos(preEl);
        if (!pos) return;

        e.preventDefault();
        e.stopPropagation();

        const actualStart = pos.startLine + frontmatterOffset;
        const actualEnd = pos.endLine + frontmatterOffset;
        const mdLines = markdownRef.current.split("\n");

        // Extract the code block content (lines between ``` fences)
        const originalCode = mdLines.slice(actualStart + 1, actualEnd).join("\n");
        const langLine = mdLines[actualStart] || "";

        // Create modal overlay
        const overlay = document.createElement("div");
        overlay.style.cssText = `
          position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.6);
          display:flex;align-items:center;justify-content:center;
        `;

        const modal = document.createElement("div");
        modal.style.cssText = `
          background:var(--surface);border:1px solid var(--border);border-radius:12px;
          padding:16px;width:90%;max-width:640px;max-height:80vh;display:flex;flex-direction:column;gap:12px;
          box-shadow:0 20px 60px rgba(0,0,0,0.5);
        `;

        const currentLang = langLine.replace(/```/, "").trim();

        const header = document.createElement("div");
        header.style.cssText = `display:flex;justify-content:space-between;align-items:center;`;
        header.innerHTML = `
          <div style="display:flex;align-items:center;gap:0;">
            <input id="code-lang" type="text" value="${currentLang}" placeholder="language"
              style="width:110px;padding:4px 10px;font-size:13px;font-family:var(--font-mono);font-weight:600;
              background:var(--border);color:var(--text-primary);border:1px solid transparent;
              border-radius:6px;outline:none;text-transform:uppercase;letter-spacing:0.5px;" />
          </div>
          <div style="display:flex;gap:6px;">
            <button id="code-save" style="padding:4px 12px;font-size:11px;background:var(--text-primary);color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Save</button>
            <button id="code-cancel" style="padding:4px 12px;font-size:11px;background:var(--toggle-bg);color:var(--text-muted);border:none;border-radius:6px;cursor:pointer;">Cancel</button>
          </div>
        `;

        const editorContainer = document.createElement("div");
        editorContainer.style.cssText = `
          flex:1;min-height:200px;background:var(--background);
          border:1px solid var(--border);border-radius:8px;overflow:hidden;
        `;

        modal.appendChild(header);
        modal.appendChild(editorContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Initialize CodeMirror 6 with syntax highlighting
        let codeValue = originalCode;
        (async () => {
          try {
            const { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } = await import("@codemirror/view");
            const { EditorState } = await import("@codemirror/state");
            const { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } = await import("@codemirror/language");
            const { defaultKeymap, history, historyKeymap, indentWithTab } = await import("@codemirror/commands");
            const { closeBrackets, closeBracketsKeymap } = await import("@codemirror/autocomplete");
            const { searchKeymap } = await import("@codemirror/search");

            // Try to load language support
            const langExts: import("@codemirror/state").Extension[] = [];
            if (currentLang) {
              try {
                const { languages } = await import("@codemirror/language-data");
                const langDesc = languages.find(l =>
                  l.name.toLowerCase() === currentLang.toLowerCase() ||
                  l.alias.some(a => a.toLowerCase() === currentLang.toLowerCase()) ||
                  l.extensions.some(e => e === `.${currentLang.toLowerCase()}`)
                );
                if (langDesc) {
                  const langSupport = await langDesc.load();
                  langExts.push(langSupport);
                }
              } catch { /* no language support */ }
            }

            const cmView = new EditorView({
              state: EditorState.create({
                doc: originalCode,
                extensions: [
                  lineNumbers(),
                  highlightActiveLineGutter(),
                  highlightSpecialChars(),
                  history(),
                  drawSelection(),
                  indentOnInput(),
                  bracketMatching(),
                  closeBrackets(),
                  highlightActiveLine(),
                  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                  ...langExts,
                  keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap,
                    ...searchKeymap,
                    ...historyKeymap,
                    indentWithTab,
                    { key: "Mod-Enter", run: () => { save(); return true; } },
                    { key: "Escape", run: () => { cancel(); return true; } },
                  ]),
                  EditorView.theme({
                    "&": { fontSize: "13px", height: "100%" },
                    ".cm-scroller": { fontFamily: "var(--font-mono)", overflow: "auto" },
                    ".cm-gutters": { background: "var(--background)", borderRight: "1px solid var(--border-dim)", color: "var(--text-faint)" },
                    ".cm-activeLineGutter": { background: "var(--border)" },
                    ".cm-activeLine": { background: "rgba(255,255,255,0.03)" },
                    ".cm-content": { caretColor: "var(--text-primary)" },
                    ".cm-cursor": { borderLeftColor: "var(--text-primary)" },
                    ".cm-selectionBackground": { background: "rgba(251,146,60,0.2) !important" },
                  }),
                  EditorView.updateListener.of(update => {
                    if (update.docChanged) codeValue = update.state.doc.toString();
                  }),
                ],
              }),
              parent: editorContainer,
            });
            cmView.focus();
          } catch {
            // Fallback to textarea if CM6 fails to load
            const textarea = document.createElement("textarea");
            textarea.value = originalCode;
            textarea.style.cssText = `width:100%;min-height:200px;background:var(--background);color:var(--editor-text);border:none;padding:12px;font-family:var(--font-mono);font-size:13px;line-height:1.6;resize:vertical;outline:none;`;
            textarea.spellcheck = false;
            editorContainer.appendChild(textarea);
            textarea.focus();
            textarea.addEventListener("input", () => { codeValue = textarea.value; });
          }
        })();

        const save = () => {
          const newCode = codeValue;
          const newLang = (header.querySelector("#code-lang") as HTMLInputElement)?.value?.trim() || "";
          const codeChanged = newCode !== originalCode;
          const langChanged = newLang !== currentLang;

          if (codeChanged || langChanged) {
            const newLines = [...mdLines];
            // Update language on the opening fence line
            if (langChanged) {
              newLines[actualStart] = "```" + newLang;
            }
            // Update code content
            newLines.splice(actualStart + 1, actualEnd - actualStart - 1, newCode);
            const newMd = newLines.join("\n");
            setMarkdown(newMd);
            doRender(newMd);
            cmSetDocRef.current?.(newMd);
          }
          document.body.removeChild(overlay);
        };

        const cancel = () => {
          document.body.removeChild(overlay);
        };

        header.querySelector("#code-save")!.addEventListener("click", save);
        header.querySelector("#code-cancel")!.addEventListener("click", cancel);
        overlay.addEventListener("click", (ev) => {
          if (ev.target === overlay) cancel();
        });
        // Keyboard shortcuts (Escape/Cmd+S) handled by CM6 keymap; overlay-level Escape fallback
        overlay.addEventListener("keydown", (ke) => {
          if (ke.key === "Escape") cancel();
        });

        return;
      }

      // Text editing is now handled by single-click (handleClick → handleEditClick)
    };

    // Image click → lightbox
    const handleImgClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      // Skip images in code blocks
      if (target.closest("pre, code")) return;
      const img = target as HTMLImageElement;
      if (!img.src) return;
      e.preventDefault(); e.stopPropagation();
      // Close existing lightbox if any
      document.querySelector(".mdcore-lightbox")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "mdcore-lightbox";
      const fullImg = document.createElement("img");
      fullImg.src = img.src;
      fullImg.alt = img.alt || "";
      overlay.appendChild(fullImg);
      const closeLightbox = () => { overlay.remove(); document.removeEventListener("keydown", esc); };
      const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") closeLightbox(); };
      overlay.addEventListener("click", closeLightbox);
      document.addEventListener("keydown", esc);
      document.body.appendChild(overlay);
    };

    // Image right-click → context menu (alignment, size, alt text)
    const handleImgContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      e.preventDefault(); e.stopPropagation();
      const img = target as HTMLImageElement;
      // Remove any existing menu
      document.querySelector(".mdcore-img-menu")?.remove();
      const menu = document.createElement("div");
      menu.className = "mdcore-img-menu";
      menu.style.position = "fixed";
      const menuW = 170, menuH = 300;
      menu.style.left = `${Math.min(e.clientX, window.innerWidth - menuW)}px`;
      menu.style.top = `${Math.min(e.clientY, window.innerHeight - menuH)}px`;

      const findImgInMd = () => {
        const md = markdownRef.current;
        const src = img.src;
        // Match ![...](url) where url matches
        const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`!\\[([^\\]]*)\\]\\(${escaped}\\)`);
        const match = md.match(regex);
        if (match) return { full: match[0], alt: match[1], index: match.index! };
        // Try matching by filename
        const filename = src.split("/").pop()?.split("?")[0] || "";
        if (filename) {
          // Use indexOf to avoid ReDoS from overlapping [^)]* quantifiers
          let searchStart = 0;
          while (searchStart < md.length) {
            const fnIdx = md.indexOf(filename, searchStart);
            if (fnIdx === -1) break;
            // Walk backwards to find ![
            const bangBracket = md.lastIndexOf("![", fnIdx);
            if (bangBracket === -1 || bangBracket < searchStart) { searchStart = fnIdx + 1; continue; }
            // Find ]( between ![ and filename
            const closeBracketParen = md.indexOf("](", bangBracket);
            if (closeBracketParen === -1 || closeBracketParen >= fnIdx) { searchStart = fnIdx + 1; continue; }
            // Find closing ) after filename
            const closeParen = md.indexOf(")", fnIdx + filename.length);
            if (closeParen === -1) { searchStart = fnIdx + 1; continue; }
            // Verify no newlines in the URL part and no ) before filename
            const urlPart = md.substring(closeBracketParen + 2, closeParen);
            if (!urlPart.includes("\n") && !urlPart.includes(")")) {
              const full = md.substring(bangBracket, closeParen + 1);
              const altMatch = full.match(/^!\[([^\]]*)\]/);
              if (altMatch) {
                return { full, alt: altMatch[1], index: bangBracket };
              }
            }
            searchStart = fnIdx + 1;
          }
        }
        return null;
      };

      const replaceAlt = (newAlt: string) => {
        const found = findImgInMd();
        if (!found) return;
        const newMd = markdownRef.current.slice(0, found.index) + found.full.replace(`![${found.alt}]`, `![${newAlt}]`) + markdownRef.current.slice(found.index + found.full.length);
        setMarkdown(newMd);
        cmSetDoc(newMd);
        doRender(newMd);
      };

      const items: { label: string; icon: string; action: () => void; separator?: boolean }[] = [
        { label: "Align left", icon: "≡", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["center","left","right"].includes(p.trim().toLowerCase())); parts.push("left"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "Align center", icon: "≡", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["center","left","right"].includes(p.trim().toLowerCase())); parts.push("center"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "Align right", icon: "≡", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["center","left","right"].includes(p.trim().toLowerCase())); parts.push("right"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "", icon: "", action: () => {}, separator: true },
        { label: "Small (25%)", icon: "◻", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["small","medium","large"].includes(p.trim().toLowerCase()) && !/^\d+%$/.test(p.trim())); parts.push("small"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "Medium (50%)", icon: "◻", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["small","medium","large"].includes(p.trim().toLowerCase()) && !/^\d+%$/.test(p.trim())); parts.push("medium"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "Large (75%)", icon: "◻", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["small","medium","large"].includes(p.trim().toLowerCase()) && !/^\d+%$/.test(p.trim())); parts.push("large"); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "Full width", icon: "◻", action: () => { const f = findImgInMd(); if (f) { const parts = f.alt.split("|").filter(p => !["small","medium","large"].includes(p.trim().toLowerCase()) && !/^\d+%$/.test(p.trim())); replaceAlt(parts.join("|")); } menu.remove(); } },
        { label: "", icon: "", action: () => {}, separator: true },
        { label: "Edit caption", icon: "✎", action: () => {
          menu.remove();
          const found = findImgInMd();
          if (!found) return;
          const cleanAlt = found.alt.split("|")[0].trim();
          setInlineInput({
            label: "Image caption / alt text",
            defaultValue: cleanAlt,
            onSubmit: (newCaption) => {
              const markers = found.alt.split("|").slice(1).join("|");
              replaceAlt(markers ? `${newCaption}|${markers}` : newCaption);
              setInlineInput(null);
            },
          });
        }},
        { label: "Delete image", icon: "✕", action: () => {
          menu.remove();
          const found = findImgInMd();
          if (!found) return;
          const newMd = markdownRef.current.slice(0, found.index) + markdownRef.current.slice(found.index + found.full.length).replace(/^\n{1,2}/, "\n");
          setMarkdown(newMd);
          cmSetDoc(newMd);
          doRender(newMd);
        }},
      ];

      items.forEach(item => {
        if (item.separator) {
          const sep = document.createElement("div");
          sep.style.cssText = "height:1px;margin:3px 6px;background:var(--border-dim)";
          menu.appendChild(sep);
        } else {
          const btn = document.createElement("button");
          btn.textContent = `${item.icon}  ${item.label}`;
          btn.addEventListener("click", item.action);
          menu.appendChild(btn);
        }
      });

      document.body.appendChild(menu);
      const dismiss = (ev: MouseEvent) => { if (!menu.contains(ev.target as Node)) { menu.remove(); document.removeEventListener("click", dismiss); document.removeEventListener("keydown", escDismiss); } };
      const escDismiss = (ev: KeyboardEvent) => { if (ev.key === "Escape") { menu.remove(); document.removeEventListener("click", dismiss); document.removeEventListener("keydown", escDismiss); } };
      requestAnimationFrame(() => { document.addEventListener("click", dismiss); document.addEventListener("keydown", escDismiss); });
    };

    preview.addEventListener("click", handleClick);
    preview.addEventListener("click", handleImgClick);
    preview.addEventListener("contextmenu", handleImgContext);
    preview.addEventListener("dblclick", handleDblClick);
    return () => {
      preview.removeEventListener("click", handleClick);
      preview.removeEventListener("click", handleImgClick);
      preview.removeEventListener("contextmenu", handleImgContext);
      preview.removeEventListener("dblclick", handleDblClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, markdown, doRender]);

  // Mermaid edit button click handler (re-attach on html/viewMode change)
  useEffect(() => {
    if (!previewRef.current) return;
    const handler = (e: Event) => {
      const btn = (e.target as HTMLElement).closest(".mermaid-edit-btn") as HTMLElement | null;
      if (!btn) return;
      const encoded = btn.getAttribute("data-mermaid-src");
      if (encoded) {
        try {
          const code = decodeURIComponent(atob(encoded));
          setCanvasMermaid(code);
          setShowMermaidModal(true);
        } catch {
          // fallback
        }
      }
    };
    previewRef.current.addEventListener("click", handler);
    const ref = previewRef.current;
    return () => ref.removeEventListener("click", handler);
  }, [html, viewMode]);


  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setConfirmRotateToken(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
      setShowEditModeMenu(false);
    };
    if (showMenu || showExportMenu || showEditModeMenu || showNewMenu) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [showMenu, showExportMenu, showEditModeMenu, showNewMenu]);

  // Guard to skip cmSetDoc when the change originated from CM6 itself
  const cmUpdateRef = useRef(false);

  // Debounced render — called when CM6 content changes
  const handleChange = useCallback(
    (value: string) => {
      cmUpdateRef.current = true;
      setMarkdown(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Increase debounce for large documents to avoid lag
      const len = value.length;
      const debounceTime = len > 200000 ? 1000 : len > 100000 ? 750 : len > 50000 ? 500 : len > 20000 ? 300 : 150;
      debounceRef.current = setTimeout(() => {
        doRender(value);
        // Sync to Tiptap only in split view when user types in CM6
        if (viewMode === "split") {
          tiptapRef.current?.setMarkdown(value);
        }
      }, debounceTime);
    },
    [doRender, setMarkdown]
  );
  // Keep CM6 onChange ref in sync
  handleChangeRef.current = handleChange;

  // Sync external markdown changes (undo/redo, tab switch, inline edit) → CM6
  useEffect(() => {
    if (cmUpdateRef.current) {
      cmUpdateRef.current = false;
      return;
    }
    cmSetDoc(markdown);
  }, [markdown, cmSetDoc]);

  // ── Tiptap LIVE editor onChange handler ──
  // Must update React state too — otherwise line ~3904 (markdownRef.current = markdown)
  // overwrites the ref on the next render, erasing typed content before save/tab switch.
  const handleTiptapChange = useCallback((md: string) => {
    // Drop onUpdate events that fire during a tab switch — Tiptap may still be
    // holding the previous tab's content, and saving it now would PATCH the
    // newly-active tab's cloudId with the wrong document.
    if (tabSwitchInFlightRef.current) return;
    markdownRef.current = md;
    setMarkdownRaw(md);
    triggerAutoSave(md);
    // Broadcast to Yjs peers. Live-tab edits used to skip this
    // (setMarkdownRaw vs setMarkdown), so Tiptap edits never reached
    // remote collaborators — they only saw whatever finally landed on
    // the server via auto-save, with no streaming sync. Fixed by
    // calling collabApplyLocal directly here so Yjs propagates the
    // diff to the doc-channel.
    collabApplyLocalRef.current?.(md);
    // Sync derived title (H1) into header + sidebar tab list
    const derived = extractTitleFromMd(md);
    if (derived) {
      setTitle((prev) => (prev === derived ? prev : derived));
      setTabs((prev) => {
        const id = activeTabIdRef.current;
        let changed = false;
        const next = prev.map((t) => {
          if (t.id === id && !t.readonly && t.title !== derived) {
            changed = true;
            return { ...t, title: derived };
          }
          return t;
        });
        return changed ? next : prev;
      });
    }
  }, [triggerAutoSave]);

  // Legacy refs kept for compatibility with non-Tiptap code paths
  const wysiwygEditingRef = useRef(false);
  const wysiwygDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Legacy WYSIWYG handlers removed — Tiptap handles all editing ──
  // handleWysiwygPaste, handleWysiwygInput, handleWysiwygKeyDown,
  // saveInsertPosition, insertBlockAtCursor, ce-spacer, FloatingToolbar
  // are all replaced by TiptapLiveEditor component.
  // See: src/components/TiptapLiveEditor.tsx

  // Kept: handleDrop (file import) uses saveInsertPosition — rewritten below
  // Kept: handleInsertTable, handleInsertBlock — rewritten for Tiptap

  void wysiwygEditingRef; void wysiwygDebounce; // suppress unused warnings

  // Handle paste in Preview — LEGACY (kept for reference, not used)
  const _handleWysiwygPaste = useCallback((e: React.ClipboardEvent) => {
    // Helper: after paste processing via saveInsertPosition → insertBlockAtCursor,
    // the marker DOM mutation triggers handleWysiwygInput which sets wysiwygEditingRef=true
    // and starts a debounce. We must clear both so that:
    // 1. doRender's HTML can actually be applied to the article DOM (the ref callback
    //    checks wysiwygEditingRef and skips innerHTML update if true)
    // 2. The debounced handleWysiwygInput doesn't reconvert the OLD DOM back to markdown,
    //    overwriting our correctly computed new markdown
    const cleanupAfterPaste = () => {
      if (wysiwygDebounce.current) {
        clearTimeout(wysiwygDebounce.current);
        wysiwygDebounce.current = undefined;
      }
      wysiwygEditingRef.current = false;
      // Suppress handleWysiwygInput for 300ms — doRender's innerHTML update
      // triggers onInput which would reconvert old DOM to markdown
      suppressInputRef.current = true;
      setTimeout(() => { suppressInputRef.current = false; }, 300);
    };

    // Check for pasted images (handle multiple)
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith("image/"));
    if (imageItems.length > 0) {
      e.preventDefault();
      // Save cursor position BEFORE async upload so we insert at the right place
      saveInsertPosition();
      cleanupAfterPaste();
      (async () => {
        const originTabId = activeTabIdRef.current;
        for (const imageItem of imageItems) {
          const file = imageItem.getAsFile();
          if (!file) continue;
          const ts = Date.now();
          const placeholder = `![Uploading ${file.name || "image"}-${ts}...]()\n`;
          // Insert placeholder at cursor position
          const withPh = insertBlockAtCursor(placeholder);
          setMarkdown(withPh); doRender(withPh); cmSetDoc(withPh);
          const url = await uploadImage(file);
          const imgMd = url ? `![${file.name || "image"}](${url})\n` : "";
          if (activeTabIdRef.current === originTabId) {
            // Still on the same tab — replace placeholder in current markdown
            const current = markdownForImageRef.current;
            const updated = current.replace(placeholder, imgMd);
            markdownForImageRef.current = updated;
            setMarkdown(updated); doRender(updated); cmSetDoc(updated);
          } else {
            // Tab changed — update the original tab's markdown via setTabs
            setTabs(prev => prev.map(t => {
              if (t.id !== originTabId) return t;
              const updated = (t.markdown || "").replace(placeholder, imgMd);
              return { ...t, markdown: updated };
            }));
          }
        }
      })();
      return;
    }

    const text = e.clipboardData.getData("text/plain");
    const html = e.clipboardData.getData("text/html");

    // Check for CLI output first — convert and insert into source + re-render
    if (text && isCliOutput(text)) {
      e.preventDefault();
      const converted = cliToMarkdown(text);
      saveInsertPosition();
      const newMd = insertBlockAtCursor(converted);
      cleanupAfterPaste();
      setMarkdown(newMd);
      doRender(newMd);
      cmSetDoc(newMd);
      return;
    }

    // Check for HTML paste — convert to markdown, insert into source + re-render
    if (html && isHtmlContent(html)) {
      e.preventDefault();
      const md = htmlToMarkdown(html);
      saveInsertPosition();
      const newMd = insertBlockAtCursor(md);
      cleanupAfterPaste();
      setMarkdown(newMd);
      doRender(newMd);
      cmSetDoc(newMd);
      return;
    }

    // For multi-line text paste or text with markdown patterns,
    // insert into markdown source and re-render (prevents raw markdown showing in LIVE view)
    if (text && (text.includes("\n") || /^#{1,6}\s|^\*\*|^```|^- \[|^\d+\.\s|^>\s|^\|.*\||^[-*] /m.test(text))) {
      e.preventDefault();
      saveInsertPosition();
      const newMd = insertBlockAtCursor(text);
      cleanupAfterPaste();
      setMarkdown(newMd);
      doRender(newMd);
      cmSetDoc(newMd);
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- saveInsertPosition/insertBlockAtCursor are stable refs defined later
  }, [setMarkdown, cmSetDoc, doRender, uploadImage]);

  // Helper: clear wysiwygInput debounce + editing flag so doRender can update article DOM
  const cleanupWysiwygState = useCallback(() => {
    if (wysiwygDebounce.current) {
      clearTimeout(wysiwygDebounce.current);
      wysiwygDebounce.current = undefined;
    }
    wysiwygEditingRef.current = false;
    suppressInputRef.current = true;
    setTimeout(() => { suppressInputRef.current = false; }, 300);
  }, []);

  // Helper: find the outermost trapping block (blockquote, ul, ol, pre, table) from cursor
  const findTrappingBlock = useCallback((article: Element): HTMLElement | null => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    let trappingBlock: HTMLElement | null = null;
    while (node && node !== article) {
      const tag = (node as HTMLElement).tagName?.toLowerCase();
      if (tag && ["blockquote", "ul", "ol", "pre", "table"].includes(tag)) {
        trappingBlock = node as HTMLElement;
      }
      node = (node as HTMLElement).parentElement;
    }
    return trappingBlock;
  }, []);

  // Helper: escape a trapping block via markdown manipulation
  const escapeTrappingBlock = useCallback((trappingBlock: HTMLElement) => {
    const md = markdownRef.current;
    const lines = md.split("\n");

    // Try sourcepos first (works for comrak-rendered blocks)
    const sourcepos = trappingBlock.getAttribute("data-sourcepos");
    const spMatch = sourcepos?.match(/^(\d+):\d+-(\d+):\d+$/);

    let insertAfterLine: number; // 0-indexed line in md to insert after

    if (spMatch) {
      const endLine = parseInt(spMatch[2]); // 1-indexed
      let fmOffset = 0;
      if (lines[0]?.trim() === "---") {
        for (let i = 1; i < lines.length; i++) {
          if (lines[i]?.trim() === "---") { fmOffset = i + 1; break; }
        }
      }
      insertAfterLine = endLine - 1 + fmOffset;
    } else {
      // No sourcepos (browser-created element after user editing).
      // First sync the DOM back to markdown so we have current state.
      const article = previewRef.current?.querySelector("article");
      if (article) {
        const clone = article.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".code-copy-btn, .code-header, .code-lang-label, .mermaid-edit-btn, .mermaid-toolbar, .ascii-render-btn, .ascii-toggle-btn, .ce-spacer, .ce-escape-hint").forEach(n => n.remove());
        clone.querySelectorAll(".table-wrapper").forEach(wrapper => {
          const table = wrapper.querySelector("table");
          if (table) wrapper.replaceWith(table);
        });
        const freshMd = htmlToMarkdown(clone.innerHTML);
        // Find the last line of blockquote/list content in the fresh markdown
        const freshLines = freshMd.split("\n");
        const tag = trappingBlock.tagName.toLowerCase();
        insertAfterLine = freshLines.length - 1;
        // Find the end of the trapping block's content
        for (let i = freshLines.length - 1; i >= 0; i--) {
          if (tag === "blockquote" && /^>\s?/.test(freshLines[i])) { insertAfterLine = i; break; }
          if ((tag === "ul" || tag === "ol") && /^\s*[-*+\d]/.test(freshLines[i])) { insertAfterLine = i; break; }
          if (freshLines[i].trim()) { insertAfterLine = i; break; }
        }
        // Use the fresh markdown as the base
        const before = freshLines.slice(0, insertAfterLine + 1);
        const after = freshLines.slice(insertAfterLine + 1);
        const newMd = [...before, "", ""].concat(after).join("\n");

        cleanupWysiwygState();
        setMarkdown(newMd);
        doRender(newMd);
        cmSetDoc(newMd);

        setTimeout(() => {
          const art = previewRef.current?.querySelector("article");
          if (!art) return;
          const all = Array.from(art.children);
          for (let i = all.length - 1; i >= 0; i--) {
            if (all[i].getAttribute("contenteditable") !== "false") {
              const range = document.createRange();
              range.selectNodeContents(all[i]);
              range.collapse(true);
              const s = window.getSelection();
              s?.removeAllRanges();
              s?.addRange(range);
              break;
            }
          }
        }, 150);
        return;
      }
      insertAfterLine = lines.length - 1;
    }

    // Insert empty line after the block
    const before = lines.slice(0, insertAfterLine + 1);
    const after = lines.slice(insertAfterLine + 1);
    const newMd = [...before, "", ""].concat(after).join("\n");

    cleanupWysiwygState();
    setMarkdown(newMd);
    doRender(newMd);
    cmSetDoc(newMd);

    // Place cursor at the new empty paragraph after DOM update
    setTimeout(() => {
      const art = previewRef.current?.querySelector("article");
      if (!art) return;
      let target: Element | null = null;
      for (const child of art.children) {
        const sp = child.getAttribute("data-sourcepos");
        if (!sp) continue;
        const sl = parseInt(sp.split(":")[0]);
        if (sl > insertAfterLine + 1) { target = child; break; }
      }
      if (!target) {
        const all = Array.from(art.children);
        for (let i = all.length - 1; i >= 0; i--) {
          if (all[i].getAttribute("contenteditable") !== "false") { target = all[i]; break; }
        }
      }
      if (target && target.getAttribute("contenteditable") !== "false") {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(true);
        const s = window.getSelection();
        s?.removeAllRanges();
        s?.addRange(range);
        (target as HTMLElement).scrollIntoView?.({ block: "nearest" });
      }
    }, 150);
  }, [setMarkdown, doRender, cmSetDoc, cleanupWysiwygState]);

  // Keyboard handler for LIVE view contentEditable
  const _handleWysiwygKeyDown = useCallback((e: React.KeyboardEvent) => {
    const article = previewRef.current?.querySelector("article");
    if (!article) return;

    // ── Cmd+Enter: escape from trapping block ──
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      const trappingBlock = findTrappingBlock(article);
      if (!trappingBlock) return;
      e.preventDefault();
      escapeTrappingBlock(trappingBlock);
      return;
    }

    // ── Plain Enter inside blockquote: prevent browser from splitting into separate blockquotes ──
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      let node: Node | null = sel.getRangeAt(0).startContainer;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      let inBlockquote = false;
      while (node && node !== article) {
        if ((node as HTMLElement).tagName?.toLowerCase() === "blockquote") {
          inBlockquote = true;
          break;
        }
        node = (node as HTMLElement).parentElement;
      }
      if (inBlockquote) {
        // Insert <br> instead of letting the browser split the blockquote
        e.preventDefault();
        document.execCommand("insertLineBreak", false);
      }
    }
  }, [findTrappingBlock, escapeTrappingBlock]);

  const _handleWysiwygInput = useCallback(() => {
    // Skip if suppressed (after paste/programmatic changes — prevents stale DOM reconversion)
    if (suppressInputRef.current) return;
    wysiwygEditingRef.current = true;
    if (wysiwygDebounce.current) clearTimeout(wysiwygDebounce.current);
    wysiwygDebounce.current = setTimeout(() => {
      const article = previewRef.current?.querySelector("article");
      if (!article) return;

      // Helper: strip UI elements from a cloned element
      const stripUiElements = (el: HTMLElement) => {
        el.querySelectorAll(".code-copy-btn, .code-header, .code-lang-label, .mermaid-edit-btn, .mermaid-toolbar, .ascii-render-btn, .ascii-toggle-btn, .ce-spacer").forEach(n => n.remove());
        el.querySelectorAll(".table-wrapper").forEach(wrapper => {
          const table = wrapper.querySelector("table");
          if (table) wrapper.replaceWith(table);
        });
      };

      // Helper: compute frontmatter line offset
      const computeFrontmatterOffset = (md: string): number => {
        const lines = md.split("\n");
        if (lines[0]?.trim() !== "---") return 0;
        for (let i = 1; i < lines.length; i++) {
          if (lines[i]?.trim() === "---") return i + 1;
        }
        return 0;
      };

      // --- Partial update strategy using data-sourcepos ---
      // Instead of converting the entire document on every keystroke,
      // find the specific edited block and convert only that block.
      // This preserves unedited markdown constructs perfectly.
      let didPartialUpdate = false;
      try {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          // Walk from cursor to nearest ancestor with data-sourcepos
          let node: Node | null = sel.getRangeAt(0).startContainer;
          if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
          let editedBlock: HTMLElement | null = null;
          while (node && node !== article) {
            if ((node as HTMLElement).getAttribute?.("data-sourcepos")) {
              editedBlock = node as HTMLElement;
              break;
            }
            node = (node as HTMLElement).parentElement;
          }

          if (editedBlock) {
            const sourcepos = editedBlock.getAttribute("data-sourcepos");
            const spMatch = sourcepos?.match(/^(\d+):\d+-(\d+):\d+$/);
            if (spMatch) {
              const startLine = parseInt(spMatch[1]) - 1; // 0-indexed
              const endLine = parseInt(spMatch[2]) - 1;

              const md = markdownRef.current;
              const lines = md.split("\n");
              const fmOffset = computeFrontmatterOffset(md);
              const actualStart = startLine + fmOffset;
              const actualEnd = endLine + fmOffset;

              // Sanity check: sourcepos must reference valid lines
              if (actualStart >= 0 && actualEnd < lines.length && actualStart <= actualEnd) {
                // Clone and strip UI from just the edited block
                const clone = editedBlock.cloneNode(true) as HTMLElement;
                stripUiElements(clone);

                // Convert only this block to markdown
                const blockMd = htmlToMarkdown(clone.outerHTML).trim();

                // Replace only the corresponding lines in the original markdown
                const before = lines.slice(0, actualStart);
                const after = lines.slice(actualEnd + 1);
                const newMd = [...before, blockMd, ...after].join("\n");

                // Validate: the partial update should produce reasonable output
                // If the new markdown is drastically shorter, something went wrong
                if (newMd.length > md.length * 0.8 || md.length < 20) {
                  setMarkdown(newMd);
                  cmSetDoc(newMd);
                  didPartialUpdate = true;

                  // Sync title from edited markdown to sidebar
                  const h1Match = newMd.match(/^#\s+(.+)/m);
                  if (h1Match) {
                    const newTitle = h1Match[1].trim();
                    setTitle(newTitle);
                    const curTabId = activeTabIdRef.current;
                    setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, title: newTitle } : t));
                  }
                }
              }
            }
          }
        }
      } catch {
        // Any error in partial update path — fall through to full conversion
      }

      // --- Fallback: full document conversion ---
      // Used when: no cursor/selection, no data-sourcepos found, block was deleted,
      // blocks were merged/split, or partial update validation failed.
      if (!didPartialUpdate) {
        const clone = article.cloneNode(true) as HTMLElement;
        stripUiElements(clone);
        const newMd = htmlToMarkdown(clone.innerHTML);
        setMarkdown(newMd);
        cmSetDoc(newMd);

        // Sync title from edited markdown to sidebar
        const h1Match = newMd.match(/^#\s+(.+)/m);
        if (h1Match) {
          const newTitle = h1Match[1].trim();
          setTitle(newTitle);
          const curTabId = activeTabIdRef.current;
          setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, title: newTitle } : t));
        }
      }

      // Keep wysiwygEditingRef true long enough for the re-render cycle to complete
      setTimeout(() => {
        wysiwygEditingRef.current = false;
      }, 500);

      // Re-process math elements that may have been damaged by contentEditable
      // This is targeted — only restores broken math, doesn't replace entire DOM
      requestAnimationFrame(() => {
        const article = previewRef.current?.querySelector("article");
        if (!article) return;
        // Find any raw math spans that lost their KaTeX rendering
        article.querySelectorAll("[data-math-style]").forEach((el) => {
          const tex = el.textContent || "";
          const mode = el.getAttribute("data-math-style");
          if (!tex || el.querySelector(".katex")) return; // already rendered
          try {
            const rendered = katex.renderToString(tex.trim(), {
              displayMode: mode === "display",
              throwOnError: false,
              strict: false,
            });
            const wrapper = document.createElement(mode === "display" ? "div" : "span");
            wrapper.className = "math-rendered";
            wrapper.setAttribute("data-math-src", encodeURIComponent(tex.trim()));
            wrapper.setAttribute("data-math-mode", mode || "inline");
            wrapper.setAttribute("contenteditable", "false");
            wrapper.style.cursor = "pointer";
            wrapper.innerHTML = rendered;
            el.replaceWith(wrapper);
          } catch { /* ignore */ }
        });
      });
    // Increase debounce for large documents to avoid lag
    }, markdownRef.current.length > 50000 ? 500 : 150);
  }, [setMarkdown, cmSetDoc]);

  // Shared file-import pipeline used by drag-drop, the hidden
  // <input type=file>, and the ImportModal's Files card.
  //
  // The modal used to forward picked files into the parent's hidden
  // input via DataTransfer + dispatchEvent('change'). React's event
  // delegation didn't pick that up reliably (synthetic events from
  // programmatic native dispatches drop the React fiber link on file
  // inputs sometimes — the change handler never fired). Result: the
  // "Files" card in the modal looked broken because nothing happened
  // after the picker closed. Routing every entry path through a single
  // callback removes the cross-input plumbing entirely and gives us a
  // place to add the URL-push + sidebar-refresh in one spot.
  const runFileImport = useCallback(async (files: File[]) => {
    for (const file of files) {
      const isPdf = /\.pdf$/i.test(file.name);
      const isOffice = /\.(pptx?|xlsx?|od[pst]|rtf)$/i.test(file.name);
      try {
        if (isPdf) showToast(`Reading PDF: ${file.name}…`, "info");
        else if (isOffice) showToast(`Parsing ${file.name}…`, "info");
        else if (file.size > 200_000) showToast(`Reading ${file.name}…`, "info");

        const { markdown: md, title: name } = await importFile(file, authHeadersRef.current);
        if (!md) {
          showToast(`${file.name} appears to be empty`, "info");
          continue;
        }
        const isPlainFormat = /\.(pdf|rtf|txt|csv|json|xml|pptx?|xlsx?|od[pst])$/i.test(file.name);
        const tabId = `tab-${tabIdCounter++}`;
        setTabs((prev) => [...prev, { id: tabId, title: name, markdown: md, isDraft: true, permission: "mine" }]);
        setTimeout(() => switchTab(tabId), 50);
        if (isPlainFormat && md.length > 50) {
          setMdfyPrompt({ text: md, filename: file.name, tabId });
        }
        showToast(`Saving ${name}…`, "info");
        const anonId = user?.id ? undefined : ensureAnonymousId();
        autoSave.createDocument({
          markdown: md,
          title: name,
          userId: user?.id,
          anonymousId: anonId,
        }).then((result) => {
          if (!result) return;
          // Catch-up save: the user may have hit Structure / Format
          // while the create POST was in flight. Push the latest body.
          let latestMarkdown = md;
          let latestTitle = name;
          setTabs((prev) => {
            const withoutDup = prev.filter((t) => !(t.cloudId === result.id && t.id !== tabId));
            return withoutDup.map((t) => {
              if (t.id !== tabId) return t;
              latestMarkdown = t.markdown;
              latestTitle = t.title;
              return { ...t, cloudId: result.id, editToken: result.editToken };
            });
          });
          if (latestMarkdown && latestMarkdown !== md) {
            autoSave.scheduleSave({
              cloudId: result.id,
              markdown: latestMarkdown,
              title: latestTitle,
              userId: user?.id,
              userEmail: user?.email,
              anonymousId: anonId,
              editToken: result.editToken,
              // Skip the 2.5s debounce. The user already made an
              // intentional edit (likely Auto-Format / Structure)
              // while the import's createDocument was in flight; if
              // we wait the full debounce window they may refresh
              // first and land on the raw imported body again.
              immediate: true,
            });
          }
          // Push the new doc's URL into the browser bar. switchTab
          // already does this when a tab is loaded, but at that
          // moment tab.cloudId was still null (createDocument hadn't
          // resolved yet), so URL stayed at "/". Re-push now that
          // we have the id. Switching tabs later will overwrite if
          // needed, so no need to gate on "still active".
          try {
            window.history.replaceState(null, "", `/${result.id}`);
          } catch { /* SSR / restricted environments, skip */ }
          showToast(`Imported ${name}`, "success");
          // Refresh sidebar docs.
          fetch("/api/user/documents?includeDeleted=1", { headers: authHeadersRef.current })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data?.documents) { setServerDocs(data.documents); ingestDocAiMeta(data.documents); } })
            .catch(() => {});
        });
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
        const message = err instanceof Error ? err.message : "Failed to import file";
        showToast(`${file.name}: ${message}`, "error");
      }
    }
  }, [autoSave, showToast, switchTab, user?.id, user?.email]);

  // File drop handler
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      // Skip page-level drop handler for internal sidebar drags. Sidebar drops
      // are handled by the per-folder onDrop handlers; bubbling here can shadow
      // them. Only handle when external files (real File objects) are dropped.
      if (!e.dataTransfer.files.length) return;
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);

      // Handle image file drops — upload, insert into doc + add to library.
      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        const total = imageFiles.length;
        let done = 0;
        let failed = 0;
        showToast(total > 1 ? `Uploading 0 / ${total}…` : `Uploading ${imageFiles[0].name}…`, "info");
        for (const img of imageFiles) {
          const url = await uploadImage(img);
          done++;
          if (url) {
            const ed = tiptapRef.current?.getEditor();
            if (ed) {
              ed.chain().focus().setImage({ src: url, alt: img.name }).run();
            } else {
              const md = markdownRef.current;
              const imgMd = `![${img.name}](${url})\n`;
              const newMd = md + (md.endsWith("\n") ? "\n" : "\n\n") + imgMd;
              setMarkdownRaw(newMd);
              cmSetDocRef.current?.(newMd);
              doRender(newMd);
            }
            // Per-image progress toast (overrides previous one).
            if (total > 1) {
              showToast(`Uploaded ${done} / ${total}${failed ? ` (${failed} failed)` : ""}`, "info");
            }
          } else {
            failed++;
            if (total > 1) {
              showToast(`Uploading ${done} / ${total} (${failed} failed)…`, "info");
            }
          }
        }
        const ok = done - failed;
        if (failed === 0) {
          showToast(ok === 1 ? "Added to library" : `${ok} images added to library`, "success");
        } else if (ok === 0) {
          showToast("All uploads failed", "error");
        } else {
          showToast(`${ok} uploaded, ${failed} failed`, "error");
        }
        return;
      }

      // Route the text-file branch through the shared importer so
      // drag-drop, the hidden <input>, and the ImportModal all behave
      // identically (URL push + catch-up save + sidebar refresh).
      await runFileImport(files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveInsertPosition/insertBlockAtCursor are stable refs defined later
    [doRender, isMobile, markdown, uploadImage, cmSetDoc, runFileImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Only preventDefault for EXTERNAL file drags. For sidebar internal drags,
    // letting the page wrapper accept the drop means dropEffect ends up "none"
    // (we never set it to "move") and the user's drop on a real sidebar target
    // gets shadowed by the page's drop handler. Skip when sidebar drag is in
    // progress so only the per-folder drop targets handle the drop.
    if (isDraggingSidebarRef.current) return;
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (isDraggingSidebarRef.current) return;
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Paste handling is now done inside useCodeMirror hook via onPaste callback

  // ─── Relative time helper ───
  const relativeTime = useCallback((dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }, []);

  // ─── History panel handlers ───
  const loadVersions = useCallback(async () => {
    if (!docId) return;
    setHistoryLoading(true);
    try {
      const data = await fetchVersions(docId, authHeaders);
      setVersions(data.versions || []);
    } catch {
      setVersions([]);
      showToast("Failed to load version history", "error");
    }
    setHistoryLoading(false);
  }, [docId]);

  const handleToggleHistory = useCallback(() => {
    if (!showHistory && docId) {
      loadVersions();
    }
    setShowHistory(!showHistory);
    setPreviewVersion(null);
    if (!showHistory) setShowAIPanel(false); // close AI panel when opening history
  }, [showHistory, docId, loadVersions]);

  // Realtime: refresh version list when new versions are created
  useEffect(() => {
    if (!showHistory || !docId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`versions-${docId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'document_versions', filter: `document_id=eq.${docId}` },
        () => { loadVersions(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [showHistory, docId, loadVersions]);

  const handlePreviewVersion = useCallback(async (versionId: number) => {
    if (!docId) return;
    if (previewVersion === versionId) {
      // Toggle off — restore current content
      setPreviewVersion(null);
      doRender(markdown);
      return;
    }
    setPreviewVersion(versionId);
    try {
      const data = await fetchVersion(docId, versionId, authHeaders);
      if (data.version?.markdown) {
        const result = render(data.version.markdown);
        setHtml(result.html);
      }
    } catch {
      showToast("Failed to load version preview", "error");
    }
  }, [docId, previewVersion, markdown, doRender]);

  const handleRestoreVersion = useCallback(async (versionId: number) => {
    if (!docId) return;
    // Confirmation dialog
    const confirmed = window.confirm("Restore this version? Your current content will be saved as a snapshot before restoring.");
    if (!confirmed) return;
    const currentTab = tabs.find(t => t.id === activeTabIdRef.current);
    let token = currentTab?.editToken || getEditToken(docId);
    // If no local token, try fetching from server (owner may not have token locally)
    if (!token && user?.id) {
      try {
        const res = await fetch(`/api/docs/${docId}`, { headers: authHeaders });
        if (res.ok) {
          const doc = await res.json();
          if (doc.editToken) token = doc.editToken;
        }
      } catch {}
    }
    if (!token) { showToast("No edit permission for this document", "error"); return; }
    setRestoringVersion(versionId);
    try {
      // Save current state as version before restoring
      if (docId && user?.id) {
        await fetch(`/api/docs/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ action: "snapshot", userId: user.id, userEmail: user.email, changeSummary: "Before restore" }),
        }).catch(() => {});
      }
      const data = await fetchVersion(docId, versionId, authHeaders);
      if (data.version?.markdown) {
        const prevMd = markdownRef.current;
        await updateDocument(docId, token, data.version.markdown, data.version.title || undefined, { userId: user?.id, anonymousId: !user?.id ? getAnonymousId() : undefined, changeSummary: `Restored to version ${data.version.version_number}` });
        setMarkdown(data.version.markdown);
        doRender(data.version.markdown);
        cmSetDocRef.current?.(data.version.markdown);
        // Force reset Y.Doc to prevent CRDT from reverting to old version
        collabForceResetRef.current?.(data.version.markdown);
        highlightDiff(prevMd, data.version.markdown);
        if (data.version.title) setTitle(data.version.title);
        setPreviewVersion(null);
        await loadVersions();
      }
    } catch {
      showToast("Failed to restore version", "error");
    }
    setRestoringVersion(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, user, doRender, loadVersions]);

  // Share — open modal for owners, quick copy for non-owners
  // ─── AI Actions ───
  const handleAIAction = useCallback(async (action: string, options?: { language?: string; instruction?: string }) => {
    if (aiProcessing) return; // Already processing, ignore
    const md = markdownRef.current;
    if (!md.trim()) { showToast("Write something first", "info"); return; }
    // Block on readonly/example docs
    const ct = tabs.find(t => t.id === activeTabIdRef.current);
    if (ct?.readonly || ct?.permission === "readonly") { showToast("Cannot edit a read-only document", "info"); return; }
    setAiProcessing(action);
    setShowMenu(false);
    setShowTranslatePicker(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, markdown: md, ...options }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI failed" }));
        throw new Error(err.error || "AI processing failed");
      }
      const data = await res.json();
      const result = data.result;
      if (!result) throw new Error("Empty result from AI");

      let newMd: string;
      if (action === "summary") {
        // Remove existing summary blockquote if present (single or multiline), then insert new one
        const stripped = md.replace(/^(?:> \*\*Summary:\*\*.*\n(?:> .*\n)*)\n/m, "");
        // Wrap each line in blockquote for multiline summaries
        const summaryLines = result.trim().split("\n").map((l: string) => `> ${l}`).join("\n");
        newMd = `> **Summary:**\n${summaryLines}\n\n${stripped}`;
        showToast("Summary added", "success");
      } else if (action === "tldr") {
        // Remove existing TL;DR section if present, then insert new one
        const stripped = md.replace(/^## TL;DR\n\n[\s\S]*?\n---\n\n/m, "");
        newMd = `## TL;DR\n\n${result.trim()}\n\n---\n\n${stripped}`;
        showToast("TL;DR added", "success");
      } else if (action === "chat") {
        const trimmed = result.trim();
        // Check if AI answered (ANSWER:) or if response doesn't start with EDIT:
        if (trimmed.startsWith("ANSWER:") || !trimmed.startsWith("EDIT:")) {
          // AI answered a question or casual message, show in chat, don't modify document
          const answer = trimmed.replace(/^ANSWER:\s*/, "");
          setAiChatHistory(prev => [...prev, { role: "ai", text: answer }]);
          setAiProcessing(null);
          return; // skip document update
        }
        // AI wants to edit the document
        newMd = trimmed.replace(/^EDIT:\s*/, "").trim();
        // SAFETY GUARDS — without these the chat path was a foot-gun.
        // Reported repro: user asked the AI to reformat a single
        // section ("split experience into lines for start/end/role")
        // and the model returned just the reformatted section as the
        // EDIT body. We blindly replaced the whole document with the
        // fragment and the rest of the page vanished.
        //
        // (1) Empty edit. If the model returned "EDIT:" with nothing
        // useful after it, refuse — would wipe the document otherwise.
        if (!newMd) {
          setAiChatHistory(prev => [...prev, {
            role: "ai",
            text: "I couldn't produce an edit. Tell me what to change and how (e.g. 'rewrite the experience section as one line per company') and I'll try again.",
          }]);
          setAiProcessing(null);
          return;
        }
        // (2) Heavy shrinkage. The model often returns only the
        // section it edited when asked for a local change ("reformat
        // experience"), and a blind replace drops the rest of the doc.
        // Two-step recovery: first try to splice the fragment back
        // into the original at the right place, only refuse if even
        // that fails.
        if (md.length > 500 && newMd.length < md.length * 0.4) {
          const spliced = trySpliceFragmentIntoOriginal(md, newMd);
          if (spliced) {
            newMd = spliced;
            // Fall through to the normal replace path below.
          } else {
            const safeNewMd = newMd; // capture for the chat message
            setAiChatHistory(prev => [...prev, {
              role: "ai",
              text:
                `I think I returned just the section instead of the full document (${safeNewMd.length.toLocaleString()} chars vs the original ${md.length.toLocaleString()}). ` +
                `Try rephrasing as "return the full document with the experience section reformatted" and I'll keep everything else intact.`,
            }]);
            setAiProcessing(null);
            return;
          }
        }
        showToast("Document updated", "success");
      } else {
        // Polish, translate, compact, format, replace entire document.
        newMd = (result || "").trim();
        // Same empty guard as the chat path — Polish / Translate /
        // Compact / Format should never return empty for a non-empty
        // input; if they do, the safest move is to leave the document
        // alone and surface the failure in the toast.
        if (!newMd) {
          throw new Error("AI returned an empty result");
        }
        const labels: Record<string, string> = {
          polish: "Document polished",
          translate: "Document translated",
          compact: "Document compacted",
          format: "Document auto-formatted",
        };
        showToast(labels[action] || "Done", "success");
      }
      // Add AI response to chat history
      if (action === "chat") {
        setAiChatHistory(prev => [...prev, { role: "ai", text: "Done — document updated.", canUndo: true }]);
      } else {
        const actionLabels: Record<string, string> = { polish: "Polished", summary: "Summary added", tldr: "TL;DR added", translate: "Translated", compact: "Compacted", format: "Auto-formatted" };
        setAiChatHistory(prev => [...prev, { role: "ai", text: actionLabels[action] || "Done", canUndo: true }]);
      }
      // Update title from new content
      const newTitle = extractTitleFromMd(newMd);
      if (newTitle && newTitle !== "Untitled") {
        setTitle(newTitle);
        setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, title: newTitle } : t));
      }
      // Push current state to undo stack before replacing
      undoStack.current.push(md);
      // Trim stack: max 50 entries, max ~5MB total
      while (undoStack.current.length > 50) undoStack.current.shift();
      {
        let totalSize = undoStack.current.reduce((sum, s) => sum + s.length, 0);
        while (totalSize > 5 * 1024 * 1024 && undoStack.current.length > 1) {
          totalSize -= undoStack.current.shift()!.length;
        }
      }
      redoStack.current = [];
      // Update markdown + tab. We must push to all three writers
      // because each owns its own DOM:
      //   - setMarkdown / doRender — react state + the legacy preview
      //   - cmSetDocRef — the source-view CodeMirror buffer
      //   - tiptapRef.setMarkdown — the Live-view WYSIWYG editor
      // Skipping the last call left users staring at the *old*
      // document in the Live tab after Compact / Polish / Translate
      // / Summary / TL;DR / chat, which read as "the AI did nothing".
      const oldMd = md;
      setMarkdown(newMd);
      doRender(newMd);
      cmSetDocRef.current?.(newMd);
      tiptapRef.current?.setMarkdown(newMd);
      setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, markdown: newMd } : t));

      // Force an immediate save (bypass the 2.5s debounce). AI edits
      // are large, intentional changes — if the user refreshes the
      // page within the debounce window the result vanishes because
      // setMarkdown's triggerAutoSave was still waiting to fire.
      // Reported case: user did Auto-Format after import, refreshed
      // quickly, server still had the raw imported body. immediate:true
      // schedules the PATCH on the next tick instead.
      const activeTab = tabs.find(t => t.id === activeTabIdRef.current);
      if (activeTab?.cloudId) {
        autoSave.scheduleSave({
          cloudId: activeTab.cloudId,
          markdown: newMd,
          title: extractTitleFromMd(newMd) || activeTab.title,
          userId: user?.id,
          userEmail: user?.email,
          anonymousId,
          editToken: activeTab.editToken,
          immediate: true,
        });
      }

      // Highlight changes in preview after render
      highlightDiff(oldMd, newMd);
      if (data.finishReason === "MAX_TOKENS") {
        showToast("AI hit output limit — result may be incomplete", "info");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI processing failed";
      showToast(message, "error");
      setAiChatHistory(prev => [...prev, { role: "ai", text: `Error: ${message}` }]);
    }
    setAiProcessing(null);
  }, [doRender, setMarkdown, tabs]);

  // ─── Format raw text from chat input ───
  // (handleFormatChatText removed — Auto-Format now lives in the
  //  quick-action grid via handleAIAction("format"), which replaces
  //  the whole doc in place. The append-from-chat-input variant was
  //  removed for UX consistency with Polish / Compact / Translate.)

  // ─── Diff Highlight ───
  const highlightDiff = useCallback((oldMd: string, newMd: string) => {
    if (oldMd === newMd) return;
    setTimeout(() => {
      if (!previewRef.current) return;
      const blocks = previewRef.current.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, table, .math-rendered, .mermaid-container");
      blocks.forEach(el => {
        const text = (el as HTMLElement).textContent?.trim() || "";
        if (text.length < 5) return;
        const snippet = text.substring(0, Math.min(text.length, 60));
        if (!oldMd.includes(snippet)) {
          (el as HTMLElement).style.transition = "background 1.5s ease-out";
          (el as HTMLElement).style.background = "rgba(251, 146, 60, 0.12)";
          (el as HTMLElement).style.borderRadius = "4px";
          setTimeout(() => { (el as HTMLElement).style.background = ""; }, 3000);
        }
      });
    }, 300);
  }, []);

  const handleShare = useCallback(async () => {
    const currentTab = tabs.find(t => t.id === activeTabIdRef.current);

    // Bundle: same ShareModal flow as docs, with cascade adapters
    if (currentTab?.kind === "bundle" && currentTab.bundleId) {
      if (!isAuthenticated) { showToast("Sign in to share bundles", "info"); return; }
      setBundleShareModal({ bundleId: currentTab.bundleId });
      return;
    }

    if (!markdown.trim()) { showToast("Write something first", "info"); return; }
    if (!isAuthenticated) { showToast("Sign in to share documents", "info"); return; }

    // If doc already has a cloudId and user is owner, open share modal
    const cid = currentTab?.cloudId || docId;

    const isMine = !currentTab?.permission || currentTab.permission === "mine";
    if (cid && isMine && isAuthenticated && user) {
      // If the tab already carries the authoritative share state from
      // a prior fetch, open the modal instantly with no skeleton — the
      // ShareModal renders the real permissions on its first paint.
      // Otherwise fall back to the skeleton + background fetch so the
      // user doesn't briefly see the stale "Anyone with the link"
      // default that the empty state used to flash for ~2 seconds.
      const hasCache = !!currentTab?.allowedEmails || !!currentTab?.allowedEditors;
      setShareModalLoading(!hasCache);
      setShowShareModal(true);

      (async () => {
        if (title) {
          fetch(`/api/docs/${cid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "auto-save", title, userId: user.id }),
          }).catch(() => {});
        }
        try {
          const res = await fetch(`/api/docs/${cid}`, { headers: authHeaders });
          if (res.ok) {
            const doc = await res.json();
            if (doc.allowedEmails) setAllowedEmailsState(doc.allowedEmails);
            if (doc.allowedEditors) setAllowedEditorsState(doc.allowedEditors);
            if (doc.editMode) { setDocEditMode(doc.editMode); setEditMode(doc.editMode); }
            // Drive isSharedByMe from is_draft (matches the bulk loader
            // and the docs filter). editMode governs WHO can edit, not
            // who can read — a published doc with editMode="token" is
            // still publicly readable and should stay marked Shared.
            const hasSharing = doc.is_draft === false;
            const shareOthersCount = doc.allowedEmails?.filter((e: string) => e.toLowerCase() !== (user?.email || "").toLowerCase()).length || 0;
            setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? {
              ...t,
              isSharedByMe: hasSharing,
              isRestricted: shareOthersCount > 0,
              editMode: doc.editMode,
              sharedWithCount: shareOthersCount,
              allowedEmails: Array.isArray(doc.allowedEmails) ? doc.allowedEmails : t.allowedEmails,
              allowedEditors: Array.isArray(doc.allowedEditors) ? doc.allowedEditors : t.allowedEditors,
              // Server returns editToken to owners only. Cache it on
              // the tab so the Share modal's Developer-access footer
              // can surface it without us re-fetching, and so the
              // local edit-token-locator (used by autosave + version
              // restore) has it available.
              editToken: typeof doc.editToken === "string" && doc.editToken ? doc.editToken : t.editToken,
            } : t));
          }
        } catch { /* ignore */ }
        finally { setShareModalLoading(false); }
      })();
      return;
    }

    // Non-owner with existing doc — open viewer share modal immediately
    if (cid && !isMine) {
      setShowViewerShareModal(true);
      // Fetch owner info in background if we don't have it
      if (!currentTab?.ownerEmail && user) {
        fetch(`/api/docs/${cid}`, { headers: authHeaders })
          .then(res => res.ok ? res.json() : null)
          .then(doc => {
            if (doc?.ownerEmail) {
              setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, ownerEmail: doc.ownerEmail } : t));
            }
          }).catch(() => {});
      }
      return;
    }

    // Not yet shared — create the document first
    setShareState("sharing");
    try {
      if (isAuthenticated && user) {
        const { url, editToken } = await createShortUrl(markdown, title, {
          userId: user.id,
          editMode,
        });
        const newDocId = url.split("/").pop()!;
        saveEditToken(newDocId, editToken);
        setDocId(newDocId);
        setIsOwner(true);
        setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, cloudId: newDocId, editToken } : t));
        window.history.replaceState(null, "", `/${newDocId}`);
        // Open share modal — doc stays as draft until user changes settings
        setShareState("idle");
        setShowShareModal(true);
      } else {
        try {
          const anonId = ensureAnonymousId();
          const { url, editToken } = await createShortUrl(markdown, title, { anonymousId: anonId });
          const newDocId = url.split("/").pop()!;
          saveEditToken(newDocId, editToken);
          setDocId(newDocId);
          setIsOwner(true);
          setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, cloudId: newDocId, editToken } : t));
          await copyToClipboard(url);
          window.history.replaceState(null, "", `/${newDocId}`);
          setShareState("copied");
          setTimeout(() => setShareState("idle"), 3000);
        } catch {
          const url = await createShareUrl(markdown);
          await copyToClipboard(url);
          setShareState("copied");
          setTimeout(() => setShareState("idle"), 3000);
        }
      }
    } catch {
      setShareState("error");
      showToast("Failed to share. Check your connection.", "error");
      setTimeout(() => setShareState("idle"), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, title, docId, tabs, isOwner, isAuthenticated, user, editMode]);

  // Copy HTML
  const handleCopyHtml = useCallback(async () => {
    await copyToClipboard(html);
    setShowMenu(false);
  }, [html]);

  // Copy rich text (for Google Docs, Email etc)
  const handleCopyRichText = useCallback(async () => {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([markdown], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": textBlob,
        }),
      ]);
    } catch {
      await copyToClipboard(html);
    }
    setShowMenu(false);
  }, [html, markdown]);

  // Copy for Slack (simplified markdown)
  const handleCopySlack = useCallback(async () => {
    // Slack uses its own mrkdwn: *bold*, _italic_, `code`, ```code block```
    // Convert standard MD to Slack-compatible format
    const slackText = markdown
      .replace(/\*\*(.*?)\*\*/g, "*$1*")       // **bold** → *bold*
      .replace(/^### (.*$)/gm, "*$1*")          // ### heading → *heading*
      .replace(/^## (.*$)/gm, "*$1*")           // ## heading → *heading*
      .replace(/^# (.*$)/gm, "*$1*")            // # heading → *heading*
      .replace(/^\- /gm, "• ");                  // - list → • list
    await copyToClipboard(slackText);
    setShowMenu(false);
  }, [markdown]);

  // Download helpers
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadMd = useCallback(() => {
    downloadFile(markdown, `${title || "document"}.md`, "text/markdown");
    setShowMenu(false);
  }, [markdown, title, downloadFile]);

  const handleDownloadHtml = useCallback(() => {
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title || "Document"}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 768px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
  pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.9em; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  img { max-width: 100%; }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
</style>
</head>
<body>
${html}
</body>
</html>`;
    downloadFile(fullHtml, `${title || "document"}.html`, "text/html");
    setShowExportMenu(false);
  }, [html, title, downloadFile]);

  const handleDownloadTxt = useCallback(() => {
    // Strip markdown syntax for plain text
    const plain = markdown
      .replace(/^#{1,6}\s+/gm, "")           // headings
      .replace(/\*\*(.*?)\*\*/g, "$1")         // bold
      .replace(/\*(.*?)\*/g, "$1")             // italic
      .replace(/~~(.*?)~~/g, "$1")             // strikethrough
      .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`{3}.*\n?/g, "")) // code blocks
      .replace(/`(.*?)`/g, "$1")               // inline code
      .replace(/!\[.*?\]\(.*?\)/g, "")          // images
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")       // links
      .replace(/^[\-\*]\s+/gm, "• ")           // unordered lists
      .replace(/^\d+\.\s+/gm, (m) => m)        // keep ordered lists
      .replace(/^>\s+/gm, "  ")                // blockquotes
      .replace(/---+/g, "────────────────");    // horizontal rules
    downloadFile(plain, `${title || "document"}.txt`, "text/plain");
    setShowExportMenu(false);
  }, [markdown, title, downloadFile]);

  const handleCopyPlainText = useCallback(async () => {
    const plain = markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`{3}.*\n?/g, ""))
      .replace(/`(.*?)`/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/^[\-\*]\s+/gm, "• ")
      .replace(/^>\s+/gm, "  ");
    await copyToClipboard(plain);
    setShowExportMenu(false);
  }, [markdown]);

  // Update existing document
  const [_updateState, setUpdateState] = useState<"idle" | "updating" | "done" | "error">("idle");
  const _handleUpdate = useCallback(async () => {
    if (!docId || !markdown.trim()) return;
    const token = getEditToken(docId);
    // Can update if: has token, or is owner by account, or doc is public
    if (!token && !user?.id && docEditMode !== "public") return;
    setUpdateState("updating");
    try {
      await updateDocument(docId, token || "", markdown, title, {
        userId: user?.id,
        anonymousId: !user?.id ? getAnonymousId() : undefined,
        changeSummary: undefined,
      });
      setUpdateState("done");
      setTimeout(() => setUpdateState("idle"), 3000);
    } catch {
      setUpdateState("error");
      showToast("Failed to update document. Check your connection.", "error");
      setTimeout(() => setUpdateState("idle"), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, markdown, title, user]);

  // Document settings (owner only)
  const [_showDocSettings, _setShowDocSettings] = useState(false);
  const [confirmRotateToken, setConfirmRotateToken] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const handleRotateToken = useCallback(async () => {
    if (!docId || !user?.id) return;
    if (!confirmRotateToken) { setConfirmRotateToken(true); return; }
    setRotatingToken(true);
    try {
      const newToken = await rotateEditToken(docId, user.id);
      saveEditToken(docId, newToken);
    } catch {
      showToast("Failed to rotate edit token", "error");
    }
    setRotatingToken(false);
    setConfirmRotateToken(false);
  }, [docId, user, confirmRotateToken]);

  // After a delete (single or bulk), pick the best fallback tab to
  // switch to. Hard rule: NEVER land on a readonly example tab — the
  // user just deleted something they own; surfacing them on a "Read-
  // only example" with a Duplicate-to-edit banner makes the editor
  // feel broken (founder report: "말이 안되는 화면"). Priority:
  //   1. their own non-readonly doc (any kind, cloud or local)
  //   2. any non-readonly tab (shared with edit permission)
  //   3. null → caller switches to the Start surface instead
  const pickFallbackTabAfterDelete = useCallback((deletedIds: Set<string>): string | null => {
    const candidates = tabs.filter((t) => !t.deleted && !deletedIds.has(t.id));
    const userOwned = candidates.find((t) => !t.readonly && t.ownerEmail !== EXAMPLE_OWNER);
    if (userOwned) return userOwned.id;
    const editable = candidates.find((t) => !t.readonly);
    if (editable) return editable.id;
    return null;
  }, [tabs]);

  // Convenience: navigate to Start surface (the personal landing).
  // Used when delete fallbacks find no usable tab. Matches what the
  // Start button in the header does.
  const switchToStartSurface = useCallback(() => {
    setShowOnboarding(true);
    setShowHub(false);
    setShowGalaxy(false);
    setShowSettings(false);
  }, []);

  // Delete document
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(false);
  // Soft delete document on server. Returns a promise so callers can revert
  // optimistic local state if the server rejects the request — without that,
  // the realtime sync would later observe deleted_at=null on the server and
  // (correctly) treat the tab as still alive, leaving the user staring at a
  // doc they just "deleted".
  const softDeleteOnServer = useCallback(async (tab: { cloudId?: string; editToken?: string; id?: string }): Promise<boolean> => {
    if (!tab.cloudId) return true;
    const token = tab.editToken || getEditToken(tab.cloudId);
    try {
      await softDeleteDocument(tab.cloudId, { userId: user?.id, editToken: token || undefined });
      return true;
    } catch {
      // Revert optimistic deletion locally and tell the user.
      if (tab.id) {
        setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, deleted: false, deletedAt: undefined } : t));
      }
      showToast("Couldn't move to Trash — server refused", "error");
      return false;
    }
  }, [user?.id]);
  // Hard delete document from server (permanent). Returns a promise so
  // callers (Empty Trash, per-row Delete) can await and react to failure.
  // Falls back to userId-based ownership when no editToken is in localStorage —
  // cloud-fetched tabs never have a local token, but the server's DELETE
  // route accepts user_id matching as authorization. Previous fire-and-forget
  // version bailed silently without a token, so trashing items that came in
  // via realtime sync never actually deleted them server-side; the next
  // sync re-added them and the user saw "Empty Trash did nothing."
  const hardDeleteOnServer = useCallback(async (tab: { cloudId?: string; editToken?: string }): Promise<boolean> => {
    if (!tab.cloudId) return true;
    const token = tab.editToken || getEditToken(tab.cloudId) || undefined;
    try {
      await deleteDocument(tab.cloudId, { userId: user?.id, editToken: token });
      return true;
    } catch {
      return false;
    }
  }, [user?.id]);

  const handleDelete = useCallback(async () => {
    if (!docId) return;
    if (!confirmDeleteDoc) { setConfirmDeleteDoc(true); return; }
    const token = getEditToken(docId) || undefined;
    try {
      await deleteDocument(docId, { userId: user?.id, editToken: token });
      setDocId(null);
      setIsOwner(false);
      window.history.replaceState(null, "", "/");
    } catch {
      showToast("Couldn't delete — server refused", "error");
    }
    setConfirmDeleteDoc(false);
    setShowMenu(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, user?.id]);

  // Clear
  const handleClear = useCallback(() => {
    autoSave.cancel(); // prevent saving empty content to cloud
    // Clear cloudId FIRST to prevent auto-save race
    setTabs(prev => prev.map(t => t.id === activeTabIdRef.current ? { ...t, cloudId: undefined, editToken: undefined } : t));
    setMarkdownRaw("");
    setIsSharedDoc(false);
    setDocId(null);
    setIsOwner(false);
    window.history.replaceState(null, "", "/");
    doRender("");
    setShowMenu(false);
  }, [doRender, autoSave]);

  // ─── Desktop Bridge (Electron) ───
  // Expose markdown state and functions to the desktop app
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    if (!w.__MDFY_DESKTOP__) return;

    w.__MDFY_GET_MARKDOWN__ = () => markdown;
    w.__MDFY_GET_TITLE__ = () => title;
    w.__MDFY_GET_DOC_ID__ = () => docId;
    w.__MDFY_SET_MARKDOWN__ = (md: string) => {
      setMarkdown(md);
      doRender(md);
      cmSetDocRef.current?.(md);
    };

    // Listen for Cmd+S from desktop (save to local file)
    const handleDesktopSave = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        window.postMessage({ type: "memory-wiki-desktop-save", markdown, title }, "*");
      }
    };
    window.addEventListener("keydown", handleDesktopSave);

    // Notify desktop when document is published/shared
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);
    const checkUrl = () => {
      const urlPath = window.location.pathname;
      const match = urlPath.match(/^\/([a-zA-Z0-9_-]{6,12})$/);
      if (match && docId) {
        window.postMessage({ type: "memory-wiki-desktop-published", docId, editToken: w.__MDFY_EDIT_TOKEN__ as string }, "*");
      }
    };
    const wrappedPush = (...args: Parameters<typeof history.pushState>) => { origPushState(...args); checkUrl(); };
    const wrappedReplace = (...args: Parameters<typeof history.replaceState>) => { origReplaceState(...args); checkUrl(); };
    history.pushState = wrappedPush;
    history.replaceState = wrappedReplace;

    return () => {
      window.removeEventListener("keydown", handleDesktopSave);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      delete w.__MDFY_GET_MARKDOWN__;
      delete w.__MDFY_GET_TITLE__;
      delete w.__MDFY_GET_DOC_ID__;
      delete w.__MDFY_SET_MARKDOWN__;
    };
  }, [markdown, title, docId, doRender, setMarkdown]);

  // Format AI conversation
  const handleFormatAiConversation = useCallback(() => {
    const messages = parseConversation(markdown);
    if (messages) {
      const formatted = formatConversation(messages);
      setMarkdown(formatted);
      doRender(formatted);
      cmSetDocRef.current?.(formatted);
    }
    setShowAiBanner(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown, doRender]);

  // Export PDF — open clean document in new window and print
  const handleExportPdf = useCallback(() => {
    setShowMenu(false);
    // Clone rendered HTML, strip UI buttons
    const clone = document.createElement("div");
    clone.innerHTML = html;
    clone.querySelectorAll(".code-copy-btn, .code-header, .code-lang-label, .mermaid-edit-btn, .mermaid-toolbar, .ascii-render-btn, .ascii-toggle-btn, .ce-spacer").forEach(n => n.remove());
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title || "Document"}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 768px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
  pre { background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.9em; }
  pre code { background: none; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  img { max-width: 100%; }
  h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
  h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  @media print { body { margin: 0; padding: 0 0.5rem; } }
</style>
</head>
<body>
${clone.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  }, [html, title]);

  // Edit shared doc
  const _handleEditShared = useCallback(() => {
    setIsSharedDoc(false);
    setViewMode(isMobile ? "editor" : "split");
  }, [isMobile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "s") {
        e.preventDefault();
        handleShare();
      }
      if (mod && e.shiftKey && e.key === "c") {
        e.preventDefault();
        handleCopyHtml();
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        setViewMode((prev) =>
          prev === "split" ? "preview" : prev === "preview" ? "editor" : "split"
        );
      }
      // View mode shortcuts: Alt+H Home, Alt+1 Live, Alt+2 Split, Alt+3 Source
      if (e.altKey && !mod && e.key === "h") { e.preventDefault(); setShowOnboarding(true); }
      if (e.altKey && !mod && e.key === "1") { e.preventDefault(); setShowOnboarding(false); setViewMode("preview"); }
      if (e.altKey && !mod && e.key === "2") { e.preventDefault(); setShowOnboarding(false); setViewMode("split"); }
      if (e.altKey && !mod && e.key === "3") { e.preventDefault(); setShowOnboarding(false); setViewMode("editor"); }
      if (e.key === "Escape") {
        if (showCommandPalette) { setShowCommandPalette(false); setCmdSearch(""); return; }
        // If a modal/dialog is handling Escape, don't also focus editor
        const target = e.target as HTMLElement;
        if (target.closest("[role='dialog'], [data-modal]")) return;
        cmFocus();
      }
      // Command palette — Cmd+K (when NOT in contentEditable preview)
      const inPreview = document.activeElement?.closest("article.mdcore-rendered");
      if (mod && e.key === "k" && !inPreview) {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        setCmdSearch("");
        return;
      }
      // WYSIWYG shortcuts — only when editing in preview (contentEditable)
      if (inPreview && mod) {
        if (e.key === "b") {
          e.preventDefault();
          document.execCommand("bold");
        }
        if (e.key === "i") {
          e.preventDefault();
          document.execCommand("italic");
        }
        if (e.key === "k") {
          e.preventDefault();
          setInlineInput({ label: "URL", onSubmit: (u) => { document.execCommand("createLink", false, u); setInlineInput(null); } });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleShare, handleCopyHtml, undo, redo, showCommandPalette]);

  // ── Cursor-aware insertion ──
  // Saves WYSIWYG cursor position so inserts go where the user expects
  const insertPosRef = useRef<number>(-1);
  // Suppress handleWysiwygInput after paste/programmatic changes
  const suppressInputRef = useRef(false);

  const saveInsertPosition = useCallback(() => {
    const md = markdownRef.current;

    // Check if cursor is in the WYSIWYG article
    const article = previewRef.current?.querySelector("article");
    const sel = window.getSelection();
    if (!article || !sel?.rangeCount || !article.contains(sel.getRangeAt(0).startContainer)) {
      // Cursor not in article — try CodeMirror cursor (source/split mode)
      if (editorContainerRef.current?.contains(document.activeElement)) {
        const cmPos = cmGetCursorPos();
        const lines = md.split("\n");
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > cmPos) {
            insertPosRef.current = charCount;
            return;
          }
        }
      }
      insertPosRef.current = md.length;
      return;
    }

    // ── Text-offset approach ──
    // Instead of htmlToMarkdown round-trip (lossy, position mismatch),
    // count the text offset from article start to cursor position,
    // then find the corresponding line boundary in the original markdown.
    const range = sel.getRangeAt(0);

    // Count text characters from article start to cursor
    const preRange = document.createRange();
    preRange.setStart(article, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString();
    const textOffset = textBefore.length;

    // Get total text length of article
    const totalText = article.textContent || "";

    if (totalText.length === 0 || textOffset >= totalText.length) {
      // Cursor at end of article — insert at end of markdown
      insertPosRef.current = md.length;
      return;
    }

    if (textOffset === 0) {
      // Cursor at beginning — insert at start
      insertPosRef.current = 0;
      return;
    }

    // Map text offset to markdown position via line-by-line text matching
    // Strip markdown syntax to get plain text, and find the line where
    // cumulative text length crosses the cursor offset
    const lines = md.split("\n");
    let mdPos = 0;
    let textCount = 0;

    for (let i = 0; i < lines.length; i++) {
      // Strip markdown syntax to get approximate text content
      const lineText = lines[i]
        .replace(/^#{1,6}\s+/, "")     // headings
        .replace(/^>\s?/gm, "")         // blockquote
        .replace(/^[-*+]\s+/, "")       // unordered list
        .replace(/^\d+\.\s+/, "")       // ordered list
        .replace(/^- \[[ x]\]\s+/, "")  // task list
        .replace(/\*\*|__/g, "")        // bold
        .replace(/\*|_/g, "")           // italic
        .replace(/~~|``/g, "")          // strikethrough/inline code
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links

      textCount += lineText.length + 1; // +1 for newline
      mdPos += lines[i].length + 1;

      if (textCount >= textOffset) {
        // Cursor is on or before this line — snap to end of this line
        insertPosRef.current = mdPos;
        return;
      }
    }

    insertPosRef.current = md.length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insertBlockAtCursor = useCallback((content: string): string => {
    const md = markdownRef.current;
    let pos = insertPosRef.current;

    if (pos < 0 || pos > md.length) {
      // No valid position — append at end
      const suffix = md.endsWith("\n") ? "\n" : "\n\n";
      return md + suffix + content;
    }

    // Snap to a line boundary (don't split a line in the middle)
    if (pos > 0 && pos < md.length) {
      const nextNl = md.indexOf("\n", pos);
      if (nextNl !== -1 && nextNl - pos < 200) {
        pos = nextNl + 1; // snap to next line boundary
      }
    }

    const before = md.slice(0, pos);
    const after = md.slice(pos);
    const gap1 = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const gap2 = after.startsWith("\n") ? "" : "\n";
    return before + gap1 + content + gap2 + after;
  }, []);

  // Insert special blocks (table, code, math, mermaid) — via Tiptap or markdown
  const handleInsertTable = useCallback((cols: number, rows: number) => {
    const ed = tiptapRef.current?.getEditor();
    if (ed) {
      // Use Tiptap's table insertion
      ed.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
      return;
    }
    // Fallback: insert markdown table
    const header = "| " + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(" | ") + " |";
    const separator = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
    const row = "| " + Array.from({ length: cols }, () => "cell").join(" | ") + " |";
    const tableRows = Array.from({ length: rows }, () => row).join("\n");
    const block = `${header}\n${separator}\n${tableRows}`;
    const md = markdownRef.current;
    const newMd = md + (md.endsWith("\n") ? "\n" : "\n\n") + block + "\n";
    setMarkdown(newMd);
    cmSetDoc(newMd);
    doRender(newMd);
  }, [doRender, setMarkdown, cmSetDoc]);

  const handleInsertBlock = useCallback((type: "code" | "math" | "mermaid") => {
    switch (type) {
      case "code": {
        const ed = tiptapRef.current?.getEditor();
        if (ed) {
          ed.chain().focus().setCodeBlock().run();
          return;
        }
        const md = markdownRef.current;
        const newMd = md + (md.endsWith("\n") ? "\n" : "\n\n") + "```\ncode here\n```\n";
        setMarkdown(newMd);
        cmSetDoc(newMd);
        doRender(newMd);
        break;
      }
      case "math":
        setInitialMath("");
        mathOriginalRef.current = null;
        setShowMathModal(true);
        return;
      case "mermaid":
        mermaidIsNewRef.current = true;
        setCanvasMermaid("graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E");
        setShowMermaidModal(true);
        return;
    }
  }, [doRender, setMarkdown, cmSetDoc]);

  // Legacy ce-spacer + non-editable islands — DISABLED (Tiptap handles natively)
  useEffect(() => {
    // Tiptap manages editing DOM — skip legacy contentEditable setup
    /* eslint-disable @typescript-eslint/no-unused-vars */
    if (true as unknown as boolean) return; // short-circuit: all code below is dead
    const article = (null as unknown as HTMLElement).querySelector("article");
    if (!article) return;
    // Non-editable blocks: code, mermaid, math, tables, images, ascii diagrams
    const nonEditableSelector = "pre, .mermaid-container, .mermaid-rendered, .math-rendered, .katex-display, .ascii-diagram, table, img";
    article.querySelectorAll(nonEditableSelector).forEach(el => {
      (el as HTMLElement).contentEditable = "false";

      // Skip spacers for inline math — <p> spacers break list/paragraph layout
      if (el.classList.contains("math-rendered") &&
          el.getAttribute("data-math-mode") === "inline") {
        return;
      }

      // For tables inside table-wrapper, add spacers to wrapper (not inside it)
      let spacerTarget: Element = el;
      if (el.tagName === "TABLE" && el.parentElement?.classList.contains("table-wrapper")) {
        spacerTarget = el.parentElement;
        (spacerTarget as HTMLElement).contentEditable = "false";
      }

      // Add editable spacer AFTER if missing — so cursor can be placed below
      const next = spacerTarget.nextElementSibling;
      if (!next || (next.getAttribute("contenteditable") === "false" && !next.classList.contains("ce-spacer"))) {
        if (!spacerTarget.nextElementSibling?.classList.contains("ce-spacer")) {
          const spacer = document.createElement("p");
          spacer.innerHTML = "<br>";
          spacer.className = "ce-spacer";
          spacerTarget.parentNode?.insertBefore(spacer, spacerTarget.nextSibling);
        }
      }

      // Add editable spacer BEFORE if missing — so cursor can be placed above
      const prev = spacerTarget.previousElementSibling;
      if (!prev || (prev.getAttribute("contenteditable") === "false" && !prev.classList.contains("ce-spacer"))) {
        if (!spacerTarget.previousElementSibling?.classList.contains("ce-spacer")) {
          const spacer = document.createElement("p");
          spacer.innerHTML = "<br>";
          spacer.className = "ce-spacer";
          spacerTarget.parentNode?.insertBefore(spacer, spacerTarget);
        }
      }
    });
    // Add spacer after last child if it's a blockquote, list, or other block
    // that traps the cursor (can't escape by pressing Enter)
    const lastChild = article.lastElementChild;
    if (lastChild && !lastChild.classList.contains("ce-spacer")) {
      const tag = lastChild.tagName.toLowerCase();
      if (["blockquote", "ul", "ol", "pre", "table"].includes(tag) ||
          lastChild.getAttribute("contenteditable") === "false") {
        const spacer = document.createElement("p");
        spacer.innerHTML = "<br>";
        spacer.className = "ce-spacer";
        article.appendChild(spacer);
      }
    }

    // Escape hint for trapping blocks is handled via CSS ::after pseudo-element
    // See globals.css — article[contenteditable="true"] > blockquote::after etc.

    // Suppress browser object resizing/table controls
    try {
      document.execCommand("enableObjectResizing", false, "false");
      document.execCommand("enableInlineTableEditing", false, "false");
    } catch { /* not supported in all browsers */ }

    // MutationObserver: remove any browser-injected table controls (▾ dropdowns)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLElement) {
            // Chrome adds elements with data-column / data-row or specific classes
            if (node.tagName === "DIV" && (node.style.position === "absolute" || node.getAttribute("data-column") !== null)) {
              node.remove();
            }
          }
        }
      }
    });
    observer.observe(article, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [html]);

  const shareButtonLabel = {
    idle: "Share",
    sharing: "Share",
    copied: "Copied",
    error: "Retry",
  }[shareState];

  // Memoize sidebar filter computations to avoid re-filtering on every render
  const memoAllMyTabs = useMemo(() =>
    tabs.filter(t => !t.deleted && !t.readonly && t.permission !== "readonly" && t.permission !== "editable" && t.kind !== "bundle" && t.kind !== "hub"),
    [tabs]
  );

  const memoTrashTabs = useMemo(() =>
    isAuthenticated ? tabs.filter(t => t.deleted) : [],
    [tabs, isAuthenticated]
  );

  const memoExampleTabs = useMemo(() => {
    const canonicalIds = new Set(EXAMPLE_TABS.map(e => e.id));
    return tabs.filter(t => !t.deleted && canonicalIds.has(t.id) && !hiddenExampleIds.has(t.id));
  }, [tabs, hiddenExampleIds]);

  const memoMyTabs = useMemo(() => {
    const allMyTabs = memoAllMyTabs;
    return docFilter === "all" ? allMyTabs
      : docFilter === "private" ? allMyTabs.filter(t => !t.isSharedByMe && !t.isRestricted)
      : docFilter === "shared" ? allMyTabs.filter(t => t.isSharedByMe || t.isRestricted)
      : docFilter === "synced" ? allMyTabs.filter(t => t.source && SYNCED_SOURCES.includes(t.source))
      : allMyTabs;
  }, [memoAllMyTabs, docFilter]);

  const memoPrivateCount = useMemo(() => memoAllMyTabs.filter(t => t.isDraft !== false).length, [memoAllMyTabs]);
  const memoSharedCount = useMemo(() => memoAllMyTabs.filter(t => t.isDraft === false).length, [memoAllMyTabs]);

  // Bundle filter — mirrors the docs filter but only Private/Shared
  // (bundles have no source axis, so Synced is omitted). A bundle is
  // "shared" the moment it's published (visibility !== 'private') OR
  // it has any allowed_emails entries — same semantics as the doc
  // filter so the user's mental model stays consistent.
  const memoFilteredBundles = useMemo(() => {
    if (bundleFilter === "all") return bundles;
    return bundles.filter(b => {
      const isPublic = b.is_draft === false;
      const hasRecipients = (b.allowed_emails_count ?? 0) > 0;
      const isShared = isPublic || hasRecipients || (b.visibility && b.visibility !== "private");
      return bundleFilter === "shared" ? isShared : !isShared;
    });
  }, [bundles, bundleFilter]);

  // Count of items matching the sidebar search across docs + bundles. Shown
  // as a small badge inside the search input. Title-match short-circuits.
  const searchMatchCount = useMemo(() => {
    const q = sidebarSearchDebounced.toLowerCase();
    if (!q) return 0;
    const tabHit = (t: { title?: string; markdown?: string }) =>
      (t.title || "").toLowerCase().includes(q) || (t.markdown || "").slice(0, 3000).toLowerCase().includes(q);
    let n = 0;
    for (const t of tabs) {
      if (t.deleted) continue;
      if (tabHit(t)) n++;
    }
    for (const b of bundles) {
      if ((b.title || "").toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q)) n++;
    }
    return n;
  }, [tabs, bundles, sidebarSearchDebounced]);

  // Bundle status icon — same visual semantics across MD Bundles section, sidebar
  // Recent, and home-screen Recent. NEVER reflects selection (active) state.
  const renderBundleStatusIcon = useCallback((bundleId: string | undefined, size: number = 14) => {
    if (!bundleId) return null;
    const bundle = bundles.find(b => b.id === bundleId);
    const isPublished = bundle?.is_draft === false;
    const sharedWithCount = bundle?.allowed_emails_count ?? 0;
    const isRestricted = sharedWithCount > 0;
    const hasPassword = bundle?.has_password === true;
    const isPublic = isPublished && !isRestricted;
    const iconColor = isRestricted ? "#60a5fa" : isPublic ? "#4ade80" : "var(--text-faint)";
    const overlay = Math.max(7, Math.round(size * 0.55));
    // Password mode has been removed app-wide — hasPassword can only
    // be true for legacy data; treat it as a noop so the tooltip
    // reflects the active three-state model (Public / Restricted /
    // Private) only.
    void hasPassword;
    const tipText = isRestricted
      ? `Shared with ${sharedWithCount} ${sharedWithCount === 1 ? "person" : "people"}`
      : isPublic
        ? "Public — anyone with the link can view"
        : "Private bundle — only you can see this";
    return (
      <Tooltip text={tipText}>
        <span className="relative shrink-0 flex items-center justify-center" style={{ width: size + 4, height: size + 2 }}>
          <Layers width={size} height={size} style={{ color: iconColor }} />
          {isRestricted && (
            <span className="absolute flex items-center justify-center rounded-full" style={{ right: -2, bottom: -2, width: overlay + 1, height: overlay + 1, background: "#60a5fa", border: "1.5px solid var(--background)" }}>
              <User width={Math.max(4, overlay - 4)} height={Math.max(4, overlay - 4)} style={{ color: "#fff" }} />
            </span>
          )}
          {!isRestricted && hasPassword && (
            <Lock width={overlay} height={overlay} className="absolute" style={{ color: "#f59e0b", right: -1, bottom: -1, background: "var(--background)", borderRadius: 4, padding: 1 }} />
          )}
          {!isRestricted && isPublic && !hasPassword && (
            <Globe width={overlay} height={overlay} className="absolute" style={{ color: "#4ade80", right: -1, bottom: -1, background: "var(--background)", borderRadius: 4, padding: 1 }} />
          )}
        </span>
      </Tooltip>
    );
  }, [bundles]);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "100dvh", background: "var(--background)", color: "var(--foreground)" }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 z-[9998] flex items-center justify-center border-2 border-dashed rounded-lg m-2"
          style={{ background: "var(--drag-bg)", borderColor: "var(--text-primary)" }}
        >
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-60">•</div>
            <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Drop your file</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>MD, PDF, DOCX, PPTX, XLSX, HTML, CSV, LaTeX, RST, JSON, TXT</p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Supports .md, .markdown, .txt</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className="relative z-[100]"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
      >
        {/* Row 1: Logo + View mode + Actions — no flex-wrap, direct mobile switch */}
        <div className="flex items-center px-3 sm:px-5 py-1.5 sm:py-2 gap-x-2 relative" style={{ justifyContent: "space-between" }}>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0" style={{ flex: "0 1 auto", maxWidth: "50%", position: "relative", zIndex: 2 }}>
          <h1
            className="font-bold tracking-tight cursor-pointer shrink-0 flex items-baseline"
            onClick={() => window.open("/about", "_blank")}
            title="memory.wiki — About"
          >
            {/* On mobile the icon row to the right gets dense and the
                wordmark collides with the first icon — drop the
                "memory.wiki" text and keep only the animated blob so
                the row breathes. */}
            <MemoryWikiLogo
              size={isMobile ? 14 : 18}
              variant={isMobile ? "icon-only" : "full"}
            />
          </h1>
          {/* Document / Bundle / Hub URL chip — refined chip group.
              For doc tabs: shows /{cloudId} → memory.wiki/{cloudId}.
              For bundle tabs: shows /b/{bundleId} → memory.wiki/b/{bundleId}.
              When the Hub overlay is up, the chip switches to
              /hub/{slug} so the user can copy the public hub URL
              from the same slot they use for doc/bundle URLs —
              consistency the founder asked for. The overlay-on
              path wins over whatever activeTab is in the
              background, since the user is "looking at" Hub. */}
          {(() => {
            const ct = tabs.find(t => t.id === activeTabId);
            // Overlay surfaces (Start / Settings) win over whatever
            // tab sits underneath; this surface label is "where the
            // user is looking right now," not "what tab is active."
            const isStart = showOnboarding;
            const isSettings = showSettings;
            const isGalaxy = !isStart && !isSettings && showGalaxy;
            const isHub = !isStart && !isSettings && !isGalaxy && showHub && !!hubSlug;
            const isBundle = !isStart && !isSettings && !isGalaxy && !showHub && ct?.kind === "bundle" && !!ct?.bundleId;
            // Pick the surface-specific label + URL. Start has no
            // meaningful URL to display (root /) so we hide the chip
            // entirely on that surface (founder ask). Settings still
            // shows a non-copyable badge as an orientation cue.
            let labelPrefix = "/";
            let labelId = "";
            let fullUrl = "";
            let copyable = true;
            if (isStart) {
              return null;
            } else if (isSettings) {
              labelPrefix = "/";
              labelId = "settings";
              fullUrl = "https://memory.wiki/settings";
              copyable = false;
            } else if (isGalaxy) {
              labelPrefix = "/";
              labelId = "galaxy";
              fullUrl = "https://memory.wiki/galaxy";
            } else if (isHub) {
              labelPrefix = "/hub/";
              labelId = hubSlug!;
              fullUrl = `https://memory.wiki/hub/${hubSlug}`;
            } else if (isBundle) {
              labelPrefix = "/b/";
              labelId = ct!.bundleId!;
              fullUrl = `https://memory.wiki/b/${ct!.bundleId}`;
            } else {
              const cid = ct?.cloudId || docId;
              if (!cid) return null;
              labelPrefix = "/";
              labelId = cid;
              fullUrl = `https://memory.wiki/${cid}`;
            }
            if (!labelId) return null;
            return (<>
              <button
                className="text-caption font-mono shrink-0 transition-all hidden lg:inline-flex items-center gap-1 px-1.5 h-5 rounded"
                style={{ color: "var(--text-muted)", background: "var(--toggle-bg)", border: "1px solid var(--border-dim)", cursor: copyable ? "pointer" : "default" }}
                title={copyable ? `Copy ${fullUrl}` : labelId}
                onClick={async (e) => {
                  if (!copyable) return;
                  try {
                    await navigator.clipboard.writeText(fullUrl);
                    const btn = e.currentTarget;
                    btn.style.color = "var(--text-primary)";
                    btn.style.borderColor = "var(--text-primary)";
                    setTimeout(() => { btn.style.color = "var(--text-muted)"; btn.style.borderColor = "var(--border-dim)"; }, 800);
                    showToast("URL copied", "success");
                  } catch { /* ignore */ }
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
              >
                {labelPrefix && <span style={{ color: "var(--text-faint)", fontSize: 9 }}>{labelPrefix}</span>}
                <span style={{ letterSpacing: "0.02em" }}>{labelId}</span>
                {copyable && <Copy width={9} height={9} style={{ opacity: 0.55 }} />}
              </button>
              {!isBundle && !isHub && !isStart && !isSettings && viewCount > 0 && (
                <span
                  className="text-caption shrink-0 hidden lg:inline-flex items-center gap-1 px-1.5 h-5 rounded"
                  style={{ color: "var(--text-muted)", background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}
                  title={`${viewCount} total ${viewCount === 1 ? "view" : "views"}`}
                >
                  <Eye width={10} height={10} />
                  <span className="tabular-nums">{viewCount}</span>
                </span>
              )}
            </>);
          })()}
          {/* Read-only / view-only state is now surfaced via the prominent
              banner above the document content (see line ~10745) — the
              inline header badge here was redundant and cluttered the
              top toolbar. */}
          {/* Save status — animated icon + label */}
          <span className="hidden lg:inline-flex items-center gap-1 text-caption shrink-0">
            {autoSave.isSaving && (
              <>
                <Loader2 width={10} height={10} className="animate-spin" style={{ color: "var(--text-faint)" }} />
                <span style={{ color: "var(--text-faint)" }}>Saving</span>
              </>
            )}
            {autoSave.error && !autoSave.isSaving && (
              <>
                <ShieldAlert width={11} height={11} style={{ color: "#ef4444" }} />
                <span style={{ color: "#ef4444" }}>{autoSave.error}</span>
              </>
            )}
            {recentlySaved && !autoSave.isSaving && !autoSave.error && (
              <span className="transition-opacity duration-500" style={{ opacity: 1 }}>
                <span className="inline-flex items-center gap-1">
                  <CircleCheck width={11} height={11} style={{ color: "#22c55e" }} />
                  <span style={{ color: "var(--text-faint)" }}>Saved</span>
                </span>
              </span>
            )}
          </span>
          {/* "Compiled — Memo/FAQ/Brief" badge + "Update synthesis"
              button removed from the header per founder feedback —
              they crowded the title row. The compile metadata is
              still on the Tab object (compileKind / compileFrom /
              compiledAt) and openSynthesisDiff() / recompileDoc()
              remain defined, so the feature can be re-exposed from a
              context menu or details panel later without re-plumbing. */}
        </div>

        {/* Center cluster: [Back/Forward] gap [Home + view modes].
            Desktop (sm:+): absolute-centered as one unit so it floats
            mid-toolbar between left logo and right actions.
            Mobile: stays in normal flow next to the logo (left side),
            so the dead space to the right of the "md" mark fills with
            the pill rail instead of being wasted to the absolute
            translate. */}
        <div
          className="flex items-center gap-1.5 shrink-0 pointer-events-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2"
        >
          {/* Back / Forward — own group, separate from Home.
              Hidden on mobile to free up horizontal room for the
              denser action rail; users navigate via the system
              back/forward (browser chrome) on phones. */}
          {(() => {
            void navTick; // re-evaluate on history tick
            const canBack = navIndexRef.current > 0;
            const canForward = navIndexRef.current >= 0 && navIndexRef.current < navHistoryRef.current.length - 1;
            return (
              <div className="hidden sm:flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
                <Tooltip text="Back" position="bottom">
                  <button
                    onClick={goBack}
                    disabled={!canBack}
                    className="flex items-center justify-center w-7 h-6 transition-colors"
                    style={{
                      background: "var(--toggle-bg)",
                      color: canBack ? "var(--text-muted)" : "var(--text-faint)",
                      opacity: canBack ? 1 : 0.35,
                      cursor: canBack ? "pointer" : "default",
                    }}
                  >
                    <ChevronLeft width={13} height={13} />
                  </button>
                </Tooltip>
                <div style={{ width: 1, height: 14, background: "var(--border-dim)" }} />
                <Tooltip text="Forward" position="bottom">
                  <button
                    onClick={goForward}
                    disabled={!canForward}
                    className="flex items-center justify-center w-7 h-6 transition-colors"
                    style={{
                      background: "var(--toggle-bg)",
                      color: canForward ? "var(--text-muted)" : "var(--text-faint)",
                      opacity: canForward ? 1 : 0.35,
                      cursor: canForward ? "pointer" : "default",
                    }}
                  >
                    <ChevronRight width={13} height={13} />
                  </button>
                </Tooltip>
              </div>
            );
          })()}
          {/* Start + Hub — start-page group. Both buttons are
              "destinations you start from" (Start = your private
              workspace landing; Hub = the public face). Order is
              [Start | Hub] so the private surface leads — most users
              live on Start, Hub is the occasional public-side trip.
              Start uses Sun (fresh-start glyph) so the icon doesn't
              repeat the house-as-home convention; Hub keeps the
              LayoutDashboard grid. Rendered inside one rounded-lg
              pill with a 1px divider between them; the view-mode
              pills live in their own group below. */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
          {/* Start (private workspace landing) */}
          <button
            onClick={() => { setShowOnboarding(true); setShowHub(false); setShowGalaxy(false); setShowSettings(false); if (viewMode === "editor") setViewMode("preview"); }}
            className="flex items-center gap-1 px-2 h-6 text-caption font-medium transition-colors"
            style={{
              background: showOnboarding && !viewMode ? "var(--border)" : showOnboarding ? "var(--border)" : "var(--toggle-bg)",
              color: showOnboarding ? "var(--text-primary)" : "var(--text-muted)",
            }}
            title="Start (Alt+H)"
          >
            <Smile width={13} height={13} />
            <span className="hidden sm:inline">Start</span>
          </button>
          {hubSlug && (() => {
            // Hub is an overlay (like Start / showOnboarding), not a
            // tab. Clicking Hub opens it; clicking it again is a
            // no-op — same as the Start button. To return to a
            // doc/bundle the user clicks the sidebar row (which is
            // still highlighted because activeTabId is untouched).
            // Mutually exclusive with the Start / Settings / Galaxy
            // overlays — opening one closes the others.
            const isHubActive = showHub && !showOnboarding && !showGalaxy;
            const isGalaxyActive = showGalaxy && !showOnboarding;
            return (
              <>
                <div style={{ width: 1, height: 14, background: "var(--border-dim)" }} />
                <Tooltip text="Open My Hub" position="bottom">
                  <button
                    onClick={() => {
                      if (isHubActive) return;
                      setShowOnboarding(false);
                      setShowSettings(false);
                      setShowGalaxy(false);
                      setShowHub(true);
                    }}
                    className="flex items-center gap-1 px-2 h-6 text-caption font-medium transition-colors"
                    style={{
                      background: isHubActive ? "var(--border)" : "var(--toggle-bg)",
                      color: isHubActive ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                    aria-pressed={isHubActive}
                  >
                    <LayoutDashboard width={13} height={13} />
                    <span className="hidden sm:inline">Hub</span>
                  </button>
                </Tooltip>
                <div style={{ width: 1, height: 14, background: "var(--border-dim)" }} />
                <Tooltip text="Open Galaxy — your hub as a constellation" position="bottom">
                  <button
                    onClick={() => {
                      if (isGalaxyActive) return;
                      setShowOnboarding(false);
                      setShowSettings(false);
                      setShowHub(false);
                      // Galaxy wants the full canvas — collapse every
                      // side panel so the cosmos breathes.
                      setShowSidebar(false);
                      setShowAIPanel(false);
                      setShowImagePanel(false);
                      setShowOutlinePanel(false);
                      setShowGalaxy(true);
                    }}
                    className="flex items-center justify-center px-2 h-6 text-caption font-medium transition-colors"
                    style={{
                      background: isGalaxyActive ? "var(--border)" : "var(--toggle-bg)",
                      color: isGalaxyActive ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                    aria-pressed={isGalaxyActive}
                    aria-label="Galaxy"
                  >
                    <Atom width={13} height={13} />
                  </button>
                </Tooltip>
              </>
            );
          })()}
          </div>
          {/* View modes — own group, separate from the start-page pills.
              Describes how the current tab is rendered. Bundle tabs get
              [Bundle | Canvas | List]; everything else gets
              [MD | Split | Source] so the toolbar slot count stays
              consistent across kinds. */}
          {!showGalaxy && <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
          {/* View buttons — different per tab kind. Bundle tabs get
              [Canvas | List]; everything else (doc + hub + onboarding)
              keeps [MD | Split | Source] so the toolbar layout stays
              identical when the user toggles Hub on/off. The view-mode
              choice persists for when the user returns to a doc tab. */}
          {activeTab?.kind === "bundle" ? (
            <>
              {/* Bundle view modes — each glyph picked so no two pills in
                  the toolbar share a shape:
                    Bundle  → Layers (stacked sheets).  The bundle's
                      own identity surface — deploy URL, stats, member
                      docs. Uses the project-wide Bundle primitive glyph
                      so the tab label and icon agree ("Bundle" pill
                      shows THE Bundle icon).
                    Canvas  → Network (nodes + edges).
                    List    → List (hamburger lines).
                  Repeating Layers here doesn't fight the sidebar
                  convention — the toolbar slot and the sidebar status
                  icons live on different surfaces and a user only ever
                  sees one of each at a time. */}
              {([
                { mode: "overview" as const, label: "Bundle", shortcut: "1", icon: <Layers width={13} height={13} /> },
                { mode: "canvas" as const, label: "Canvas", shortcut: "2", icon: <Network width={13} height={13} /> },
                { mode: "list" as const, label: "List", shortcut: "3", icon: <List width={13} height={13} /> },
              ]).map(({ mode, label, shortcut, icon }) => {
              // Active highlight requires the bundle to actually be the
              // visible surface — when Home or Hub is overlaid on top,
              // the bundle is hidden, so the pill must NOT stay
              // highlighted (was the visible asymmetry between Home
              // and Hub: Home cleared the highlight, Hub didn't).
              const active = !showOnboarding && !showHub && !showGalaxy && !showSettings && bundleView === mode;
              return (
                <button key={mode} onClick={() => { setBundleView(mode); setShowOnboarding(false); setShowHub(false); setShowGalaxy(false); setShowSettings(false); }} title={`${label} (Alt+${shortcut})`}
                  className="flex items-center gap-1 px-2 h-6 text-caption font-medium transition-colors"
                  style={{
                    background: active ? "var(--border)" : "var(--toggle-bg)",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                  }}>
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
            </>
          ) : (
          ([
            { mode: "preview" as ViewMode, label: "MD", shortcut: "1", icon: (
              <Eye width={13} height={13} />
            )},
            { mode: "split" as ViewMode, label: "Split", shortcut: "2", icon: (
              <Columns2 width={13} height={13} />
            )},
            { mode: "editor" as ViewMode, label: "Source", shortcut: "3", icon: (
              <Code width={13} height={13} />
            )},
          ]).map(({ mode, label, shortcut, icon }) => {
            // The Live/Split/Source pills only signal an "active" state
            // when the editor is actually showing a doc — on Hub or
            // Onboarding nothing is rendering at viewMode, so the pills
            // stay inactive (the user's last choice persists for when
            // they return to a doc).
            const active = !showOnboarding && !showHub && !showGalaxy && !showSettings && viewMode === mode;
            const hasActiveDoc = tabs.some(t => t.id === activeTabId && !t.deleted);
            // Disable clicks when an overlay surface (Hub / Settings)
            // is on top, or when Onboarding is showing without a real
            // doc to return to. View modes don't apply on those
            // surfaces so a click would be a hidden no-op.
            const disabled = showHub || showGalaxy || showSettings || (showOnboarding && !hasActiveDoc);
            return (
              <button
                key={mode}
                onClick={() => { if (!disabled) { setViewMode(mode); setShowOnboarding(false); setShowHub(false); setShowGalaxy(false); setShowSettings(false); } }}
                disabled={disabled}
                title={`${label} (Alt+${shortcut})`}
                className="flex items-center gap-1 px-2 h-6 text-caption font-medium transition-colors"
                style={{
                  background: active ? "var(--border)" : "var(--toggle-bg)",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })
          )}
          </div>}{/* end view-modes group */}
          {/* Image library — own pill group, same chrome as Start/Hub
              + view-mode groups so it reads as a sibling tab. Visible
              on every surface (Start / Hub / docs / galaxy collapses
              all so skip there) so the panel is reachable without an
              open doc. */}
          {!showGalaxy && (
            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
              <button
                onClick={() => {
                  if (!isAuthenticated) { setShowAuthMenu(true); return; }
                  setShowImagePanel(prev => {
                    if (!prev && !imagesLoading) {
                      setImagesLoading(true);
                      fetch("/api/upload/list", { headers: authHeaders })
                        .then(r => r.ok ? r.json() : null)
                        .then(data => { if (data) { setUserImages(data.images || []); setImageQuota(data.quota); } })
                        .catch(() => {})
                        .finally(() => setImagesLoading(false));
                    }
                    return !prev;
                  });
                  setShowAIPanel(false); setShowHistory(false); setShowExportMenu(false); setShowOutlinePanel(false);
                }}
                className="flex items-center justify-center px-2 h-6 text-caption font-medium transition-colors"
                style={{
                  background: showImagePanel ? "var(--border)" : "var(--toggle-bg)",
                  color: showImagePanel ? "var(--text-primary)" : "var(--text-muted)",
                }}
                aria-pressed={showImagePanel}
                aria-label="Image library"
                title="Image library"
              >
                <ImageIcon width={13} height={13} />
              </button>
            </div>
          )}
        </div>{/* end center cluster */}

        <div className="flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 justify-end" style={{ position: "relative", zIndex: 2 }}>

          {/* AI Render moved to LIVE panel header */}
          {/* Bundle Chat button removed — unified into the right-side Assistant
              panel (activated via the AI button). */}

          {/* Presence indicators — other editors on this document (docs only).
              Each avatar wears its owner's stable user color as an
              outer ring so collaborators are recognizable across
              both avatars and (eventually) remote cursors. The same
              color comes from lib/user-color so the OAuth-photo
              avatars and fallback letter circles share identity. */}
          {activeTab?.kind !== "bundle" && otherEditors.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-1">
              {otherEditors.slice(0, 5).map((editor) => {
                const color = userColor(editor.userId);
                return (
                <div key={editor.userId} className="relative group/presence">
                  {editor.avatarUrl ? (
                    <img
                      src={editor.avatarUrl}
                      alt={editor.displayName || editor.email}
                      className="w-5 h-5 rounded-full shrink-0 object-cover"
                      style={{ outline: `2px solid ${color}`, outlineOffset: "-1px", boxShadow: "0 0 0 1px var(--background)" }}
                      title={editor.displayName || editor.email}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                    />
                  ) : null}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold shrink-0${editor.avatarUrl ? " hidden" : ""}`}
                    style={{ background: color, color: "#000", outline: "2px solid var(--background)" }}
                    title={editor.displayName || editor.email}
                  >
                    {(editor.displayName || editor.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover/presence:opacity-100 transition-opacity z-[9998]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>{editor.displayName || "Unknown"}</div>
                    <div style={{ color: "var(--text-muted)" }}>{editor.email}</div>
                    <div style={{ color }}>Editing now</div>
                  </div>
                </div>
              );})}
              {otherEditors.length > 5 && (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-caption font-bold shrink-0"
                  style={{ background: "var(--toggle-bg)", color: "var(--text-muted)", outline: "2px solid var(--background)" }}>
                  +{otherEditors.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Theme toggle — hidden on mobile, in menu instead */}
          <button
            onClick={toggleTheme}
            className="px-2 h-6 rounded-md transition-colors text-caption hidden sm:flex items-center"
            style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              {theme === "dark"
                ? <><circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 3.4l1-1"/></>
                : <path d="M13.5 8.5a5.5 5.5 0 01-6-6 5.5 5.5 0 106 6z"/>
              }
            </svg>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Notifications bell */}
            {user?.email && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                  }}
                  className="relative h-6 w-6 rounded-md flex items-center justify-center transition-colors"
                  style={{ background: showNotifications ? "var(--border)" : "var(--toggle-bg)", color: showNotifications ? "var(--text-primary)" : "var(--text-muted)" }}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                  title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                >
                  <Bell width={13} height={13} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-caption font-bold" style={{ background: "var(--micro-red)", color: "#fff" }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div
                    className="absolute top-full right-0 mt-1 w-72 max-h-80 overflow-auto rounded-lg shadow-xl z-[9999]"
                    style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                  >
                    <div className="px-3 py-2 text-caption font-semibold" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)" }}>
                      Notifications
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-3 py-4 text-center text-caption" style={{ color: "var(--text-faint)" }}>No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[var(--menu-hover)] flex items-start gap-2.5"
                          style={{ borderBottom: "1px solid var(--border-dim)" }}
                          onClick={async () => {
                            setShowNotifications(false);
                            // Mark this notification as read
                            if (!n.read) {
                              setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                              setUnreadCount(prev => Math.max(0, prev - 1));
                              fetch("/api/notifications", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", ...authHeaders },
                                body: JSON.stringify({ ids: [n.id] }),
                              }).catch(() => {});
                            }
                            if (!n.documentId) return;
                            // Notification clicks should also leave the
                            // Start surface (we're navigating into a doc).
                            setShowOnboarding(false);
                            try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                            // Check if already open as a tab
                            const existing = tabs.find(t => !t.deleted && t.cloudId === n.documentId);
                            if (existing) {
                              switchTab(existing.id);
                              return;
                            }
                            // Fetch and open as new tab
                            try {
                              const res = await fetch(`/api/docs/${n.documentId}`, { headers: authHeaders });
                              if (!res.ok) {
                                setNotifications(prev => prev.filter(x => x.documentId !== n.documentId));
                                return;
                              }
                              const d = await res.json();
                              const perm: "mine" | "editable" | "readonly" =
                                d.isOwner ? "mine"
                                : d.isEditor ? "editable"
                                : "readonly";
                              const newId = `tab-${Date.now()}`;
                              const newTab: Tab = { id: newId, title: d.title || n.documentTitle || "Untitled", markdown: d.markdown, cloudId: n.documentId, permission: perm, shared: perm !== "mine", ownerEmail: d.ownerEmail || n.fromUserName || undefined };
                              // Render immediately, then update tabs
                              setTabs(prev => {
                                const dup = prev.find(t => t.cloudId === n.documentId);
                                if (dup) {
                                  return prev.map(t => t.cloudId === n.documentId ? { ...t, markdown: d.markdown, title: d.title || t.title, permission: perm } : t);
                                }
                                const saved = prev.map(t => t.id !== activeTabIdRef.current || t.readonly ? t : { ...t, markdown: markdownRef.current });
                                return [...saved, newTab];
                              });
                              // Activate the new tab — same bug as the
                              // Shared-with-me click handler: adding to
                              // tabs without setActiveTabId left the canvas
                              // showing the previous selection.
                              activeTabIdRef.current = newTab.id;
                              setActiveTabId(newTab.id);
                              loadTab(newTab);
                              setDocId(n.documentId);
                              setDocEditMode(d.editMode || "token");
                              setIsOwner(perm === "mine");
                              setIsSharedDoc(perm !== "mine");
                              setIsEditor(perm === "editable");
                              setTitle(d.title || n.documentTitle || "Untitled");
                            } catch {
                              window.location.href = `/?from=${n.documentId}`;
                            }
                          }}
                        >
                          <img src={dicebearUrl(n.fromUserName || "user", 24)} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-caption leading-relaxed" style={{ color: n.read ? "var(--text-muted)" : "var(--text-primary)" }}>
                              <span className="font-medium">{n.fromUserName}</span> {n.message}
                            </p>
                            <p className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>
                              {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: "var(--text-primary)" }} />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Presence indicators moved to before theme toggle */}

            <div className="relative group">
              <button
                onClick={handleShare}
                disabled={shareState === "sharing"}
                className="px-2 h-6 rounded-md transition-colors text-caption font-medium flex items-center gap-1.5"
                title={`Share (${mod}+S)`}
                style={{
                  background: shareState === "copied" ? "rgba(34, 197, 94, 0.2)" : "var(--toggle-bg)",
                  color: shareState === "copied" ? "#4ade80" : "var(--text-muted)",
                }}
              >
                {shareState === "sharing" ? (
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/></svg>
                ) : (
                  <Share2 width={11} height={11} />
                )}
                <span className="hidden sm:inline">{shareButtonLabel}</span>
              </button>
              <div className="absolute top-full mt-1.5 right-0 w-48 p-2.5 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                {(() => {
                  const ct = tabs.find(t => t.id === activeTabId);
                  const isMine = !ct?.permission || ct.permission === "mine";
                  if (docId && isMine) return (
                    <>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Share Settings</p>
                      <p>Manage who can view or edit this document. Add people by email, set general access, and copy the share link.</p>
                    </>
                  );
                  if (docId && !isMine) return (
                    <>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Share</p>
                      <p>View document info, copy the share link, or request edit access from the owner.</p>
                    </>
                  );
                  return (
                    <>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Share</p>
                      <p>Publish and create a share link for this document. Changes auto-save automatically. <span style={{ color: "var(--text-faint)" }}>{mod}+S</span></p>
                    </>
                  );
                })()}
              </div>
            </div>
            {/* Universal Assistant button — always visible, but disabled
                when there's no doc/bundle being viewed (start screen, or no
                editable doc/bundle). Always renders Sparkles: this is the
                AI surface, not a Bundle/Doc primitive (Layers belongs to the
                Bundle icon family used in the sidebar). */}
            {(() => {
              const isBundle = activeTab?.kind === "bundle" && !!activeTab.bundleId;
              const isDoc = !!activeTab && activeTab.kind !== "bundle" && canEdit && !showOnboarding;
              const enabled = !showOnboarding && (isBundle || isDoc);
              const tip = enabled
                ? (isBundle ? "Bundle Assistant" : "Document Assistant")
                : "Open a document or bundle to use the Assistant";
              return (
                <Tooltip text={tip} position="left">
                  <button
                    onClick={() => { if (!enabled) return; setShowAIPanel(prev => !prev); setShowExportMenu(false); setShowHistory(false); setShowImagePanel(false); setShowOutlinePanel(false); }}
                    disabled={!enabled}
                    className="px-2 h-6 rounded-md transition-colors flex items-center gap-1.5 text-caption font-medium"
                    style={{
                      background: !enabled ? "var(--toggle-bg)" : (showAIPanel || aiProcessing ? "var(--border)" : "var(--toggle-bg)"),
                      color: !enabled ? "var(--text-faint)" : (showAIPanel || aiProcessing ? "var(--text-primary)" : "var(--text-muted)"),
                      opacity: !enabled ? 0.45 : 1,
                      cursor: !enabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {aiProcessing ? <Loader2 width={11} height={11} className="animate-spin" /> : <Sparkles width={11} height={11} />}
                    <span className="hidden sm:inline">Chat</span>
                  </button>
                </Tooltip>
              );
            })()}
            <div className="relative" ref={menuRef} style={{ display: "none" }}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="px-1.5 h-6 rounded-md transition-colors flex items-center"
                title="Menu"
                style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                <Menu width={16} height={16} />
              </button>
              {showMenu && (
                <div
                  className="fixed w-48 rounded-lg shadow-xl"
                  style={{ zIndex: 9999, background: "var(--menu-bg)", border: "1px solid var(--border)", top: menuRef.current ? menuRef.current.getBoundingClientRect().bottom + 4 : 0, right: 8 }}
                >
                  <div className="py-1">
                    <button
                      onClick={handleCopyHtml}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Copy HTML
                      <span className="float-right hidden sm:inline" style={{ color: "var(--text-muted)" }}>{isMac ? "⌘⇧C" : "Ctrl+Shift+C"}</span>
                    </button>
                    <button
                      onClick={handleCopyRichText}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Copy for Docs / Email
                    </button>
                    <button
                      onClick={handleCopySlack}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Copy for Slack
                    </button>
                    <button
                      onClick={handleDownloadMd}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Download .md
                    </button>
                    <button
                      onClick={handleExportPdf}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Export PDF
                    </button>
                    {docId && (
                      <>
                        <button
                          onClick={() => { setShowQr(true); setShowMenu(false); }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          QR Code
                        </button>
                        <button
                          onClick={() => {
                            const code = `<iframe src="https://memory.wiki/embed/${docId}" width="100%" height="500" frameborder="0" style="border:1px solid #27272a;border-radius:8px;"></iframe>`;
                            copyToClipboard(code);
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs transition-colors"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          Copy Embed Code
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setCanvasMermaid(undefined); setShowMermaidModal(true); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      New Mermaid Diagram
                    </button>
                    <button
                      onClick={() => { setInitialMath(undefined); setShowMathModal(true); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      New Math Equation
                    </button>
                    <hr style={{ borderColor: "var(--border)" }} className="my-1" />
                    <button
                      onClick={() => { addTab(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      New tab
                    </button>
                    <button
                      onClick={() => { toggleTheme(); setShowMenu(false); }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </button>
                    <hr style={{ borderColor: "var(--border)" }} className="my-1" />
                    <button
                      onClick={handleClear}
                      className="w-full text-left px-3 py-2 text-xs transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Clear document
                    </button>
                    {isOwner && docId && (
                      <>
                        <hr style={{ borderColor: "var(--border)" }} className="my-1" />
                        <div className="px-3 py-1.5">
                          <div className="text-caption font-mono uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Document Settings</div>
                          {/* Rotate edit token */}
                          {confirmRotateToken ? (
                            <div className="py-1.5">
                              <p className="text-caption mb-2" style={{ color: "var(--text-muted)" }}>This will invalidate all existing edit links.</p>
                              <div className="flex gap-1">
                                <button onClick={() => setConfirmRotateToken(false)} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>Cancel</button>
                                <button onClick={handleRotateToken} disabled={rotatingToken} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "var(--border)", color: "var(--text-primary)" }}>
                                  {rotatingToken ? "Rotating..." : "Confirm"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={handleRotateToken}
                              className="w-full text-left text-xs py-1.5 transition-colors"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              Rotate edit token
                            </button>
                          )}
                        </div>
                        <hr style={{ borderColor: "var(--border)" }} className="my-1" />
                        {confirmDeleteDoc ? (
                          <div className="px-3 py-2">
                            <p className="text-caption mb-2" style={{ color: "var(--text-muted)" }}>Delete this shared document?</p>
                            <div className="flex gap-1">
                              <button onClick={() => setConfirmDeleteDoc(false)} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>Cancel</button>
                              <button onClick={handleDelete} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Delete</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={handleDelete}
                            className="w-full text-left px-3 py-2 text-xs transition-colors"
                            style={{ color: "#ef4444" }}
                          >
                            Delete shared doc
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine badge moved to footer */}
        </div>
        </div>{/* end Row 1 */}

        {/* Row 2: Mobile-only — title + permission + save status */}
        {(title || (() => { const ct = tabs.find(t => t.id === activeTabId); return ct?.permission === "readonly"; })()) && (
          <div className="flex sm:hidden items-center gap-2 px-3 pb-1.5 min-w-0">
            {title && (
              <span className="text-caption truncate flex-1 min-w-0" style={{ color: "var(--text-muted)" }}>
                {title}
              </span>
            )}
            {(() => {
              const ct = tabs.find(t => t.id === activeTabId);
              const cid = ct?.cloudId || docId;
              if (!cid) return null;
              return (
                <button
                  className="text-caption font-mono px-1 py-0.5 rounded shrink-0"
                  style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}
                  title="Click to copy document URL"
                  onClick={async () => { try { await navigator.clipboard.writeText(`https://memory.wiki/${cid}`); showToast("URL copied", "success"); } catch {} }}
                >
                  /{cid}
                </button>
              );
            })()}
            {autoSave.isSaving && (
              <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>Saving...</span>
            )}
            {autoSave.error && !autoSave.isSaving && (
              <span className="text-caption font-mono shrink-0" style={{ color: "#ef4444" }}>{autoSave.error}</span>
            )}
            {autoSave.lastSaved && !autoSave.isSaving && !autoSave.error && (
              <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)", opacity: 0.5 }}>Saved</span>
            )}
            {docId && isOwner && viewCount > 0 && (
              <span className="text-caption font-mono shrink-0" style={{ color: "var(--text-faint)" }}>
                {viewCount} {viewCount === 1 ? "view" : "views"}
              </span>
            )}
            {/* Mobile-row VIEW ONLY badge removed — banner above the
                document content now surfaces this state for both example
                tabs and shared view-only docs. */}
          </div>
        )}
      </header>

      {/* AI conversation banner */}
      {showAiBanner && (
        <div
          className="flex items-center justify-between px-3 sm:px-5 py-2 text-xs"
          style={{ background: "var(--border)", borderBottom: "1px solid var(--border-dim)" }}
        >
          <span style={{ color: "var(--text-primary)" }}>
            AI conversation detected. Format as a clean document?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleFormatAiConversation}
              className="px-2.5 py-1 rounded font-mono text-caption"
              style={{ background: "var(--text-primary)", color: "var(--background)", fontWeight: 600 }}
              title="Format AI conversation as a clean document"
            >
              Format
            </button>
            <button
              onClick={() => setShowAiBanner(false)}
              className="px-2 py-1 rounded font-mono text-caption"
              style={{ color: "var(--text-muted)" }}
              title="Dismiss this suggestion"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main content wrapper (sidebar + editor/render). Resize listeners are
          attached to the window via useEffect so they survive the cursor
          crossing over child components (e.g. ReactFlow) that capture
          pointermove for their own panning. */}
      <div
        data-resize-wrapper
        className="flex flex-1 min-h-0 overflow-hidden relative"
        onClick={() => { if (docContextMenu) setDocContextMenu(null); if (folderContextMenu) setFolderContextMenu(null); if (sidebarContextMenu) setSidebarContextMenu(null); if (bundleContextMenu) setBundleContextMenu(null); }}
      >

      {/* Sidebar */}
      {showSidebar ? (
        <>
        {/* Mobile sidebar backdrop — confined to the content area below
            the header (absolute inside data-resize-wrapper, not fixed
            to viewport) so the header stays interactive and uncovered. */}
        {isMobile && showSidebar && (
          <div
            className="absolute inset-0 z-[200]"
            style={{ background: sidebarClosing ? "transparent" : "rgba(0,0,0,0.4)", transition: "background 0.25s ease" }}
            onClick={() => closeSidebar()}
          />
        )}
        <div
          className={`flex flex-col shrink-0 ${isMobile ? "absolute left-0 top-0 bottom-0 z-[201] shadow-2xl" : "relative"}`}
          data-pane="sidebar"
          style={{
            width: isMobile ? 260 : sidebarWidth,
            minWidth: isMobile ? 260 : 240,
            background: "var(--background)",
            borderRight: "1px solid var(--border-dim)",
            transition: isMobile ? "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)" : "width 0.15s ease",
            // Flat chrome — desktop sidebar has no boxShadow; the
            // mobile overlay keeps shadow-2xl because it actually
            // floats above content.
            zIndex: isMobile ? 201 : 10,
            ...(isMobile ? { transform: sidebarClosing ? "translateX(-100%)" : "translateX(0)" } : {}),
          }}
        >
          {/* Header — toggle button + LIBRARY + actions; search row expands below when toggled.
              Boundary with the section list below is owned by the first section
              header's borderTop now, so this wrapper no longer needs its own
              borderBottom (which would stack as a doubled line). */}
          <div className="shrink-0 select-none">
          <div
            data-library-header
            className="flex items-center justify-between px-2 py-1.5 text-caption font-mono"
            style={{ color: "var(--text-muted)", cursor: "default" }}
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Tooltip text="Close sidebar">
                <button
                  onClick={() => closeSidebar()}
                  className="p-1 rounded transition-colors shrink-0"
                  style={{ color: "var(--text-primary)" }}
                >
                  <PanelLeft width={14} height={14} />
                </button>
              </Tooltip>
              <span style={{ color: "var(--text-primary)" }} className="shrink-0">LIBRARY</span>
            </div>
            <div className="flex items-stretch gap-0.5 shrink-0">
              {/* Library-level sort removed — each section (MDs,
                  MD Bundles) has its own sort dropdown in its header
                  now, which makes the global one redundant. */}
              {(() => {
                const allFolders = folders;
                const anyOpen = allFolders.some(f => !f.collapsed) || showRecent || showStarred || showMyBundles || showMyDocs || showSharedDocs || showExamples || showTrash;
                return (
                  <Tooltip text={anyOpen ? "Collapse all sections + folders" : "Expand all sections + folders"}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (anyOpen) {
                          setShowRecent(false); setShowStarred(false); setShowMyBundles(false); setShowMyDocs(false); setShowSharedDocs(false); setShowExamples(false); setShowTrash(false);
                          setFolders(prev => prev.map(f => ({ ...f, collapsed: true })));
                          allFolders.forEach(f => { if (!f.collapsed) fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, collapsed: true }) }).catch(() => {}); });
                        } else {
                          setShowRecent(true); setShowStarred(true); setShowMyBundles(true); setShowMyDocs(true); setShowSharedDocs(true); setShowExamples(true); setShowTrash(true);
                          setFolders(prev => prev.map(f => ({ ...f, collapsed: false })));
                          allFolders.forEach(f => { if (f.collapsed) fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, collapsed: false }) }).catch(() => {}); });
                        }
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]" data-action="organize"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {anyOpen ? <ChevronsDownUp width={12} height={12} /> : <ChevronsUpDown width={12} height={12} />}
                    </button>
                  </Tooltip>
                );
              })()}
              {/* Direct Import button — replaces the old + dropdown.
                  New document / New bundle are now reachable from
                  each section's own + button, so the Library header
                  doesn't need to mediate them. One click → modal. */}
              <Tooltip text="Import from Files, GitHub, Obsidian, URL, or Notion">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowImportModal(true); }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]" data-action="import"
                  style={{ color: "var(--text-faint)" }}
                >
                  <Download width={12} height={12} />
                </button>
              </Tooltip>
              <Tooltip text="Refresh from server">
                <button
                  id="sidebar-refresh-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user?.id) return;
                    setRefreshSpinning(true);
                    // Refresh everything the sidebar surfaces — docs,
                    // bundles, folders — in parallel. Three real fixes
                    // here over the earlier silent-fail version:
                    //   1. `cache: "no-store"` so the browser HTTP
                    //      cache doesn't serve a stale 304 against
                    //      the same URL the user just hit a moment
                    //      before (the primary cause of "refresh
                    //      does nothing" reports).
                    //   2. Promise.all + spinner stops on actual
                    //      completion — not a hardcoded 600ms.
                    //   3. console.warn on failed fetches so a stale
                    //      access token (401) is at least visible in
                    //      DevTools instead of silently swallowed.
                    const opts: RequestInit = { headers: authHeaders, cache: "no-store" };
                    const docsP = fetch("/api/user/documents?includeDeleted=1", opts)
                      .then(res => {
                        if (!res.ok) { console.warn("[sidebar refresh] docs", res.status); return null; }
                        return res.json();
                      })
                      .then(data => {
                        if (!data?.documents) return;
                        setServerDocs(data.documents);
                        ingestDocAiMeta(data.documents);
                        // Full resync of cloud tabs — title, draft state, shared
                        // state, restricted state, source, edit mode, folder,
                        // soft-delete. The previous version only patched
                        // `source` on existing tabs, so a doc renamed on
                        // another device kept its old title in the sidebar
                        // even after Refresh. This mirrors the realtime
                        // postgres_changes sync further up the file so both
                        // paths produce identical state.
                        type ServerDoc = {
                          id: string; title?: string; source?: string | null;
                          is_draft?: boolean; folder_id?: string | null;
                          allowed_emails?: string[]; edit_mode?: string;
                          updated_at?: string; created_at?: string;
                          deleted_at?: string | null;
                        };
                        const docs = data.documents as ServerDoc[];
                        const docsById = new Map(docs.map(d => [d.id, d]));
                        const publishedIds = new Set(docs.filter(d => d.is_draft === false).map(d => d.id));
                        const ownerEmailLower = user?.email?.toLowerCase();
                        const restrictedIds = new Set(
                          docs.filter(d => {
                            const ae = d.allowed_emails || [];
                            if (ae.length === 0) return false;
                            return ae.some(e => e.toLowerCase() !== ownerEmailLower);
                          }).map(d => d.id)
                        );
                        const sourceMap = new Map(docs.map(d => [d.id, d.source ?? null]));
                        const editModeMap = new Map(docs.map(d => [d.id, d.edit_mode || "token"]));
                        const sharedCountMap = new Map(docs.map(d => {
                          const others = (d.allowed_emails || []).filter(e => e.toLowerCase() !== (ownerEmailLower || ""));
                          return [d.id, others.length];
                        }));
                        setTabs(prev => {
                          const existingCloudIds = new Set(prev.filter(t => t.cloudId).map(t => t.cloudId!));
                          // 1. Update fields on existing cloud tabs.
                          const updated = prev.map(t => {
                            if (!t.cloudId) return t;
                            const sd = docsById.get(t.cloudId);
                            if (!sd) return t; // deletion handled below
                            const newTitle = sd.title || "Untitled";
                            const newDraft = !publishedIds.has(t.cloudId);
                            const newShared = publishedIds.has(t.cloudId);
                            const newRestricted = restrictedIds.has(t.cloudId);
                            const newSource = sourceMap.get(t.cloudId) || undefined;
                            const newEditMode = editModeMap.get(t.cloudId) || "token";
                            const newSharedCount = sharedCountMap.get(t.cloudId) || 0;
                            const newFolderId = sd.folder_id || undefined;
                            if (
                              t.title === newTitle &&
                              t.isDraft === newDraft &&
                              t.isSharedByMe === newShared &&
                              t.isRestricted === newRestricted &&
                              t.source === newSource &&
                              t.editMode === newEditMode &&
                              t.sharedWithCount === newSharedCount &&
                              t.folderId === newFolderId
                            ) return t;
                            return {
                              ...t,
                              title: newTitle,
                              isDraft: newDraft,
                              isSharedByMe: newShared,
                              isRestricted: newRestricted,
                              source: newSource,
                              editMode: newEditMode,
                              sharedWithCount: newSharedCount,
                              folderId: newFolderId,
                            };
                          });
                          // 2. Reflect deletion state. Hard-deleted = absent
                          //    from server response → drop the tab (unless
                          //    it's currently active so the editor can show
                          //    a placeholder). Soft-deleted (deleted_at set)
                          //    → keep the tab but mark deleted. Server
                          //    un-deleted → flip the local flag back.
                          const filtered = updated.flatMap(t => {
                            if (!t.cloudId) return [t];
                            const sd = docsById.get(t.cloudId);
                            if (!sd) {
                              if (t.id === activeTabIdRef.current) return [t];
                              return [];
                            }
                            const isSoft = !!sd.deleted_at;
                            if (isSoft && !t.deleted) {
                              return [{ ...t, deleted: true, deletedAt: new Date(sd.deleted_at!).getTime() }];
                            }
                            if (!isSoft && t.deleted) {
                              return [{ ...t, deleted: false, deletedAt: undefined }];
                            }
                            return [t];
                          });
                          // 3. Add new server docs that aren't local yet.
                          const newTabs = docs
                            .filter(d => !existingCloudIds.has(d.id))
                            .map(d => ({
                              id: `cloud-${d.id}`,
                              title: d.title || "Untitled",
                              markdown: "",
                              cloudId: d.id,
                              isDraft: d.is_draft !== false,
                              source: d.source || undefined,
                              folderId: d.folder_id || undefined,
                              permission: "mine" as const,
                              lastOpenedAt: d.updated_at
                                ? new Date(d.updated_at).getTime()
                                : d.created_at ? new Date(d.created_at).getTime() : Date.now(),
                            }));
                          return [...filtered, ...newTabs];
                        });
                      })
                      .catch(err => console.warn("[sidebar refresh] docs threw", err));
                    const bundlesP = fetch("/api/bundles", opts)
                      .then(res => {
                        if (!res.ok) { console.warn("[sidebar refresh] bundles", res.status); return null; }
                        return res.json();
                      })
                      .then(data => { if (data?.bundles) setBundles(data.bundles); })
                      .catch(err => console.warn("[sidebar refresh] bundles threw", err));
                    const foldersP = fetch("/api/user/folders", opts)
                      .then(res => {
                        if (!res.ok) { console.warn("[sidebar refresh] folders", res.status); return null; }
                        return res.json();
                      })
                      .then(data => {
                        if (!data?.folders) return;
                        setFolders(data.folders.map((f: { id: string; name: string; collapsed?: boolean; section?: string; parent_id?: string | null; emoji?: string; sort_order?: number }) => ({
                          id: f.id,
                          name: f.name,
                          collapsed: f.collapsed || false,
                          section: (f.section || "my") as "my" | "shared",
                          parentId: f.parent_id || null,
                          emoji: f.emoji || undefined,
                          sortOrder: f.sort_order ?? 0,
                        })));
                      })
                      .catch(err => console.warn("[sidebar refresh] folders threw", err));
                    try { await Promise.all([docsP, bundlesP, foldersP]); }
                    finally { setRefreshSpinning(false); }
                  }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]" data-action="refresh"
                  style={{ color: "var(--text-faint)" }}
                >
                  <RefreshCw width={11} height={11} className={refreshSpinning ? "animate-spin" : ""} />
                </button>
              </Tooltip>
              <Tooltip text="What do the icons and filters mean?">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSidebarHelp(prev => !prev); }}
                  className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]" data-action="help"
                  style={{ color: showSidebarHelp ? "var(--text-primary)" : "var(--text-faint)" }}
                >
                  <HelpCircle width={12} height={12} />
                </button>
              </Tooltip>
            </div>
          </div>
          {/* Search row — always visible under Library header. This is a
              LOCAL filter over the sidebar tree (not global search; ⌘K
              opens the command palette for that). Sits on the sidebar's
              --background; sticky section headers below use --surface so
              the visual rhythm goes: background (sidebar wall, search
              row) → surface (section header). Search input box itself
              stays unfilled (transparent). */}
          <div className="px-2 pb-1.5 flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 flex-1 px-2 rounded" style={{ background: "transparent", border: `1px solid ${sidebarSearch ? "var(--text-primary)" : "var(--border-dim)"}` }}>
              <Search width={11} height={11} className="shrink-0" style={{ color: sidebarSearch ? "var(--text-primary)" : "var(--text-faint)" }} />
              <input
                ref={sidebarSearchInputRef}
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSidebarSearch(""); (e.currentTarget as HTMLInputElement).blur(); } }}
                placeholder="Search…"
                className="w-full text-caption py-1 bg-transparent outline-none"
                style={{ color: "var(--text-secondary)", border: "none" }}
              />
              {sidebarSearch ? (
                <>
                  <span className="shrink-0 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>
                    {searchMatchCount}
                  </span>
                  <button
                    onClick={() => setSidebarSearch("")}
                    className="shrink-0 w-4 h-4 rounded flex items-center justify-center hover:bg-[var(--border-dim)]"
                    style={{ color: "var(--text-faint)" }}
                    title="Clear (Esc)"
                  >
                    <X width={9} height={9} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
          </div>
          {/* Hidden file input for Obsidian vault ZIP. Separate from
              the main import input so the system picker shows only
              .zip files when the user picks the Obsidian path. */}
          <input
            ref={obsidianFileRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = ""; // reset so re-picking the same file fires change
              if (!file) return;
              if (!user?.id) { showToast("Sign in to import an Obsidian vault", "error"); return; }
              const form = new FormData();
              form.append("file", file);
              showToast(`Importing ${file.name}…`, "info");
              try {
                const res = await fetch("/api/import/obsidian", {
                  method: "POST",
                  headers: { ...authHeaders },
                  body: form,
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) { showToast(json.error || `Import failed (${res.status})`, "error"); return; }
                const { imported = 0, deduplicated = 0, failed = 0, skipped = 0 } = json as { imported?: number; deduplicated?: number; failed?: number; skipped?: number };
                const parts = [
                  imported > 0 ? `${imported} imported` : null,
                  deduplicated > 0 ? `${deduplicated} already in your hub` : null,
                  skipped > 0 ? `${skipped} skipped` : null,
                  failed > 0 ? `${failed} failed` : null,
                ].filter(Boolean);
                showToast(parts.length > 0 ? parts.join(", ") : "Nothing to import", "success");
                fetch("/api/user/documents?includeDeleted=1", { headers: authHeaders })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((data) => { if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents); })
                  .catch(() => {});
              } catch { showToast("Import failed", "error"); }
            }}
          />
          {/* Hidden file input for import */}
          <input
            ref={importFileRef}
            type="file"
            accept={getSupportedAcceptString()}
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              await runFileImport(files);
            }}
          />
          {/* Hidden file input for image upload */}
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length === 0) return;
              if (files.length > 1) showToast(`Uploading ${files.length} images...`, "info");
              for (const file of files) {
                const url = await uploadImage(file);
                if (url) {
                  // Insert via Tiptap if editor available
                  const ed = tiptapRef.current?.getEditor();
                  if (ed) {
                    ed.chain().focus().setImage({ src: url, alt: file.name }).run();
                  } else {
                    // Fallback: append to markdown
                    const md = markdownRef.current;
                    const imgMd = `![${file.name}](${url})\n`;
                    const newMd = md + (md.endsWith("\n") ? "\n" : "\n\n") + imgMd;
                    setMarkdownRaw(newMd);
                    cmSetDocRef.current?.(newMd);
                    doRender(newMd);
                  }
                }
              }
              e.target.value = "";
            }}
          />
          {/* Help panel — global, under FILES header */}
          {showSidebarHelp && (
            <div className="shrink-0 mx-2 mt-1.5 mb-1.5 p-2.5 rounded-md text-caption space-y-2" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}>
              <div className="font-semibold text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Filters</div>
              <div className="flex items-center gap-2"><span className="shrink-0 font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>ALL</span><span style={{ color: "var(--text-muted)" }}>All your documents</span></div>
              <div className="flex items-center gap-2"><span className="shrink-0 font-semibold" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>PRIVATE</span><span style={{ color: "var(--text-muted)" }}>Not shared with anyone (includes synced)</span></div>
              <div className="flex items-center gap-2"><span className="shrink-0 font-semibold" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>SHARED</span><span style={{ color: "var(--text-muted)" }}>Shared with others</span></div>
              <div className="flex items-center gap-2"><span className="shrink-0 font-semibold" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>SYNCED</span><span style={{ color: "var(--text-muted)" }}>From VS Code, Desktop, CLI, or MCP</span></div>
              <div className="my-1.5" style={{ borderTop: "1px solid var(--border-dim)" }} />
              <div className="font-semibold text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Document Icons</div>
              <div className="flex items-center gap-2"><Globe width={12} height={12} style={{ color: "#22c55e" }} /><span style={{ color: "var(--text-muted)" }}>Public — anyone with the link can read</span></div>
              <div className="flex items-center gap-2"><Users width={12} height={12} style={{ color: "#60a5fa" }} /><span style={{ color: "var(--text-muted)" }}>Shared — password or specific people</span></div>
              <div className="flex items-center gap-2"><Cloud width={12} height={12} style={{ color: "var(--micro-info)" }} /><span style={{ color: "var(--text-muted)" }}>Private — saved to cloud, only you can read</span></div>
              <div className="flex items-center gap-2"><Eye width={12} height={12} style={{ color: "#a78bfa" }} /><span style={{ color: "var(--text-muted)" }}>View only — shared with you</span></div>
              <div className="flex items-center gap-2">
                <div className="relative shrink-0" style={{ width: 12, height: 12 }}>
                  <Globe width={12} height={12} style={{ color: "#22c55e" }} />
                  <svg className="absolute -bottom-[2px] -right-[2px]" width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill="var(--toggle-bg)" /><path d="M2.5 4.2L3.5 5.2L5.5 3" stroke="#22c55e" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                </div>
                <span style={{ color: "var(--text-muted)" }}>+ Synced (VS Code, Desktop, CLI, MCP)</span>
              </div>
              <div className="my-1.5" style={{ borderTop: "1px solid var(--border-dim)" }} />
              <div className="font-semibold text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Bundle Icons</div>
              <div className="flex items-center gap-2"><Layers width={12} height={12} style={{ color: "var(--text-faint)" }} /><span style={{ color: "var(--text-muted)" }}>Private bundle</span></div>
              <div className="flex items-center gap-2">
                <div className="relative shrink-0" style={{ width: 14, height: 12 }}>
                  <Layers width={12} height={12} style={{ color: "#4ade80" }} />
                  <Globe width={7} height={7} className="absolute" style={{ color: "#4ade80", right: -1, bottom: -2, background: "var(--toggle-bg)", borderRadius: 3 }} />
                </div>
                <span style={{ color: "var(--text-muted)" }}>Published bundle (anyone with link)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative shrink-0" style={{ width: 14, height: 12 }}>
                  <Layers width={12} height={12} style={{ color: "#4ade80" }} />
                  <Lock width={7} height={7} className="absolute" style={{ color: "#f59e0b", right: -1, bottom: -2, background: "var(--toggle-bg)", borderRadius: 3 }} />
                </div>
                <span style={{ color: "var(--text-muted)" }}>Password-protected bundle</span>
              </div>
            </div>
          )}
          {/* Document list — sections stack naturally; whole list scrolls if it
              exceeds viewport. Avoids the previous "empty space in the middle"
              issue where expanded sections used flex-1 even when their content
              was short, pushing collapsed headers far below. */}
          <div ref={sectionsScrollRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto sidebar-scroll" onContextMenu={(e) => {
            e.preventDefault();
            setDocContextMenu(null);
            setFolderContextMenu(null);
            setSidebarContextMenu({ x: e.clientX, y: e.clientY });
          }}>
            {/* ── Section: STARRED (top, above Recent) ─────────────
                Owner-only pin list. Renders only when there's at
                least one pin so the sidebar doesn't grow an empty
                header. Sits above Recent because "starred" is
                deliberate recall, not history. Title is plain mixed
                case (not the SCREAMING uppercase used elsewhere) per
                founder ask. */}
            {pins.length > 0 && (
              <div className="shrink-0 flex flex-col">
                <div
                  data-section-id="starred"
                  className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                  style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                  onClick={() => setShowStarred(!showStarred)}
                >
                  <ChevronDown
                    width={10} height={10}
                    className={`shrink-0 transition-transform ${showStarred ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                    style={{ transform: showStarred ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                  <Star width={11} height={11} style={{ color: "var(--micro-warn)", fill: "var(--micro-warn)" }} />
                  <span className={`flex-1 text-caption font-medium transition-colors ${showStarred ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>
                    Starred
                  </span>
                  <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
                    {pins.length}
                  </span>
                </div>
                {showStarred && (
                <div className="px-2 pb-1 space-y-0.5">
                  {pins.map((p) => {
                    let title = "Untitled";
                    let onOpen: (() => void) | null = null;
                    // Match the icon to the source section — docs use
                    // DocStatusIcon (private/restricted/draft glyphs),
                    // bundles use renderBundleStatusIcon (the same
                    // Layers + colored dot the MD Bundles section
                    // renders). Generic FileIcon/Layers fallbacks
                    // only fire when the underlying tab/bundle row
                    // hasn't been loaded yet.
                    let iconNode: React.ReactNode = null;
                    if (p.kind === "document") {
                      const t = memoAllMyTabs.find((x) => x.cloudId === p.id);
                      if (t) {
                        title = t.title || "Untitled";
                        iconNode = <DocStatusIcon tab={t} isActive={false} />;
                      } else {
                        iconNode = <FileIcon width={12} height={12} className="shrink-0" style={{ color: "var(--text-faint)" }} />;
                      }
                      onOpen = () => {
                        const existing = tabs.find((x) => x.cloudId === p.id && !x.deleted);
                        if (existing) { switchTab(existing.id); return; }
                        const newId = `tab-${tabIdCounter++}`;
                        const newTab: Tab = { id: newId, title, markdown: "", cloudId: p.id, permission: "mine" };
                        setTabs((prev) => [...prev, newTab]);
                        switchTab(newId);
                      };
                    } else {
                      const b = bundles.find((x) => x.id === p.id);
                      if (b) title = b.title || "Untitled Bundle";
                      iconNode = renderBundleStatusIcon(p.id, 14);
                      onOpen = () => {
                        const existing = tabs.find((x) => x.kind === "bundle" && x.bundleId === p.id);
                        if (existing) { switchTab(existing.id); return; }
                        const newId = `bundle-${p.id}-${Date.now()}`;
                        const newTab: Tab = { id: newId, kind: "bundle", bundleId: p.id, title, markdown: "" };
                        setTabs((prev) => [...prev, newTab]);
                        switchTab(newId);
                      };
                    }
                    return (
                      <div
                        key={`${p.kind}:${p.id}`}
                        onClick={onOpen}
                        className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer text-caption transition-colors hover:bg-[var(--toggle-bg)] group/pin"
                        style={{ color: "var(--text-secondary)" }}
                        title={title}
                      >
                        <span className="shrink-0">{iconNode}</span>
                        <span className="flex-1 min-w-0 truncate text-body">{title}</span>
                        {/* hidden/flex toggle (not opacity-0) so the unstar
                            button is fully removed from layout when not
                            hovered — the title above gets the entire row
                            width. On hover the button takes its w-4 + gap
                            slot and the title shrinks to accommodate.
                            Matches Recent row behavior. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); void togglePin(p.kind, p.id); }}
                          className="shrink-0 w-4 h-4 rounded items-center justify-center transition-colors hover:bg-[var(--border)] hidden group-hover/pin:flex"
                          style={{ color: "var(--text-faint)" }}
                          title="Unstar"
                        >
                          <Star width={10} height={10} style={{ fill: "currentColor" }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* ── Section: RECENT (top) — last 7 visited tabs, separate from main tree ──
                Each entry can come from one of three sources:
                  1. Existing local Tab (id matches a tab) — normal case.
                  2. "ghost" bundle: id parses as `bundle-<bundleId>-<ts>` and
                     bundles[] still has that bundleId. Happens after logout
                     wipes bundle tabs but recentTabIds was preserved.
                  3. Unresolvable — drop. */}
            {(() => {
              type RecentEntry =
                | { kind: "tab"; id: string; tab: Tab }
                | { kind: "ghost-bundle"; id: string; bundleId: string };
              const resolveRecent = (id: string): RecentEntry | null => {
                const tab = tabs.find(t => t.id === id && !t.deleted);
                if (tab) return { kind: "tab", id, tab };
                const m = /^bundle-(.+)-\d+$/.exec(id);
                if (m) {
                  const bundleId = m[1];
                  if (bundles.some(b => b.id === bundleId)) {
                    return { kind: "ghost-bundle", id, bundleId };
                  }
                }
                return null;
              };
              const openGhostBundle = (bundleId: string) => {
                const b = bundles.find(x => x.id === bundleId);
                if (!b) return;
                setShowOnboarding(false);
                const existing = tabs.find(t => t.kind === "bundle" && t.bundleId === b.id);
                if (existing) { switchTab(existing.id); return; }
                const newId = `bundle-${b.id}-${Date.now()}`;
                const newTab: Tab = { id: newId, kind: "bundle", bundleId: b.id, title: b.title || "Untitled Bundle", markdown: "" };
                flushSync(() => { setTabs(prev => [...prev, newTab]); });
                switchTab(newId);
              };
              const recentEntries: RecentEntry[] = [];
              for (const id of recentTabIds) {
                const r = resolveRecent(id);
                if (!r) continue;
                // Hub tabs are reachable from the dedicated toolbar
                // button — never let one occupy a slot in Recent.
                if (r.kind === "tab" && r.tab.kind === "hub") continue;
                recentEntries.push(r);
                if (recentEntries.length >= 7) break;
              }
              const recentTabs = recentEntries
                .filter((r): r is Extract<RecentEntry, { kind: "tab" }> => r.kind === "tab")
                .map(r => r.tab); // legacy alias for count display
              void recentTabs;
              // Decide which Recent rows are entering THIS commit.
              // Computed at render time (not in an effect) so the
              // CSS class is on the element from its first paint —
              // avoids the "appear at full opacity then fade in"
              // flicker that an effect-applied animation produces.
              const recentEnteringIds: Set<string> = recentFirstPaint.current
                ? new Set<string>()
                : new Set(recentEntries.map((r) => r.id).filter((id) => !recentSeenIds.current.has(id)));
              return (
                <div className="shrink-0">
                  <div
                    data-section-id="recent"
                    className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                    onClick={() => setShowRecent(!showRecent)}
                  >
                    <ChevronDown
                      width={10} height={10}
                      className={`shrink-0 transition-transform ${showRecent ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                      style={{ transform: showRecent ? "rotate(0deg)" : "rotate(-90deg)" }}
                    />
                    <span className={`flex-1 text-caption font-medium transition-colors ${showRecent ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Recent</span>
                    <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{recentEntries.length}</span>
                  </div>
                  {showRecent && (
                    recentEntries.length === 0 ? (
                      <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>No recently opened documents</div>
                    ) : (
                      <div className="pl-2 pr-2 pb-1 space-y-0.5">
                        {recentEntries.map(entry => {
                          if (entry.kind === "ghost-bundle") {
                            const bundle = bundles.find(b => b.id === entry.bundleId)!;
                            return (
                              <div
                                key={`recent-${entry.id}`}
                                ref={(el) => {
                                  if (el) recentRowRefs.current.set(entry.id, el);
                                  else recentRowRefs.current.delete(entry.id);
                                }}
                                className={`flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors hover:bg-[var(--toggle-bg)] group/recent${recentEnteringIds.has(entry.id) ? " mw-recent-enter" : ""}`}
                                style={{ paddingLeft: 6, paddingRight: 6, color: "var(--text-secondary)" }}
                                onClick={() => {
                                  // If already at the top of Recent, plain switch.
                                  // Otherwise capture rects and reorder so the row
                                  // animates a slide-to-top via FLIP.
                                  if (recentTabIds[0] !== entry.id) {
                                    captureRecentRects();
                                    setRecentTabIds(prev => [entry.id, ...prev.filter(id => id !== entry.id)].slice(0, 25));
                                  }
                                  const activeTab = tabs.find(t => t.id === activeTabId);
                                  const alreadyOpen = activeTab?.kind === "bundle" && activeTab.bundleId === entry.bundleId;
                                  if (!alreadyOpen) openGhostBundle(entry.bundleId);
                                }}
                                title={bundle.title || "Untitled Bundle"}
                              >
                                {renderBundleStatusIcon(entry.bundleId, 13)}
                                <span className="truncate flex-1 text-body">{bundle.title || "Untitled Bundle"}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setRecentTabIds(prev => prev.filter(id => id !== entry.id)); }}
                                  className="shrink-0 w-4 h-4 rounded items-center justify-center transition-colors hover:bg-[var(--border-dim)] hidden group-hover/recent:flex"
                                  style={{ color: "var(--text-faint)" }}
                                  title="Remove from recent"
                                >
                                  <X width={9} height={9} />
                                </button>
                              </div>
                            );
                          }
                          const tab = entry.tab;
                          const displayTitle = tab.kind === "bundle" && tab.bundleId
                            ? (bundles.find(b => b.id === tab.bundleId)?.title || tab.title || "Untitled")
                            : (tab.title || "Untitled");
                          return (
                            <div
                              key={`recent-${tab.id}`}
                              ref={(el) => {
                                if (el) recentRowRefs.current.set(tab.id, el);
                                else recentRowRefs.current.delete(tab.id);
                              }}
                              className={`flex items-center gap-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors hover:bg-[var(--toggle-bg)] group/recent${recentEnteringIds.has(tab.id) ? " mw-recent-enter" : ""}`}
                              style={{ paddingLeft: 6, paddingRight: 6, color: "var(--text-secondary)" }}
                              onClick={(e) => handleDocClick(tab.id, e)}
                              title={displayTitle}
                            >
                              {tab.kind === "bundle" ? renderBundleStatusIcon(tab.bundleId, 13) : <DocStatusIcon tab={tab} isActive={false} />}
                              <span className="truncate flex-1 text-body">{displayTitle}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setRecentTabIds(prev => prev.filter(id => id !== tab.id)); }}
                                className="shrink-0 w-4 h-4 rounded items-center justify-center transition-colors hover:bg-[var(--border-dim)] hidden group-hover/recent:flex"
                                style={{ color: "var(--text-faint)" }}
                                title="Remove from recent"
                              >
                                <X width={9} height={9} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })()}
            {/* ── Section: MD BUNDLES (above MDs) ── */}
            <div
              className="shrink-0 flex flex-col"
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setDocContextMenu(null); setFolderContextMenu(null); setBundleContextMenu(null); setSidebarContextMenu({ x: e.clientX, y: e.clientY, section: "bundles" }); }}
            >
                {(() => {
                  const bundleFolders = folders.filter(f => f.section === "bundles");
                  const anyBundleFolderExpanded = bundleFolders.some(f => !f.collapsed);
                  return (
                    <div
                      data-section-id="bundles"
                      className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                      style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                      onClick={() => setShowMyBundles(!showMyBundles)}
                    >
                      <ChevronDown
                        width={10} height={10}
                        className={`shrink-0 transition-transform ${showMyBundles ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                        style={{ transform: showMyBundles ? "rotate(0deg)" : "rotate(-90deg)" }}
                      />
                      <span className={`flex-1 text-caption font-medium transition-colors ${showMyBundles ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>MD Bundles</span>
                      {showMyBundles && bundleFolders.length > 0 && (
                        <Tooltip text={anyBundleFolderExpanded ? "Collapse all bundle folders" : "Expand all bundle folders"}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = anyBundleFolderExpanded;
                              setFolders(prev => prev.map(f => f.section === "bundles" ? { ...f, collapsed: next } : f));
                              bundleFolders.forEach(f => {
                                if (f.collapsed !== next) fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, collapsed: next }) }).catch(() => {});
                              });
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]"
                            style={{ color: "var(--text-faint)" }}
                          >
                            {anyBundleFolderExpanded ? <ChevronsDownUp width={12} height={12} /> : <ChevronsUpDown width={12} height={12} />}
                          </button>
                        </Tooltip>
                      )}
                      {/* Section-level Sort — independent from MDs, so
                          bundles can be sorted by date while docs are
                          A-Z (or vice versa). */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Tooltip text={`Sort bundles: ${SECTION_SORT_OPTIONS.find((o) => o.value === bundlesSortMode)?.label}`}>
                          <button
                            onClick={() => setOpenSortMenu((m) => m === "bundles" ? null : "bundles")}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="sort"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <ArrowUpDown width={11} height={11} />
                          </button>
                        </Tooltip>
                        {openSortMenu === "bundles" && (<>
                          <div className="fixed inset-0 z-[9997]" onClick={() => setOpenSortMenu(null)} />
                          <div className="absolute top-full right-0 mt-1 w-36 rounded-lg py-1 z-[9998]"
                            style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
                          >
                            {SECTION_SORT_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => { setBundlesSortMode(opt.value); setOpenSortMenu(null); }}
                                className="w-full text-left px-3 py-1.5 text-caption hover:bg-[var(--menu-hover)]"
                                style={{ color: bundlesSortMode === opt.value ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: bundlesSortMode === opt.value ? 600 : 400 }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>)}
                      </div>
                      {/* Section-level New folder — creates a folder
                          scoped to bundles. Owner-only. */}
                      {user?.id && (
                        <Tooltip text="New folder">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMyBundles(true);
                              const id = `folder-${Date.now()}`;
                              setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "bundles" }]);
                              fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "bundles" }) }).catch(() => {});
                              setInlineInput({ label: "Folder name", defaultValue: "New Folder", onSubmit: (name) => { setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f)); fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {}); setInlineInput(null); }});
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="folder"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <FolderPlus width={11} height={11} />
                          </button>
                        </Tooltip>
                      )}
                      {/* Section-level + — creates a bundle without bouncing
                          through the Library + menu. Owner-only; only
                          rendered for signed-in users. */}
                      {user?.id && (
                        <Tooltip text="New bundle">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowMyBundles(true); setBundleCreatorDocs([]); setShowBundleCreator(true); }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="create"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <Plus width={12} height={12} />
                          </button>
                        </Tooltip>
                      )}
                      <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
                        {bundleFilter === "all" ? bundles.length : `${memoFilteredBundles.length} / ${bundles.length}`}
                      </span>
                    </div>
                  );
                })()}
                {showMyBundles && bundles.length === 0 && folders.filter(f => f.section === "bundles").length === 0 && (
                  <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>
                    No bundles yet
                  </div>
                )}
                {showMyBundles && bundles.length > 0 && (
                  // Filter pills — same UX as the MDs section. Bundles
                  // only have Private/Shared (no source axis), so the
                  // Synced tab from MDs is omitted here.
                  <div className="shrink-0 px-2 pt-1.5 pb-1">
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md w-full" style={{ background: "var(--background)" }}>
                      {(["all", "private", "shared"] as const).map((f) => {
                        const tips: Record<string, string> = {
                          all: "Show all bundles",
                          private: "Only visible to you",
                          shared: "Shared via public URL or invited people",
                        };
                        const labels: Record<string, string> = { all: "All", private: "Private", shared: "Shared" };
                        const isActive = bundleFilter === f;
                        return (
                          <button
                            key={f}
                            onClick={() => { setBundleFilter(f); localStorage.setItem("mw-bundle-filter", f); }}
                            title={tips[f]}
                            className="flex-1 text-caption py-1 rounded transition-colors"
                            style={{
                              background: isActive ? "var(--border)" : "transparent",
                              color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                              fontWeight: isActive ? 600 : 500,
                            }}
                            onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; } }}
                            onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; } }}
                          >
                            {labels[f]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {showMyBundles && bundles.length > 0 && memoFilteredBundles.length === 0 && (
                  <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>
                    {bundleFilter === "private" ? "No private bundles" : bundleFilter === "shared" ? "No shared bundles" : "No bundles yet"}
                  </div>
                )}
                {showMyBundles && (bundles.length > 0 || folders.filter(f => f.section === "bundles").length > 0) && (
                  // Wrapper has `pr-2` on both sides so the per-row
                  // hover background gets a visible left + right
                  // gutter against the sidebar edge. The section
                  // header above uses `pl-3 pr-5` (asymmetric on
                  // purpose) so its trailing count lands at the same
                  // x as row/folder counts inside the wrapper. Math
                  // breakdown:
                  //   wrapper.pr(8) + row.pr(6) + gap-1.5(6) = 20px
                  //     from sidebar outer right → badge right edge
                  //   header.pr-5(20) → same x ✓
                  <div className="space-y-0.5 pb-1 pl-2 pr-2">
                    {/* Bundles share the same SidebarFolderTree component as docs, with
                        bundle-specific handlers. Folders with section="bundles" group bundles. */}
                    <SidebarFolderTree
                      folders={folders}
                      tabs={memoFilteredBundles.map(b => {
                        return {
                          id: `bundle-item-${b.id}`,
                          title: b.title || "Untitled Bundle",
                          folderId: b.folder_id || undefined,
                          // Stash bundle id via cloudId for downstream lookups.
                          // lastOpenedAt drives the "newest" sort — must come
                          // from a STABLE value (bundle.updated_at), not
                          // Date.now() keyed on activeTabId. Earlier we set
                          // Date.now() only for the active bundle, which
                          // promoted it to the top of "newest" on every click
                          // and triggered a FLIP slide for every row below.
                          cloudId: b.id,
                          lastOpenedAt: b.updated_at ? new Date(b.updated_at).getTime() : undefined,
                          kind: "bundle" as const,
                        };
                      })}
                      rootFolderFilter={FOLDER_FILTER_BUNDLES}
                      activeTabId={(() => {
                        const activeBundleTab = tabs.find(t => t.kind === "bundle" && t.id === activeTabId);
                        return activeBundleTab ? `bundle-item-${activeBundleTab.bundleId}` : undefined;
                      })()}
                      selectedTabIds={new Set()}
                      activeBundleDocIds={new Set()}
                      sidebarSearch={sidebarSearchDebounced}
                      sortMode={bundlesSortMode}
                      sidebarMode={sidebarMode}
                      docFilter={bundleFilter}
                      dragTabId={dragTabId}
                      dragFolderId={dragFolderId}
                      setDragTabId={setDragTabId}
                      setDragFolderId={setDragFolderId}
                      renderTabIcon={(item) => renderBundleStatusIcon(item.cloudId, 14)}
                      renderTabBadge={(item) => {
                        const bundle = bundles.find(b => b.id === item.cloudId);
                        if (!bundle) return null;
                        const starred = isPinned("bundle", bundle.id);
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {starred && (
                              <Star width={10} height={10} style={{ color: "var(--micro-warn)", fill: "var(--micro-warn)" }} aria-label="Starred" />
                            )}
                            <Tooltip text={`${bundle.documentCount} document${bundle.documentCount === 1 ? "" : "s"} in this bundle`}>
                              <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
                                {bundle.documentCount}
                              </span>
                            </Tooltip>
                          </span>
                        );
                      }}
                      renamingItem={renamingItem}
                      setRenamingItem={setRenamingItem}
                      handlers={{
                        onToggleCollapsed: (folderId) => {
                          const target = folders.find(f => f.id === folderId);
                          const next = !target?.collapsed;
                          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, collapsed: next } : f));
                          fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, collapsed: next }) }).catch(() => {});
                        },
                        onRename: (folderId, currentName) => {
                          setInlineInput({
                            label: "Folder name",
                            defaultValue: currentName,
                            onSubmit: (name) => {
                              setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
                              fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, name }) }).catch(() => {});
                              setInlineInput(null);
                            },
                          });
                        },
                        onCommitFolderRename: (folderId, name) => {
                          setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
                          fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, name }) }).catch(() => {});
                        },
                        onCommitTabRename: (itemId, name) => {
                          // Bundle items use `bundle-item-<id>` ids; strip
                          // the prefix to find the underlying bundle row.
                          const bundleId = itemId.replace(/^bundle-item-/, "");
                          const b = bundles.find(x => x.id === bundleId);
                          if (!b) return;
                          setBundles(prev => prev.map(x => x.id === bundleId ? { ...x, title: name } : x));
                          setTabs(prev => prev.map(t => (t.kind === "bundle" && t.bundleId === bundleId) ? { ...t, title: name } : t));
                          fetch(`/api/bundles/${bundleId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...authHeaders },
                            body: JSON.stringify({
                              userId: user?.id,
                              anonymousId: !user?.id ? getAnonymousId() : undefined,
                              title: name,
                            }),
                          }).catch(() => {});
                        },
                        onCreateDocInFolder: (folderId) => {
                          // For bundles section, "+" creates a new bundle inside this folder
                          setBundleCreatorDocs([]);
                          setShowBundleCreator(true);
                          setPendingNewBundleFolderId(folderId);
                        },
                        onCreateSubfolder: (parentId) => {
                          const id = `folder-${Date.now()}`;
                          setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "bundles", parentId }]);
                          fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "bundles", parentId }) }).catch(() => {});
                          setInlineInput({
                            label: "Folder name",
                            defaultValue: "New Folder",
                            onSubmit: (name) => {
                              setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
                              fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {});
                              setInlineInput(null);
                            },
                          });
                        },
                        onOpenContextMenu: (folderId, x, y) => setFolderContextMenu({ x, y, folderId }),
                        onTabClick: (itemId) => {
                          // itemId is "bundle-item-<bundleId>" — extract real bundle id
                          const bundleId = itemId.replace(/^bundle-item-/, "");
                          const b = bundles.find(x => x.id === bundleId);
                          if (!b) return;
                          setShowOnboarding(false);
                          setSelectedTabIds(new Set());
                          const existingTab = tabs.find(t => t.kind === "bundle" && t.bundleId === b.id);
                          let openedTabId: string;
                          if (existingTab) {
                            openedTabId = existingTab.id;
                            // Freshen Tab.title from the current bundle row before
                            // switching — otherwise a renamed bundle keeps showing
                            // its stale draft title in Recent and the bundle
                            // viewer header.
                            if (b.title && existingTab.title !== b.title) {
                              setTabs(prev => prev.map(t => t.id === existingTab.id ? { ...t, title: b.title || t.title } : t));
                            }
                            switchTab(existingTab.id);
                          } else {
                            // First-click path: insert the bundle tab AND make it
                            // active in the same synchronous flush. Without setting
                            // activeTabId here, switchTab would only commit it via a
                            // queueMicrotask, leaving an intermediate render where
                            // activeTab still resolves to the previous doc — the
                            // bundle viewer's `activeTab.kind === "bundle"` gate
                            // fails for that frame and the canvas appears not to load.
                            openedTabId = `bundle-${b.id}-${Date.now()}`;
                            const newTab: Tab = { id: openedTabId, kind: "bundle", bundleId: b.id, title: b.title || "Untitled Bundle", markdown: "" };
                            activeTabIdRef.current = openedTabId;
                            flushSync(() => {
                              setTabs(prev => [...prev, newTab]);
                              setActiveTabId(openedTabId);
                            });
                            switchTab(openedTabId);
                            // Persist the new bundle tab IMMEDIATELY (bypass the
                            // 500ms persist debounce). When the click navigates
                            // pushState → /b/X and the user then refreshes, the
                            // browser reloads /b/[id] which never mounts MdEditor
                            // and never gets a chance to flush. Without this eager
                            // save, the bundle tab is missing from mw-tabs and
                            // the corresponding entry in mw-recent-tabs would
                            // resolve to a missing tab → Recent appears empty.
                            try {
                              const saved = localStorage.getItem("mw-tabs");
                              const arr = saved ? JSON.parse(saved) : [];
                              if (Array.isArray(arr) && !arr.some((t: { id: string }) => t.id === newTab.id)) {
                                arr.push(newTab);
                                localStorage.setItem("mw-tabs", JSON.stringify(arr));
                              }
                              localStorage.setItem("mw-active-tab", openedTabId);
                            } catch { /* quota / parse — fallback to debounced save */ }
                          }
                          // Push to Recent (shared with sidebar Recent + Home Recent).
                          // Also persist immediately so a refresh on /b/X doesn't lose it.
                          if (!isDraggingSidebarRef.current) {
                            setRecentTabIds(prev => {
                              const next = [openedTabId, ...prev.filter(id => id !== openedTabId)].slice(0, 25);
                              try { localStorage.setItem("mw-recent-tabs", JSON.stringify(next)); } catch { /* ignore */ }
                              return next;
                            });
                          }
                        },
                        onTabContextMenu: (itemId, x, y) => {
                          const bundleId = itemId.replace(/^bundle-item-/, "");
                          setBundleContextMenu({ x, y, bundleId });
                        },
                        onTabKebab: (itemId, rect) => {
                          const bundleId = itemId.replace(/^bundle-item-/, "");
                          setBundleContextMenu({ x: rect.right, y: rect.bottom, bundleId });
                        },
                        onDropTabIntoFolder: (itemId, folderId) => {
                          const bundleId = itemId.replace(/^bundle-item-/, "");
                          setBundles(prev => prev.map(b => b.id === bundleId ? { ...b, folder_id: folderId } : b));
                          fetch(`/api/bundles/${bundleId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", ...authHeaders },
                            body: JSON.stringify({
                              userId: user?.id,
                              anonymousId: !user?.id ? getAnonymousId() : undefined,
                              action: "move-to-folder",
                              folderId,
                            }),
                          }).catch(() => {});
                        },
                        onDropFolderIntoFolder: (movedFolderId, newParentId) => {
                          setFolders(prev => prev.map(f => f.id === movedFolderId ? { ...f, parentId: newParentId } : f));
                          fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: movedFolderId, parentId: newParentId }) }).catch(() => {});
                        },
                        onChangeEmoji: (folderId) => setEmojiPickerFolderId(folderId),
                        onReorderFolder: (movedId, siblingId, position) => {
                          // Re-parent moved folder to sibling's parent, then reorder among siblings
                          const sibling = folders.find(f => f.id === siblingId);
                          const newParent = sibling?.parentId ?? null;
                          setFolders(prev => {
                            const next = prev.map(f => f.id === movedId ? { ...f, parentId: newParent } : f);
                            const movedIdx = next.findIndex(f => f.id === movedId);
                            if (movedIdx < 0) return next;
                            const [moved] = next.splice(movedIdx, 1);
                            const sibIdx = next.findIndex(f => f.id === siblingId);
                            if (sibIdx < 0) return [...next, moved];
                            next.splice(position === "before" ? sibIdx : sibIdx + 1, 0, moved);
                            // Persist new parent + sort_order for affected folders
                            fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: movedId, parentId: newParent }) }).catch(() => {});
                            next.forEach((f, i) => {
                              fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, sortOrder: i }) }).catch(() => {});
                            });
                            return next;
                          });
                        },
                      }}
                    />
                  </div>
                )}
              </div>

            {/* ── Section 1: MY DOCUMENTS ── */}
            {(() => {
              const allMyTabs = memoAllMyTabs;
              const myTabs = memoMyTabs;
              const myTabCount = allMyTabs.length;
              const _privateCount = memoPrivateCount;
              const _sharedCount = memoSharedCount;
              return (
                <div
                  className="shrink-0 flex flex-col"
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setDocContextMenu(null); setFolderContextMenu(null); setBundleContextMenu(null); setSidebarContextMenu({ x: e.clientX, y: e.clientY, section: "my" }); }}
                >
                  {(() => {
                    const myFolders = folders.filter(f => !f.section || f.section === "my");
                    const anyMyFolderExpanded = myFolders.some(f => !f.collapsed);
                    return (
                      <div
                        data-section-id="mds"
                        className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                        style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                        onClick={() => { setShowMyDocs(!showMyDocs); }}
                      >
                        <ChevronDown
                          width={10} height={10}
                          className={`shrink-0 transition-transform ${showMyDocs ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                          style={{ transform: showMyDocs ? "rotate(0deg)" : "rotate(-90deg)" }}
                        />
                        <span className={`flex-1 text-caption font-medium transition-colors ${showMyDocs ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>MDs</span>
                        {showMyDocs && myFolders.length > 0 && (
                          <Tooltip text={anyMyFolderExpanded ? "Collapse all folders" : "Expand all folders"}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = anyMyFolderExpanded;
                                setFolders(prev => prev.map(f => (!f.section || f.section === "my") ? { ...f, collapsed: next } : f));
                                myFolders.forEach(f => {
                                  if (f.collapsed !== next) fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, collapsed: next }) }).catch(() => {});
                                });
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {anyMyFolderExpanded ? <ChevronsDownUp width={12} height={12} /> : <ChevronsUpDown width={12} height={12} />}
                            </button>
                          </Tooltip>
                        )}
                        {/* Section-level Sort for MDs — independent
                            from the bundles sort above. */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <Tooltip text={`Sort docs: ${SECTION_SORT_OPTIONS.find((o) => o.value === mdsSortMode)?.label}`}>
                            <button
                              onClick={() => setOpenSortMenu((m) => m === "mds" ? null : "mds")}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="sort"
                              style={{ color: "var(--text-faint)" }}
                            >
                              <ArrowUpDown width={11} height={11} />
                            </button>
                          </Tooltip>
                          {openSortMenu === "mds" && (<>
                            <div className="fixed inset-0 z-[9997]" onClick={() => setOpenSortMenu(null)} />
                            <div className="absolute top-full right-0 mt-1 w-36 rounded-lg py-1 z-[9998]"
                              style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
                            >
                              {SECTION_SORT_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => { setMdsSortMode(opt.value); setOpenSortMenu(null); }}
                                  className="w-full text-left px-3 py-1.5 text-caption hover:bg-[var(--menu-hover)]"
                                  style={{ color: mdsSortMode === opt.value ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: mdsSortMode === opt.value ? 600 : 400 }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>)}
                        </div>
                        {/* Section-level New folder — creates a folder
                            scoped to MDs (section="my"). Owner-only. */}
                        <Tooltip text="New folder">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMyDocs(true);
                              const id = `folder-${Date.now()}`;
                              setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "my" }]);
                              fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "my" }) }).catch(() => {});
                              setInlineInput({ label: "Folder name", defaultValue: "New Folder", onSubmit: (name) => { setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f)); fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {}); setInlineInput(null); }});
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="folder"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <FolderPlus width={11} height={11} />
                          </button>
                        </Tooltip>
                        {/* Section-level + on MDs — creates a new doc
                            inline. Same affordance as Library + → New
                            document, just one click closer to where the
                            user is looking. */}
                        <Tooltip text="New document">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowMyDocs(true); addTab(); }}
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--toggle-bg)]" data-action="create"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <Plus width={12} height={12} />
                          </button>
                        </Tooltip>
                        <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>
                          {docFilter === "all" ? myTabCount : `${myTabs.length} / ${myTabCount}`}
                        </span>
                      </div>
                    );
                  })()}
                  {showMyDocs && (
                    <>
                    {/* Filter pills — compact chips, active filled with accent-dim */}
                    <div className="shrink-0 px-2 pt-1.5 pb-1">
                      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-md w-full" style={{ background: "var(--background)" }}>
                        {(["all", "private", "shared", "synced"] as const).map((f) => {
                          const tips: Record<string, string> = {
                            all: "Show all documents",
                            private: "Only visible to you",
                            shared: "Shared via public URL",
                            synced: "Synced from VS Code, Desktop, CLI, MCP",
                          };
                          const labels: Record<string, string> = { all: "All", private: "Private", shared: "Shared", synced: "Synced" };
                          const isActive = docFilter === f;
                          return (
                            <button
                              key={f}
                              onClick={() => { setDocFilter(f); localStorage.setItem("mw-doc-filter", f); }}
                              title={tips[f]}
                              className="flex-1 text-caption py-1 rounded transition-colors"
                              style={{
                                background: isActive ? "var(--border)" : "transparent",
                                color: isActive ? "var(--text-primary)" : "var(--text-faint)",
                                fontWeight: isActive ? 600 : 500,
                              }}
                              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "var(--toggle-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; } }}
                              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-faint)"; } }}
                            >
                              {labels[f]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Document list — scrollable */}
                    {/* overflow-y-auto only — earlier we had blamed overflow-x-hidden
                        for cancelling HTML5 drag, but the real cause was state
                        mutations during drag (now gated). Horizontal scroll on the
                        sidebar is unwanted: long titles already truncate.
                        Wrapper pr-2 gives row hover BG a right gutter; the
                        MDs section header (the sibling above this wrapper)
                        compensates with pr-5 so trailing counts align. */}
                    <div data-sidebar-scroll className="overflow-x-hidden space-y-0.5 pb-1 pl-2 pr-2">
                      {/* Root tabs + folders rendered through SidebarFolderTree below — same component as MD Bundles + Shared sections for unified UX. */}

                      {/* Folders — recursive nested tree (Obsidian/Notion-style) */}
                      <SidebarFolderTree
                        folders={folders}
                        tabs={myTabs}
                        rootFolderFilter={FOLDER_FILTER_MY}
                        includeRootTabs={true}
                        activeTabId={activeTabId}
                        selectedTabIds={selectedTabIds}
                        activeBundleDocIds={activeBundleDocIds}
                        freshCloudIds={recentlyUpdatedCloudIds}
                        sidebarSearch={sidebarSearchDebounced}
                        sortMode={mdsSortMode}
                        sidebarMode={sidebarMode}
                        docFilter={docFilter}
                        dragTabId={dragTabId}
                        dragFolderId={dragFolderId}
                        setDragTabId={setDragTabId}
                        setDragFolderId={setDragFolderId}
                        renderTabIcon={(tab, isActive) => {
                          // Cluster color dots were dropped — random
                          // HSL hash didn't scale past ~6 clusters
                          // (everything converged to greenish/blueish
                          // twins) and the real grouping signal is
                          // the AI Bundles section, not row colour.
                          // We keep the tooltip so the cluster label
                          // + ai_summary still surface on demand.
                          const meta = tab.cloudId ? docAiMeta[tab.cloudId] : null;
                          const tooltipBits: string[] = [];
                          if (meta?.clusterId && meta.clusterId !== "misc") tooltipBits.push(`Cluster: ${meta.clusterId}`);
                          if (meta?.summary) tooltipBits.push(meta.summary);
                          const tooltip = tooltipBits.length > 0 ? tooltipBits.join("\n\n") : null;
                          return (
                            <span className="shrink-0" title={tooltip || undefined}>
                              <DocStatusIcon tab={tab} isActive={isActive} />
                            </span>
                          );
                        }}
                        renderTabMeta={(tab) => tab.lastOpenedAt ? (
                          <span className="text-caption font-mono" style={{ color: "var(--text-faint)", opacity: 0.5 }}>
                            {relativeTime(new Date(tab.lastOpenedAt).toISOString())}{(tab.viewCount ?? 0) > 0 && ` \u00b7 ${tab.viewCount}`}
                          </span>
                        ) : null}
                        renderTabBadge={(tab) => (tab.cloudId && isPinned("document", tab.cloudId)) ? (
                          <Star width={10} height={10} style={{ color: "var(--micro-warn)", fill: "var(--micro-warn)" }} aria-label="Starred" />
                        ) : null}
                        renamingItem={renamingItem}
                        setRenamingItem={setRenamingItem}
                        handlers={{
                          onToggleCollapsed: (folderId) => {
                            const target = folders.find(f => f.id === folderId);
                            const next = !target?.collapsed;
                            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, collapsed: next } : f));
                            fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, collapsed: next }) }).catch(() => {});
                          },
                          onRename: (folderId, currentName) => {
                            setInlineInput({
                              label: "Folder name",
                              defaultValue: currentName,
                              onSubmit: (name) => {
                                setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
                                fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, name }) }).catch(() => {});
                                setInlineInput(null);
                              },
                            });
                          },
                          onCommitFolderRename: (folderId, name) => {
                            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
                            fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId, name }) }).catch(() => {});
                          },
                          onCommitTabRename: (tabId, name) => {
                            const tab = tabs.find(t => t.id === tabId);
                            if (!tab) return;
                            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title: name } : t));
                            // If active tab → splice the H1 in the visible
                            // body so the editor reflects the rename
                            // instantly; the standard autoSave then PATCHes
                            // both markdown + title and the server-side
                            // title invariant keeps DB.title aligned.
                            if (tabId === activeTabIdRef.current) {
                              const md = markdownRef.current;
                              const lines = md.split("\n");
                              const h1Idx = lines.findIndex(l => /^#\s+/.test(l));
                              if (h1Idx >= 0) lines[h1Idx] = `# ${name}`;
                              else lines.unshift(`# ${name}`, "");
                              const next = lines.join("\n");
                              if (next !== md) setMarkdown(next);
                            } else if (tab.cloudId) {
                              // Background-tab rename: PATCH directly so
                              // the server picks up the title even without
                              // the editor view's autoSave hook.
                              fetch(`/api/docs/${tab.cloudId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", ...authHeaders },
                                body: JSON.stringify({ title: name, userId: user?.id, editToken: tab.editToken }),
                              }).catch(() => {});
                            }
                          },
                          onCreateDocInFolder: (folderId) => {
                            setPendingNewDocFolderId(folderId);
                            setShowTemplatePicker(true);
                          },
                          onCreateSubfolder: (parentId) => {
                            const id = `folder-${Date.now()}`;
                            setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "my", parentId }]);
                            fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "my", parentId }) }).catch(() => {});
                            setInlineInput({
                              label: "Folder name",
                              defaultValue: "New Folder",
                              onSubmit: (name) => {
                                setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
                                fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {});
                                setInlineInput(null);
                              },
                            });
                          },
                          onOpenContextMenu: (folderId, x, y) => setFolderContextMenu({ x, y, folderId }),
                          onTabClick: handleDocClick,
                          onTabContextMenu: (tabId, x, y) => setDocContextMenu({ x, y, tabId }),
                          onTabKebab: (tabId, rect) => setDocContextMenu({ x: rect.right, y: rect.bottom, tabId }),
                          onDropTabIntoFolder: (tabId, folderId) => {
                            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, folderId: folderId || undefined } : t));
                          },
                          onDropFolderIntoFolder: (movedFolderId, newParentId) => {
                            setFolders(prev => prev.map(f => f.id === movedFolderId ? { ...f, parentId: newParentId } : f));
                            fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: movedFolderId, parentId: newParentId }) }).catch(() => {});
                          },
                          onChangeEmoji: (folderId) => setEmojiPickerFolderId(folderId),
                          onReorderFolder: (movedId, siblingId, position) => {
                            const sibling = folders.find(f => f.id === siblingId);
                            const newParent = sibling?.parentId ?? null;
                            setFolders(prev => {
                              const next = prev.map(f => f.id === movedId ? { ...f, parentId: newParent } : f);
                              const movedIdx = next.findIndex(f => f.id === movedId);
                              if (movedIdx < 0) return next;
                              const [moved] = next.splice(movedIdx, 1);
                              const sibIdx = next.findIndex(f => f.id === siblingId);
                              if (sibIdx < 0) return [...next, moved];
                              next.splice(position === "before" ? sibIdx : sibIdx + 1, 0, moved);
                              fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: movedId, parentId: newParent }) }).catch(() => {});
                              next.forEach((f, i) => {
                                fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: f.id, sortOrder: i }) }).catch(() => {});
                              });
                              return next;
                            });
                          },
                          onReorderTab: (movedTabId, siblingTabId, position) => {
                            // Reorder tabs in the sibling's folder. Computes new sort_order
                            // values via simple "midpoint of neighbors" — re-numbers all
                            // siblings 0..N for stability and persists each.
                            const sibling = tabs.find(t => t.id === siblingTabId);
                            if (!sibling) return;
                            const targetFolderId = sibling.folderId;
                            setTabs(prev => {
                              // Move the tab into sibling's folder if needed
                              const next = prev.map(t => t.id === movedTabId ? { ...t, folderId: targetFolderId } : t);
                              // Get all tabs in target folder, sorted by current sortOrder/title
                              const inFolder = next.filter(t => !t.deleted && t.folderId === targetFolderId && t.permission !== "readonly" && t.permission !== "editable")
                                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.title || "").localeCompare(b.title || ""));
                              // Take moved out, splice at sibling position
                              const filtered = inFolder.filter(t => t.id !== movedTabId);
                              const sibIdx = filtered.findIndex(t => t.id === siblingTabId);
                              if (sibIdx < 0) return next;
                              const moved = inFolder.find(t => t.id === movedTabId);
                              if (!moved) return next;
                              filtered.splice(position === "before" ? sibIdx : sibIdx + 1, 0, moved);
                              // Renumber 0..N and persist
                              const sortMap = new Map(filtered.map((t, i) => [t.id, i]));
                              filtered.forEach((t, i) => {
                                if (t.cloudId) {
                                  fetch(`/api/docs/${t.cloudId}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", ...authHeadersRef.current },
                                    body: JSON.stringify({ action: "set-sort-order", sortOrder: i }),
                                  }).catch(() => {});
                                }
                              });
                              return next.map(t => sortMap.has(t.id) ? { ...t, sortOrder: sortMap.get(t.id)! } : t);
                            });
                          },
                        }}
                      />

                      {/* Root-drop is now handled by SidebarFolderTree's built-in
                          "Drop here to move to top level" slot — supports both tabs and
                          folders, dragged from any depth. The previous tab-only box was
                          removed to avoid two competing drop zones. */}

                      {myTabs.length === 0 && (
                        <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>
                          {docFilter === "all" ? "No documents yet" :
                           docFilter === "synced" ? (!isAuthenticated ? "Sign in to see synced docs" : "No synced documents") :
                           docFilter === "private" ? "No private documents" :
                           docFilter === "shared" ? (!isAuthenticated ? "Sign in to share docs" : "No shared documents") :
                           "No documents found"}
                        </div>
                      )}

                      {/* Cloud search results */}
                      {sidebarSearch.length >= 3 && (
                        <>
                          {isCloudSearching && (
                            <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>
                              <span className="inline-block animate-spin mr-1.5" style={{ width: 10, height: 10, border: "1.5px solid var(--text-faint)", borderTopColor: "transparent", borderRadius: "50%" }} />
                              Searching cloud...
                            </div>
                          )}
                          {!isCloudSearching && (() => {
                            const localCloudIds = new Set(tabs.filter(t => t.cloudId).map(t => t.cloudId!));
                            const uniqueResults = cloudSearchResults.filter(r => !localCloudIds.has(r.id));
                            if (uniqueResults.length === 0) return null;
                            return (
                              <>
                                <div className="px-3 pt-2 pb-1 text-caption font-semibold uppercase" style={{ color: "var(--text-faint)", letterSpacing: "0.5px" }}>
                                  Cloud results ({uniqueResults.length})
                                </div>
                                {uniqueResults.map(r => {
                                  const snippet = (r.snippet || "").slice(0, 80);
                                  const ago = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "";
                                  return (
                                    <div
                                      key={r.id}
                                      className="group flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--menu-hover)]"
                                      onClick={() => {
                                        // Add as tab and load from cloud
                                        const tabId = `cloud-${r.id}`;
                                        const exists = tabs.find(t => t.id === tabId || t.cloudId === r.id);
                                        if (exists) {
                                          switchTab(exists.id);
                                        } else {
                                          const newTab = { id: tabId, title: r.title || "Untitled", markdown: "", cloudId: r.id, isDraft: r.isDraft, permission: "mine" as const };
                                          setTabs(prev => [...prev, newTab]);
                                          setTimeout(() => switchTab(tabId), 50);
                                        }
                                      }}
                                    >
                                      <Search width={11} height={11} className="shrink-0" style={{ color: "var(--text-primary)" }} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-caption font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.title}</div>
                                        <div className="text-caption truncate" style={{ color: "var(--text-faint)" }}>{snippet || ago}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </>
                  )}
                </div>
              );
            })()}

            {/* ── Section: CONCEPTS — cross-doc index ──
                Hidden by default for v6 launch (FEATURES.THINKING_SURFACE).
                Cross-doc concepts are part of the thinking-surface vocabulary
                that v6 deliberately doesn't expose to first-time visitors;
                the section + drawer code stays so flipping the flag back on
                restores it without rebuilding. */}
            {FEATURES.THINKING_SURFACE && isAuthenticated && conceptIndex && conceptIndex.concepts.length > 0 && (
              <div className="shrink-0 flex flex-col">
                <div
                  data-section-id="concepts"
                  className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                  style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                  onClick={() => setShowConcepts(prev => !prev)}
                >
                  <ChevronDown
                    width={10} height={10}
                    className={`shrink-0 transition-transform ${showConcepts ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                    style={{ transform: showConcepts ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                  <span className={`flex-1 text-caption font-medium transition-colors ${showConcepts ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Concepts</span>
                  <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{conceptIndex.concepts.length}</span>
                </div>
                {showConcepts && (() => {
                  const crossLinked = conceptIndex.concepts.filter(c => c.docCount >= 2);
                  const singleDoc = conceptIndex.concepts.filter(c => c.docCount < 2);
                  const renderRow = (c: ConceptEntry) => {
                    const isCross = c.docCount >= 2;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setOpenedConceptId(c.id)}
                        className="w-full flex items-center gap-2 px-2 py-1 text-caption cursor-pointer transition-colors hover:bg-[var(--toggle-bg)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <span aria-hidden className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: isCross ? "var(--text-primary)" : "var(--text-faint)" }} />
                        <span className="flex-1 truncate text-left">{c.label}</span>
                        <span className="text-caption tabular-nums shrink-0" style={{ color: isCross ? "var(--text-primary)" : "var(--text-faint)" }}>
                          {c.docCount}
                        </span>
                      </button>
                    );
                  };
                  return (
                    <div className="pb-2">
                      {crossLinked.length === 0 && singleDoc.length > 0 && (
                        <div className="px-2 py-1.5 text-caption leading-relaxed" style={{ color: "var(--text-faint)" }}>
                          No cross-linked concepts yet. Decompose more docs to surface compounds.
                        </div>
                      )}
                      {crossLinked.slice(0, 30).map(renderRow)}
                      {crossLinked.length > 30 && (
                        <div className="px-2 py-1 text-caption" style={{ color: "var(--text-faint)" }}>
                          +{crossLinked.length - 30} more cross-linked
                        </div>
                      )}
                      {singleDoc.length > 0 && (
                        <>
                          <button
                            onClick={() => setShowSingleDocConcepts(prev => !prev)}
                            className="w-full flex items-center gap-1 px-2 py-1 text-caption cursor-pointer transition-colors hover:bg-[var(--toggle-bg)]"
                            style={{ color: "var(--text-faint)", marginTop: "var(--space-1)" }}
                          >
                            {showSingleDocConcepts ? <ChevronDown width={10} height={10} /> : <ChevronRight width={10} height={10} />}
                            <span className="flex-1 text-left">Single-doc concepts</span>
                            <span className="tabular-nums">{singleDoc.length}</span>
                          </button>
                          {showSingleDocConcepts && (
                            <>
                              {singleDoc.slice(0, 30).map(renderRow)}
                              {singleDoc.length > 30 && (
                                <div className="px-2 py-1 text-caption" style={{ color: "var(--text-faint)" }}>
                                  +{singleDoc.length - 30} more
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {isAuthenticated && conceptsLoading && !conceptIndex && (
              <div className="px-2 py-1 text-caption" style={{ color: "var(--text-faint)" }}>Loading concepts…</div>
            )}

            {/* ── Section 2: SHARED WITH ME ── */}
            {(() => {
              // Shared tabs: exclude examples (they have their own section)
              const sharedTabs = tabs.filter(t => {
                if (t.deleted || t.folderId) return false;
                if (t.ownerEmail === EXAMPLE_OWNER) return false;
                if (t.permission !== "readonly" && t.permission !== "editable") return false;
                if (sidebarSearchDebounced) {
                  const q = sidebarSearchDebounced.toLowerCase();
                  if (!(t.title || "").toLowerCase().includes(q) && !(t.markdown || "").slice(0, 3000).toLowerCase().includes(q)) return false;
                }
                if (!isAuthenticated) return false;
                return true;
              });
              // Deduplicate sharedTabs by cloudId (prevent duplicate entries)
              const seenCloudIds = new Set<string>();
              const dedupedSharedTabs = sharedTabs.filter(t => {
                if (!t.cloudId) return true;
                if (seenCloudIds.has(t.cloudId)) return false;
                seenCloudIds.add(t.cloudId);
                return true;
              });
              // Include deleted tabs' cloudIds so they don't reappear in extraShared
              const allCloudIds = new Set(tabs.filter(t => t.cloudId).map(t => t.cloudId!));
              // All my document cloudIds — to exclude from shared section
              const myCloudIds = new Set(tabs.filter(t => !t.deleted && (!t.permission || t.permission === "mine") && t.cloudId).map(t => t.cloudId!));
              // Unread notification document IDs — for orange dot indicator
              const unreadDocIds = new Set(notifications.filter(n => !n.read && n.documentId).map(n => n.documentId));
              // Merge recentDocs + notification-based shared docs (exclude my own + already-open/deleted)
              // Dedupe recentDocs by id first — server may return same doc twice
              // (e.g., visited under two contexts) which collides React keys.
              const recentSeen = new Set<string>();
              const extraShared = recentDocs.filter(d => {
                if (allCloudIds.has(d.id) || myCloudIds.has(d.id)) return false;
                if (recentSeen.has(d.id)) return false;
                recentSeen.add(d.id);
                return true;
              });
              const notifSeen = new Set<string>();
              const notifDocs = notifications
                .filter(n => {
                  if (n.type !== "share" || !n.documentId) return false;
                  if (allCloudIds.has(n.documentId) || myCloudIds.has(n.documentId)) return false;
                  if (recentSeen.has(n.documentId)) return false;
                  if (notifSeen.has(n.documentId)) return false;
                  notifSeen.add(n.documentId);
                  return true;
                })
                .map(n => ({ id: n.documentId, title: n.documentTitle, isOwner: false, editMode: "view", ownerName: n.fromUserName }));
              const allExtra = [...extraShared, ...notifDocs];
              const totalShared = dedupedSharedTabs.length + allExtra.length;
              return (<>
                <div className="shrink-0 flex flex-col">
                  <div
                    data-section-id="shared"
                    className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                    onClick={() => { const next = !showSharedDocs; setShowSharedDocs(next); localStorage.setItem("mw-show-shared", String(next)); }}
                  >
                    <ChevronDown
                      width={10} height={10}
                      className={`shrink-0 transition-transform ${showSharedDocs ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                      style={{ transform: showSharedDocs ? "rotate(0deg)" : "rotate(-90deg)" }}
                    />
                    <span className={`flex-1 text-caption font-medium transition-colors ${showSharedDocs ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Shared with me</span>
                    <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{totalShared}</span>
                  </div>
                  {showSharedDocs && (
                    <div className="overflow-x-hidden space-y-0.5 pt-1 pb-1 pl-2 pr-2">
                      {/* Shared tabs already open — draggable to folders */}
                      {dedupedSharedTabs.map((tab) => (
                        <div
                          key={tab.id}
                          draggable
                          onDragStart={(e) => {
                            setDragTabId(tab.id);
                            e.dataTransfer.effectAllowed = "move";
                            try { e.dataTransfer.setData("text/plain", tab.id); } catch { /* ignore */ }
                          }}
                          onDragEnd={() => { setDragTabId(null); setDragOverTarget(null); }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer group text-xs transition-colors relative ${dragOverTarget === tab.id ? "ring-1 ring-[var(--text-primary)]" : ""} ${tab.id === activeTabId ? "bg-[var(--border)]" : "hover:bg-[var(--toggle-bg)]"}`}
                          style={{
                            color: tab.id === activeTabId ? "var(--text-primary)" : "var(--text-secondary)",
                            opacity: dragTabId === tab.id ? 0.4 : 1,
                            outline: selectedTabIds.has(tab.id) ? "1px solid var(--text-primary)" : "none",
                            outlineOffset: "-1px",
                          }}
                          onClick={(e) => handleDocClick(tab.id, e)}
                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setDocContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }); }}
                        >
                          <DocStatusIcon tab={tab} isActive={tab.id === activeTabId} />
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{tab.title || "Untitled"}</span>
                            {showSharedOwner && tab.ownerEmail && (
                              <span className="truncate block text-caption" style={{ color: "var(--text-faint)" }}>{tab.ownerEmail}</span>
                            )}
                          </div>
                          {tab.cloudId && (unreadDocIds.has(tab.cloudId) || tab.unread || !tab.lastOpenedAt) && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: "var(--text-primary)" }}
                              title="New — you haven't opened this yet"
                            />
                          )}
                          <button onClick={(e) => { e.stopPropagation(); const rect = (e.target as HTMLElement).getBoundingClientRect(); setDocContextMenu({ x: rect.right, y: rect.bottom, tabId: tab.id }); }}
                            className="shrink-0 rounded flex items-center justify-center w-0 group-hover:w-[18px] overflow-hidden transition-all duration-150" style={{ color: "var(--text-muted)", padding: "0" }} title="Document options">
                            <MoreHorizontal width={14} height={14} />
                          </button>
                        </div>
                      ))}
                      {/* Shared folders (exclude legacy Examples folder) */}
                      {folders.filter(f => f.section === "shared" && f.id !== EXAMPLES_FOLDER_ID).map(folder => {
                        const folderTabs = tabs.filter(t => !t.deleted && t.folderId === folder.id);
                        return (
                          <div key={folder.id} className="mt-0.5">
                            <div
                              className="flex items-center gap-1 px-0.5 py-1 rounded-md cursor-pointer text-xs font-medium transition-colors group"
                              style={{ color: "var(--text-muted)" }}
                              onClick={() => setFolders(prev => prev.map(f => f.id === folder.id ? { ...f, collapsed: !f.collapsed } : f))}
                              onDragOver={(e) => { if (folder.id === EXAMPLES_FOLDER_ID) return; e.preventDefault(); if (dragTabId) setDragOverTarget(folder.id); }}
                              onDragLeave={() => setDragOverTarget(null)}
                              onDrop={(e) => { if (folder.id === EXAMPLES_FOLDER_ID) return; e.preventDefault(); if (dragTabId) { setTabs(prev => prev.map(t => t.id === dragTabId ? { ...t, folderId: folder.id } : t)); } setDragTabId(null); setDragOverTarget(null); }}
                            >
                              <ChevronDown width={8} height={8} className="shrink-0 -mr-1"
                                style={{ transform: folder.collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                              {folder.collapsed ? (
                                <Folder width={14} height={14} className="shrink-0" style={{ color: "var(--text-faint)" }} />
                              ) : (
                                <FolderOpen width={14} height={14} className="shrink-0" style={{ color: "var(--text-faint)" }} />
                              )}
                              <span className="truncate flex-1">{folder.name}</span>
                              <span className="text-caption opacity-50 group-hover:opacity-0 transition-opacity ml-auto shrink-0">{folderTabs.length}</span>
                            </div>
                            {!folder.collapsed && (
                              <div className="pl-3 pr-1 space-y-0.5 mt-0.5">
                                {folderTabs.map(tab => (
                                  <div key={tab.id} draggable={tab.ownerEmail !== EXAMPLE_OWNER} onDragStart={(e) => { if (tab.ownerEmail === EXAMPLE_OWNER) return; setDragTabId(tab.id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", tab.id); } catch { /* ignore */ } }} onDragEnd={() => { setDragTabId(null); setDragOverTarget(null); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer group text-xs transition-colors"
                                    style={{
                                      background: selectedTabIds.has(tab.id) || tab.id === activeTabId ? "var(--border)" : "transparent",
                                      color: selectedTabIds.has(tab.id) || tab.id === activeTabId ? "var(--text-primary)" : "var(--text-secondary)",
                                      outline: selectedTabIds.has(tab.id) ? "1px solid var(--text-primary)" : "none",
                                      outlineOffset: "-1px",
                                    }}
                                    onClick={(e) => handleDocClick(tab.id, e)}
                                  >
                                    <DocStatusIcon tab={tab} isActive={tab.id === activeTabId} />
                                    <div className="flex-1 min-w-0">
                                      <span className="truncate block">{tab.title || "Untitled"}</span>
                                      {showSharedOwner && tab.ownerEmail && (
                                        <span className="truncate block text-caption" style={{ color: "var(--text-faint)" }}>{tab.ownerEmail}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Recent shared docs not yet open as tabs.
                          Match the opened-tab color exactly — the
                          color shouldn't change just because the
                          user clicked once. The subtle "muted-when-
                          unopened" treatment misled the eye into
                          thinking the doc had brightened on click,
                          when actually it was the same row swapping
                          render paths. */}
                      {allExtra.map((doc) => (
                        <div
                          key={`shared-${doc.id}`}
                          role="button"
                          tabIndex={0}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer group text-xs transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{ color: "var(--text-secondary)" }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            // Clicking a Shared-with-me entry should always
                            // leave the Start surface — even if the doc is
                            // already open, we're trying to view it now.
                            setShowOnboarding(false);
                            try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                            const existing = tabs.find(t => !t.deleted && t.cloudId === doc.id);
                            if (existing) { switchTab(existing.id); return; }
                            try {
                              const res = await fetch(`/api/docs/${doc.id}`, { headers: authHeaders });
                              if (!res.ok) {
                                console.error("[shared] Failed to load doc", doc.id, res.status, await res.text().catch(() => ""));
                                return;
                              }
                              const d = await res.json();
                              // Editor-role docs (allowed_editors) come back
                              // with isEditor=true. Default everyone else to
                              // readonly. Without this branch the sidebar
                              // entry opens as view-only even though the
                              // server has the user in allowed_editors.
                              const perm: "mine" | "editable" | "readonly" =
                                d.isOwner ? "mine"
                                : d.isEditor ? "editable"
                                : "readonly";
                              const newId = `tab-${Date.now()}`;
                              const newTab: Tab = { id: newId, title: d.title || "Untitled", markdown: d.markdown, cloudId: doc.id, permission: perm, shared: perm !== "mine", ownerEmail: d.ownerEmail || undefined };
                              // Render immediately, then update tabs
                              setTabs(prev => {
                                const dup = prev.find(t => !t.deleted && t.cloudId === doc.id);
                                if (dup) {
                                  return prev.map(t => t.cloudId === doc.id ? { ...t, markdown: d.markdown, title: d.title || t.title } : t);
                                }
                                const saved = prev.map(t => t.id !== activeTabIdRef.current || t.readonly ? t : { ...t, markdown: markdownRef.current });
                                return [...saved, newTab];
                              });
                              // Activate the new tab BEFORE loading. Without
                              // these two lines, the first click only added
                              // the tab to state but left activeTabId on the
                              // previous selection — so the editor canvas
                              // kept rendering the old doc and the user had
                              // to click a second time (which hit the
                              // "existing" branch and switched correctly).
                              activeTabIdRef.current = newTab.id;
                              setActiveTabId(newTab.id);
                              loadTab(newTab);
                              setDocId(doc.id);
                              setDocEditMode(d.editMode || "token");
                              setIsOwner(perm === "mine");
                              setIsSharedDoc(perm !== "mine");
                              setIsEditor(perm === "editable");
                              setTitle(d.title || "Untitled");
                            } catch { window.location.href = `/?from=${doc.id}`; }
                          }}
                        >
                          <DocStatusIcon tab={{ permission: "readonly" }} isActive={false} />
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{doc.title || "Untitled"}</span>
                            {showSharedOwner && ((doc as { ownerEmail?: string }).ownerEmail || (doc as { ownerName?: string }).ownerName) && (
                              <span className="truncate block text-caption" style={{ color: "var(--text-faint)" }}>{(doc as { ownerEmail?: string }).ownerEmail || (doc as { ownerName?: string }).ownerName}</span>
                            )}
                          </div>
                          {unreadDocIds.has(doc.id) && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--text-primary)" }} />
                          )}
                        </div>
                      ))}
                      {/* Drop zone for removing from shared folder */}
                      {dragTabId && (
                        <div
                          className="mx-2 mt-2 px-3 py-2 rounded-md text-caption text-center transition-colors"
                          style={{ border: "1px dashed var(--border)", color: "var(--text-faint)", background: dragOverTarget === "shared-root" ? "var(--border)" : "transparent" }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverTarget("shared-root"); }}
                          onDragLeave={() => setDragOverTarget(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragTabId) setTabs(prev => prev.map(t => t.id === dragTabId ? { ...t, folderId: undefined } : t));
                            setDragTabId(null);
                            setDragOverTarget(null);
                          }}
                        >
                          Move to root
                        </div>
                      )}
                      {totalShared === 0 && (
                        <div className="px-3 py-2 text-caption" style={{ color: "var(--text-faint)" }}>
                          {!isAuthenticated ? "Sign in to see shared docs" : "No shared documents"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>);
            })()}

            {/* ── Section: NEEDS REVIEW (Hermes Step 4: lint).
                  Surfaces orphan docs (not in any bundle, not linked
                  from any other doc) and likely duplicate pairs.
                  Only renders when there's at least one finding —
                  empty hubs don't need to see an empty section. ── */}
            {user?.id && lintReport && (
              (curatorSettings.orphan ? lintReport.orphans.filter((o) => !lintResolved.orphans.has(o.id)).length : 0)
              + (curatorSettings.duplicate ? lintReport.duplicates.filter((p) => !lintResolved.duplicates.has(`${p.a.id}|${p.b.id}`)).length : 0)
            ) > 0 && (
              <div className="shrink-0">
                <div
                  data-section-id="lint"
                  className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                  style={{
                    background: "var(--background)",
                    borderTop: "1px solid var(--border)",
                    borderBottom: "none",
                    position: "sticky", top: 0, zIndex: 10,
                  }}
                  onClick={() => { const next = !showLint; setShowLint(next); try { localStorage.setItem("mw-show-lint", String(next)); } catch {} }}
                >
                  <ChevronDown
                    width={10} height={10}
                    className={`shrink-0 transition-transform ${showLint ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                    style={{ transform: showLint ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                  <span className={`flex-1 text-caption font-medium transition-colors ${showLint ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Needs review</span>
                  <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{
                    (curatorSettings.orphan ? lintReport.orphans.filter((o) => !lintResolved.orphans.has(o.id)).length : 0)
                    + (curatorSettings.duplicate ? lintReport.duplicates.filter((p) => !lintResolved.duplicates.has(`${p.a.id}|${p.b.id}`)).length : 0)
                  }</span>
                </div>
                {showLint && (() => {
                  // Mutating actions kept inside this IIFE so the outer
                  // section doesn't grow a forest of inline handlers.
                  // `resolvingId` is the doc id currently being resolved
                  // — used to disable the row's Resolve button while
                  // the request is in flight.
                  // Filter the raw lintReport through (a) the user's
                  // curator-options toggles — categories the user
                  // turned off don't surface at all — and (b) the
                  // in-session resolved set so items the user just
                  // resolved stay hidden even if backend re-scan
                  // returns them (concept extraction is async, lags).
                  const visibleOrphans = curatorSettings.orphan
                    ? lintReport.orphans.filter((o) => !lintResolved.orphans.has(o.id))
                    : [];
                  const visibleDuplicates = curatorSettings.duplicate
                    ? lintReport.duplicates.filter((p) => !lintResolved.duplicates.has(`${p.a.id}|${p.b.id}`))
                    : [];
                  const totalVisible = visibleOrphans.length + visibleDuplicates.length;

                  const reScan = () => {
                    setLintLoading(true);
                    return fetch("/api/user/hub/lint", { headers: authHeaders })
                      .then((r) => (r.ok ? r.json() : null))
                      .then((data) => { if (data) setLintReport({ orphans: data.orphans || [], duplicates: data.duplicates || [], titleMismatches: data.titleMismatches || [], staleClaims: data.staleClaims || [], mergeSuggestions: data.mergeSuggestions || [], rollupSuggestions: data.rollupSuggestions || [], autoArchive: data.autoArchive || [], bundleSuggestions: data.bundleSuggestions || [], citationRot: data.citationRot || [], totalDocs: data.totalDocs || 0 }); })
                      .catch(() => {})
                      .finally(() => setLintLoading(false));
                  };
                  // "Re-scan from scratch" — clears the resolved set so
                  // findings the backend still considers open come back.
                  // Available via long-press / shift-click on Re-scan
                  // (kept implicit so the default UX is forgiving).
                  void (() => setLintResolved({ orphans: new Set(), duplicates: new Set(), titleMismatches: new Set(), staleClaims: new Set(), mergeSuggestions: new Set(), rollupSuggestions: new Set(), autoArchive: new Set(), bundleSuggestions: new Set(), citationRot: new Set() }));
                  const resolveOrphan = async (docId: string, docTitle: string | null) => {
                    // Orphan auto-fix: re-run concept extraction. The
                    // concept extractor pulls concepts from the doc;
                    // if any of those concepts ALSO appear in another
                    // doc, the cross-link breaks the orphan state
                    // (see hub-lint.ts conceptLinked).
                    if (!user?.id) return;
                    try {
                      const res = await fetch(`/api/docs/${docId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", ...authHeaders },
                        body: JSON.stringify({ action: "refresh-concepts", userId: user.id }),
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        showToast(j.error || "Couldn't refresh concepts", "error");
                        return;
                      }
                      showToast(`Re-extracting concepts for "${docTitle || "Untitled"}". If it shares concepts with another doc, it'll drop off the list.`, "success");
                      // Mark as resolved this session — kept hidden
                      // even if backend hasn't caught up by next scan.
                      setLintResolved((prev) => ({ ...prev, orphans: new Set([...prev.orphans, docId]) }));
                      setLintReport((prev) => prev ? { ...prev, orphans: prev.orphans.filter((x) => x.id !== docId) } : prev);
                      setTimeout(reScan, 4000);
                    } catch {
                      showToast("Couldn't refresh concepts", "error");
                    }
                  };
                  const resolveDuplicate = async (aId: string, aTitle: string | null, bId: string, bTitle: string | null) => {
                    const targetTitle = aTitle || aId;
                    if (!confirm(`Move "${targetTitle}" to Trash and keep "${bTitle || bId}" as the canonical copy?\n\nYou can restore from Trash if wrong.`)) return;
                    const targetTab = tabs.find((t) => t.cloudId === aId);
                    try {
                      const res = await fetch(`/api/docs/${aId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", ...authHeaders },
                        body: JSON.stringify({ action: "soft-delete", userId: user?.id, editToken: targetTab?.editToken }),
                      });
                      if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        showToast(j.error || "Couldn't move to Trash", "error");
                        return;
                      }
                      showToast(`Moved "${targetTitle}" to Trash. "${bTitle || bId}" is now the canonical copy.`, "success");
                      const pairKey = `${aId}|${bId}`;
                      setLintResolved((prev) => ({ ...prev, duplicates: new Set([...prev.duplicates, pairKey]) }));
                      setTabs((prev) => prev.map((t) => t.cloudId === aId ? { ...t, deleted: true, deletedAt: Date.now() } : t));
                      setLintReport((prev) => prev ? { ...prev, duplicates: prev.duplicates.filter((x) => x.a.id !== aId || x.b.id !== bId) } : prev);
                      setTimeout(reScan, 1500);
                    } catch {
                      showToast("Couldn't move to Trash", "error");
                    }
                  };

                  const resolveAll = async () => {
                    if (!user?.id || !lintReport) return;
                    const total = totalVisible;
                    if (total === 0) return;
                    if (!confirm(`Resolve all ${total} finding${total === 1 ? "" : "s"}?\n\n• Orphans (${visibleOrphans.length}) — concept extraction will re-run. If the doc shares concepts with another doc, it drops off the list.\n• Duplicates (${visibleDuplicates.length}) — the older copy of each pair moves to Trash; you can restore.`)) return;
                    setLintLoading(true);
                    let ok = 0;
                    let failed = 0;
                    // Orphans first — cheap, non-destructive.
                    const resolvedOrphanIds = new Set<string>();
                    const resolvedDupKeys = new Set<string>();
                    for (const o of visibleOrphans) {
                      try {
                        const res = await fetch(`/api/docs/${o.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({ action: "refresh-concepts", userId: user.id }),
                        });
                        if (res.ok) { ok++; resolvedOrphanIds.add(o.id); } else failed++;
                      } catch { failed++; }
                    }
                    // Duplicates — soft-delete the older copy of each pair.
                    for (const p of visibleDuplicates) {
                      const targetTab = tabs.find((t) => t.cloudId === p.a.id);
                      try {
                        const res = await fetch(`/api/docs/${p.a.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({ action: "soft-delete", userId: user.id, editToken: targetTab?.editToken }),
                        });
                        if (res.ok) {
                          ok++;
                          resolvedDupKeys.add(`${p.a.id}|${p.b.id}`);
                          setTabs((prev) => prev.map((t) => t.cloudId === p.a.id ? { ...t, deleted: true, deletedAt: Date.now() } : t));
                        } else failed++;
                      } catch { failed++; }
                    }
                    // Stash everything that actually succeeded so the
                    // rows don't flash back when the delayed re-scan
                    // races with the backend concept extraction.
                    setLintResolved((prev) => ({
                      ...prev,
                      orphans: new Set([...prev.orphans, ...resolvedOrphanIds]),
                      duplicates: new Set([...prev.duplicates, ...resolvedDupKeys]),
                    }));
                    showToast(failed > 0 ? `Resolved ${ok}, ${failed} failed` : `Resolved all ${ok}`, failed > 0 ? "error" : "success");
                    // Give the ontology extractor a few seconds to land
                    // its writes before we re-scan; orphan→linked is
                    // async and would otherwise still show the same
                    // findings.
                    setTimeout(() => reScan(), 4000);
                  };

                  return (
                    <div className="space-y-1 pb-2 pl-2 pr-2 pt-1.5">
                      {visibleOrphans.slice(0, 8).map((o) => (
                        <div
                          key={`orphan-${o.id}`}
                          className="group/lint relative flex items-center gap-1.5 px-2 rounded-md text-xs hover:bg-[var(--toggle-bg)] transition-colors"
                          style={{ color: "var(--text-muted)", height: 28 }}
                          title="Orphan — not in any bundle, not linked from any other doc. Resolve re-runs concept extraction on this doc."
                        >
                          {/* ORPHAN — warm warning hue (not red — orphan isn't
                              an error, it's a "needs attention" state). */}
                          <span className="shrink-0 px-1 rounded-sm font-mono uppercase" style={{ fontSize: 8, letterSpacing: 0.5, color: "var(--micro-warn)", border: "1px solid var(--micro-warn)" }}>orphan</span>
                          <button
                            onClick={() => {
                              const existing = tabs.find((t) => t.cloudId === o.id);
                              if (existing) { switchTab(existing.id); return; }
                              fetch(`/api/docs/${o.id}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                                if (!d) return;
                                const newId = `doc-${o.id}-${Date.now()}`;
                                setTabs(prev => [...prev, { id: newId, kind: "doc", title: d.title || "Untitled", markdown: d.markdown || "", cloudId: o.id, isDraft: d.is_draft }]);
                                switchTab(newId);
                              }).catch(() => {});
                            }}
                            className="truncate flex-1 text-left bg-transparent hover:underline"
                            style={{ color: "inherit" }}
                          >
                            {o.title || "Untitled"}
                          </button>
                          {/* Resolve button — hidden in layout pre-hover
                              and slotted into the flex flow on hover.
                              Title's flex-1 shrinks to make room. No
                              absolute positioning, no overlap. */}
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveOrphan(o.id, o.title); }}
                            className="shrink-0 hidden group-hover/lint:inline-flex items-center px-2 py-0.5 rounded"
                            style={{ background: "var(--toggle-bg)", color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, border: "1px solid var(--border-dim)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--text-primary)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; }}
                            title="Re-extract concepts for this doc — usually fixes the orphan"
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                      {visibleDuplicates.slice(0, 8).map((p) => (
                        <div
                          key={`dup-${p.a.id}-${p.b.id}`}
                          className="group/lint relative flex items-center gap-1.5 px-2 rounded-md text-xs hover:bg-[var(--toggle-bg)] transition-colors"
                          style={{ color: "var(--text-muted)", height: 28 }}
                          title={`Likely duplicate — distance ${p.distance.toFixed(3)}. Resolve moves the older copy to Trash and keeps the newer one.`}
                        >
                          {/* DUP — info hue (informational duplicate, not an
                              error; the resolve action moves the older copy). */}
                          <span className="shrink-0 px-1 rounded-sm font-mono uppercase" style={{ fontSize: 8, letterSpacing: 0.5, color: "var(--micro-info)", border: "1px solid var(--micro-info)" }}>dup</span>
                          <button
                            onClick={() => {
                              for (const id of [p.a.id, p.b.id]) {
                                const existing = tabs.find(t => t.cloudId === id);
                                if (existing) continue;
                                fetch(`/api/docs/${id}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                                  if (!d) return;
                                  setTabs(prev => prev.some(t => t.cloudId === id) ? prev : [...prev, { id: `doc-${id}-${Date.now()}`, kind: "doc", title: d.title || "Untitled", markdown: d.markdown || "", cloudId: id, isDraft: d.is_draft }]);
                                }).catch(() => {});
                              }
                              setTimeout(() => {
                                const newer = tabs.find(t => t.cloudId === p.b.id);
                                if (newer) switchTab(newer.id);
                              }, 100);
                            }}
                            className="truncate flex-1 text-left bg-transparent hover:underline"
                            style={{ color: "inherit" }}
                          >
                            {(p.a.title || "Untitled")} ↔ {(p.b.title || "Untitled")}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveDuplicate(p.a.id, p.a.title, p.b.id, p.b.title); }}
                            className="shrink-0 hidden group-hover/lint:inline-flex items-center px-2 py-0.5 rounded"
                            style={{ background: "var(--toggle-bg)", color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, border: "1px solid var(--border-dim)" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--text-primary)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; }}
                            title="Move the older copy to Trash"
                          >
                            Resolve
                          </button>
                        </div>
                      ))}
                      {(visibleOrphans.length > 8 || visibleDuplicates.length > 8) && (
                        <div className="text-caption px-2.5 py-1" style={{ color: "var(--text-faint)" }}>
                          …showing {Math.min(visibleOrphans.length, 8) + Math.min(visibleDuplicates.length, 8)} of {totalVisible}.
                        </div>
                      )}
                      {/* Action row — both buttons share the neutral
                          bordered style. Resolve All used to be
                          accent-tinted but it read as "destructive
                          primary CTA" which it isn't (Trash is
                          restorable, the action is undo-friendly).
                          Same weight as Re-scan; only the icon + label
                          tell them apart. */}
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => { reScan(); }}
                          disabled={lintLoading}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-caption font-medium transition-colors disabled:opacity-50"
                          style={{
                            background: "var(--toggle-bg)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-dim)",
                          }}
                          onMouseEnter={(e) => { if (!lintLoading) { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; } }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                          title="Recompute orphans + duplicates from the current hub state"
                        >
                          <RefreshCw width={11} height={11} className={lintLoading ? "animate-spin" : ""} />
                          {lintLoading ? "Re-scanning…" : "Re-scan"}
                        </button>
                        <button
                          onClick={resolveAll}
                          disabled={lintLoading || totalVisible === 0}
                          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-caption font-medium transition-colors disabled:opacity-50"
                          style={{
                            background: "var(--toggle-bg)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-dim)",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                          title="Run Resolve on every finding — re-extract orphans, move duplicate pair's older copy to Trash"
                        >
                          <Check width={11} height={11} />
                          Resolve all
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Section: GUIDES & EXAMPLES (above Trash so the
                  helper docs are reachable without scrolling past
                  the deleted-bin) ── */}
            {showExamples && (() => {
              const exampleTabs = memoExampleTabs;
              return (
                <div className="shrink-0">
                  <div
                    data-section-id="guides"
                    className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                    onClick={() => { const next = !examplesCollapsed; setExamplesCollapsed(next); localStorage.setItem("mw-examples-collapsed", String(next)); }}
                  >
                    <ChevronDown
                      width={10} height={10}
                      className={`shrink-0 transition-transform ${!examplesCollapsed ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                      style={{ transform: examplesCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                    />
                    <span className={`flex-1 text-caption font-medium transition-colors ${!examplesCollapsed ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Guides & Examples</span>
                    <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{exampleTabs.length}</span>
                  </div>
                  {!examplesCollapsed && <div className="space-y-0.5 pb-1 pl-2 pr-2">
                    {exampleTabs.map(tab => (
                      <div
                        key={tab.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md cursor-pointer group text-xs transition-colors ${tab.id === activeTabId ? "bg-[var(--border)]" : "hover:bg-[var(--toggle-bg)]"}`}
                        style={{
                          color: tab.id === activeTabId ? "var(--text-primary)" : "var(--text-secondary)",
                        }}
                        onClick={(e) => handleDocClick(tab.id, e)}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setDocContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }); }}
                      >
                        {tab.kind === "bundle"
                          ? renderBundleStatusIcon(tab.bundleId, 13)
                          : <Eye width={13} height={13} className="shrink-0" style={{ color: tab.id === activeTabId ? "var(--text-primary)" : "var(--text-faint)" }} />
                        }
                        <span className="truncate flex-1">{tab.title || "Untitled"}</span>
                      </div>
                    ))}
                  </div>}
                </div>
              );
            })()}

            {/* ── Section: TRASH (bottom of the sidebar) ── */}
            {(() => {
              // Trash: all deleted documents (mine + shared I removed from list)
              const trashTabs = memoTrashTabs;
              return (<>
                <div className="shrink-0 flex flex-col">
                  <div
                    data-section-id="trash"
                    className="flex items-center gap-1.5 px-3 h-7 cursor-pointer select-none group/sec hover:bg-[var(--toggle-bg)]"
                    style={{ background: "var(--background)", borderTop: "1px solid var(--border)", borderBottom: "none", position: "sticky", top: 0, zIndex: 10 }}
                    onClick={() => { const next = !showTrash; setShowTrash(next); localStorage.setItem("mw-show-trash", String(next)); }}
                  >
                    <ChevronDown
                      width={10} height={10}
                      className={`shrink-0 transition-transform ${showTrash ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] group-hover/sec:text-[var(--text-primary)]"}`}
                      style={{ transform: showTrash ? "rotate(0deg)" : "rotate(-90deg)" }}
                    />
                    <span className={`flex-1 text-caption font-medium transition-colors ${showTrash ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] group-hover/sec:text-[var(--text-primary)]"}`}>Trash</span>
                    <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)", opacity: 0.6 }}>{trashTabs.length}</span>
                  </div>
                  {showTrash && (
                    <div className="space-y-0.5 pt-1 pb-1 pl-2">
                      {trashTabs.map(tab => (
                        // Action buttons collapse to `hidden` (not just
                        // opacity-0) so they take no horizontal space when
                        // the row isn't hovered. Previously the buttons
                        // stayed in flex layout while invisible, shrinking
                        // the filename column by their width even at rest.
                        // Matches the MDs section's hover-reveal pattern.
                        <div key={tab.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs group hover:bg-[var(--toggle-bg)] transition-colors" style={{ color: "var(--text-faint)" }}>
                          <FileIcon width={14} height={14} className="shrink-0 opacity-40" />
                          <span className="truncate flex-1 line-through opacity-60">{tab.title || "Untitled"}</span>
                          <button onClick={() => {
                            // Only call server restore for MY docs
                            if (tab.cloudId && (!tab.permission || tab.permission === "mine")) {
                              restoreDocument(tab.cloudId, { userId: user?.id, editToken: tab.editToken || undefined }).catch(() => {});
                            }
                            setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, deleted: false, deletedAt: undefined } : t));
                          }}
                            className="text-caption hidden group-hover:inline-flex px-1 rounded" style={{ color: "var(--text-primary)" }}
                            title="Restore this document">
                            Restore
                          </button>
                          <button onClick={async () => {
                            const isMine = !tab.permission || tab.permission === "mine";
                            // Shared docs: actually leave the share on
                            // the server (remove caller's email from
                            // allowed_emails / allowed_editors), then
                            // drop from local list. Used to be local-
                            // only which left the row reappearing on
                            // the next /api/user/recent hydration.
                            if (!isMine) {
                              if (tab.cloudId && user?.email) {
                                try {
                                  await fetch(`/api/docs/${tab.cloudId}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", ...authHeaders },
                                    body: JSON.stringify({ action: "leave-share", userEmail: user.email }),
                                  });
                                } catch { /* best effort */ }
                                fetch("/api/user/recent", { headers: authHeaders })
                                  .then(r => (r.ok ? r.json() : null))
                                  .then(d => { if (d?.recent) setRecentDocs(d.recent.filter((x: { isOwner: boolean }) => !x.isOwner)); })
                                  .catch(() => {});
                              }
                              setTabs(prev => prev.filter(t => t.id !== tab.id));
                              return;
                            }
                            const ok = await hardDeleteOnServer(tab);
                            if (ok) {
                              setTabs(prev => prev.filter(t => t.id !== tab.id));
                            } else {
                              showToast("Couldn't delete — server refused", "error");
                            }
                          }}
                            className="text-caption hidden group-hover:inline-flex px-1 rounded" style={{ color: "var(--text-faint)" }}
                            title={(!tab.permission || tab.permission === "mine") ? "Delete permanently" : "Remove from list"}>
                            {(!tab.permission || tab.permission === "mine") ? "Delete" : "Remove"}
                          </button>
                        </div>
                      ))}
                      {trashTabs.length > 0 && (
                        <button
                          onClick={async (e) => {
                            const btn = e.currentTarget;
                            if (btn.dataset.confirm === "true") {
                              btn.dataset.confirm = "";
                              btn.textContent = "Emptying…";
                              btn.style.color = "var(--text-faint)";
                              const targets = tabs.filter(t => t.deleted && t.cloudId && (!t.permission || t.permission === "mine"));
                              const sharedTargets = tabs.filter(t => t.deleted && (t.permission === "readonly" || t.permission === "editable"));
                              const results = await Promise.all(targets.map(t => hardDeleteOnServer(t)));
                              const successIds = new Set(targets.filter((_, i) => results[i]).map(t => t.id));
                              const failedCount = results.filter(r => !r).length;
                              // Drop only the rows the server confirmed deleted, plus any
                              // shared-doc dismissals which never hit the server.
                              setTabs(prev => prev.filter(t => !successIds.has(t.id) && !sharedTargets.some(s => s.id === t.id)));
                              if (failedCount > 0) {
                                showToast(`${failedCount} item${failedCount === 1 ? "" : "s"} couldn't be deleted`, "error");
                              }
                              btn.textContent = "Empty Trash";
                            } else {
                              btn.dataset.confirm = "true";
                              btn.textContent = `Delete ${trashTabs.length} permanently?`;
                              btn.style.color = "#ef4444";
                              setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Empty Trash"; btn.style.color = "var(--text-faint)"; }, 3000);
                            }
                          }}
                          className="w-full text-caption px-2 py-1 rounded-md transition-colors text-center mt-1"
                          style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}
                          title="Permanently delete all trashed documents"
                        >
                          Empty Trash
                        </button>
                      )}
                      {trashTabs.length === 0 && (
                        <div className="px-2.5 py-2 text-caption" style={{ color: "var(--text-faint)" }}>Trash is empty</div>
                      )}
                    </div>
                  )}
                </div>
              </>);
            })()}

          </div>

          {/* Section navigator — sections that are off-screen below the viewport
              get a small clickable label here so the user can jump back to them
              without scrolling. Acts as a "bottom-sticky" preview of what's
              still ahead. Hidden when nothing is below viewport. */}
          {belowViewportSections.size > 0 && (() => {
            const navItems: Array<{ id: string; label: string; count: number }> = [
              { id: "recent", label: "Recent", count: recentTabIds.filter(id => tabs.find(t => t.id === id && !t.deleted)).length },
              { id: "bundles", label: "Bundles", count: bundles.length },
              { id: "mds", label: "MDs", count: memoAllMyTabs.length },
              { id: "shared", label: "Shared", count: tabs.filter(t => !t.deleted && (t.permission === "readonly" || t.permission === "editable")).length },
              { id: "guides", label: "Guides", count: memoExampleTabs.length },
              { id: "trash", label: "Trash", count: memoTrashTabs.length },
            ];
            return (
              <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 overflow-x-auto whitespace-nowrap sidebar-scroll" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                {navItems.filter(s => belowViewportSections.has(s.id)).map(s => (
                  <Tooltip key={s.id} text={`Jump to ${s.label}`}>
                    <button
                      onClick={() => {
                        const root = sectionsScrollRef.current;
                        const target = root?.querySelector(`[data-section-id="${s.id}"]`) as HTMLElement | null;
                        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="shrink-0 inline-flex items-center gap-1 text-caption px-2 py-0.5 rounded-full transition-colors hover:bg-[var(--border)]"
                      style={{ color: "var(--text-muted)", background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}
                    >
                      <span>{s.label}</span>
                      {s.count > 0 && (
                        <span className="text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>{s.count}</span>
                      )}
                    </button>
                  </Tooltip>
                ))}
              </div>
            );
          })()}

          {/* Multi-select action bar */}
          {selectedTabIds.size > 0 && (
            <div className="shrink-0 px-3 py-2.5 mw-multiselect-bar" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              {/* Header: count + clear */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-caption font-semibold" style={{ color: "var(--text-primary)" }}>{selectedTabIds.size} document{selectedTabIds.size > 1 ? "s" : ""} selected</span>
                <button onClick={() => setSelectedTabIds(new Set())} className="text-caption px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--toggle-bg)]" style={{ color: "var(--text-faint)" }} title="Clear selection">
                  Clear
                </button>
              </div>
              {/* Actions */}
              <div className="flex gap-1.5">
                {(folders.filter(f => !f.section || f.section === "my").length > 0 || !!user?.id) && (
                  <div className="relative group/move flex-1">
                    <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-caption font-medium transition-colors hover:bg-[var(--border)]" style={{ color: "var(--text-secondary)", border: "1px solid var(--border-dim)" }} title="Move to folder">
                      <Folder width={11} height={11} /><span className="mw-collapse-label">Move</span><ChevronDown width={8} height={8} />
                    </button>
                    <div
                      className="absolute bottom-full left-0 mb-1 rounded-lg py-1 hidden group-hover/move:block"
                      style={{
                        background: "var(--menu-bg)",
                        border: "1px solid var(--border)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        zIndex: 9999,
                        // Size to longest folder name so labels stay
                        // on a single line, but never narrower than
                        // the Move button (minWidth: 100%) and never
                        // wider than 18rem so a runaway folder name
                        // can't escape the sidebar.
                        width: "max-content",
                        minWidth: "100%",
                        maxWidth: "18rem",
                      }}
                    >
                      {folders.filter(f => !f.section || f.section === "my").map(f => (
                        <button key={f.id} onClick={() => { setTabs(prev => prev.map(t => selectedTabIds.has(t.id) ? { ...t, folderId: f.id } : t)); setSelectedTabIds(new Set()); }}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--border)] flex items-center gap-2 whitespace-nowrap"
                          style={{ color: "var(--text-secondary)" }}
                          title={f.name}>
                          <Folder width={11} height={11} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                      <button onClick={() => { setTabs(prev => prev.map(t => selectedTabIds.has(t.id) ? { ...t, folderId: undefined } : t)); setSelectedTabIds(new Set()); }}
                        className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--border)] flex items-center gap-2 whitespace-nowrap"
                        style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border-dim)" }}>
                        <FileIcon width={11} height={11} style={{ color: "var(--text-faint)", flexShrink: 0 }} />Root
                      </button>
                      {user?.id && (
                        <button
                          onClick={() => {
                            // Snapshot the selection BEFORE we clear it
                            // — setInlineInput's onSubmit fires later
                            // and selectedTabIds will be empty by then.
                            const targetIds = new Set(selectedTabIds);
                            const id = `folder-${Date.now()}`;
                            const defaultName = "New Folder";
                            setFolders(prev => [...prev, { id, name: defaultName, collapsed: false, section: "my" }]);
                            setTabs(prev => prev.map(t => targetIds.has(t.id) ? { ...t, folderId: id } : t));
                            setSelectedTabIds(new Set());
                            // Persist optimistically; failure is recoverable on next reload
                            fetch("/api/user/folders", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...authHeaders },
                              body: JSON.stringify({ id, name: defaultName, section: "my" }),
                            }).catch(() => {});
                            // Immediately open rename so the user names
                            // it in-flow instead of finding "New Folder"
                            // in the sidebar after the fact.
                            setInlineInput({
                              label: "Folder name",
                              defaultValue: defaultName,
                              onSubmit: (name) => {
                                setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
                                fetch("/api/user/folders", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", ...authHeaders },
                                  body: JSON.stringify({ id, name }),
                                }).catch(() => {});
                                setInlineInput(null);
                              },
                            });
                          }}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--border)] flex items-center gap-2 whitespace-nowrap"
                          style={{ color: "var(--text-primary)", borderTop: "1px solid var(--border-dim)" }}
                          title="Create a new folder and move the selected docs into it"
                        >
                          <FolderPlus width={11} height={11} style={{ flexShrink: 0 }} />
                          New folder…
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Bundle — pre-fills BundleCreator with the
                    selected docs and an auto-suggested title. Only
                    visible when ≥ 2 docs with cloudId are selected
                    (single-doc bundling is reachable via the right-
                    click "Create bundle…" instead). */}
                {(() => {
                  const bundleable = tabs.filter(t =>
                    selectedTabIds.has(t.id) && t.cloudId && !t.deleted && t.kind !== "bundle",
                  );
                  if (bundleable.length < 2) return null;
                  return (
                    <button
                      onClick={() => {
                        const docs = bundleable.map(t => ({ id: t.cloudId!, title: t.title || "Untitled" }));
                        setBundleCreatorDocs(docs);
                        setShowMyBundles(true);
                        setShowBundleCreator(true);
                        setSelectedTabIds(new Set());
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-caption font-medium transition-colors hover:bg-[var(--border)]"
                      style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
                      title={`Bundle ${bundleable.length} selected docs`}
                    >
                      <Layers width={11} height={11} />
                      <span className="mw-collapse-label">Bundle</span>
                    </button>
                  );
                })()}
                <button onClick={() => {
                  if (!confirmTrash) {
                    setConfirmTrash(true);
                    setTimeout(() => { setConfirmTrash(false); }, 3000);
                    return;
                  }
                  setConfirmTrash(false);
                  const ids = selectedTabIds;
                  // Soft delete from server for cloud documents
                  tabs.filter(t => ids.has(t.id) && t.cloudId).forEach(t => softDeleteOnServer(t));
                  setTabs(prev => prev.map(t => ids.has(t.id) ? { ...t, deleted: true, deletedAt: Date.now() } : t));
                  if (ids.has(activeTabId)) { const fb = pickFallbackTabAfterDelete(ids); if (fb) switchTab(fb); else switchToStartSurface(); }
                  setSelectedTabIds(new Set());
                }} className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md text-caption font-medium transition-colors shrink-0 ${confirmTrash ? "bg-[#ef4444]" : ""}`}
                  style={{ color: confirmTrash ? "#fff" : "#ef4444", border: confirmTrash ? "1px solid #ef4444" : "1px solid rgba(239,68,68,0.3)" }}
                  title="Move to Trash">
                  <Trash2 width={11} height={11} />
                  {confirmTrash && <span>Confirm?</span>}
                </button>
              </div>
            </div>
          )}
          {/* Folder + Sort actions moved to section headers */}
          {/* Account section at bottom */}
          <div className="shrink-0 px-2 py-2" style={{ borderTop: "1px solid var(--border-dim)" }}>
            {authLoading ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-caption" style={{ color: "var(--text-faint)" }}>
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isAuthenticated ? (
              <div ref={authMenuTriggerRef} className="relative flex items-center gap-1">
                <button
                  onClick={() => setShowAuthMenu(!showAuthMenu)}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-[var(--border)]"
                  title="Account menu"
                >
                  <img src={resolveAvatar(profile, user, 20)} alt="" className="w-5 h-5 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-caption truncate" style={{ color: "var(--text-primary)" }}>{profile?.display_name || user?.email?.split("@")[0]}</div>
                    <div className="text-caption truncate" style={{ color: "var(--text-faint)" }}>{user?.email}</div>
                  </div>
                  <ChevronDown width={10} height={10} style={{ color: "var(--text-faint)" }} />
                </button>
                {/* Direct gear → opens the Settings overlay without
                    routing through the profile menu. The profile
                    menu still has its own Account Settings row;
                    this is the one-click shortcut for users who
                    just want to jump straight into preferences. */}
                <Tooltip text="Account settings" position="top">
                  <button
                    onClick={() => { setShowOnboarding(false); setShowHub(false); setShowGalaxy(false); setShowSettings(true); }}
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-[var(--border)]"
                    style={{ color: "var(--text-faint)" }}
                    aria-label="Account settings"
                  >
                    <Settings width={14} height={14} />
                  </button>
                </Tooltip>
                {showAuthMenu && (
                  <>
                    {/* No backdrop element — outside-click +
                        Escape dismissal lives in a useEffect above.
                        A portalled backdrop sat above the sidebar's
                        stacking context and blocked clicks on the
                        menu's own buttons. */}
                    <div ref={authMenuPanelRef} className="absolute bottom-full left-0 mb-1 w-full rounded-lg shadow-xl z-[9999] overflow-hidden"
                      style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                      {/* Profile header — avatar + identity, no plan badge here.
                          Plan stays on its own row below so the eye reads
                          identity → plan → settings → footer in one column. */}
                      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                        <div className="flex items-center gap-2.5">
                          <img src={resolveAvatar(profile, user, 32)} alt="" className="w-8 h-8 rounded-full shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-body font-semibold truncate" style={{ color: "var(--text-primary)" }}>{profile?.display_name || "User"}</div>
                            <div className="text-caption truncate" style={{ color: "var(--text-faint)" }}>{user?.email}</div>
                          </div>
                        </div>
                      </div>
                      {/* Plan row — one line, label + chip + upgrade arrow.
                          The old version had a paragraph of marketing copy
                          + a 4-line "Pro includes" bullet list inside the
                          menu. Pro feature breakdown now lives behind the
                          arrow CTA on a dedicated /pricing page; the menu
                          is for navigation, not upsell. */}
                      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                        <span className="text-caption font-medium" style={{ color: "var(--text-faint)" }}>Plan</span>
                        <span
                          className="text-caption px-1.5 py-0.5 rounded font-mono font-semibold"
                          style={{
                            background: profile?.plan === "pro" ? "var(--text-primary)" : "var(--toggle-bg)",
                            color: profile?.plan === "pro" ? "#000" : "var(--text-secondary)",
                          }}
                        >
                          {(profile?.plan || "free").toUpperCase()}
                        </span>
                        <span className="flex-1" />
                        {(!profile?.plan || profile.plan === "free") && (
                          /* Soft filled chip — matches the Canvas / Full guide
                              / List view shape across the app. Tint background
                              + same-color text + arrow icon. */
                          <button
                            onClick={() => { setShowAuthMenu(false); window.open("/about#pricing", "_blank"); }}
                            className="inline-flex items-center gap-1 text-caption font-medium px-2.5 py-1 rounded transition-opacity hover:opacity-85"
                            style={{
                              color: "var(--micro-info)",
                              background: "rgba(46, 123, 255, 0.10)",
                            }}
                            title="See Pro features"
                          >
                            Upgrade
                            <ArrowUpRight width={11} height={11} />
                          </button>
                        )}
                      </div>
                      {/* Toggles: Guides & Sidebar mode */}
                      <div className="py-1" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                        <button
                          onClick={() => { setShowExamples(!showExamples); }}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <BookOpen width={12} height={12} />
                          <span className="flex-1">Show Guides & Examples</span>
                          {/* Semantic toggle: ON = lime (active), OFF = red dim.
                              Reads at a glance even without labels. */}
                          <span className="relative inline-flex items-center" style={{ width: 28, height: 14 }}>
                            {/* Solid, slightly desaturated micro colors at full
                                alpha — thin red on dark bg at < 1 opacity turned
                                muddy brown; saturated hex at alpha 1 reads as
                                clean ON/OFF. */}
                            <span className="absolute inset-0 rounded-full transition-colors" style={{ background: showExamples ? "#7CC400" : "#9A2A2A" }} />
                            <span className="absolute rounded-full transition-transform" style={{ width: 10, height: 10, top: 2, background: "#fff", transform: showExamples ? "translateX(16px)" : "translateX(2px)" }} />
                          </span>
                        </button>
                        <button
                          onClick={() => setSidebarMode(m => m === "simple" ? "detailed" : "simple")}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <List width={12} height={12} />
                          <span className="flex-1">{sidebarMode === "simple" ? "Detailed Sidebar" : "Simple Sidebar"}</span>
                          <span className="relative inline-flex items-center" style={{ width: 28, height: 14 }}>
                            <span className="absolute inset-0 rounded-full transition-colors" style={{ background: sidebarMode === "detailed" ? "#7CC400" : "#9A2A2A" }} />
                            <span className="absolute rounded-full transition-transform" style={{ width: 10, height: 10, top: 2, background: "#fff", transform: sidebarMode === "detailed" ? "translateX(16px)" : "translateX(2px)" }} />
                          </span>
                        </button>
                      </div>
                      {/* Appearance: Skin Theme first, then Key Color.
                          Flyouts use a controlled hoverFlyout state +
                          120ms close-delay so the mouse can travel
                          across the gap between row and submenu
                          without losing hover. The earlier Tailwind
                          group-hover version dropped the submenu the
                          moment the cursor left the row's exact
                          bounding box. */}
                      <div className="py-1" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                        {/* Skin Theme */}
                        <FlyoutMenu
                          label="Skin Theme"
                          icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12"/><path d="M6 6v8"/></svg>}
                          width={160}
                        >
                          <div className="text-caption font-mono uppercase tracking-wider mb-1 px-3 pt-1" style={{ color: "var(--text-faint)" }}>Skin Theme</div>
                          {COLOR_SCHEMES.map(s => (
                            <button
                              key={s.name}
                              onClick={() => setColorScheme(s.name)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-[var(--menu-hover)]"
                              style={{ color: colorScheme === s.name ? "var(--text-primary)" : "var(--text-secondary)" }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.preview, outline: colorScheme === s.name ? "1.5px solid var(--text-primary)" : "1px solid var(--border)", outlineOffset: "1px" }} />
                              <span>
                                <span className="text-caption block" style={{ fontWeight: colorScheme === s.name ? 600 : 400 }}>{s.label}</span>
                                <span className="text-caption block" style={{ color: "var(--text-faint)" }}>{s.desc}</span>
                              </span>
                            </button>
                          ))}
                        </FlyoutMenu>
                        {/* Key Color */}
                        <FlyoutMenu
                          label="Key Color"
                          icon={<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--text-primary)" }} />}
                          width={128}
                        >
                          <div className="text-caption font-mono uppercase tracking-wider mb-1 px-3 pt-1" style={{ color: "var(--text-faint)" }}>Key Color</div>
                          {ACCENT_COLORS.map(c => (
                            <button
                              key={c.name}
                              onClick={() => { setAccentColor(c.name); }}
                              className="w-full flex items-center gap-2 px-3 py-1 text-caption transition-colors hover:bg-[var(--menu-hover)] text-left"
                              style={{
                                color: accentColor === c.name ? "var(--text-primary)" : "var(--text-secondary)",
                                fontWeight: accentColor === c.name ? 600 : 400,
                              }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: theme === "dark" ? c.dark : c.light, outline: accentColor === c.name ? "1.5px solid var(--text-primary)" : "1px solid var(--border)", outlineOffset: "1px" }} />
                              {c.label}
                            </button>
                          ))}
                        </FlyoutMenu>
                      </div>
                      {/* Account section. Hub + Settings share one
                          group; Sign Out lives below a divider so it
                          can't be hit by accident next to a routine
                          link. My Hub used to render in accent which
                          made it look like an alert pinned in the
                          menu — toned down to text-secondary, matches
                          its sibling row. */}
                      <div className="py-1">
                        {(profile as { hub_slug?: string | null; hub_public?: boolean } | null)?.hub_public &&
                         (profile as { hub_slug?: string | null }).hub_slug && (
                          <button
                            onClick={() => {
                              const slug = (profile as { hub_slug?: string }).hub_slug;
                              setShowAuthMenu(false);
                              if (slug) window.open(`/hub/${slug}`, "_blank");
                            }}
                            className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <Globe width={12} height={12} aria-hidden />
                            <span className="flex-1">My Hub</span>
                            <span className="font-mono" style={{ color: "var(--text-faint)", fontSize: 10 }}>
                              /hub/{(profile as { hub_slug?: string }).hub_slug}
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setShowAuthMenu(false);
                            setShowOnboarding(false);
                            setShowHub(false);
                            setShowGalaxy(false);
                            setShowSettings(true);
                          }}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <User width={12} height={12} />
                          Account Settings
                        </button>
                      </div>
                      <div className="py-1" style={{ borderTop: "1px solid var(--border-dim)" }}>
                        <button
                          onClick={() => {
                            signOut();
                            setShowAuthMenu(false);
                            setTabs(INITIAL_TABS);
                            setFolders(INITIAL_FOLDERS);
                            setActiveTabId(INITIAL_TABS[0].id);
                            setMarkdown(INITIAL_TABS[0].markdown);
                            setDocId(null);
                            setIsOwner(false);
                            setIsSharedDoc(false);
                            setServerDocs([]);
                            setRecentDocs([]);
                            // Sidebar Bundle section was sticking around
                            // after sign-out because the fetch effect
                            // refetched against the still-present anon id.
                            // Clear bundles state + cache + the anon id so
                            // the next render is a clean anonymous session.
                            setBundles([]);
                            clearAnonymousId();
                            doRender(INITIAL_TABS[0].markdown);
                            window.history.replaceState(null, "", "/");
                            try {
                              localStorage.removeItem("mw-tabs");
                              localStorage.removeItem("mw-folders");
                              localStorage.removeItem("mw-active-tab");
                              localStorage.removeItem("mw-bundles");
                              localStorage.removeItem("mw-was-logged-in");
                            } catch {}
                          }}
                          className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2"
                          style={{ color: "var(--text-faint)" }}
                        >
                          <LogOut width={12} height={12} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowAuthMenu(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-xs hover:bg-[var(--border)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <User width={14} height={14} className="shrink-0" />
                  {sidebarWidth >= 180 ? "Sign In / Sign Up" : "Sign In"}
                </button>
              </>
            )}
          </div>
        </div>
        {/* Sidebar resize hit-zone — invisible. The 1px borderRight on
            the sidebar itself is the only visible seam; this strip just
            exposes a 5px drag target sitting on top of that seam. */}
        {!isMobile && (
          <div
            data-print-hide
            className="shrink-0 cursor-col-resize"
            style={{ width: 5, marginLeft: -3, background: "transparent", position: "relative", zIndex: 11 }}
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSidebar.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />
        )}
        </>
      ) : (
        /* Collapsed: just the toggle button as a narrow strip.
           items-start + pl-2 keeps the toggle icon at the same horizontal
           offset as when the sidebar is open (px-2 container + button p-1
           in the open header), so re-opening doesn't visually shift the
           cursor target. */
        <div
          data-print-hide
          className="flex flex-col shrink-0 items-start pl-2 pt-1.5 gap-1"
          style={{ width: 36, borderRight: "1px solid var(--border-dim)", background: "var(--background)" }}
        >
          <Tooltip text="Open sidebar" position="right">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <PanelLeft width={14} height={14} />
            </button>
          </Tooltip>
          <div ref={newMenuRef} className="relative">
            <Tooltip text="New document" position="right">
              <button
                onClick={() => setShowNewMenu(v => !v)}
                className="p-1 rounded transition-colors"
                style={{ color: showNewMenu ? "var(--text-primary)" : "var(--text-muted)", background: showNewMenu ? "var(--border)" : "transparent" }}
              >
                <Plus width={14} height={14} />
              </button>
            </Tooltip>
            {showNewMenu && (
              <div
                className="absolute z-[200] py-1 rounded-lg shadow-xl"
                style={{
                  top: 0,
                  left: "calc(100% + 6px)",
                  minWidth: 180,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                }}
              >
                <button
                  onClick={() => { setShowNewMenu(false); addTab(); }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Plus width={12} height={12} /> Blank document
                </button>
                <button
                  onClick={() => { setShowNewMenu(false); setShowTemplatePicker(true); }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Layers width={12} height={12} /> From template
                </button>
                <button
                  onClick={() => { setShowNewMenu(false); importFileRef.current?.click(); }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <Upload width={12} height={12} /> Import file…
                </button>
                <button
                  onClick={async () => {
                    setShowNewMenu(false);
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        addTab();
                        setTimeout(() => { setMarkdown(text); doRender(text); cmSetDocRef.current?.(text); }, 100);
                      }
                    } catch { /* clipboard permission denied */ }
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <FileText width={12} height={12} /> From clipboard
                </button>
              </div>
            )}
          </div>
          <div className="flex-1" />
          <div className="pb-2">
            <Tooltip text={isAuthenticated ? profile?.display_name || user?.email : "Sign in"} position="right">
            <button
              onClick={() => { setShowSidebar(true); setTimeout(() => setShowAuthMenu(true), 100); }}
              className="p-1 rounded transition-colors"
              style={{ color: isAuthenticated ? "var(--text-primary)" : "var(--text-faint)" }}
            >
              {isAuthenticated ? (
                <img src={resolveAvatar(profile, user, 16)} alt="" className="w-4 h-4 rounded-full" />
              ) : (
                <User width={14} height={14} />
              )}
            </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Editor + Render area */}
      <div
        ref={splitContainerRef}
        className={`flex flex-1 min-h-0 overflow-hidden relative ${isMobile && viewMode === "split" ? "flex-col" : ""}`}
        style={{ background: "var(--canvas)" }}
        onMouseMove={(e) => {
          if (!isDraggingSplit.current || !splitContainerRef.current) return;
          const rect = splitContainerRef.current.getBoundingClientRect();
          let pct: number;
          if (isMobile) {
            pct = ((e.clientY - rect.top) / rect.height) * 100;
          } else {
            pct = ((e.clientX - rect.left) / rect.width) * 100;
          }
          pct = Math.max(25, Math.min(75, pct));
          splitPercentRef.current = pct;
          // Update DOM directly to avoid re-render (preserves Mermaid SVGs)
          const renderPane = splitContainerRef.current.querySelector("[data-pane='render']") as HTMLElement;
          if (renderPane) {
            if (isMobile) {
              renderPane.style.height = `${pct}%`;
            } else {
              renderPane.style.width = `${pct}%`;
            }
          }
        }}
        onMouseUp={() => { isDraggingSplit.current = false; }}
        onMouseLeave={() => { isDraggingSplit.current = false; }}
        onTouchMove={(e) => {
          if (!isDraggingSplit.current || !splitContainerRef.current) return;
          const touch = e.touches[0];
          const rect = splitContainerRef.current.getBoundingClientRect();
          let pct: number;
          if (isMobile) {
            pct = ((touch.clientY - rect.top) / rect.height) * 100;
          } else {
            pct = ((touch.clientX - rect.left) / rect.width) * 100;
          }
          pct = Math.max(25, Math.min(75, pct));
          splitPercentRef.current = pct;
          const renderPane = splitContainerRef.current.querySelector("[data-pane='render']") as HTMLElement;
          if (renderPane) {
            if (isMobile) { renderPane.style.height = `${pct}%`; }
            else { renderPane.style.width = `${pct}%`; }
          }
        }}
        onTouchEnd={() => { isDraggingSplit.current = false; }}
      >
        {/* Editor placeholder — replaces all panes when active */}
        {editorPlaceholder ? (
          <div className="flex-1 flex items-center justify-center" style={{ background: "var(--canvas)" }}>
            <div className="flex flex-col items-center gap-4 px-6 max-w-sm text-center">
              {editorPlaceholder === "sign-in" && (
                <>
                  <Lock width={48} height={48} strokeWidth={1.2} style={{ color: "var(--text-faint)" }} />
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Sign in to continue</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    This document may be private or shared with specific people. Sign in to view it if you have access.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={signInWithGoogle} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--text-primary)", color: "var(--background)" }}>
                      Sign in with Google
                    </button>
                    <button onClick={signInWithGitHub} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      GitHub
                    </button>
                    <button onClick={signInWithApple} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      Apple
                    </button>
                  </div>
                </>
              )}
              {editorPlaceholder === "restricted" && (
                <>
                  <ShieldAlert width={48} height={48} strokeWidth={1.2} style={{ color: "var(--text-faint)" }} />
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Access Restricted</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    This document is shared with specific people only. If you believe you should have access, contact the document owner.
                  </p>
                  <button onClick={() => {
                    setEditorPlaceholder(null);
                    window.history.replaceState(null, "", "/");
                    const validTab = tabs.find(t => !t.deleted);
                    if (validTab) loadTab(validTab);
                    setShowSidebar(true);
                  }} className="px-4 py-2 rounded-lg text-sm font-medium mt-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    My documents
                  </button>
                </>
              )}
              {editorPlaceholder === "not-found" && (
                <>
                  <FileX width={48} height={48} strokeWidth={1.2} style={{ color: "var(--text-faint)" }} />
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Document Not Found</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    This document may have been deleted or the link is incorrect.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setEditorPlaceholder(null); window.history.replaceState(null, "", "/"); addTab(); }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--text-primary)", color: "var(--background)" }}>
                      New document
                    </button>
                    <button onClick={() => {
                      setEditorPlaceholder(null);
                      window.history.replaceState(null, "", "/");
                      const validTab = tabs.find(t => !t.deleted);
                      if (validTab) loadTab(validTab);
                      setShowSidebar(true);
                    }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      My documents
                    </button>
                  </div>
                </>
              )}
              {editorPlaceholder === "deleted" && (
                <>
                  <Trash2 width={48} height={48} strokeWidth={1.2} style={{ color: "var(--text-faint)" }} />
                  <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>This document is in your Trash</h2>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    You previously removed this document. Would you like to restore it?
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => {
                      if (deletedDocId) {
                        // Restore the tab
                        setTabs(prev => prev.map(t => t.cloudId === deletedDocId ? { ...t, deleted: false, deletedAt: undefined } : t));
                        // Restore on server if it's our doc
                        const tab = tabs.find(t => t.cloudId === deletedDocId);
                        if (tab?.cloudId && (tab.permission === "mine" || !tab.permission)) {
                          restoreDocument(tab.cloudId, { userId: user?.id, editToken: tab.editToken || undefined }).catch(() => {});
                        }
                      }
                      setEditorPlaceholder(null);
                      setDeletedDocId(null);
                      // Reload the page to properly load the document
                      window.location.reload();
                    }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--text-primary)", color: "var(--background)" }}>
                      Restore
                    </button>
                    <button onClick={() => {
                      setEditorPlaceholder(null);
                      setDeletedDocId(null);
                      window.history.replaceState(null, "", "/");
                      // Load a valid tab or open sidebar
                      const validTab = tabs.find(t => !t.deleted && t.id !== activeTabId) || tabs.find(t => !t.deleted);
                      if (validTab) {
                        loadTab(validTab);
                      } else {
                        setShowSidebar(true);
                      }
                    }} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      Go back
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (<>
        {/* Render pane (left/top).
            Split-mode width: normally splitPercentRef%, but when the
            editor area is showing a non-doc surface (bundle / hub /
            onboarding / settings) the source pane next to it has no
            markdown — we expand the render pane to full width and
            hide the source pane + resize handle below so the user
            doesn't see stale CM6 markdown from the previous doc next
            to the bundle UI. The expression matches the toolbar
            SOURCE-row hide condition (~line 12577) so the three
            stay consistent. */}
        {viewMode !== "editor" && (() => {
          const hideSourceInSplit =
            (activeTab?.kind === "bundle") || showHub || showOnboarding || showSettings;
          const sourceVisible = viewMode === "split" && !hideSourceInSplit;
          return (
          <div
            data-pane="render"
            className="flex flex-col min-h-0"
            style={{
              background: "var(--canvas)",
              width: sourceVisible && !isMobile ? `${splitPercentRef.current}%` : "100%",
              height: sourceVisible && isMobile ? `${splitPercentRef.current}%` : undefined,
              flexShrink: 0,
              minWidth: sourceVisible && !isMobile ? 280 : undefined,
              overflow: sourceVisible && isMobile ? "hidden" : undefined,
            }}
          >
          {showOnboarding ? (
            /* ─── Start Screen ─── */
            <div className="flex-1 overflow-y-auto flex flex-col relative" style={{ background: "var(--canvas)" }}>
              {/* Animated MW-blob backdrop — same morphing SVG the
                  marketing Pure shell uses, so the start surface
                  reads as part of the same brand world (not a flat
                  app pane). Theme-swapped via the mw-logo-blob-*
                  CSS rules. */}
              <div className="mw-start-backdrop" aria-hidden>
                <img className="mw-start-backdrop-morph mw-logo-darktheme" src="/brand/mwblob_morph.svg" alt="" draggable={false} />
                <img className="mw-start-backdrop-morph mw-logo-lighttheme" src="/brand/mwblob_morph_dark.svg" alt="" draggable={false} />
              </div>
              {/* Centered vertically + horizontally — the start
                  content is short, so anchoring it to the visual
                  midpoint reads as a "destination" rather than a
                  half-empty top-aligned panel. Width + padding still
                  match Hub / Bundle so the three share one frame. */}
              <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 mw-start-backdrop-content flex flex-col justify-center">

                {/* Growing-knowledge-hub surface (Pulse / Constellation /
                    Frontier) HIDDEN by founder request 2026-05-17 — the
                    panels weren't feeling load-bearing in practice.
                    Components + APIs are still on disk so re-enabling is
                    a one-block uncomment when there's a clearer reason
                    to show them. Design notes + the per-layer rationale
                    live in claude memory `start_growing_hub_concept_2026_05`.
                {isAuthenticated && (
                  <div className="space-y-4 mb-6">
                    <HubPulse authHeaders={authHeaders} />
                    <HubConstellation authHeaders={authHeaders} />
                    <HubFrontier authHeaders={authHeaders} />
                  </div>
                )}
                */}

                {/* Greeting header — time-of-day aware title plus a
                    soft caption. No leading badge icon (founder ask):
                    the toolbar Start pill already carries the Smile
                    glyph; repeating it 56px tall right under the
                    toolbar was redundant. The greeting falls through
                    profile.display_name → email prefix → bare time
                    string so it never renders an empty name slot.
                    Signed-out users see "Welcome to memory.wiki" + the
                    deploy-to-any-AI subtitle. */}
                {(() => {
                  const hour = new Date().getHours();
                  const timeGreeting =
                    hour < 5 ? "Up late"
                    : hour < 12 ? "Good morning"
                    : hour < 18 ? "Good afternoon"
                    : hour < 22 ? "Good evening"
                    : "Up late";
                  const displayName = profile?.display_name?.trim()
                    || (user?.email ? user.email.split("@")[0] : "");
                  const isSignedIn = isAuthenticated && !!user;
                  return (
                    <header className="mb-8">
                      {/* Cal Sans display headline — a touch larger than the
                          old text-display utility (24px → 30px) since the
                          surrounding chrome is mono/caption-sized; weight
                          500 + letter-spacing 0 come from the global h1
                          rule. */}
                      <h1 style={{ color: "var(--text-primary)", lineHeight: 1.15, fontSize: 30 }}>
                        {isSignedIn
                          ? (displayName ? `${timeGreeting}, ${displayName}` : timeGreeting)
                          : "Welcome to memory.wiki"}
                      </h1>
                      <p className="text-body mt-1.5" style={{ color: "var(--text-secondary)" }}>
                        {isSignedIn
                          ? "Pick up where you left off, or start something new."
                          : "Your AI memory, deployable to any AI."}
                      </p>
                    </header>
                  );
                })()}

                {/* Knowledge-compounds stats — gated on the thinking-surface
                    flag because it surfaces concept counts that don't make
                    sense without the Concepts sidebar section (also hidden).
                    Will return when v6 launch settles. */}
                {FEATURES.THINKING_SURFACE && isAuthenticated && conceptIndex && conceptIndex.stats.totalDocs > 0 && (
                  <div className="mb-6 rounded-xl px-4 py-3" style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}>
                    <div className="text-caption font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-primary)" }}>
                      Your knowledge
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex flex-col">
                        <span className="text-display font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{conceptIndex.stats.totalDocs}</span>
                        <span className="text-caption" style={{ color: "var(--text-faint)" }}>docs</span>
                      </div>
                      <div className="w-px h-8" style={{ background: "var(--border-dim)" }} />
                      <button
                        onClick={() => { setShowSidebar(true); setShowConcepts(true); }}
                        className="flex flex-col text-left transition-opacity hover:opacity-80"
                      >
                        <span className="text-display font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{conceptIndex.stats.totalConcepts}</span>
                        <span className="text-caption" style={{ color: "var(--text-faint)" }}>concepts</span>
                      </button>
                      <div className="w-px h-8" style={{ background: "var(--border-dim)" }} />
                      <button
                        onClick={() => { setShowSidebar(true); setShowConcepts(true); }}
                        className="flex flex-col text-left transition-opacity hover:opacity-80"
                      >
                        <span className="text-display font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{conceptIndex.stats.crossLinkedConcepts}</span>
                        <span className="text-caption" style={{ color: "var(--text-faint)" }}>cross-linked</span>
                      </button>
                      {conceptIndex.stats.decomposedDocs < conceptIndex.stats.totalDocs && (
                        <>
                          <div className="w-px h-8" style={{ background: "var(--border-dim)" }} />
                          <div className="flex flex-col" title="Docs that have been AI-decomposed contribute concepts to your library.">
                            <span className="text-body font-medium tabular-nums" style={{ color: "var(--text-muted)" }}>
                              {conceptIndex.stats.decomposedDocs} / {conceptIndex.stats.totalDocs}
                            </span>
                            <span className="text-caption" style={{ color: "var(--text-faint)" }}>analyzed</span>
                          </div>
                        </>
                      )}
                    </div>
                    {conceptIndex.stats.crossLinkedConcepts > 0 && (
                      <div className="mt-2 text-caption" style={{ color: "var(--text-muted)" }}>
                        {conceptIndex.stats.crossLinkedConcepts} {conceptIndex.stats.crossLinkedConcepts === 1 ? "concept connects" : "concepts connect"} multiple docs in your library.
                      </div>
                    )}
                  </div>
                )}

                {/* Starred — mirrors Recent's Start-surface treatment
                    end-to-end: uppercase mono header, chevron-toggle
                    via toggleStartSection("starred"), Clear-all action
                    on the right, card-shaped row container, same per-
                    row chrome (icon + title + relative time on right).
                    Only renders when there's at least one pin. */}
                {pins.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => toggleStartSection("starred")}
                        className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider cursor-pointer"
                        style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                      >
                        <ChevronDown width={11} height={11} style={{ transform: startSections.starred ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                        Starred
                      </button>
                      {startSections.starred && (
                        <button
                          onClick={() => {
                            // Optimistic clear-all. Snapshot first so a
                            // network failure can revert.
                            const snapshot = pins;
                            setPins([]);
                            Promise.all(snapshot.map((p) =>
                              fetch(`/api/user/pins?kind=${p.kind}&id=${encodeURIComponent(p.id)}`, {
                                method: "DELETE",
                                headers: authHeadersRef.current,
                              }).catch(() => null),
                            )).catch(() => { /* best-effort */ });
                          }}
                          className="text-caption cursor-pointer"
                          style={{ color: "var(--text-faint)", background: "none", border: "none", padding: "2px 6px", opacity: 0.6 }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {startSections.starred && (() => {
                      // Show 5 by default + a "See more" footer.
                      // Removes the maxHeight + internal scroll the
                      // older layout used so the expand control is the
                      // single source of truth for how tall this gets.
                      const visiblePins = starredExpandedStart
                        ? pins
                        : pins.slice(0, START_PREVIEW_COUNT);
                      const overflowCount = pins.length - visiblePins.length;
                      return (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          border: "1px solid var(--border-dim)",
                        }}
                      >
                        {visiblePins.map((p, i) => {
                          let title = "Untitled";
                          let onOpen: (() => void) | null = null;
                          let tsIso: string | null = null;
                          let iconNode: React.ReactNode = null;
                          if (p.kind === "document") {
                            const t = memoAllMyTabs.find((x) => x.cloudId === p.id);
                            if (t) {
                              title = t.title || "Untitled";
                              if (t.lastOpenedAt) tsIso = new Date(t.lastOpenedAt).toISOString();
                              iconNode = <DocStatusIcon tab={t} isActive={false} />;
                            } else {
                              iconNode = <FileIcon width={14} height={14} style={{ color: "var(--text-faint)" }} />;
                            }
                            onOpen = () => {
                              setShowOnboarding(false);
                              try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                              const existing = tabs.find((x) => x.cloudId === p.id && !x.deleted);
                              if (existing) { switchTab(existing.id); return; }
                              const newId = `tab-${tabIdCounter++}`;
                              const newTab: Tab = { id: newId, title, markdown: "", cloudId: p.id, permission: "mine" };
                              setTabs((prev) => [...prev, newTab]);
                              switchTab(newId);
                            };
                          } else {
                            const b = bundles.find((x) => x.id === p.id);
                            if (b) {
                              title = b.title || "Untitled Bundle";
                              tsIso = b.updated_at || null;
                            }
                            iconNode = renderBundleStatusIcon(p.id, 14);
                            onOpen = () => {
                              setShowOnboarding(false);
                              try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                              const existing = tabs.find((x) => x.kind === "bundle" && x.bundleId === p.id);
                              if (existing) { switchTab(existing.id); return; }
                              const newId = `bundle-${p.id}-${Date.now()}`;
                              const newTab: Tab = { id: newId, kind: "bundle", bundleId: p.id, title, markdown: "" };
                              flushSync(() => { setTabs((prev) => [...prev, newTab]); });
                              switchTab(newId);
                            };
                          }
                          return (
                            <button
                              key={`${p.kind}:${p.id}`}
                              onClick={onOpen}
                              className="w-full flex items-center gap-3 px-4 py-3 text-body text-left cursor-pointer"
                              style={{ color: "var(--text-secondary)", background: "var(--surface)", transition: "all 0.12s", borderTop: i > 0 ? "1px solid var(--border-dim)" : "none" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--menu-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                            >
                              {iconNode}
                              <span className="flex-1 truncate">{title}</span>
                              <Star width={11} height={11} className="shrink-0" style={{ color: "var(--micro-warn)", fill: "var(--micro-warn)" }} aria-label="Starred" />
                              {tsIso && (
                                <span className="shrink-0 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>{relativeTime(tsIso)}</span>
                              )}
                            </button>
                          );
                        })}
                        {(overflowCount > 0 || starredExpandedStart) && (
                          <button
                            type="button"
                            onClick={() => setStarredExpandedStart((v) => !v)}
                            className="w-full text-caption font-mono tracking-wide cursor-pointer transition-colors"
                            style={{
                              color: "var(--text-faint)",
                              background: "var(--surface)",
                              border: "none",
                              borderTop: "1px solid var(--border-dim)",
                              padding: "8px 12px",
                              textAlign: "center",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--menu-hover)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "var(--surface)"; }}
                          >
                            {starredExpandedStart ? "See less" : `See ${overflowCount} more`}
                          </button>
                        )}
                      </div>
                      );
                    })()}
                  </div>
                )}

                {/* Recent files — same data source as sidebar Recent (recentTabIds).
                    Mirrors the sidebar's ghost-bundle resolution so entries
                    survive logout/re-login even when the local bundle tab was
                    wiped: an unmatched `bundle-X-time` ID is rebuilt against
                    bundles[] for display + click. */}
                {(() => {
                  type HomeRecentEntry =
                    | { kind: "tab"; id: string; tab: Tab }
                    | { kind: "ghost-bundle"; id: string; bundleId: string }
                    | { kind: "server-doc"; id: string; cloudId: string; title: string; source: string; ts: number };
                  const entries: HomeRecentEntry[] = [];
                  // Local-first: tabs the user has actually opened in this
                  // browser bubble to the top of Recent. 25 is the
                  // "all" ceiling for the See more toggle below; the
                  // default-visible slice is 5.
                  for (const id of recentTabIds) {
                    if (entries.length >= 25) break;
                    const tab = tabs.find(t => t.id === id && !t.deleted && !t.readonly && t.ownerEmail !== EXAMPLE_OWNER);
                    if (tab) { entries.push({ kind: "tab", id, tab }); continue; }
                    const m = /^bundle-(.+)-\d+$/.exec(id);
                    if (m && bundles.some(b => b.id === m[1])) {
                      entries.push({ kind: "ghost-bundle", id, bundleId: m[1] });
                    }
                  }
                  // Server-fetched docs: anything the user created from
                  // chrome / vscode / desktop / mobile that isn't already
                  // represented by a local tab. De-dup by cloudId.
                  const localCloudIds = new Set(
                    tabs.filter(t => t.cloudId).map(t => t.cloudId as string)
                  );
                  for (const doc of serverRecentDocs) {
                    if (entries.length >= 25) break;
                    if (localCloudIds.has(doc.id)) continue;
                    entries.push({
                      kind: "server-doc",
                      id: `server-${doc.id}`,
                      cloudId: doc.id,
                      title: doc.title,
                      source: doc.source,
                      ts: doc.ts,
                    });
                  }
                  if (entries.length === 0) return null;
                  const openGhost = (bundleId: string) => {
                    const b = bundles.find(x => x.id === bundleId);
                    if (!b) return;
                    setShowOnboarding(false);
                    try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                    const existing = tabs.find(t => t.kind === "bundle" && t.bundleId === b.id);
                    if (existing) { switchTab(existing.id); return; }
                    const newId = `bundle-${b.id}-${Date.now()}`;
                    const newTab: Tab = { id: newId, kind: "bundle", bundleId: b.id, title: b.title || "Untitled Bundle", markdown: "" };
                    flushSync(() => { setTabs(prev => [...prev, newTab]); });
                    switchTab(newId);
                  };
                  return (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => toggleStartSection("recent")}
                          className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider cursor-pointer"
                          style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                        >
                          <ChevronDown width={11} height={11} style={{ transform: startSections.recent ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                          Recent
                        </button>
                        {startSections.recent && (
                          <button
                            onClick={() => { setRecentTabIds([]); }}
                            className="text-caption cursor-pointer"
                            style={{ color: "var(--text-faint)", background: "none", border: "none", padding: "2px 6px", opacity: 0.6 }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {startSections.recent && (() => {
                        const visibleEntries = recentExpandedStart
                          ? entries
                          : entries.slice(0, START_PREVIEW_COUNT);
                        const overflowCount = entries.length - visibleEntries.length;
                        return (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          border: "1px solid var(--border-dim)",
                        }}
                      >
                        {visibleEntries.map((entry, i) => {
                          if (entry.kind === "server-doc") {
                            // Doc created on another surface (chrome ext /
                            // vscode / desktop / mobile) — not yet in the
                            // local tabs list. Click opens it into a new
                            // tab anchored by cloudId.
                            const openServer = () => {
                              setShowOnboarding(false);
                              try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                              const existing = tabs.find(t => t.cloudId === entry.cloudId && !t.deleted);
                              if (existing) { switchTab(existing.id); return; }
                              const newId = `tab-${tabIdCounter++}`;
                              const newTab: Tab = { id: newId, title: entry.title || "Untitled", markdown: "", cloudId: entry.cloudId, permission: "mine" };
                              flushSync(() => { setTabs(prev => [...prev, newTab]); });
                              switchTab(newId);
                            };
                            const tsIso = entry.ts ? new Date(entry.ts).toISOString() : null;
                            return (
                              <button key={entry.id} onClick={openServer}
                                className="w-full flex items-center gap-3 px-4 py-3 text-body text-left cursor-pointer"
                                style={{ color: "var(--text-secondary)", background: "var(--surface)", transition: "all 0.12s", borderTop: i > 0 ? "1px solid var(--border-dim)" : "none" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--menu-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                                <FileIcon width={14} height={14} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                                <span className="flex-1 truncate">{entry.title || "Untitled"}</span>
                                {entry.source && (
                                  <span className="shrink-0 text-caption font-mono" style={{ color: "var(--text-faint)", opacity: 0.7 }}>{entry.source.replace(/^chrome-?/, "chrome ")}</span>
                                )}
                                {tsIso && (
                                  <span className="shrink-0 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>{relativeTime(tsIso)}</span>
                                )}
                              </button>
                            );
                          }
                          if (entry.kind === "ghost-bundle") {
                            const bundle = bundles.find(b => b.id === entry.bundleId)!;
                            return (
                              <button key={entry.id} onClick={() => openGhost(entry.bundleId)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-body text-left cursor-pointer"
                                style={{ color: "var(--text-secondary)", background: "var(--surface)", transition: "all 0.12s", borderTop: i > 0 ? "1px solid var(--border-dim)" : "none" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--menu-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                                {renderBundleStatusIcon(entry.bundleId, 14)}
                                <span className="flex-1 truncate">{bundle.title || "Untitled Bundle"}</span>
                                {bundle.updated_at && (
                                  <span className="shrink-0 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>{relativeTime(bundle.updated_at)}</span>
                                )}
                              </button>
                            );
                          }
                          const t = entry.tab;
                          const displayTitle = t.kind === "bundle" && t.bundleId
                            ? (bundles.find(b => b.id === t.bundleId)?.title || t.title || "Untitled")
                            : (t.title || "Untitled");
                          // Prefer the bundle's server updated_at for bundle
                          // tabs (always present); fall back to the local
                          // lastOpenedAt for plain docs which don't carry
                          // a server timestamp on the tab itself.
                          const bundleUpdated = t.kind === "bundle" && t.bundleId
                            ? bundles.find(b => b.id === t.bundleId)?.updated_at || null
                            : null;
                          const tsIso = bundleUpdated
                            || (t.lastOpenedAt ? new Date(t.lastOpenedAt).toISOString() : null);
                          return (
                            <button key={t.id} onClick={() => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} switchTab(t.id); }}
                              className="w-full flex items-center gap-3 px-4 py-3 text-body text-left cursor-pointer"
                              style={{ color: "var(--text-secondary)", background: "var(--surface)", transition: "all 0.12s", borderTop: i > 0 ? "1px solid var(--border-dim)" : "none" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--menu-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-secondary)"; }}>
                              {t.kind === "bundle" ? renderBundleStatusIcon(t.bundleId, 14) : <DocStatusIcon tab={t} isActive={false} />}
                              <span className="flex-1 truncate">{displayTitle}</span>
                              {tsIso && (
                                <span className="shrink-0 text-caption tabular-nums" style={{ color: "var(--text-faint)" }}>{relativeTime(tsIso)}</span>
                              )}
                            </button>
                          );
                        })}
                        {(overflowCount > 0 || recentExpandedStart) && (
                          <button
                            type="button"
                            onClick={() => setRecentExpandedStart((v) => !v)}
                            className="w-full text-caption font-mono tracking-wide cursor-pointer transition-colors"
                            style={{
                              color: "var(--text-faint)",
                              background: "var(--surface)",
                              border: "none",
                              borderTop: "1px solid var(--border-dim)",
                              padding: "8px 12px",
                              textAlign: "center",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--menu-hover)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "var(--surface)"; }}
                          >
                            {recentExpandedStart ? "See less" : `See ${overflowCount} more`}
                          </button>
                        )}
                      </div>
                      );
                    })()}
                    </div>
                  );
                })()}

                {/* Create — 3 column grid like About page */}
                <div className="mb-6">
                  <button
                    onClick={() => toggleStartSection("create")}
                    className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider mb-3 cursor-pointer"
                    style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                  >
                    <ChevronDown width={11} height={11} style={{ transform: startSections.create ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    Create
                  </button>
                  {startSections.create && (<>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { label: "New Document", desc: "Blank page", kbd: "", color: "#fb923c", icon: <Plus width={16} height={16} />, fn: () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} addTab(); } },
                      { label: "New Bundle", desc: "Group docs into a thinking surface", kbd: "", color: "#a78bfa", icon: <Layers width={16} height={16} />, fn: () => {
                        // Open the BundleCreator modal with an empty
                        // doc list. The user picks docs (or starts
                        // empty and adds later) inside the modal —
                        // same flow as the sidebar's "+ New bundle"
                        // shortcut, so no second code path to
                        // maintain.
                        setShowOnboarding(false);
                        try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                        setBundleCreatorDocs([]);
                        setShowMyBundles(true);
                        setShowBundleCreator(true);
                      } },
                      { label: "Paste", desc: "Text or AI share URL", kbd: "", color: "#4ade80", icon: <FileText width={16} height={16} />, fn: async () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} try { const text = await navigator.clipboard.readText(); if (text) { addTab(); setTimeout(() => { setMarkdown(text); doRender(text); cmSetDocRef.current?.(text); }, 100); } } catch { /* clipboard permission denied — user can Cmd+V manually */ } } },
                      { label: "Import", desc: "PDF, Word, Excel...", kbd: "", color: "#60a5fa", icon: <Upload width={16} height={16} />, fn: () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} imageFileRef.current?.click(); } },
                    ].map((item) => (
                      <button key={item.label} onClick={item.fn}
                        className="flex flex-col items-start px-4 py-3.5 rounded-xl text-left cursor-pointer overflow-hidden relative"
                        style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", transition: "all 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${item.color}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-dim)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div className="mb-2" style={{ color: item.color }}>{item.icon}</div>
                        <div className="text-body font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                        <div className="text-caption" style={{ color: "var(--text-faint)" }}>{item.desc}</div>
                        {item.kbd && <kbd className="text-caption font-mono mt-2 px-1.5 py-0.5 rounded" style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}>{item.kbd}</kbd>}
                      </button>
                    ))}
                  </div>
                  {/* Drop zone — desktop only. Lives under the 3-card
                      grid because dropping a file IS another way to
                      create a new doc, not a separate concern. Mobile
                      hides it because mobile browsers don't support
                      desktop-style file drag-and-drop. */}
                  <div className="hidden sm:block mt-2 py-5 rounded-xl cursor-pointer text-center"
                    style={{ border: "2px dashed var(--border)", color: "var(--text-faint)", background: "var(--surface)", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-primary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--text-primary)"; e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--border)"; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; e.currentTarget.style.background = "var(--surface)"; }}
                    onDrop={(e) => { e.preventDefault(); setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} }}
                    onClick={() => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} imageFileRef.current?.click(); }}>
                    <p className="text-body font-medium">Drop files here to open</p>
                    <p className="text-caption mt-1" style={{ opacity: 0.5 }}>MD, PDF, DOCX, PPTX, XLSX, HTML, CSV</p>
                  </div>
                  </>)}
                </div>

                {/* Deploy to AI — v6 hero. Goes above Guides because the hub story
                    is the v6 thesis; tutorials come second. Install /memory.wiki is the
                    primary CTA, highlighted via an inline tag rather than a
                    full-card border (the border made the card visually heavier
                    than its neighbors and read as "warning" yellow). */}
                <div className="mb-6">
                  <button
                    onClick={() => toggleStartSection("deploy")}
                    className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider mb-2 cursor-pointer"
                    style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                  >
                    <ChevronDown width={11} height={11} style={{ transform: startSections.deploy ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    Deploy to AI
                  </button>
                  {startSections.deploy && (<>
                  <p className="text-caption mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Your hub is the context any AI can read. Paste the URL into Claude, ChatGPT, Cursor, or Codex — they load your knowledge as context.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(() => {
                      // Every signed-in user has a slug (auto-assigned
                      // by /api/user/hub/ensure on first login). The
                      // null branch is reserved for signed-out users
                      // who land on Home before authenticating.
                      const myHubSlug = (profile as { hub_slug?: string | null } | null)?.hub_slug || null;
                      type DeployCard = {
                        label: string; desc: string; url: string; color: string;
                        icon: React.ReactElement; tag: string | null;
                        /** When set, clicking opens the doc as an in-app
                         *  tab via openDocBySlug instead of a new browser
                         *  window. */
                        docSlug?: string;
                      };
                      const cards: DeployCard[] = [
                        myHubSlug
                          ? { label: "Your hub", desc: `memory.wiki/hub/${myHubSlug} · Rename in Settings`, url: `/hub/${myHubSlug}`, color: "#fb923c", icon: <Globe width={14} height={14} />, tag: null }
                          : { label: "Sign in to get your hub", desc: "Every signed-in user gets a personal hub URL", url: "/", color: "#fb923c", icon: <Globe width={14} height={14} />, tag: null },
                        { label: "Install /memory.wiki", desc: "From any AI tool", url: "/install", color: "#fbbf24", icon: <Sparkles width={14} height={14} />, tag: "Recommended" },
                        { label: "Shared bundles", desc: "Curated public context", url: "/shared", color: "#4ade80", icon: <Users width={14} height={14} />, tag: null },
                        { label: "How memory.wiki stays fresh", desc: "Doc / bundle / hub freshness model", url: "/how-memorywiki-stays-fresh", color: "#60a5fa", icon: <Sparkles width={14} height={14} />, tag: null, docSlug: "RUMdz2fQ" },
                      ];
                      return cards.map((item) => {
                        const sharedProps = {
                          className: "flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer",
                          style: {
                            background: "var(--surface)",
                            border: "1px solid var(--border-dim)",
                            textDecoration: "none",
                            transition: "all 0.12s",
                          } as React.CSSProperties,
                          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${item.color}20`; },
                          onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = "var(--border-dim)"; e.currentTarget.style.boxShadow = "none"; },
                        };
                        const body = (
                          <>
                            <div className="mt-0.5 shrink-0" style={{ color: item.color }}>{item.icon}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</span>
                                {item.tag && (
                                  <span
                                    className="text-caption font-mono px-1.5 py-px rounded"
                                    style={{
                                      background: "var(--border)",
                                      color: "var(--text-primary)",
                                      fontSize: 9,
                                      letterSpacing: 0.5,
                                      textTransform: "uppercase",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {item.tag}
                                  </span>
                                )}
                              </div>
                              <div className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>{item.desc}</div>
                            </div>
                          </>
                        );
                        return item.docSlug ? (
                          <button key={item.label} onClick={() => openDocBySlug(item.docSlug!, item.url)} {...sharedProps}>
                            {body}
                          </button>
                        ) : (
                          // Internal Next.js pages — same-window navigation so
                          // users don't pile up "stale editor" tabs in their
                          // browser. Editor state persists in localStorage so
                          // back-button restores everything.
                          <NextLink key={item.label} href={item.url} {...sharedProps}>
                            {body}
                          </NextLink>
                        );
                      });
                    })()}
                  </div>
                  </>)}
                </div>

                {/* How people use memory.wiki — short Pain → Action → Result case
                    studies. Each card opens a published doc in the founder
                    hub. Sits between the v6 hero (Deploy to AI) and the
                    tutorial-shaped Guides & Examples — answers "why would
                    I bother" before "here's how it works."
                    Card list trimmed to only slugs that actually exist
                    in next.config rewrites — 7 → 4. The previous "Agent
                    memory / Docs as KB / Project decisions / Research
                    notes / Meeting log / Book notes" entries all 404'd. */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <button
                      onClick={() => toggleStartSection("cases")}
                      className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider cursor-pointer"
                      style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                    >
                      <ChevronDown width={11} height={11} style={{ transform: startSections.cases ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                      What people put in memory.wiki
                    </button>
                    {startSections.cases && (
                      <button
                        onClick={() => openDocBySlug("about", "/about#use-cases")}
                        className="text-caption cursor-pointer"
                        style={{ color: "var(--text-faint)", background: "none", border: "none", padding: 0 }}
                      >
                        All cases &rarr;
                      </button>
                    )}
                  </div>
                  {startSections.cases && (<>
                  <p className="text-caption mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Concrete shapes the URL takes. Pick what fits your week.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { label: "Cross-tool handoff", desc: "Cursor ↔ Claude on shared context", slug: "case-cross-tool-handoff", url: "/case-cross-tool-handoff", color: "#f472b6" },
                      { label: "Personal LLM wiki", desc: "Your own knowledge base for AIs", slug: "case-personal-llm-wiki", url: "/case-personal-llm-wiki", color: "#a78bfa" },
                      { label: "CLAUDE.md personal context", desc: "Carry context across coding sessions", slug: "case-claude-md-personal-context", url: "/case-claude-md-personal-context", color: "#60a5fa" },
                      { label: "Share with a team", desc: "Living docs your team + AI both read", slug: "case-share-with-team", url: "/case-share-with-team", color: "#4ade80" },
                    ]).map((item) => (
                      <button key={item.label} onClick={() => openDocBySlug(item.slug, item.url)}
                        className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-left cursor-pointer"
                        style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", transition: "all 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${item.color}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-dim)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                        <div className="text-caption" style={{ color: "var(--text-faint)" }}>{item.desc}</div>
                      </button>
                    ))}
                  </div>
                  </>)}
                </div>

                {/* Examples — 2 column grid. Surface guides (Chrome/VSCode/Mac/CLI/MCP/QuickLook)
                    are filtered out here because the EXPLORE > Plugins card is the
                    canonical entry for those — listing both would be a duplicate
                    surface. The remaining 8 example tabs stay focused on content,
                    and titles longer than the card width truncate with ellipsis
                    so the grid stays single-line everywhere. */}
                <div className="mb-6">
                  <button
                    onClick={() => toggleStartSection("guides")}
                    className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider mb-3 cursor-pointer"
                    style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                  >
                    <ChevronDown width={11} height={11} style={{ transform: startSections.guides ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    Guides & Examples
                  </button>
                  {startSections.guides && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXAMPLE_TABS.filter(ex => !["tab-chrome-ext", "tab-vscode-ext", "tab-desktop", "tab-cli", "tab-mcp", "tab-quicklook"].includes(ex.id)).map((ex) => (
                      <button key={ex.id} onClick={() => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} switchTab(ex.id); }}
                        title={ex.title}
                        className="flex items-center gap-2 min-w-0 px-3 py-2 rounded-lg text-body text-left cursor-pointer"
                        style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border-dim)", transition: "all 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-primary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-dim)"; e.currentTarget.style.color = "var(--text-muted)"; }}>
                        {ex.kind === "bundle" ? renderBundleStatusIcon(ex.bundleId, 14) : <DocStatusIcon tab={ex} isActive={false} />}
                        <span className="flex-1 min-w-0 truncate">{ex.title}</span>
                      </button>
                    ))}
                  </div>
                  )}
                </div>

                {/* Explore + Plugins — 2 column grid */}
                <div className="mb-6">
                  <button
                    onClick={() => toggleStartSection("explore")}
                    className="flex items-center gap-1.5 text-caption font-mono uppercase tracking-wider mb-3 cursor-pointer"
                    style={{ color: "var(--text-primary)", background: "none", border: "none", padding: 0 }}
                  >
                    <ChevronDown width={11} height={11} style={{ transform: startSections.explore ? "" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                    Explore
                  </button>
                  {startSections.explore && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { label: "Trending", desc: "Popular GitHub projects", url: "/discover", color: "#fb923c", icon: <Zap width={14} height={14} /> },
                      { label: "Documentation", desc: "API and SDK reference", url: "/docs", color: "#60a5fa", icon: <FileText width={14} height={14} /> },
                      { label: "Plugins", desc: "Chrome, VS Code, Mac, CLI", url: "/plugins", color: "#4ade80", icon: <Download width={14} height={14} /> },
                      { label: "How it works", desc: "Architecture, end to end", url: "/about#how-it-works", color: "#c4b5fd", icon: <HelpCircle width={14} height={14} /> },
                      { label: "memory.wiki Memory", desc: "How memory works under the hood", url: "/about#memory", color: "#a78bfa", icon: <Sparkles width={14} height={14} /> },
                    ]).map((item) => (
                      // Same-window navigation (Link, no target=_blank)
                      // for internal memory.wiki pages — keeps the user in one
                      // browser tab; editor state restores on back.
                      <NextLink key={item.label} href={item.url}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left cursor-pointer"
                        style={{ background: "var(--surface)", border: "1px solid var(--border-dim)", textDecoration: "none", transition: "all 0.12s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${item.color}20`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-dim)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div className="mt-0.5 shrink-0" style={{ color: item.color }}>{item.icon}</div>
                        <div>
                          <div className="text-body font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</div>
                          <div className="text-caption mt-0.5" style={{ color: "var(--text-faint)" }}>{item.desc}</div>
                        </div>
                      </NextLink>
                    ))}
                  </div>
                  )}
                </div>

                {/* Replay welcome */}
                <div className="text-center mt-2 mb-4">
                  <button
                    onClick={() => { localStorage.removeItem("mw-welcome-seen"); window.location.reload(); }}
                    className="text-caption cursor-pointer"
                    style={{ color: "var(--text-faint)", background: "none", border: "none", padding: "4px 8px", opacity: 0.6 }}
                  >
                    Replay welcome tour
                  </button>
                </div>
              </div>
            </div>
          ) : (<>
            <div
              data-print-hide
              className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 text-caption font-mono uppercase tracking-normal select-none"
              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)", cursor: "default", display: (activeTab?.kind === "bundle" || showHub || showGalaxy || showSettings || showOnboarding) ? "none" : undefined }}
            >
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                <span className="shrink-0" style={{ color: "var(--text-primary)" }}>MD</span>
                {/* Doc intent chip (Hermes Step 4 / page-type tag).
                    Shown for the doc owner only. No intent → faint
                    "+ Type" pill; intent set → coloured pill with X
                    to clear. PATCH /api/docs/{id} { intent } updates
                    the row; we apply optimistically and revert on
                    HTTP failure. */}
                {activeTab?.cloudId && isOwner && (() => {
                  const intent = activeTab.intent || null;
                  const options: Array<{ value: "note" | "definition" | "comparison" | "decision" | "question" | "reference"; label: string; hint: string; color: string }> = [
                    { value: "note",       label: "Note",       hint: "General notes, no specific shape",    color: "#a1a1aa" },
                    { value: "definition", label: "Definition", hint: "Defines a concept or term",          color: "#60a5fa" },
                    { value: "comparison", label: "Comparison", hint: "Compares two or more alternatives",  color: "#fbbf24" },
                    { value: "decision",   label: "Decision",   hint: "Records a choice + why",             color: "#4ade80" },
                    { value: "question",   label: "Question",   hint: "Open question / something to resolve", color: "#c4b5fd" },
                    { value: "reference",  label: "Reference",  hint: "Reference material — read often",    color: "#f472b6" },
                  ];
                  const current = options.find((o) => o.value === intent);
                  const applyIntent = (next: typeof intent) => {
                    if (!activeTab?.cloudId) return;
                    const cloudId = activeTab.cloudId;
                    const prev = activeTab.intent || null;
                    // Optimistic update + close menu.
                    setTabs((all) => all.map((t) => t.id === activeTab.id ? { ...t, intent: next || undefined } : t));
                    setIntentMenuOpen(false);
                    fetch(`/api/docs/${cloudId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", ...authHeaders },
                      body: JSON.stringify({ intent: next, userId: user?.id, editToken: activeTab.editToken }),
                    }).then((r) => {
                      if (!r.ok) {
                        // Revert if the server refused (likely permission).
                        setTabs((all) => all.map((t) => t.id === activeTab.id ? { ...t, intent: prev || undefined } : t));
                        showToast("Couldn't update doc type", "error");
                      }
                    }).catch(() => {
                      setTabs((all) => all.map((t) => t.id === activeTab.id ? { ...t, intent: prev || undefined } : t));
                    });
                  };
                  return (
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setIntentMenuOpen((v) => !v)}
                        className="flex items-center gap-1 h-5 px-1.5 rounded-md text-caption transition-colors hover:bg-[var(--toggle-bg)] normal-case"
                        style={{
                          color: current ? current.color : "var(--text-faint)",
                          border: `1px solid ${current ? current.color + "44" : "var(--border-dim)"}`,
                          background: current ? current.color + "11" : "transparent",
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: 0.3,
                        }}
                        title={current ? `Type: ${current.hint} — click to change` : "Doc type — auto-set after the next concept refresh. Click to pick one now."}
                      >
                        <span>{current ? current.label : "+ Type"}</span>
                      </button>
                      {intentMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-[9998]" onClick={() => setIntentMenuOpen(false)} />
                          <div
                            className="absolute top-full left-0 mt-1 w-56 rounded-lg py-1 z-[9999]"
                            style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                          >
                            <div className="px-3 py-1.5 text-caption font-mono uppercase tracking-wider" style={{ color: "var(--text-faint)", borderBottom: "1px solid var(--border-dim)", fontSize: 9 }}>
                              Doc type
                            </div>
                            {options.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => applyIntent(opt.value)}
                                className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-[var(--menu-hover)] transition-colors normal-case"
                                style={{ background: intent === opt.value ? "var(--menu-hover)" : "transparent" }}
                              >
                                <span className="shrink-0 mt-1" style={{ width: 6, height: 6, borderRadius: 3, background: opt.color, display: "inline-block" }} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-body font-medium" style={{ color: intent === opt.value ? opt.color : "var(--text-primary)" }}>{opt.label}</div>
                                  <div className="text-caption" style={{ color: "var(--text-faint)", fontSize: 10 }}>{opt.hint}</div>
                                </div>
                                {intent === opt.value && <Check width={11} height={11} className="shrink-0 mt-1" style={{ color: opt.color }} />}
                              </button>
                            ))}
                            {intent && (
                              <>
                                <div className="my-1" style={{ borderTop: "1px solid var(--border-dim)" }} />
                                <button
                                  onClick={() => applyIntent(null)}
                                  className="w-full text-left px-3 py-1.5 text-caption hover:bg-[var(--menu-hover)] transition-colors normal-case"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Clear doc type
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
                {/* Locate in sidebar — scrolls the active doc / bundle row
                    into view inside the MDs (or MD Bundles) tree and
                    expands its parent folders. Replaces the previous
                    behavior where every activeTabId change auto-scrolled
                    the sidebar (annoying on Recent / Starred clicks).
                    Sits inside the MD strip, right after the Type chip,
                    so the affordance is next to the doc context it
                    affects. */}
                {(activeTab?.cloudId || activeTab?.bundleId) && (
                  <button
                    onClick={() => { revealActiveInSidebar(); if (!showSidebar) setShowSidebar(true); }}
                    className="flex items-center justify-center h-5 w-5 rounded-md transition-colors hover:bg-[var(--toggle-bg)] normal-case"
                    style={{ color: "var(--text-faint)" }}
                    title="Locate in sidebar"
                  >
                    <Locate width={11} height={11} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 normal-case shrink-0 flex-nowrap">
                {/* Toolbar toggle — icon with hint popover for new users */}
                {canEdit && <div className="relative group">
                  <button
                    onClick={() => { setShowToolbar(!showToolbar); if (!showToolbar && !toolbarHintDismissed) { setToolbarHintDismissed(true); try { localStorage.setItem("mw-toolbar-hint-dismissed", "1"); } catch {} } }}
                    className={`flex items-center justify-center h-6 w-6 rounded-md transition-colors ${!showToolbar && !toolbarHintDismissed ? "ring-1 ring-[var(--text-primary)]" : ""}`}
                    style={{ background: showToolbar ? "var(--border)" : "transparent", color: showToolbar ? "var(--text-primary)" : "var(--text-faint)" }}
                    title={`Formatting toolbar ${showToolbar ? "ON" : "OFF"}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 4h14M1 8h14M1 12h14"/><circle cx="5" cy="4" r="1.5" fill="currentColor"/><circle cx="10" cy="8" r="1.5" fill="currentColor"/><circle cx="7" cy="12" r="1.5" fill="currentColor"/></svg>
                  </button>
                  {/* Hint for new users — subtle ring + expanded tooltip */}
                  {!showToolbar && !toolbarHintDismissed && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-40 p-2 rounded-lg text-caption leading-relaxed z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--text-primary)", color: "var(--text-secondary)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 3 }}>Formatting Tools</p>
                      <p style={{ color: "var(--text-muted)", marginBottom: 6 }}>Click to enable bold, headings, lists, and more.</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setToolbarHintDismissed(true); try { localStorage.setItem("mw-toolbar-hint-dismissed", "1"); } catch {} }}
                        className="text-caption" style={{ color: "var(--text-faint)" }}>Dismiss</button>
                    </div>
                  )}
                  {/* Regular hover tooltip (when hint is dismissed) */}
                  {toolbarHintDismissed && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-44 p-2.5 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                      <p style={{ color: showToolbar ? "var(--text-primary)" : "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Formatting Toolbar {showToolbar ? "ON" : "OFF"}</p>
                      <p>Bold, italic, headings, lists, links, and more.</p>
                    </div>
                  )}
                </div>}
                {/* Wide view toggle — narrow is the default; click to expand
                    content to full width. State variable `narrowView` is kept
                    (true = narrow / default), but the button represents "Wide". */}
                <div className="relative group" style={{ display: isMobile || renderPaneUnderNarrowWidth ? "none" : undefined }}>
                  <button
                    onClick={() => setNarrowView(!narrowView)}
                    className="flex items-center justify-center h-6 w-6 rounded-md transition-colors"
                    style={{ background: !narrowView ? "var(--border)" : "transparent", color: !narrowView ? "var(--text-primary)" : "var(--text-faint)" }}
                    title={`Wide view ${!narrowView ? "ON" : "OFF"}`}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 4v8M14 4v8M1 8h14" strokeLinecap="round"/><path d="M5 6L3 8l2 2M11 6l2 2-2 2" strokeLinecap="round"/></svg>
                  </button>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-44 p-2.5 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <p style={{ color: !narrowView ? "var(--text-primary)" : "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Wide View {!narrowView ? "ON" : "OFF"}</p>
                    <p>Default: narrow, book-like reading width. Click to expand to full width.</p>
                  </div>
                </div>
                {/* ASCII toggle removed — render button on each diagram instead */}
                <div className="w-px h-3.5 mx-0.5" style={{ background: "var(--border-dim)" }} />
                {/* History — icon only */}
                {docId && (
                  <div className="relative group">
                    <button
                      onClick={handleToggleHistory}
                      className="flex items-center justify-center h-6 w-6 rounded-md transition-colors relative"
                      style={{ background: showHistory ? "var(--border)" : "transparent", color: showHistory ? "var(--text-primary)" : "var(--text-faint)" }}
                      title="Version history"
                    >
                      <Clock width={11} height={11} />
                      {versions.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full text-caption flex items-center justify-center" style={{ background: "var(--micro-red)", color: "#fff", fontWeight: 700 }}>{versions.length}</span>}
                    </button>
                    <div className="absolute top-full right-0 mt-1.5 w-44 p-2.5 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                      <p style={{ color: showHistory ? "var(--text-primary)" : "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Version History</p>
                      <p>{versions.length > 0 ? `${versions.length} version${versions.length > 1 ? "s" : ""} saved. Click to browse and restore.` : "Save history appears after sharing your document."}</p>
                    </div>
                  </div>
                )}
                {/* Outline toggle */}
                <div className="relative group">
                  <button
                    onClick={() => { setShowOutlinePanel(prev => !prev); setShowAIPanel(false); setShowImagePanel(false); }}
                    className="flex items-center justify-center h-6 px-1.5 rounded-md transition-colors"
                    style={{ background: showOutlinePanel ? "var(--border)" : "transparent", color: showOutlinePanel ? "var(--text-primary)" : "var(--text-faint)" }}
                    title="Document outline"
                  >
                    <List width={13} height={13} />
                  </button>
                  {!showOutlinePanel && (
                    <div className="absolute top-full right-0 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                      Outline
                    </div>
                  )}
                </div>
                {/* Assistant button moved to top header right of Share — kept
                    here as a no-op so layout offsets stay the same; hidden via CSS. */}
                {false && (canEdit || activeTab?.kind === "bundle") && <div className="relative group">
                  <button
                    onClick={() => { setShowAIPanel(prev => !prev); setShowExportMenu(false); setShowHistory(false); setShowImagePanel(false); setShowOutlinePanel(false); }}
                    className="flex items-center justify-center h-6 px-2.5 rounded-md transition-colors gap-1.5"
                    style={{ background: showAIPanel || aiProcessing ? "var(--border)" : "transparent", color: showAIPanel || aiProcessing ? "var(--text-primary)" : "var(--text-faint)", fontWeight: 600, fontSize: 11 }}
                    title="AI tools"
                  >
                    {aiProcessing ? <Loader2 width={11} height={11} className="animate-spin" /> : <Sparkles width={11} height={11} />}
                    {aiProcessing ? <span className="text-caption hidden sm:inline">
                      {(({ polish: "Polishing", summary: "Summarizing", tldr: "Generating", translate: "Translating", chat: "Editing", compact: "Compacting", format: "Formatting" } as Record<string, string>)[aiProcessing as string]) || "Processing"}...
                    </span> : <span className="hidden sm:inline text-caption">Chat</span>}
                  </button>
                  {!showAIPanel && !aiProcessing && (
                    <div className="absolute top-full right-0 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                      AI Tools
                    </div>
                  )}
                </div>}
                {/* Image library moved to the top global nav (right of Source). */}
                <div className="w-px h-3.5 mx-0.5" style={{ background: "var(--border-dim)" }} />
                {/* Export dropdown */}
                <div className="relative group" ref={exportMenuRef}>
                  <button
                    onClick={() => { setShowExportMenu(prev => !prev); setShowMenu(false); }}
                    className="flex items-center justify-center h-6 w-6 rounded-md transition-colors"
                    style={{ background: showExportMenu ? "var(--border)" : "transparent", color: showExportMenu ? "var(--text-primary)" : "var(--text-faint)" }}
                    title="Export"
                  >
                    <Upload width={11} height={11} />
                  </button>
                  {!showExportMenu && (
                    <div className="absolute top-full right-0 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                      Export (download, print, copy)
                    </div>
                  )}
                  {showExportMenu && (
                    <div className="absolute top-full right-0 mt-1 w-56 rounded-lg shadow-xl py-1 z-[9999]"
                      style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                      {/* Download section */}
                      <div className="px-3 py-1 text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Download</div>
                      <button onClick={() => { handleDownloadMd(); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <FileText width={12} height={12} />
                        Markdown (.md)
                      </button>
                      <button onClick={handleDownloadHtml} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <Code width={12} height={12} />
                        HTML (.html)
                      </button>
                      <button onClick={handleDownloadTxt} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <FileText width={12} height={12} />
                        Plain Text (.txt)
                      </button>
                      <div className="my-1" style={{ borderTop: "1px solid var(--border-dim)" }} />
                      {/* Print section */}
                      <div className="px-3 py-1 text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Print</div>
                      <button onClick={() => { handleExportPdf(); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="14" height="7" rx="1"/><path d="M4 5V2h8v3M4 9h8v5H4z"/></svg>
                        PDF / Print
                      </button>
                      <div className="my-1" style={{ borderTop: "1px solid var(--border-dim)" }} />
                      {/* Copy as section */}
                      <div className="px-3 py-1 text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Copy to Clipboard</div>
                      <button onClick={() => { handleCopyHtml(); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <Code width={12} height={12} />
                        Raw HTML
                      </button>
                      <button onClick={() => { handleCopyRichText(); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <FileText width={12} height={12} />
                        Rich Text (Docs / Email)
                      </button>
                      <button onClick={() => { handleCopySlack(); setShowExportMenu(false); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 9.5a1.5 1.5 0 110-3H5v1.5A1.5 1.5 0 013.5 9.5zm3 0A1.5 1.5 0 015 8V3.5a1.5 1.5 0 113 0V8a1.5 1.5 0 01-1.5 1.5zm6-3a1.5 1.5 0 110 3H11V8a1.5 1.5 0 011.5-1.5zm-3 0A1.5 1.5 0 0111 8v4.5a1.5 1.5 0 11-3 0V8a1.5 1.5 0 011.5-1.5z"/></svg>
                        Slack (mrkdwn)
                      </button>
                      <button onClick={() => { handleCopyPlainText(); }} className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)] flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                        <FileText width={12} height={12} />
                        Plain Text
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* WYSIWYG Formatting Toolbar */}
            {/* Formatting toolbar — LIVE view only. Hidden while any
                full-surface overlay (Galaxy / Hub / Start / Settings)
                is showing so the cosmos / hub view owns the whole
                content slot, not a doc-specific bar floating on top. */}
            {/* Toolbar is doc-specific. Hide it when the active tab is
                a bundle (canvas / overview / list views) — the
                formatting controls don't apply to bundle surfaces, and
                showing them carries over the visual state from the
                previously-open doc tab. */}
            {showToolbar && canEdit && !editorPlaceholder && !showGalaxy && !showHub && !showOnboarding && !showSettings && activeTab?.kind !== "bundle" && (
              <WysiwygToolbar
                onInsert={handleInsertBlock}
                onInsertTable={handleInsertTable}
                onInputPopup={(config) => setInlineInput({ ...config, onSubmit: (v) => { config.onSubmit(v); setInlineInput(null); } })}
                cmWrap={cmWrapSelection}
                cmInsert={cmInsertAtCursor}
                onImageUpload={() => imageFileRef.current?.click()}
                onUndo={undo}
                onRedo={redo}
                getTiptapEditor={() => tiptapRef.current?.getEditor() ?? null}
              />
            )}
            {/* Toolbar hint for new users — visible only in Live view when toolbar is hidden */}
            {/* Toolbar hint removed — now integrated into toolbar toggle button */}
            {(activeTab?.readonly || activeTab?.permission === "readonly") && !showHub && !showGalaxy && !showSettings && !showOnboarding && (
              <div
                className="flex items-center justify-between gap-3 px-3 py-2 text-caption"
                style={{
                  background: "var(--border)",
                  borderTop: "1px solid var(--border-dim)",
                  borderBottom: "1px solid var(--border-dim)",
                  color: "var(--text-secondary)",
                }}
              >
                <div className="flex items-center gap-1.5">
                  {activeTab?.readonly ? (
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Read-only example</span>
                  ) : (
                    <>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>View only</span>
                      <span style={{ color: "var(--text-muted)" }}>— this document was shared with you.</span>
                    </>
                  )}
                </div>
                <button
                  onClick={duplicateCurrentTabAsEditable}
                  className="px-2.5 py-1 rounded text-caption font-semibold"
                  style={{ background: "var(--text-primary)", color: "var(--background)", border: "none", cursor: "pointer" }}
                >
                  Duplicate to edit
                </button>
              </div>
            )}
            <div className="flex-1 flex min-h-0 relative">
            {/* Account Settings — overlay, same mental model as Hub.
                Founder ask: settings shouldn't open as a new page; it
                should layer in-place so closing it puts you right back
                where you were. */}
            {showSettings && (
              <div
                className="absolute top-0 bottom-0 left-0 z-10 flex" data-reserves-right-panel
                style={{
                  right: showAIPanel ? aiPanelWidth : (showImagePanel ? imagePanelWidth : 0),
                  background: "var(--background)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <SettingsEmbed
                    onClose={() => { setShowSettings(false); setSettingsInitialSection(undefined); }}
                    initialSection={settingsInitialSection as "profile" | "appearance" | "auto-management" | "hub" | "danger" | undefined}
                  />
                </div>
              </div>
            )}
            {/* Hub — overlay rendering keyed off showHub, not a tab in
                tabs[]. Activates on top of whatever the user was last
                on (doc or bundle), so the sidebar selection for that
                tab stays intact. Same overlay slot as BundleEmbed —
                respects the right-side panels. */}
            {showHub && hubSlug && !showOnboarding && !showSettings && !showGalaxy && (
              <div
                className="absolute top-0 bottom-0 left-0 z-10 flex" data-reserves-right-panel
                style={{
                  right: showAIPanel ? aiPanelWidth : (showImagePanel ? imagePanelWidth : 0),
                  background: "var(--background)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <HubEmbed
                    slug={hubSlug}
                    onCreateBundleFromDocs={(docIds) => {
                      // Pre-fill BundleCreator with the suggested doc IDs.
                      // Resolve to full {id, title} pairs from local tabs +
                      // serverDocs so the modal shows real titles, not bare ids.
                      const resolved = docIds.map((id) => {
                        const tab = tabs.find((t) => t.cloudId === id);
                        if (tab) return { id, title: tab.title || "Untitled" };
                        return { id, title: id };
                      });
                      setBundleCreatorDocs(resolved);
                      setShowBundleCreator(true);
                    }}
                    onOpenDoc={(docId) => {
                      setShowHub(false);
                      const existing = tabs.find(t => t.cloudId === docId);
                      if (existing) { switchTab(existing.id); return; }
                      fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                        if (!d) return;
                        const newId = `doc-${docId}-${Date.now()}`;
                        const newTab: Tab = {
                          id: newId, kind: "doc",
                          title: d.title || "Untitled",
                          markdown: d.markdown || "",
                          cloudId: docId,
                          isDraft: d.is_draft,
                          shared: !d.isOwner,
                          readonly: !d.isOwner && !d.isEditor && d.editMode !== "public",
                        };
                        setTabs(prev => [...prev, newTab]);
                        switchTab(newId);
                      }).catch(() => {});
                    }}
                    onOpenBundle={(bundleId) => {
                      setShowHub(false);
                      const existing = tabs.find(t => t.kind === "bundle" && t.bundleId === bundleId);
                      if (existing) { switchTab(existing.id); return; }
                      const b = bundles.find(x => x.id === bundleId);
                      const newId = `bundle-${bundleId}-${Date.now()}`;
                      const newTab: Tab = {
                        id: newId, kind: "bundle", bundleId,
                        title: b?.title || "Untitled Bundle",
                        markdown: "",
                      };
                      setTabs(prev => [...prev, newTab]);
                      switchTab(newId);
                    }}
                    onExpandConcept={(concept, sourceDocId, neighbors) => {
                      setShowHub(false);
                      const newId = `local-expand-${Date.now()}`;
                      const neighbourHint = neighbors.length > 0
                        ? `<!-- memory.wiki: this concept connects to ${neighbors.slice(0, 5).join(", ")} — referenced in /${sourceDocId} -->\n\n`
                        : "";
                      const seedMd = `${neighbourHint}# ${concept}\n\n`;
                      const newTab: Tab = {
                        id: newId,
                        kind: "doc",
                        title: concept,
                        markdown: seedMd,
                        isDraft: true,
                      };
                      setTabs(prev => [...prev, newTab]);
                      switchTab(newId);
                    }}
                    lintReport={lintReport}
                    curatorOrphanEnabled={curatorSettings.orphan}
                    curatorDuplicateEnabled={curatorSettings.duplicate}
                    curatorTitleMismatchEnabled={curatorSettings["title-mismatch"]}
                    curatorStaleEnabled={curatorSettings.stale}
                    curatorMergeEnabled={curatorSettings.merge}
                    curatorRollupEnabled={curatorSettings.rollup}
                    curatorAutoArchiveEnabled={curatorSettings["auto-archive"]}
                    curatorBundleSuggestionEnabled={curatorSettings["bundle-suggestion"]}
                    curatorCitationRotEnabled={curatorSettings["citation-rot"]}
                    onResolveStaleClaim={(docId) => {
                      setLintResolved((prev) => ({ ...prev, staleClaims: new Set([...prev.staleClaims, docId]) }));
                    }}
                    onResolveMergeSuggestion={(aId, bId) => {
                      const key = `${aId}|${bId}`;
                      setLintResolved((prev) => ({ ...prev, mergeSuggestions: new Set([...prev.mergeSuggestions, key]) }));
                    }}
                    onResolveRollupSuggestion={(concept) => {
                      setLintResolved((prev) => ({ ...prev, rollupSuggestions: new Set([...prev.rollupSuggestions, concept]) }));
                    }}
                    onResolveAutoArchive={(docId) => {
                      setLintResolved((prev) => ({ ...prev, autoArchive: new Set([...prev.autoArchive, docId]) }));
                    }}
                    onAcceptBundleSuggestion={async (clusterId, title, docIds) => {
                      if (!user?.id) return;
                      // Dismiss locally up front so the card disappears
                      // while the bundle creation runs in the background.
                      setLintResolved((prev) => ({ ...prev, bundleSuggestions: new Set([...prev.bundleSuggestions, clusterId]) }));
                      try {
                        const res = await fetch("/api/bundles", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({
                            title,
                            documentIds: docIds,
                            isDraft: true,
                            sourceClusterId: clusterId,
                          }),
                        });
                        if (!res.ok) {
                          showToast("Couldn't create bundle", "error");
                          return;
                        }
                        const data = await res.json();
                        showToast(`Bundle "${title}" created`, "success");
                        // Refresh bundles so the sidebar picks it up.
                        fetch("/api/bundles", { headers: authHeaders })
                          .then((r) => r.ok ? r.json() : null)
                          .then((d) => { if (d?.bundles) setBundles(d.bundles); })
                          .catch(() => {});
                        void data;
                      } catch {
                        showToast("Couldn't create bundle", "error");
                      }
                    }}
                    onDismissBundleSuggestion={(clusterId) => {
                      setLintResolved((prev) => ({ ...prev, bundleSuggestions: new Set([...prev.bundleSuggestions, clusterId]) }));
                    }}
                    onDismissCitationRot={(docId, url) => {
                      setLintResolved((prev) => ({ ...prev, citationRot: new Set([...prev.citationRot, `${docId}|${url}`]) }));
                    }}
                    onResolveTitleMismatch={(docId) => {
                      // Renaming via AI isn't wired yet; opening the
                      // doc lets the user edit the H1 manually, which
                      // is the source of truth for the title.
                      setShowHub(false);
                      const existing = tabs.find(t => t.cloudId === docId);
                      if (existing) { switchTab(existing.id); return; }
                      fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                        if (!d) return;
                        const newId = `doc-${docId}-${Date.now()}`;
                        const newTab: Tab = {
                          id: newId, kind: "doc",
                          title: d.title || "Untitled",
                          markdown: d.markdown || "",
                          cloudId: docId,
                          isDraft: d.is_draft,
                          shared: !d.isOwner,
                          readonly: !d.isOwner && !d.isEditor && d.editMode !== "public",
                        };
                        setTabs(prev => [...prev, newTab]);
                        switchTab(newId);
                      }).catch(() => {});
                    }}
                    lintResolved={lintResolved}
                    onResolveOrphan={async (docId, docTitle) => {
                      // Orphan auto-fix: refresh-concepts. If the
                      // extractor turns up shared concepts the doc
                      // drops off the orphan list on the next scan.
                      // Inlined here (and in the sidebar's Needs
                      // Review) so the Hub surface stays decoupled —
                      // a refactor to lift these into useCallback can
                      // come later when there's a third caller.
                      if (!user?.id) return;
                      try {
                        const res = await fetch(`/api/docs/${docId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({ action: "refresh-concepts", userId: user.id }),
                        });
                        if (!res.ok) {
                          const j = await res.json().catch(() => ({}));
                          showToast(j.error || "Couldn't refresh concepts", "error");
                          return;
                        }
                        showToast(`Re-extracting concepts for "${docTitle || "Untitled"}".`, "success");
                        setLintResolved((prev) => ({ ...prev, orphans: new Set([...prev.orphans, docId]) }));
                        setLintReport((prev) => prev ? { ...prev, orphans: prev.orphans.filter((x) => x.id !== docId) } : prev);
                      } catch {
                        showToast("Couldn't refresh concepts", "error");
                      }
                    }}
                    onResolveDuplicate={async (aId, aTitle, bId, bTitle) => {
                      const targetTitle = aTitle || aId;
                      if (!confirm(`Move "${targetTitle}" to Trash and keep "${bTitle || bId}" as the canonical copy?\n\nYou can restore from Trash if wrong.`)) return;
                      const targetTab = tabs.find((t) => t.cloudId === aId);
                      try {
                        const res = await fetch(`/api/docs/${aId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify({ action: "soft-delete", userId: user?.id, editToken: targetTab?.editToken }),
                        });
                        if (!res.ok) {
                          const j = await res.json().catch(() => ({}));
                          showToast(j.error || "Couldn't move to Trash", "error");
                          return;
                        }
                        showToast(`Moved "${targetTitle}" to Trash.`, "success");
                        const pairKey = `${aId}|${bId}`;
                        setLintResolved((prev) => ({ ...prev, duplicates: new Set([...prev.duplicates, pairKey]) }));
                        setTabs((prev) => prev.map((t) => t.cloudId === aId ? { ...t, deleted: true, deletedAt: Date.now() } : t));
                        setLintReport((prev) => prev ? { ...prev, duplicates: prev.duplicates.filter((x) => x.a.id !== aId || x.b.id !== bId) } : prev);
                      } catch {
                        showToast("Couldn't move to Trash", "error");
                      }
                    }}
                    autoLevel={curatorSettings.autoLevel}
                    autoTrigger={curatorSettings.autoTrigger}
                    onAutoResolveRun={() => autoResolveSafeFindings({ manual: true })}
                    onOpenAutoSettings={() => {
                      setShowHub(false);
                      setSettingsInitialSection("auto-management");
                      setShowSettings(true);
                    }}
                    freshness={hubFreshness}
                    onReanalyze={handleHubReanalyze}
                    reanalyzing={hubReanalyzing}
                    onOpenGalaxy={() => {
                      // Same recipe as the Atom pill in the toolbar:
                      // hand the canvas the full editor slot and open
                      // the embedded Galaxy overlay.
                      setShowOnboarding(false);
                      setShowSettings(false);
                      setShowHub(false);
                      setShowSidebar(false);
                      setShowAIPanel(false);
                      setShowImagePanel(false);
                      setShowOutlinePanel(false);
                      setShowGalaxy(true);
                    }}
                  />
                </div>
              </div>
            )}
            {/* Galaxy — same overlay slot as Hub / Bundle. Renders
                the full hub graph (xyflow + elkjs). Mutex with Hub
                via the active checks above. */}
            {showGalaxy && !showOnboarding && !showHub && !showSettings && (
              <div
                className="absolute top-0 bottom-0 left-0 z-10 flex" data-reserves-right-panel
                style={{
                  right: showAIPanel ? aiPanelWidth : (showImagePanel ? imagePanelWidth : 0),
                  background: "var(--background)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <HubGalaxy
                    authHeaders={authHeaders}
                    userEmail={user?.email ?? null}
                    embedded
                    onOpenDoc={(docId) => {
                      setShowGalaxy(false);
                      const existing = tabs.find(t => t.cloudId === docId);
                      if (existing) { switchTab(existing.id); return; }
                      fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                        if (!d) return;
                        const newId = `doc-${docId}-${Date.now()}`;
                        const newTab: Tab = {
                          id: newId, kind: "doc",
                          title: d.title || "Untitled",
                          markdown: d.markdown || "",
                          cloudId: docId,
                          isDraft: d.is_draft,
                          shared: !d.isOwner,
                          readonly: !d.isOwner && !d.isEditor && d.editMode !== "public",
                        };
                        setTabs(prev => [...prev, newTab]);
                        switchTab(newId);
                      }).catch(() => {});
                    }}
                    onOpenBundle={(bundleId) => {
                      setShowGalaxy(false);
                      const existing = tabs.find(t => t.kind === "bundle" && t.bundleId === bundleId);
                      if (existing) { switchTab(existing.id); return; }
                      const b = bundles.find(x => x.id === bundleId);
                      const newId = `bundle-${bundleId}-${Date.now()}`;
                      const newTab: Tab = {
                        id: newId, kind: "bundle", bundleId,
                        title: b?.title || "Untitled Bundle",
                        markdown: "",
                      };
                      setTabs(prev => [...prev, newTab]);
                      switchTab(newId);
                    }}
                  />
                </div>
              </div>
            )}
            {activeTab?.kind === "bundle" && activeTab.bundleId && !showOnboarding && !showHub && !showGalaxy && !showSettings && (
              <div
                className="absolute top-0 bottom-0 left-0 z-10 flex" data-reserves-right-panel
                style={{
                  // Leave room for the right-side Assistant or Image panel when open.
                  // Bundle view has no markdown to outline, so we never render the
                  // outline panel here — don't reserve space for it either.
                  right: showAIPanel ? aiPanelWidth : (showImagePanel ? imagePanelWidth : 0),
                  background: "var(--background)",
                  outline: dragTabId ? "2px dashed var(--text-primary)" : undefined,
                  outlineOffset: dragTabId ? "-8px" : undefined,
                  transition: "outline-color 0.12s",
                }}
                // Sidebar MD/doc tabs are draggable. When the user drags
                // one onto an open bundle viewer, add the cloud doc to
                // the bundle in place — no roundtrip to a picker. The
                // outline above flashes accent during a valid drag so
                // the drop target is obvious.
                onDragOver={(e) => {
                  if (!dragTabId) return;
                  const draggedTab = tabs.find(t => t.id === dragTabId);
                  if (!draggedTab?.cloudId || draggedTab.kind === "bundle") return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={async (e) => {
                  if (!dragTabId || !activeTab.bundleId) return;
                  e.preventDefault();
                  const draggedTab = tabs.find(t => t.id === dragTabId);
                  setDragTabId(null);
                  if (!draggedTab?.cloudId) {
                    showToast("Save the doc first before adding to a bundle.", "info");
                    return;
                  }
                  if (draggedTab.kind === "bundle") return;
                  const bundleId = activeTab.bundleId;
                  try {
                    const res = await fetch(`/api/bundles/${bundleId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", ...authHeaders },
                      body: JSON.stringify({
                        action: "add-documents",
                        documentIds: [draggedTab.cloudId],
                      }),
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      showToast(j.error || "Couldn't add to bundle.", "error");
                      return;
                    }
                    showToast(`Added "${draggedTab.title || "Untitled"}" to bundle.`, "success");
                    // BundleEmbed subscribes to this event and re-pulls
                    // its document list so the new member appears
                    // without a manual reload.
                    try {
                      window.dispatchEvent(new CustomEvent("mw-bundle-doc-added", {
                        detail: { bundleId, docIds: [draggedTab.cloudId] },
                      }));
                    } catch { /* ignore */ }
                  } catch {
                    showToast("Couldn't add to bundle.", "error");
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <BundleEmbed
                    bundleId={activeTab.bundleId}
                    view={bundleView}
                    onChangeView={(v) => setBundleView(v)}
                    aiPanelOpen={showAIPanel}
                    onSelectNodeInfo={() => setShowAIPanel(false)}
                    authHeaders={authHeaders}
                    highlightedDocIds={bundleHighlights[activeTab.bundleId] || null}
                    onClearHighlight={() => setBundleHighlights(prev => {
                      if (!activeTab.bundleId || !prev[activeTab.bundleId]) return prev;
                      const next = { ...prev };
                      delete next[activeTab.bundleId];
                      return next;
                    })}
                    onDocCreated={({ docId, title, markdown }) => {
                      // Newly created doc from synthesis or extraction.
                      // Append it to the user's tab list with unread:true so
                      // the sidebar shows a pulsing orange dot until they
                      // actually open it. Skip if a tab already exists for
                      // this doc (extract path may also be the active doc).
                      setTabs(prev => {
                        if (prev.some(t => t.cloudId === docId)) return prev;
                        const newTab: Tab = {
                          id: `doc-${docId}-${Date.now()}`,
                          kind: "doc",
                          cloudId: docId,
                          title: title || "Untitled",
                          markdown: markdown || "",
                          permission: "mine",
                          isDraft: true,
                          unread: true,
                          lastOpenedAt: undefined,
                        };
                        return [...prev, newTab];
                      });
                      showToast(`Saved — ${title}`, "info");
                    }}
                    onOpenDoc={(docId) => {
                      const existing = tabs.find(t => t.cloudId === docId);
                      if (existing) { switchTab(existing.id); return; }
                      fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                        if (!d) return;
                        const newId = `doc-${docId}-${Date.now()}`;
                        const newTab: Tab = {
                          id: newId, kind: "doc",
                          title: d.title || "Untitled",
                          markdown: d.markdown || "",
                          cloudId: docId,
                          isDraft: d.is_draft,
                          shared: !d.isOwner,
                          readonly: !d.isOwner && !d.isEditor && d.editMode !== "public",
                        };
                        setTabs(prev => [...prev, newTab]);
                        switchTab(newId);
                      }).catch(() => {});
                    }}
                  />
                </div>
                {/* Bundle chat moved into unified Assistant panel (showAIPanel). */}
              </div>
            )}
            {/* Related concepts strip — when the active doc mentions known
                concepts that also appear in OTHER docs, surface a pill row
                so the user can jump to the cross-doc context. Only shown for
                regular doc tabs (not bundles, not onboarding). */}
            {activeTab?.kind !== "bundle" && !showHub && !showGalaxy && !showOnboarding && relatedConcepts.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 flex-wrap shrink-0"
                style={{ borderBottom: "1px solid var(--border-dim)", background: "var(--toggle-bg)" }}>
                <span className="text-caption font-semibold uppercase tracking-wider shrink-0" style={{ color: "var(--text-faint)" }}>
                  Related concepts
                </span>
                {relatedConcepts.map(c => {
                  const otherDocCount = c.docCount;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setOpenedConceptId(c.id)}
                      className="text-caption px-2 py-0.5 rounded-full inline-flex items-center gap-1 transition-colors hover:bg-[var(--menu-hover)]"
                      style={{ background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border-dim)" }}
                      title={`${c.label} appears in ${otherDocCount} ${otherDocCount === 1 ? "doc" : "docs"} across your library`}
                    >
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--text-primary)" }} />
                      {c.label}
                      <span className="tabular-nums" style={{ color: "var(--text-faint)" }}>{otherDocCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex-1 overflow-auto body-scroll relative" ref={previewRef}>
              {showInnerLoader && !editorPlaceholder && activeTab?.kind !== "bundle" && !showHub && (
                // Visually identical to page.tsx's boot loader — same
                // logo size, same bar dimensions, same caption — so
                // when this overlay takes over from the boot loader
                // (Next finishes downloading the editor bundle while
                // we still need to fetch the first doc) it reads as
                // ONE continuous loader instead of "logo flashed
                // twice." The fade-in animation that lived here used
                // to re-trigger on the takeover, which is what the
                // founder saw as a second logo appearing.
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: "var(--background)", gap: 14 }}>
                  {/* Inner doc loader — matches the boot loader: symbol
                      only + "Loading" caption. Bar and wordmark removed
                      so this transition reads as one continuous moment. */}
                  <MemoryWikiLogo size={64} variant="icon-only" />
                  <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)" }}>
                    Loading
                  </span>
                </div>
              )}
                {/* Compiled-doc banner removed per founder feedback —
                    the loud accent block above the body interrupted
                    reading and the same info is implicit from the doc's
                    source field. Regenerate is reachable from the
                    sidebar right-click menu (Recompile / Recompile
                    from another bundle). */}
                {/* Bundle-membership banner — distinct from the
                    Compiled banner above. Tells the reader "this
                    doc lives inside N bundle(s)" so they know
                    where it gets pulled into a synthesis. Each
                    bundle name is clickable. Owner-only (server
                    only returns inBundles for the owner). */}
                {activeTab?.inBundles && activeTab.inBundles.length > 0 && (
                  <div
                    className="mx-auto flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg my-3"
                    style={{
                      maxWidth: 760,
                      background: "var(--surface)",
                      border: "1px solid var(--border-dim)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Layers width={14} height={14} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    <span className="text-caption shrink-0">
                      Member of {activeTab.inBundles.length} bundle{activeTab.inBundles.length === 1 ? "" : "s"}:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {activeTab.inBundles.map((b) => (
                        <button
                          key={b.id}
                          onClick={() => {
                            const existing = tabs.find((t) => t.kind === "bundle" && t.bundleId === b.id);
                            if (existing) { switchTab(existing.id); return; }
                            const newId = `bundle-${b.id}-${Date.now()}`;
                            const newTab: Tab = { id: newId, kind: "bundle", bundleId: b.id, title: b.title, markdown: "" };
                            setTabs((prev) => [...prev, newTab]);
                            switchTab(newId);
                          }}
                          className="text-caption px-2 py-0.5 rounded transition-colors hover:bg-[var(--toggle-bg)]"
                          style={{
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-dim)",
                          }}
                        >
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <TiptapLiveEditor
                  ref={tiptapRef}
                  markdown={markdown}
                  onChange={handleTiptapChange}
                  canEdit={canEdit && !activeTab?.readonly}
                  narrowView={narrowView}
                  onPasteImage={uploadImage}
                  onDoubleClickCode={(lang, code) => {
                    setCodeEditState({ lang, code });
                  }}
                  onDoubleClickMermaid={(code) => {
                    mermaidIsNewRef.current = false;
                    setCanvasMermaid(code);
                    setShowMermaidModal(true);
                  }}
                  onDoubleClickMath={(tex, mode) => {
                    setInitialMath(tex);
                    // Store original math syntax for replacement
                    mathOriginalRef.current = mode === "display" ? `$$${tex}$$` : `$${tex}$`;
                    setShowMathModal(true);
                  }}
                  onSelectionUpdate={(pmPos) => {
                    // CM6 line/col stays at 0/0 when origin is Tiptap — the
                    // pmPos field is the meaningful payload here. Source
                    // pane receivers will skip cursors whose pmPos is set
                    // without line/col context, and vice versa.
                    broadcastCursorRef.current?.(0, 0, pmPos);
                  }}
                  remoteCursors={remoteCursors
                    .filter((c) => typeof c.pmPos === "number")
                    .map((c) => ({
                      userId: c.userId,
                      pmPos: c.pmPos as number,
                      name: c.name,
                      color: c.color,
                    }))}
                  onAiAction={(action) => handleAIAction(action)}
                  onOpenAssistant={() => { setShowAIPanel(true); setShowOutlinePanel(false); setShowImagePanel(false); }}
                />
                {/* Related docs — under the body so the user
                    discovers it after they finish reading. Owner-
                    only; gated on cloudId so non-cloud / sample
                    docs don't show it. */}
                <RelatedDocsWidget
                  cloudId={activeTab?.cloudId}
                  isOwner={!activeTab?.permission || activeTab.permission === "mine"}
                  onOpenDoc={(docId) => {
                    const existing = tabs.find((t) => t.cloudId === docId && !t.deleted);
                    if (existing) { switchTab(existing.id); return; }
                    const newId = `tab-${Date.now()}`;
                    const newTab: Tab = { id: newId, title: "Loading…", markdown: "", cloudId: docId, permission: "mine" };
                    setTabs((prev) => [...prev, newTab]);
                    switchTab(newId);
                  }}
                />
                {/* Backlinks — owner-side "what of mine references
                    this doc". Lives under the body so it's a passive
                    discovery surface, not a CTA. Click → opens the
                    referencing entity as a new tab. */}
                {activeTab?.cloudId && (!activeTab.permission || activeTab.permission === "mine") && (
                  <BacklinksPanel
                    type="document"
                    id={activeTab.cloudId}
                    authHeaders={authHeaders}
                    onOpenDoc={(docId) => {
                      const existing = tabs.find((t) => t.cloudId === docId && !t.deleted);
                      if (existing) { switchTab(existing.id); return; }
                      const newId = `tab-${Date.now()}`;
                      const newTab: Tab = { id: newId, title: "Loading…", markdown: "", cloudId: docId, permission: "mine" };
                      setTabs((prev) => [...prev, newTab]);
                      switchTab(newId);
                    }}
                    onOpenBundle={(bundleId) => {
                      const existing = tabs.find((t) => t.kind === "bundle" && t.bundleId === bundleId);
                      if (existing) { switchTab(existing.id); return; }
                      const newId = `bundle-${bundleId}-${Date.now()}`;
                      const newTab: Tab = { id: newId, kind: "bundle", bundleId, title: "Bundle", markdown: "" };
                      setTabs((prev) => [...prev, newTab]);
                      switchTab(newId);
                    }}
                  />
                )}
              </div>{/* end scrollable preview */}
              {/* ─── AI Panel (side-by-side) ─── */}
              {showAIPanel && (canEdit || activeTab?.kind === "bundle" || showHub || (aiPanelMode === "hub" && hubSlug)) && (() => {
                // Three assistants — Document, Bundle, Hub. All share the
                // memory.wiki orange palette; the radio tabs above the panel are
                // the single source of mode identity. The header below
                // just shows "what the active assistant is working with"
                // (title + word count, doc count + bundle name, concept
                // count). No per-mode colour.
                // When the Hub overlay is showing, the chat snaps to Hub
                // mode automatically — no need for the user to flip the
                // radio. (showHub replaced the old hub-tab path.)
                const isHubMode = !!hubSlug && (aiPanelMode === "hub" || showHub);
                const isBundleMode = !isHubMode && activeTab?.kind === "bundle";
                const activeBundle = isBundleMode ? bundles.find(b => b.id === activeTab?.bundleId) : null;
                const docWordCount = !isHubMode && !isBundleMode ? markdown.trim().split(/\s+/).filter(Boolean).length : 0;
                const accent = "var(--text-primary)";
                const accentDim = "var(--border)";
                const mode = isHubMode
                  ? {
                      id: "hub" as const,
                      label: "Hub",
                      icon: <Network width={12} height={12} />,
                      accent,
                      accentDim,
                      scope: hubConceptCount > 0
                        ? `${hubConceptCount} concepts — whole hub`
                        : "ontology not built yet",
                    }
                  : isBundleMode
                    ? {
                        id: "bundle" as const,
                        label: "Bundle",
                        icon: <Layers width={12} height={12} />,
                        accent,
                        accentDim,
                        scope: activeBundle
                          ? `${activeBundle.documentCount} doc${activeBundle.documentCount === 1 ? "" : "s"} — ${activeBundle.title || "Untitled"}`
                          : (activeTab?.title || "this bundle"),
                      }
                    : {
                        id: "doc" as const,
                        label: "Document",
                        icon: <FileText width={12} height={12} />,
                        accent,
                        accentDim,
                        scope: activeTab?.title
                          ? `${activeTab.title}${docWordCount > 0 ? ` — ${docWordCount.toLocaleString()} word${docWordCount === 1 ? "" : "s"}` : ""}`
                          : (docWordCount > 0 ? `${docWordCount.toLocaleString()} words` : "draft"),
                      };
                // Helpers for the radio tab clicks: clicking Document /
                // Bundle when no tab of that kind is active jumps to the
                // most recent tab of that kind so the radio actually
                // gets you to the scope it advertises.
                const jumpToMostRecent = (kind: "doc" | "bundle") => {
                  setAiPanelMode("auto");
                  // If the current activeTab already matches, nothing to do.
                  if (activeTab?.kind === kind) return;
                  // Prefer recent tabs first (user's recency signal),
                  // fall back to anything in `tabs` of the right kind.
                  const matchKind = (t: Tab) => kind === "bundle"
                    ? t.kind === "bundle"
                    : (t.kind !== "bundle" && t.kind !== "hub");
                  const candidatesFromRecent = recentTabIds
                    .map((id) => tabs.find((t) => t.id === id))
                    .filter((t): t is Tab => !!t && matchKind(t) && !t.deleted);
                  const fallback = tabs.find((t) => matchKind(t) && !t.deleted && !t.readonly);
                  const target = candidatesFromRecent[0] || fallback;
                  if (target) switchTab(target.id);
                };
                return (
                <div
                  data-pane="ai-panel"
                  className="flex shrink-0 relative"
                  style={{
                    width: aiPanelWidth,
                    minWidth: 280,
                    maxWidth: 720,
                    background: "var(--surface)",
                    borderLeft: "1px solid var(--border-dim)",
                    // Layering: AI panel floats above sidebar (z:10) and canvas
                    // (default). Originally had a left-edge box-shadow but
                    // the 8px blur leaked above/below the panel — read as
                    // an unwanted shadow under the chat. Border alone keeps
                    // the seam crisp without the bleed.
                    zIndex: 20,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Resize hit-zone — invisible. The 1px borderLeft on
                      the panel itself is the only visible seam; this
                      strip just exposes a 5px drag target on top of it. */}
                  <div
                    className="absolute top-0 bottom-0 cursor-col-resize z-[100]"
                    style={{ width: 5, left: -3, background: "transparent" }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      isDraggingAiPanel.current = true;
                      document.body.style.cursor = "col-resize";
                      document.body.style.userSelect = "none";
                    }}
                  />
                  <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full">
                  {/* Mode indicator + actions header. Single brand colour
                      (orange) so the panel feels like one product. The
                      radio tabs below this row are the source of mode
                      identity; the header just shows the active scope. */}
                  <div
                    className="flex items-center justify-between px-3 py-2 shrink-0 gap-2"
                    style={{ borderBottom: "1px solid var(--border-dim)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: "var(--border)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {mode.icon}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-caption font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>{mode.label}</span>
                        <span className="leading-tight truncate" style={{ color: "var(--text-faint)", fontSize: 10 }} title={mode.scope}>
                          {mode.scope}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Always-visible "New chat" affordance — clears the
                          history of whichever chat is currently active.
                          Doc mode mutates local state directly; hub/bundle
                          fire a window event the chat components listen
                          for (so we don't need to thread refs through). */}
                      <button
                        onClick={() => {
                          if (isHubMode) {
                            window.dispatchEvent(new CustomEvent("mw-newchat-hub"));
                          } else if (isBundleMode) {
                            window.dispatchEvent(new CustomEvent("mw-newchat-bundle"));
                          } else {
                            if (aiChatHistory.length > 0 && !confirm("Start a new chat? Current conversation will be cleared.")) return;
                            setAiChatHistory([]);
                          }
                        }}
                        className="flex items-center gap-1 h-5 px-1.5 rounded text-caption font-medium transition-colors hover:bg-[var(--menu-hover)]"
                        style={{ color: "var(--text-muted)" }}
                        title="Start a new chat"
                      >
                        <MessageSquarePlus width={11} height={11} />
                        <span className="hidden sm:inline">New</span>
                      </button>
                      {undoStack.current.length > 1 && !isHubMode && !isBundleMode && (
                        <button
                          onClick={() => { undo(); setAiChatHistory(prev => [...prev, { role: "ai", text: "Reverted to previous version." }]); }}
                          className="flex items-center gap-1 px-1.5 h-5 rounded text-caption font-medium transition-colors hover:bg-[var(--menu-hover)]"
                          style={{ color: "var(--text-muted)" }}
                          title="Undo last AI change"
                        >
                          <Undo2 width={9} height={9} />
                          Undo
                        </button>
                      )}
                      <button
                        onClick={() => setShowAIPanel(false)}
                        className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-[var(--menu-hover)]"
                        style={{ color: "var(--text-muted)" }}
                        title="Close AI panel"
                      >
                        <X width={10} height={10} />
                      </button>
                    </div>
                  </div>
                  {/* Mode switcher — two tabs: the per-scope assistant
                      (Document or Bundle, whichever matches the current
                      tab) plus Hub. We don't render Document AND Bundle
                      simultaneously since only one is meaningful at a
                      time; the visible per-scope tab swaps based on
                      activeTab.kind. Active state = accent-dim fill +
                      orange text. No crisp orange border — the fill is
                      enough signal and the border read as loud. */}
                  <div className="px-2 pt-2 shrink-0">
                    <div
                      className="flex items-center gap-0.5 p-0.5 rounded-lg"
                      style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}
                      role="radiogroup"
                      aria-label="Assistant mode"
                    >
                      {(() => {
                        type ModeTab = { id: "doc" | "bundle" | "hub"; label: string; icon: React.ReactNode; active: boolean; onClick: () => void; title: string };
                        // Pick whichever scope tab applies right now —
                        // Document if the user is on a doc, Bundle if on
                        // a bundle. Active when aiPanelMode is auto.
                        const scopeTab: ModeTab = isBundleMode || activeTab?.kind === "bundle"
                          ? { id: "bundle", label: "Bundle", icon: <Layers width={11} height={11} />,
                              active: !isHubMode && isBundleMode,
                              onClick: () => setAiPanelMode("auto"),
                              title: "Bundle Assistant — chat scoped to the current bundle" }
                          : { id: "doc", label: "Document", icon: <FileText width={11} height={11} />,
                              active: !isHubMode,
                              onClick: () => setAiPanelMode("auto"),
                              title: "Document Assistant — chat scoped to the current doc" };
                        const radioTabs: ModeTab[] = [scopeTab];
                        if (hubSlug) {
                          radioTabs.push({
                            id: "hub", label: "Hub", icon: <Network width={11} height={11} />,
                            active: isHubMode,
                            onClick: () => setAiPanelMode("hub"),
                            title: "Hub Assistant — chat across your whole hub",
                          });
                        }
                        return radioTabs.map((t) => (
                          <button
                            key={t.id}
                            role="radio"
                            aria-checked={t.active}
                            onClick={t.onClick}
                            className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md text-caption font-semibold transition-colors"
                            style={{
                              background: t.active ? "var(--border)" : "transparent",
                              color: t.active ? "var(--text-primary)" : "var(--text-faint)",
                            }}
                            title={t.title}
                          >
                            {t.icon}
                            {t.label}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                  {/* Hub mode → ontology-grounded chat over the whole hub */}
                  {isHubMode && hubSlug && (
                    <HubChat
                      slug={hubSlug}
                      hubName={profile?.display_name || hubSlug}
                      conceptCount={hubConceptCount}
                      accent={mode.accent}
                      accentDim={mode.accentDim}
                      onCitationClick={(docId) => {
                        const existing = tabs.find(t => t.cloudId === docId);
                        if (existing) { switchTab(existing.id); return; }
                        fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                          if (!d) return;
                          const newId = `doc-${docId}-${Date.now()}`;
                          const newTab: Tab = { id: newId, kind: "doc", title: d.title || "Untitled", markdown: d.markdown || "", cloudId: docId, isDraft: d.is_draft };
                          setTabs(prev => [...prev, newTab]);
                          switchTab(newId);
                        }).catch(() => {});
                      }}
                      onDocCreated={(docId) => {
                        // Refresh the sidebar so the just-saved Hub
                        // Chat answer surfaces immediately instead of
                        // waiting for the next manual refresh.
                        fetch("/api/user/documents?includeDeleted=1", { headers: authHeaders })
                          .then((r) => (r.ok ? r.json() : null))
                          .then((data) => { if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents); })
                          .catch(() => {});
                        void docId;
                      }}
                    />
                  )}
                  {/* Bundle mode → render BundleChat in place of doc tools */}
                  {!isHubMode && isBundleMode && activeTab?.bundleId && (
                    <BundleChat
                      bundleId={activeTab.bundleId}
                      bundleTitle={activeTab.title}
                      documentCount={bundles.find(b => b.id === activeTab?.bundleId)?.documentCount}
                      accent={mode.accent}
                      accentDim={mode.accentDim}
                      onClose={() => setShowAIPanel(false)}
                      onApplyFilter={(docIds) => {
                        const bid = activeTab.bundleId;
                        if (!bid) return;
                        setBundleHighlights(prev => ({ ...prev, [bid]: docIds }));
                        // Make sure the canvas view is the one actually
                        // showing — pasting a filter onto the List or
                        // Overview surface wouldn't reveal the highlight.
                        if (bundleView !== "canvas") setBundleView("canvas");
                      }}
                      onCitationClick={(docId) => {
                        const existing = tabs.find(t => t.cloudId === docId);
                        if (existing) { switchTab(existing.id); return; }
                        fetch(`/api/docs/${docId}`, { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => {
                          if (!d) return;
                          const newId = `doc-${docId}-${Date.now()}`;
                          const newTab: Tab = { id: newId, kind: "doc", title: d.title || "Untitled", markdown: d.markdown || "", cloudId: docId, isDraft: d.is_draft };
                          setTabs(prev => [...prev, newTab]);
                          switchTab(newId);
                        }).catch(() => {});
                      }}
                    />
                  )}
                  {/* Doc mode (default) — existing AI tools follow */}
                  {!isBundleMode && !isHubMode && (<>
                  {/* Quick actions with tooltips */}
                  <div className="px-2 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        { action: "polish", icon: <Sparkles width={11} height={11} style={{ color: "var(--micro-ai)" }} />, label: "Polish", desc: "Fix grammar, spelling, and improve clarity. Preserves meaning." },
                        { action: "compact", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"><path d="M3 4h10M3 8h10M3 12h7"/><path d="M14 6l-2 2 2 2"/></svg>, label: "Compact", desc: "Halve the length while keeping every heading, code block, table, and diagram intact." },
                        { action: "summary", icon: <AlignLeft width={11} height={11} style={{ color: "#60a5fa" }} />, label: "Summary", desc: "Generate a 2-4 sentence summary and add it to the top of the document." },
                        { action: "tldr", icon: <List width={11} height={11} style={{ color: "#fbbf24" }} />, label: "TL;DR", desc: "Create 2-5 bullet points of key takeaways and add to the top." },
                        { action: "translate", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 3h7M5.5 3v9M3 6c1 3 3.5 5 5.5 6M8 6c-1 3-3.5 5-5.5 6"/><path d="M10 8l2 5 2-5M10.5 11.5h3"/></svg>, label: "Translate", desc: "Translate the entire document to another language. Code blocks stay unchanged." },
                        { action: "format", icon: <Wand2 width={11} height={11} style={{ color: "#34d399" }} />, label: "Auto-Format", desc: "Restructure the document into clean Markdown — auto-detect headings, lists, tables, code, quotes from prose." },
                      ] as const).map((item) => (
                        <div key={item.action} className="relative group/ai">
                          <button
                            onClick={() => item.action === "translate" ? setShowTranslatePicker(prev => !prev) : handleAIAction(item.action)}
                            disabled={!!aiProcessing}
                            className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-md text-caption transition-colors hover:bg-[var(--menu-hover)]"
                            style={{ color: "var(--text-secondary)", background: "var(--toggle-bg)" }}>
                            {item.icon}
                            {item.label}
                          </button>
                          <div className="absolute top-full left-0 mt-1 w-48 p-2 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover/ai:opacity-100 transition-opacity z-[9999]"
                            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                            <p style={{ color: "var(--text-primary)", fontWeight: 600, marginBottom: 3 }}>{item.label}</p>
                            <p>{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {showTranslatePicker && (
                      <div className="grid grid-cols-3 gap-0.5 pt-1.5">
                        {[
                          ["English", "English"], ["한국어", "Korean"], ["日本語", "Japanese"], ["中文", "Chinese"],
                          ["Español", "Spanish"], ["Français", "French"], ["Deutsch", "German"], ["Português", "Portuguese"],
                          ["Русский", "Russian"], ["العربية", "Arabic"], ["हिन्दी", "Hindi"], ["Tiếng Việt", "Vietnamese"],
                        ].map(([label, lang]) => (
                          <button key={lang} onClick={() => handleAIAction("translate", { language: lang })}
                            className="px-2 py-1.5 text-caption rounded transition-colors hover:bg-[var(--menu-hover)]"
                            style={{ color: "var(--text-muted)" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Chat history */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-w-0">
                    {aiChatHistory.length === 0 && !aiProcessing && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3" style={{ background: mode.accentDim }}>
                          <Sparkles width={22} height={22} style={{ color: mode.accent }} />
                        </div>
                        <p className="text-caption mb-1" style={{ color: "var(--text-secondary)" }}>Ask AI to edit your document</p>
                        <p className="text-caption" style={{ color: "var(--text-faint)", opacity: 0.7 }}>Edits this doc only — for cross-doc, switch to Bundle or Hub.</p>
                      </div>
                    )}
                    {aiChatHistory.map((msg, i) => (
                      <div key={i} className={`flex flex-col gap-1.5 min-w-0`}>
                        {msg.role === "ai" && (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="flex items-center justify-center shrink-0"
                              style={{ width: 20, height: 20, borderRadius: 4, background: "var(--border)" }}
                            >
                              <FileText width={11} height={11} style={{ color: "var(--text-primary)" }} />
                            </div>
                            <span
                              className="font-bold uppercase tracking-wider"
                              style={{ color: "var(--text-primary)", fontSize: 10, letterSpacing: "0.08em" }}
                            >
                              Document
                            </span>
                          </div>
                        )}
                        <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} min-w-0`}>
                          <div className={`max-w-[85%] min-w-0 px-3 py-2 leading-relaxed ${msg.role === "ai" && msg.text.startsWith("Error") ? "border border-red-500/20" : ""}`}
                            style={{
                              background: msg.role === "user" ? "var(--surface)" : "var(--toggle-bg)",
                              color: msg.text.startsWith("Error") ? "#f87171" : "var(--text-primary)",
                              border: msg.role === "user" || (msg.role === "ai" && !msg.text.startsWith("Error")) ? "1px solid var(--border-dim)" : undefined,
                              borderRadius: 14,
                              borderTopRightRadius: msg.role === "user" ? 4 : 14,
                              fontSize: 13,
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                            }}>
                            <span>{msg.text}</span>
                            {msg.canUndo && undoStack.current.length > 1 && (
                              <button
                                onClick={() => {
                                  undo();
                                  setAiChatHistory(prev => prev.map((m, j) => j === i ? { ...m, canUndo: false, text: m.text + " (undone)" } : m));
                                }}
                                className="ml-2 px-1.5 py-0.5 rounded text-caption font-medium transition-colors hover:opacity-80"
                                style={{ color: "var(--text-primary)", background: "var(--border)" }}
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {aiProcessing && (
                      <div className="flex justify-start">
                        <div className="px-3 py-2 rounded-lg text-caption flex items-center gap-2"
                          style={{ background: "var(--toggle-bg)", color: "var(--text-faint)" }}>
                          <Loader2 width={10} height={10} className="animate-spin" />
                          {{ polish: "Polishing document...", summary: "Writing summary...", tldr: "Extracting key points...", translate: "Translating...", chat: "Thinking...", compact: "Compacting document...", format: "Formatting raw text..." }[aiProcessing] || "Processing..."}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Chat input — textarea so users can paste raw text to
                      format (Format button alongside Send). Auto-grows
                      between 1–6 rows; Enter sends (Shift+Enter newline). */}
                  <div className="shrink-0 px-2 py-2" style={{ borderTop: "1px solid var(--border-dim)" }}>
                    <div className="flex items-end gap-1.5 px-3 py-2 rounded-lg" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)" }}>
                      <textarea
                        value={aiChatInput}
                        onChange={(e) => {
                          setAiChatInput(e.target.value);
                          // Auto-grow: reset then size to scrollHeight, capped at ~6 rows.
                          const el = e.currentTarget;
                          el.style.height = "auto";
                          el.style.height = Math.min(el.scrollHeight, 140) + "px";
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && aiChatInput.trim() && !aiProcessing) {
                            e.preventDefault();
                            const instruction = aiChatInput.trim();
                            setAiChatHistory(prev => [...prev, { role: "user", text: instruction }]);
                            setAiChatInput("");
                            (e.currentTarget as HTMLTextAreaElement).style.height = "auto";
                            handleAIAction("chat", { instruction });
                          }
                        }}
                        placeholder="Ask AI to edit, or paste raw text and Format it…"
                        maxLength={20000}
                        rows={1}
                        disabled={!!aiProcessing}
                        autoFocus
                        className="flex-1 bg-transparent resize-none leading-relaxed"
                        style={{ color: "var(--text-secondary)", border: "none", outline: "none", fontSize: "0.875rem", maxHeight: 140, minHeight: 22 }}
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Auto-Format now lives in the quick-action grid
                            above (alongside Polish / Compact / Summary /
                            TL;DR / Translate) — keeping the formatting
                            entry point in one consistent place. The
                            chat-input Wand2 button was confusing as a
                            second affordance. */}
                        <button
                          onClick={() => {
                            if (aiChatInput.trim() && !aiProcessing) {
                              const instruction = aiChatInput.trim();
                              setAiChatHistory(prev => [...prev, { role: "user", text: instruction }]);
                              setAiChatInput("");
                              handleAIAction("chat", { instruction });
                            }
                          }}
                          disabled={!aiChatInput.trim() || !!aiProcessing}
                          className="p-1.5 rounded-md transition-colors"
                          style={{ background: aiChatInput.trim() ? "var(--text-primary)" : "transparent", color: aiChatInput.trim() ? "#000" : "var(--text-faint)" }}
                          title="Send (Enter)"
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2L2 8.5l5 2L9.5 16z"/><path d="M14 2L7 10.5"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  </>)}
                  </div>
                </div>
              ); })()}
              {/* ─── Outline Panel (side-by-side) ─── */}
              {showOutlinePanel && !showHub && activeTab?.kind !== "bundle" && (
                <div
                  className="flex flex-col shrink-0"
                  style={{ width: "min(260px, 40%)", background: "var(--surface)", borderLeft: "1px solid var(--border-dim)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <div className="flex items-center gap-1.5">
                      <List width={12} height={12} style={{ color: "var(--text-primary)" }} />
                      <span className="text-caption font-semibold" style={{ color: "var(--text-primary)" }}>Outline</span>
                    </div>
                    <button onClick={() => setShowOutlinePanel(false)} className="p-0.5 rounded hover:bg-[var(--menu-hover)] transition-colors" title="Close outline">
                      <X width={12} height={12} style={{ color: "var(--text-faint)" }} />
                    </button>
                  </div>
                  {/* key={activeTabId} forces React to unmount + remount the
                      heading list whenever the active doc changes. The IIFE
                      already reads `markdown` state directly so it SHOULD
                      auto-update, but founder reported a stale-outline bug:
                      switching docs left the previous doc's outline visible
                      until the panel was closed and reopened. Forcing the
                      subtree to discard on tab switch sidesteps whatever
                      reconciliation edge case is leaking the closure. */}
                  <div key={activeTabId || "no-tab"} className="flex-1 overflow-y-auto py-2" style={{ fontSize: 12 }}>
                    {(() => {
                      const md = markdown || "";
                      const headings = md.split("\n")
                        .map((line, idx) => {
                          const match = line.match(/^(#{1,6})\s+(.+)$/);
                          if (!match) return null;
                          return { level: match[1].length, text: match[2].replace(/[*_`\[\]]/g, ""), line: idx };
                        })
                        .filter(Boolean) as { level: number; text: string; line: number }[];

                      if (headings.length === 0) {
                        return <p className="px-3 py-4 text-center" style={{ color: "var(--text-faint)", fontSize: 11 }}>No headings found. Add # headings to see the document structure.</p>;
                      }

                      const minLevel = Math.min(...headings.map(h => h.level));

                      return headings.map((h, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            // Scroll to heading in preview
                            const allHeadings = previewRef.current?.querySelectorAll("h1, h2, h3, h4, h5, h6");
                            if (allHeadings) {
                              // Find matching heading by text content
                              for (const el of allHeadings) {
                                if (el.textContent?.trim() === h.text.trim()) {
                                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                                  // Brief highlight
                                  (el as HTMLElement).style.background = "rgba(251,146,60,0.15)";
                                  setTimeout(() => { (el as HTMLElement).style.background = ""; }, 1500);
                                  break;
                                }
                              }
                            }
                          }}
                          className="w-full text-left px-3 py-1 transition-colors hover:bg-[var(--menu-hover)] truncate"
                          style={{
                            paddingLeft: 12 + (h.level - minLevel) * 16,
                            color: h.level <= 2 ? "var(--text-primary)" : "var(--text-muted)",
                            fontWeight: h.level === 1 ? 700 : h.level === 2 ? 600 : 400,
                            fontSize: h.level === 1 ? 13 : h.level === 2 ? 12 : 11,
                          }}
                          title={h.text}
                        >
                          {h.text}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
              {/* ─── Images Panel (side-by-side, resizable) ─── */}
              {showImagePanel && isAuthenticated && (
                <div
                  className="flex flex-col shrink-0 relative"
                  data-pane="image-panel"
                  style={{ width: imagePanelWidth, background: "var(--surface)", borderLeft: "1px solid var(--border-dim)" }}
                >
                  {/* Drag handle — 6px wide, sits flush against the
                      left border. Active cursor + transparent so it
                      doesn't obstruct the content visually. */}
                  <div
                    onMouseDown={(e) => {
                      e.preventDefault();
                      isDraggingImagePanel.current = true;
                      document.body.style.cursor = "col-resize";
                      document.body.style.userSelect = "none";
                    }}
                    className="absolute top-0 bottom-0 z-10 cursor-col-resize"
                    style={{ left: -3, width: 6 }}
                    title="Drag to resize"
                    aria-label="Resize image panel"
                  />
                  {/* On hover the handle paints a thin accent line so
                      its location is discoverable. */}
                  <style>{`
                    [data-pane="image-panel"] > div[aria-label="Resize image panel"]:hover::after {
                      content: ""; position: absolute; left: 2px; top: 0; bottom: 0; width: 2px;
                      background: var(--text-primary); opacity: 0.4;
                    }
                  `}</style>
                  {/* Header */}
                  <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <div className="flex items-center gap-1.5">
                      <ImageIcon width={12} height={12} style={{ color: "var(--text-primary)" }} />
                      <span className="text-caption font-semibold" style={{ color: "var(--text-primary)" }}>Image library</span>
                      {userImages.length > 0 && <span className="text-caption px-1 rounded" style={{ background: "var(--border)", color: "var(--text-primary)" }}>{userImages.length}</span>}
                    </div>
                    <button onClick={() => setShowImagePanel(false)} className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-muted)" }} title="Close image panel">
                      <X width={10} height={10} />
                    </button>
                  </div>
                  {/* Quota bar */}
                  {imageQuota && (
                    <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                      <div className="flex items-center justify-between text-caption mb-1" style={{ color: "var(--text-faint)" }}>
                        <span>{Math.round(imageQuota.used / 1024 / 1024)}MB used</span>
                        <span>{Math.round(imageQuota.total / 1024 / 1024)}MB total</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--toggle-bg)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (imageQuota.used / imageQuota.total) * 100)}%`, background: imageQuota.used / imageQuota.total > 0.9 ? "#ef4444" : "var(--text-primary)" }} />
                      </div>
                    </div>
                  )}
                  {/* Image grid */}
                  <div className="flex-1 overflow-y-auto p-2">
                    {imagesLoading ? (
                      <div className="text-center py-8">
                        <Loader2 width={16} height={16} className="mx-auto animate-spin" style={{ color: "var(--text-faint)" }} />
                        <p className="text-caption mt-2" style={{ color: "var(--text-faint)" }}>Loading images...</p>
                      </div>
                    ) : userImages.length === 0 ? (
                      <div className="text-center py-8">
                        <ImageIcon width={24} height={24} className="mx-auto mb-2" style={{ color: "var(--border)", opacity: 0.5 }} />
                        <p className="text-caption" style={{ color: "var(--text-faint)" }}>No images yet</p>
                        <p className="text-caption mt-1" style={{ color: "var(--text-faint)", opacity: 0.6 }}>Paste or drag images into your document</p>
                      </div>
                    ) : (
                      <div
                        className="grid gap-2"
                        style={{
                          // Auto-fit columns: thumbnails stay 130px wide,
                          // count per row grows/shrinks as the panel
                          // resizes. Last row can have trailing empty
                          // cells when the column count doesn't divide
                          // userImages.length evenly — intentional.
                          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                        }}
                      >
                        {userImages.map((img) => (
                          <div
                            key={img.name}
                            className="group relative rounded-lg overflow-hidden flex flex-col"
                            style={{
                              border: "1px solid var(--border-dim)",
                              background: "var(--background)",
                            }}
                            title={img.name}
                          >
                            {/* Fixed-aspect image area so every card has the
                                same height and the action bar lines up across
                                the grid. Object-contain preserves the image. */}
                            <div
                              className="cursor-pointer relative"
                              style={{ aspectRatio: "1 / 1", background: "var(--background)" }}
                              onClick={() => setLightboxImage(img.url)}
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-contain"
                              />
                              {/* Hover hint: action icons live on the bottom
                                  bar below, but a click-to-preview affordance
                                  fades in on hover so users know the image
                                  itself is interactive. */}
                              <div
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                style={{ background: "rgba(0,0,0,0.20)" }}
                              >
                                <Eye
                                  width={20}
                                  height={20}
                                  style={{ color: "rgba(255,255,255,0.95)", strokeWidth: 1.8 }}
                                />
                              </div>
                            </div>
                            {/* Action bar — fixed position at the bottom of
                                every card thanks to the square image area. */}
                            <div
                              className="flex items-center gap-1 px-1.5 py-1.5 mt-auto"
                              style={{ borderTop: "1px solid var(--border-dim)" }}
                            >
                              {(() => {
                                // Insert only makes sense when a doc
                                // is the active surface. On Start /
                                // Hub / Galaxy there's nothing to
                                // insert INTO — show the button as
                                // disabled with an explanatory title.
                                const hasActiveDoc =
                                  !showOnboarding && !showHub && !showGalaxy && !showSettings &&
                                  activeTab?.kind !== "bundle" &&
                                  !!tabs.find(t => t.id === activeTabId && !t.deleted);
                                return (
                                  <button
                                    disabled={!hasActiveDoc}
                                    onClick={() => {
                                      if (!hasActiveDoc) return;
                                      const imgMd = `\n![${img.name.replace(/\.\w+$/, "")}](${img.url})\n`;
                                      const current = markdownRef.current;
                                      const pos = lastCursorPosRef.current || cmGetCursorPos();
                                      const insertAt = pos > 0 && pos <= current.length ? pos : current.length;
                                      const newMd = current.slice(0, insertAt) + imgMd + current.slice(insertAt);
                                      setMarkdown(newMd);
                                      doRender(newMd);
                                      cmSetDocRef.current?.(newMd);
                                      showToast("Image inserted", "success");
                                    }}
                                    className="flex-1 py-1 rounded-md text-caption font-medium transition-colors"
                                    style={{
                                      background: "transparent",
                                      color: hasActiveDoc ? "var(--text-secondary)" : "var(--text-faint)",
                                      border: "1px solid var(--border-dim)",
                                      opacity: hasActiveDoc ? 1 : 0.5,
                                      cursor: hasActiveDoc ? "pointer" : "not-allowed",
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!hasActiveDoc) return;
                                      e.currentTarget.style.background = "var(--menu-hover)";
                                      e.currentTarget.style.color = "var(--text-primary)";
                                      e.currentTarget.style.borderColor = "var(--text-primary)";
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!hasActiveDoc) return;
                                      e.currentTarget.style.background = "transparent";
                                      e.currentTarget.style.color = "var(--text-secondary)";
                                      e.currentTarget.style.borderColor = "var(--border-dim)";
                                    }}
                                    title={hasActiveDoc ? "Insert image into document" : "Open a document to insert"}
                                  >
                                    Insert
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => { navigator.clipboard.writeText(img.url); showToast("URL copied", "success"); }}
                                className="flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-[var(--menu-hover)]"
                                style={{ color: "var(--text-muted)" }}
                                title="Copy URL"
                              >
                                <Copy width={11} height={11} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm("Delete this image?")) return;
                                  try {
                                    const res = await fetch(`/api/upload/delete?name=${encodeURIComponent(img.name)}`, { method: "DELETE", headers: authHeaders });
                                    if (res.ok) {
                                      setUserImages(prev => prev.filter(i => i.name !== img.name));
                                      const data = await res.json();
                                      if (data.quota) setImageQuota(data.quota);
                                      showToast("Image deleted", "success");
                                    } else { showToast("Failed to delete", "error"); }
                                  } catch { showToast("Failed to delete", "error"); }
                                }}
                                className="flex items-center justify-center w-6 h-6 rounded-md transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[#ef4444]"
                                style={{ color: "var(--text-faint)" }}
                                title="Delete"
                              >
                                <Trash2 width={11} height={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* ─── Version History Panel (side-by-side) ─── */}
              {showHistory && docId && (
                <div
                  className="flex flex-col shrink-0"
                  style={{
                    width: "min(320px, 50%)",
                    background: "var(--surface)",
                    borderLeft: "1px solid var(--border-dim)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* History header */}
                  <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                    <div className="flex items-center gap-1.5">
                      <Clock width={12} height={12} style={{ color: "var(--text-primary)" }} />
                      <span className="text-caption font-semibold" style={{ color: "var(--text-primary)" }}>Version History</span>
                      {versions.length > 0 && (
                        <span className="text-caption px-1 rounded" style={{ background: "var(--border)", color: "var(--text-primary)" }}>{versions.length}</span>
                      )}
                    </div>
                    <button
                      onClick={() => { setShowHistory(false); setPreviewVersion(null); if (previewVersion !== null) doRender(markdown); }}
                      className="flex items-center justify-center w-5 h-5 rounded transition-colors"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X width={10} height={10} />
                    </button>
                  </div>
                  {/* Version list */}
                  <div className="flex-1 overflow-y-auto">
                    {historyLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite", color: "var(--text-primary)" }}><circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/></svg>
                      </div>
                    ) : versions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                        <Clock width={24} height={24} strokeWidth={1} style={{ color: "var(--text-faint)", marginBottom: 8 }} />
                        <p className="text-caption" style={{ color: "var(--text-muted)" }}>No versions yet</p>
                        <p className="text-caption mt-1" style={{ color: "var(--text-faint)" }}>Versions are created each time you update the document.</p>
                      </div>
                    ) : (
                      <div className="py-1">
                        {versions.map((v, i) => {
                          const isCurrent = i === 0;
                          const isPreviewing = previewVersion === v.id;
                          return (
                            <div
                              key={v.id}
                              className="px-3 py-2 transition-colors cursor-pointer"
                              style={{
                                background: isPreviewing ? "var(--border)" : "transparent",
                                borderBottom: "1px solid var(--border-dim)",
                              }}
                              onClick={() => handlePreviewVersion(v.id)}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-caption font-semibold" style={{ color: isPreviewing ? "var(--text-primary)" : "var(--text-primary)" }}>
                                    v{v.version_number}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-caption px-1 py-0.5 rounded font-semibold uppercase" style={{ background: "var(--border)", color: "var(--text-primary)" }}>Current</span>
                                  )}
                                  {isPreviewing && (
                                    <span className="text-caption px-1 py-0.5 rounded font-semibold uppercase" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>Previewing</span>
                                  )}
                                </div>
                                <span className="text-caption" style={{ color: "var(--text-faint)" }}>{relativeTime(v.created_at)}</span>
                              </div>
                              {v.change_summary && (
                                <p className="text-caption mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>{v.change_summary}</p>
                              )}
                              {v.title && (
                                <p className="text-caption mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>{v.title}</p>
                              )}
                              {/* Restore button — not shown on current version */}
                              {!isCurrent && isOwner && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRestoreVersion(v.id); }}
                                  disabled={restoringVersion === v.id}
                                  className="mt-1.5 flex items-center gap-1 h-5 px-2 rounded text-caption font-medium transition-colors"
                                  style={{ background: "var(--toggle-bg)", color: "var(--text-secondary)" }}
                                >
                                  {restoringVersion === v.id ? (
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/></svg>
                                  ) : (
                                    <RotateCcw width={10} height={10} />
                                  )}
                                  {restoringVersion === v.id ? "Restoring..." : "Restore"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>)}
          </div>
          );
        })()}

        {/* Split-view resize seam — 1px line with an invisible 5px
            hit-zone overlaying it. No grip-dot affordance; just the
            crisp line. Hidden when split-view has no source pane
            visible (bundle / hub / onboarding / settings host the
            full pane). */}
        {viewMode === "split" && !(
          (activeTab?.kind === "bundle") || showHub || showOnboarding || showSettings
        ) && (
          <div
            data-print-hide
            className={`shrink-0 relative ${isMobile ? "cursor-row-resize" : "cursor-col-resize"}`}
            style={{
              ...(isMobile
                ? { height: 1, width: "100%" }
                : { width: 1, height: "100%" }),
              background: "var(--border-dim)",
              zIndex: 5,
            }}
            onMouseDown={(e) => { e.preventDefault(); isDraggingSplit.current = true; }}
            onTouchStart={() => { isDraggingSplit.current = true; }}
          >
            {/* Invisible drag hit-zone, centered on the 1px line */}
            <div
              className="absolute"
              style={isMobile
                ? { left: 0, right: 0, top: -3, height: 7, background: "transparent" }
                : { top: 0, bottom: 0, left: -3, width: 7, background: "transparent" }}
            />
          </div>
        )}

        {/* Markdown pane (right/bottom) — always in DOM, hidden via
            CSS to keep CM6 alive. Hidden when viewMode is "preview"
            OR when the editor area is hosting a non-doc surface (a
            bundle / hub / onboarding / settings overlay has no
            markdown source to show). */}
        <div
          data-pane="editor"
          className="flex-1 flex flex-col min-h-0"
          style={{ display:
            (viewMode === "preview")
              || (activeTab?.kind === "bundle") || showHub || showGalaxy || showOnboarding || showSettings
              ? "none" : undefined,
            minWidth: viewMode === "split" && !isMobile ? 280 : undefined,
            overflow: viewMode === "split" && isMobile ? "hidden" : undefined,
          }}
        >
            <div
              className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 text-caption font-mono uppercase tracking-normal select-none"
              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-dim)", cursor: "default" }}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="shrink-0" style={{ color: "var(--text-primary)" }}>SOURCE</span>
                {/* Flavor badge — click to convert */}
                <div className="relative">
                  <button
                    onClick={() => setShowFlavorMenu(!showFlavorMenu)}
                    className="px-1.5 py-0.5 rounded font-mono cursor-pointer transition-colors hover:brightness-110"
                    style={{ background: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {flavor.toUpperCase()} ▾
                  </button>
                  {showFlavorMenu && (
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setShowFlavorMenu(false)} />
                      <div className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-xl py-1 z-[9999]"
                        style={{ background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                        <div className="px-3 py-1 text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                          Current: {{ gfm: "GitHub Flavored", commonmark: "CommonMark", obsidian: "Obsidian", mdx: "MDX", pandoc: "Pandoc" }[flavor] || flavor}
                        </div>
                        <div className="my-1" style={{ borderTop: "1px solid var(--border-dim)" }} />
                        <div className="px-3 py-1 text-caption uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Convert to</div>
                        {[
                          { id: "gfm", name: "GFM (GitHub)", desc: "Tables, task lists, strikethrough, autolinks" },
                          { id: "commonmark", name: "CommonMark", desc: "Standard Markdown — maximum compatibility" },
                          { id: "obsidian", name: "Obsidian", desc: "Wikilinks, callouts, embeds" },
                        ].filter(f => f.id !== flavor).map(target => (
                          <button
                            key={target.id}
                            onClick={async (e) => {
                              const md = markdownRef.current;
                              let converted = md;
                              // Conversion rules
                              if (flavor === "obsidian" && target.id !== "obsidian") {
                                // [[wikilinks]] → [text](text)
                                converted = converted.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "[$2]($1)");
                                converted = converted.replace(/\[\[([^\]]+)\]\]/g, "[$1]($1)");
                                // > [!note] callouts → > **Note:**
                                converted = converted.replace(/^>\s*\[!(\w+)\]\s*(.*)$/gm, "> **$1:** $2");
                              }
                              if (target.id === "obsidian" && flavor !== "obsidian") {
                                // [text](url) where text === url → [[text]]
                                converted = converted.replace(/\[([^\]]+)\]\(\1\)/g, "[[$1]]");
                              }
                              if (flavor === "mdx") {
                                // Remove JSX components
                                converted = converted.replace(/<[A-Z]\w+[^>]*\/>/g, "");
                                converted = converted.replace(/<[A-Z]\w+[^>]*>[\s\S]*?<\/[A-Z]\w+>/g, "");
                                // Remove import statements
                                converted = converted.replace(/^import\s+.*$/gm, "");
                                // Remove export default
                                converted = converted.replace(/^export\s+default\s+.*$/gm, "");
                              }
                              if (target.id === "commonmark") {
                                // Strikethrough ~~text~~ → text (not in CommonMark)
                                converted = converted.replace(/~~([^~]+)~~/g, "$1");
                                // Task lists → plain lists
                                converted = converted.replace(/^(\s*)- \[[ x]\] /gm, "$1- ");
                              }
                              // Clean up excessive blank lines
                              converted = converted.replace(/\n{3,}/g, "\n\n").trim();
                              if (converted === md) {
                                // Nothing to convert — show inline feedback on the clicked button
                                const btn = e.currentTarget as HTMLElement;
                                const orig = btn.innerHTML;
                                btn.innerHTML = `<div style="color:var(--text-primary);font-size:10px;padding:4px 0;text-align:center;font-weight:600">Already compatible</div>`;
                                setTimeout(() => { btn.innerHTML = orig; }, 1500);
                                return;
                              }
                              setShowFlavorMenu(false);
                              setMarkdown(converted);
                              cmSetDoc(converted);
                              doRender(converted);
                            }}
                            className="w-full text-left px-3 py-1.5 text-caption transition-colors hover:bg-[var(--menu-hover)]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <div style={{ color: "var(--text-primary)" }}>{target.name}</div>
                            <div className="text-caption" style={{ color: "var(--text-faint)" }}>{target.desc}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {Object.entries(flavorDetails).filter(([,v])=>v).map(([key]) => (
                  <div key={key} className="relative group hidden sm:block">
                    <span className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--badge-muted-bg)", color: "var(--badge-muted-color)" }}>+{key}</span>
                    <div className="absolute top-full left-0 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                      {key === "math" ? "Math equations detected (KaTeX)" : key === "mermaid" ? "Mermaid diagrams detected" : key === "wikilinks" ? "Wiki-style links detected" : key === "jsx" ? "JSX/MDX syntax detected" : `${key} detected`}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 normal-case shrink-0 flex-nowrap">
                {/* Wide view toggle — narrow is default. */}
                <div className="relative group" style={{ display: isMobile || editorPaneUnderNarrowWidth ? "none" : undefined }}>
                  <button
                    onClick={() => setNarrowSource(!narrowSource)}
                    className="flex items-center justify-center h-6 w-6 rounded-md transition-colors"
                    style={{ background: !narrowSource ? "var(--border)" : "transparent", color: !narrowSource ? "var(--text-primary)" : "var(--text-faint)" }}
                    title={`Wide view ${!narrowSource ? "ON" : "OFF"}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 4v8M14 4v8M1 8h14" strokeLinecap="round"/><path d="M5 6L3 8l2 2M11 6l2 2-2 2" strokeLinecap="round"/></svg>
                  </button>
                  <div className="absolute top-full right-0 mt-1.5 w-44 p-2.5 rounded-lg text-caption leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>
                    <p style={{ color: !narrowSource ? "var(--text-primary)" : "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>Wide View {!narrowSource ? "ON" : "OFF"}</p>
                    <p>Default: narrow, comfortable editing width. Click to expand.</p>
                  </div>
                </div>
                {/* Copy MD */}
                <div className="relative group">
                  <button
                    onClick={() => { navigator.clipboard.writeText(markdownRef.current); }}
                    className="flex items-center justify-center h-6 px-2 rounded-md transition-colors"
                    style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
                  >
                    <Copy width={11} height={11} />
                  </button>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>Copy raw Markdown</div>
                </div>
                {/* Download .md */}
                <div className="relative group">
                  <button
                    onClick={handleDownloadMd}
                    className="flex items-center justify-center h-6 px-2 rounded-md transition-colors"
                    style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
                  >
                    <Download width={11} height={11} />
                  </button>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>Download as .md file</div>
                </div>
              </div>
            </div>
            <div
              className="flex-1 min-h-0"
              style={narrowSource ? { paddingLeft: "max(0px, calc(50% - 384px))", paddingRight: "max(0px, calc(50% - 384px))" } : undefined}
            >
              <div
                ref={editorContainerRef}
                className="h-full"
              />
            </div>
          </div>
        </>)}
      </div>
      </div>{/* end main content wrapper */}

      {/* Inline input popup (replaces all prompt() dialogs) */}
      {inlineInput && (
        <InlineInput
          label={inlineInput.label}
          defaultValue={inlineInput.defaultValue}
          onSubmit={inlineInput.onSubmit}
          onCancel={() => setInlineInput(null)}
          position={inlineInput.position}
        />
      )}

      {/* Footer — Left: Help + links, Right: stats + badges */}
      <footer
        className="flex items-center justify-between px-3 sm:px-5 py-1.5 text-caption font-mono"
        style={{ borderTop: "1px solid var(--border-dim)", color: "var(--text-muted)" }}
      >
        {/* Left: Alpha badge + Help + navigation */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Tooltip text="memory.wiki is in alpha — features can change and bugs are expected. Send feedback to hi@raymind.ai." position="top">
            <span
              className="inline-flex items-center font-semibold uppercase shrink-0"
              style={{
                color: "var(--text-primary)",
                background: "var(--border)",
                border: "1px solid var(--text-primary)",
                letterSpacing: "0.06em",
                fontSize: 8,
                padding: "1px 4px",
                borderRadius: 3,
                lineHeight: 1.1,
              }}
            >
              Alpha
            </span>
          </Tooltip>
          <div className="relative group"
            onClick={(e) => {
              // Mobile: toggle help tooltip on tap (hover doesn't work on touch)
              const tooltip = (e.currentTarget.querySelector("[data-help-tooltip]") as HTMLElement);
              if (!tooltip) return;
              const showing = tooltip.style.opacity === "1";
              tooltip.style.opacity = showing ? "0" : "1";
              tooltip.style.pointerEvents = showing ? "none" : "auto";
              if (!showing) {
                const dismiss = (ev: MouseEvent) => { if (!tooltip.contains(ev.target as Node)) { tooltip.style.opacity = "0"; tooltip.style.pointerEvents = "none"; document.removeEventListener("click", dismiss); } };
                requestAnimationFrame(() => document.addEventListener("click", dismiss));
              }
            }}
          >
            <button className="transition-colors" style={{ color: "var(--text-muted)" }} title="Keyboard shortcuts and help">Help</button>
            <div data-help-tooltip className="absolute bottom-full left-0 mb-1 w-72 max-w-[90vw] p-3 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
              <p className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Keyboard Shortcuts</p>
              <div className="space-y-1 text-caption">
                {[
                  [`${mod}+B`, "Bold"],
                  [`${mod}+I`, "Italic"],
                  [`${mod}+K`, "Insert link"],
                  [`${mod}+S`, "Share / copy URL"],
                  [`${mod}+Shift+C`, "Copy as HTML"],
                  [`${mod}+Z`, "Undo"],
                  [`${mod}+Shift+Z`, "Redo"],
                  [`${mod}+\\`, "Toggle view mode"],
                  ["Escape", "Focus markdown editor"],
                  ["Dbl-click code", "Edit code block"],
                  ["Dbl-click math", "Edit equation"],
                  ["Dbl-click diagram", "Edit diagram"],
                  ["Dbl-click table", "Edit cell"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex justify-between">
                    <span style={{ color: "var(--text-faint)" }}>{key}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
              <div className="my-2" style={{ borderTop: "1px solid var(--border-dim)" }} />
              <p className="font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Import</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {["MD", "PDF", "DOCX", "PPTX", "XLSX", "HTML", "CSV", "LaTeX", "RST", "RTF", "JSON", "XML", "TXT"].map(f => (
                  <span key={f} className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--border)", color: "var(--text-primary)", fontSize: 9 }}>{f}</span>
                ))}
              </div>
              <p className="text-caption" style={{ color: "var(--text-faint)" }}>Drag & drop or use IMPORT in sidebar</p>
              <div className="my-2" style={{ borderTop: "1px solid var(--border-dim)" }} />
              <p className="font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>Export</p>
              <div className="space-y-0.5 text-caption">
                {[
                  ["Download", "MD, HTML, TXT"],
                  ["Print", "PDF"],
                  ["Clipboard", "HTML, Rich Text, Slack, Plain"],
                ].map(([cat, fmts]) => (
                  <div key={cat} className="flex justify-between">
                    <span style={{ color: "var(--text-faint)" }}>{cat}</span>
                    <span>{fmts}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button onClick={() => { setShowCommandPalette(true); setCmdSearch(""); }} className="transition-colors hidden sm:inline-flex items-center gap-1" style={{ color: "var(--text-faint)", background: "none", border: "1px solid var(--border-dim)", borderRadius: 4, padding: "1px 6px", fontSize: 10, cursor: "pointer" }} title="Command palette">
            <span style={{ fontSize: 10 }}>{navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl+"}K</span>
          </button>
          <a href="/about" className="transition-colors inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="About memory.wiki">About</a>
          <a href="/plugins" className="transition-colors hidden sm:inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="Browser and editor plugins">Plugins</a>
          <a href="/discover" className="transition-colors hidden md:inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="Trending public documents">Trending</a>
          <a href="/docs" className="transition-colors hidden md:inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="API documentation">API</a>
          <a href="/privacy" className="transition-colors hidden lg:inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="Privacy policy">Privacy</a>
          <a href="/terms" className="transition-colors hidden lg:inline" style={{ color: "var(--text-muted)" }} target="_blank" rel="noopener noreferrer" title="Terms of service">Terms</a>
        </div>
        {/* Right: stats + engine badges — tap to expand on mobile.
            Stats only render when the editor is showing an actual
            doc. Start / Hub / Settings / Bundle surfaces have no
            markdown to count, so "0 words 0 chars 1 lines" was just
            visual noise. */}
        {!showOnboarding && !showHub && !showGalaxy && !showSettings && activeTab?.kind !== "bundle" && (
        <div className="flex items-center gap-3 shrink-0">
          {/* Desktop: always visible */}
          <span className="hidden sm:inline">{wordCount.toLocaleString()} words</span>
          <span className="hidden sm:inline">{charCount.toLocaleString()} chars</span>
          <span className="hidden sm:inline">{lineCount.toLocaleString()} lines</span>
          {/* Mobile: compact tap-to-expand */}
          <button
            className="sm:hidden flex items-center gap-1"
            style={{ color: "var(--text-muted)" }}
            title="Document statistics"
            onClick={(e) => {
              const el = e.currentTarget.nextElementSibling as HTMLElement;
              if (!el) return;
              const showing = el.style.display === "flex";
              el.style.display = showing ? "none" : "flex";
              if (!showing) {
                const dismiss = () => { el.style.display = "none"; document.removeEventListener("click", dismiss); };
                requestAnimationFrame(() => document.addEventListener("click", dismiss));
              }
            }}
          >
            <AlignLeft width={10} height={10} />
            {wordCount.toLocaleString()}w
          </button>
          <div className="sm:hidden flex items-center gap-2 absolute bottom-full right-3 mb-1 px-3 py-1.5 rounded-lg" style={{ display: "none", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
            <span>{wordCount.toLocaleString()} words</span>
            <span>{charCount.toLocaleString()} chars</span>
            <span>{lineCount.toLocaleString()} lines</span>
          </div>
          {/* Engine-self-advertising "RUST+WASM" chip removed from the
              editor footer. The v6 message is outcome-shaped ("personal
              knowledge hub for AI") and most SMB users don't care which
              parser powers the renderer; the chip read as engineering
              vanity inside a workspace surface. The same claim still
              lives on /mdcore-ai and /docs/sdk for the developer
              audience where it earns the slot.
              Keep the render-time ms readout — that's real information
              users can act on (slow render → maybe a long mermaid or
              math block to investigate). */}
          <div className="relative group hidden sm:block">
            <span className="flex items-center gap-0.5" style={{ color: "var(--text-primary)" }}>
              <Zap width={10} height={10} fill="currentColor" stroke="none" />
              {renderTime.toFixed(0)}ms
            </span>
            <div className="absolute bottom-full right-0 mb-1 px-2 py-1 rounded text-caption whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[9998]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
              Render time
            </div>
          </div>
        </div>
        )}
      </footer>

      {/* Document context menu */}
      {docContextMenu && (
        <div
          // Force a remount on every folders mutation. The IIFE below
          // re-reads `folders` from state on every render, but user
          // reports new/renamed folders weren't appearing in the
          // Move-to submenu — likely a React reconciliation quirk
          // around the nested submenu div whose visibility is driven
          // by CSS :hover (`opacity-0 ... group-hover/sub:opacity-100`)
          // rather than React state. Keying the whole menu on a
          // fingerprint of folders' ids + names guarantees a fresh
          // subtree any time folders change.
          key={`docmenu-${folders.map(f => `${f.id}:${f.name}`).join("|")}`}
          className="fixed rounded-lg shadow-xl py-1"
          // Initial position uses the raw click coordinates. The ref
          // callback below measures the actual rendered bounds and
          // flips the menu up/left when it overflows the viewport —
          // right-clicking the bottom-most row no longer clips the
          // bottom of the menu.
          style={{
            left: docContextMenu.x,
            top: docContextMenu.y,
            zIndex: 9999,
            background: "var(--menu-bg)",
            border: "1px solid var(--border)",
            width: 160,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
          ref={(el) => {
            if (!el) return;
            const r = el.getBoundingClientRect();
            const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
            const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
            if (r.right > vw) el.style.left = `${Math.max(4, vw - r.width - 4)}px`;
            if (r.bottom > vh) el.style.top = `${Math.max(4, vh - r.height - 4)}px`;
          }}
        >
          {(() => {
            const isExample = tabs.find(t => t.id === docContextMenu.tabId)?.ownerEmail === EXAMPLE_OWNER;
            const targetTab = tabs.find(t => t.id === docContextMenu.tabId);
            const isSharedWithMe = targetTab?.permission === "readonly" || targetTab?.permission === "editable";
            return isExample ? [
              { label: "Duplicate to my MDs", action: () => {
                if (targetTab) {
                  const id = `tab-${tabIdCounter++}`;
                  const t = `${targetTab.title} (copy)`;
                  setTabs(prev => [...prev, { id, title: t, markdown: targetTab.markdown, permission: "mine", shared: false, isDraft: true }]);
                  autoSave.createDocument({ markdown: targetTab.markdown, title: t, userId: user?.id, anonymousId: !user?.id ? ensureAnonymousId() : undefined }).then(result => {
                    if (result) {
                      setTabs(prev => prev.map(x => x.id === id ? { ...x, cloudId: result.id, editToken: result.editToken } : x));
                      queueMicrotask(() => switchTab(id));
                    } else {
                      switchTab(id);
                    }
                  });
                }
              }},
              { label: "Download .md", action: () => {
                if (targetTab) {
                  const blob = new Blob([targetTab.markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${targetTab.title || "document"}.md`; a.click();
                  URL.revokeObjectURL(url);
                }
              }},
              { label: "Hide example", action: () => {
                setHiddenExampleIds(prev => new Set([...prev, docContextMenu.tabId]));
                if (docContextMenu.tabId === activeTabId) {
                  const fb = pickFallbackTabAfterDelete(new Set([docContextMenu.tabId]));
                  if (fb) switchTab(fb); else switchToStartSurface();
                }
              }},
            ] : isSharedWithMe ? [
              { label: "Duplicate", action: () => {
                if (targetTab) {
                  const id = `tab-${tabIdCounter++}`;
                  const t = targetTab.title + " (copy)";
                  // Splice the "(copy)" suffix into the body's H1 too.
                  // Server's title invariant rewrites DB title from the
                  // H1, so without this the duplicate would land with
                  // title === source title → dedup hit → original tab
                  // removed by withoutDup filter below.
                  const dupMd = rewriteH1(targetTab.markdown, t);
                  // Bulletproof newest-first sort: take max(all existing) + 1.
                  const maxLastOpenedAt = Math.max(Date.now(), ...tabs.map(x => x.lastOpenedAt ?? 0));
                  const newLastOpenedAt = maxLastOpenedAt + 1;
                  setTabs(prev => [...prev, { id, title: t, markdown: dupMd, permission: "mine", shared: false, isDraft: true, lastOpenedAt: newLastOpenedAt }]);
                  showToast(`Duplicating "${targetTab.title}"…`, "info");
                  setTimeout(() => switchTab(id), 50);
                  autoSave.createDocument({ markdown: dupMd, title: t, userId: user?.id, anonymousId: !user?.id ? ensureAnonymousId() : undefined }).then(result => {
                    if (!result) {
                      showToast("Duplicate failed — try again", "error");
                      return;
                    }
                    if (result.deduplicated) {
                      // Server collapsed our copy into an existing doc.
                      // Drop the phantom tab and switch to the survivor.
                      setTabs(prev => prev.filter(x => x.id !== id));
                      showToast("Duplicate already exists — opened existing copy", "info");
                      const existing = tabs.find(x => x.cloudId === result.id);
                      if (existing) switchTab(existing.id);
                      return;
                    }
                    setTabs(prev => prev.map(x => x.id === id ? { ...x, cloudId: result.id, editToken: result.editToken } : x));
                    showToast(`Duplicated "${targetTab.title}"`, "success");
                  });
                }
              }},
              { label: "Download .md", action: () => {
                if (targetTab) {
                  const blob = new Blob([targetTab.markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${targetTab.title || "document"}.md`; a.click();
                  URL.revokeObjectURL(url);
                }
              }},
              { label: "Remove from list", action: async () => {
                // For shared docs (the user is a recipient, not the
                // owner), 'Remove from list' must actually drop their
                // email from allowed_emails on the server. Otherwise
                // the doc keeps reappearing on the next /api/user/
                // recent refresh, and the realtime channel still
                // pushes 'updated elsewhere' toasts while it's open.
                const target = tabs.find(t => t.id === docContextMenu.tabId);
                if (target?.cloudId && user?.email) {
                  try {
                    await fetch(`/api/docs/${target.cloudId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", ...authHeaders },
                      body: JSON.stringify({ action: "leave-share", userEmail: user.email }),
                    });
                  } catch { /* best-effort, still dismiss locally */ }
                  // Also refresh the Shared-with-me feed so the row
                  // doesn't reappear from /api/user/recent on the next
                  // hydration.
                  fetch("/api/user/recent", { headers: authHeaders })
                    .then(r => (r.ok ? r.json() : null))
                    .then(d => { if (d?.recent) setRecentDocs(d.recent.filter((x: { isOwner: boolean }) => !x.isOwner)); })
                    .catch(() => {});
                }
                setTabs(prev => prev.filter(t => t.id !== docContextMenu.tabId));
                if (docContextMenu.tabId === activeTabId) {
                  const fb = pickFallbackTabAfterDelete(new Set([docContextMenu.tabId]));
                  if (fb) switchTab(fb); else switchToStartSurface();
                }
              }, danger: true },
            ] : [
              { label: "Rename", action: () => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (!tab) return;
                // Flip the matching sidebar row into inline-edit mode.
                // The commit handler (in the docs <SidebarFolderTree>
                // mount) updates tab title + splices the body H1.
                setRenamingItem({ kind: "tab", id: tab.id });
              }},
              ...(() => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (!tab?.cloudId) return [];
                const pinned = isPinned("document", tab.cloudId);
                return [{
                  label: pinned ? "Unstar" : "Star",
                  action: () => { void togglePin("document", tab.cloudId!); },
                }];
              })(),
              { label: "Duplicate", action: () => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (tab) {
                  const id = `tab-${tabIdCounter++}`;
                  const t = tab.title + " (copy)";
                  // Splice "(copy)" into the body H1 so the server's
                  // title invariant lands DB.title = "X (copy)". Without
                  // this the server recomputes title from H1 ("X") and
                  // the dedup helper matches the original — returning
                  // the original's id, then withoutDup below would
                  // delete the original tab.
                  const dupMd = rewriteH1(tab.markdown, t);
                  // GUARANTEE the duplicate beats every existing tab's
                  // lastOpenedAt in the "newest first" sort. Plain
                  // Date.now() was sometimes equal to a tab opened in
                  // the same ms (or got beaten by an incoming server
                  // sync's updated_at). Take max(all existing) + 1
                  // explicitly.
                  const maxLastOpenedAt = Math.max(Date.now(), ...tabs.map(x => x.lastOpenedAt ?? 0));
                  const newLastOpenedAt = maxLastOpenedAt + 1;
                  setTabs(prev => [...prev, { id, title: t, markdown: dupMd, permission: "mine", shared: false, isDraft: true, lastOpenedAt: newLastOpenedAt }]);
                  // Immediate visible feedback — the server round-trip
                  // can take 1-3s and users were left wondering if the
                  // click did anything.
                  showToast(`Duplicating "${tab.title}"…`, "info");
                  // Switch to the new tab right away so the user lands
                  // in the duplicate as it saves (matches the "+New
                  // Document" UX). Tiny setTimeout to let setTabs flush.
                  setTimeout(() => switchTab(id), 50);
                  autoSave.createDocument({
                    markdown: dupMd,
                    title: t,
                    userId: user?.id,
                    anonymousId: !user?.id ? ensureAnonymousId() : undefined,
                  }).then(result => {
                    if (!result) {
                      showToast("Duplicate failed — try again", "error");
                      return;
                    }
                    if (result.deduplicated) {
                      // Server collapsed the copy into an existing doc
                      // (likely a race or stale state). Drop the
                      // phantom new tab and never strip the original.
                      setTabs(prev => prev.filter(x => x.id !== id));
                      showToast("Duplicate already exists — opened existing copy", "info");
                      const existing = tabs.find(x => x.cloudId === result.id);
                      if (existing) switchTab(existing.id);
                      return;
                    }
                    setTabs(prev => {
                      // Only strip prior phantom drafts (no cloudId yet)
                      // that happen to share the resolved cloudId.
                      // Never strip a tab the user already had open.
                      const withoutDup = prev.filter(x => !(x.cloudId === result.id && x.id !== id && x.isDraft && !x.cloudId));
                      return withoutDup.map(x => x.id === id ? { ...x, cloudId: result.id, editToken: result.editToken } : x);
                    });
                    showToast(`Duplicated "${tab.title}"`, "success");
                  });
                }
              }},
              { label: "Share", action: () => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (tab) { switchTab(tab.id); setTimeout(() => handleShare(), 100); }
              }},
              // Create a new bundle. When the user has multi-selected
              // tabs AND the right-clicked tab is part of the
              // selection, batch the whole selection into one bundle
              // with an auto-suggested title. Otherwise fall back to
              // a single-doc seed.
              ...((() => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (!tab?.cloudId) return [];
                const selectedInMenu = selectedTabIds.has(tab.id);
                const multiTabs = (selectedInMenu && selectedTabIds.size > 1)
                  ? tabs.filter(t => selectedTabIds.has(t.id) && t.cloudId && !t.deleted && t.kind !== "bundle")
                  : [];
                if (multiTabs.length > 1) {
                  const docs = multiTabs.map(t => ({ id: t.cloudId!, title: t.title || "Untitled" }));
                  return [{ label: `Bundle these ${multiTabs.length} docs…`, action: () => {
                    setBundleCreatorDocs(docs);
                    setShowMyBundles(true);
                    setShowBundleCreator(true);
                    setSelectedTabIds(new Set());
                  }}];
                }
                return [{ label: "Create bundle…", action: () => {
                  setBundleCreatorDocs([{ id: tab.cloudId!, title: tab.title || "Untitled" }]);
                  setShowMyBundles(true);
                  setShowBundleCreator(true);
                }}];
              })()),
              { label: "Download .md", action: () => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (tab) {
                  const blob = new Blob([tab.markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `${tab.title || "document"}.md`; a.click();
                  URL.revokeObjectURL(url);
                }
              }},
              ...(() => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (!tab?.cloudId || !user?.id) return [];
                return [{ label: "Re-analyze concepts", action: async () => {
                  try {
                    const res = await fetch(`/api/docs/${tab.cloudId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", ...authHeaders },
                      body: JSON.stringify({ action: "refresh-concepts", userId: user.id }),
                    });
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}));
                      showToast(j.error || "Couldn't re-analyze", "error");
                      return;
                    }
                    showToast(`Re-analyzing "${tab.title || "Untitled"}".`, "success");
                  } catch {
                    showToast("Couldn't re-analyze", "error");
                  }
                }}];
              })(),
              ...(() => {
                const tab = tabs.find(t => t.id === docContextMenu.tabId);
                if (!tab?.cloudId || !tab.source) return [];
                return [{ label: "Unsync", action: async () => {
                  try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (tab.editToken) headers["x-edit-token"] = tab.editToken;
                    if (user?.id) headers["x-user-id"] = user.id;
                    await fetch(`/api/docs/${tab.cloudId}`, {
                      method: "PATCH",
                      headers,
                      body: JSON.stringify({ action: "clear-source", editToken: tab.editToken, userId: user?.id }),
                    });
                    setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, source: undefined } : t));
                  } catch {}
                }}];
              })(),
              // Compiled-doc actions live as an inline banner inside
              // the doc body now (CompiledDocBanner). The kebab is
              // for generic doc actions only — Recompile is too heavy
              // and "Open source bundle" too domain-specific to bury
              // here.
              ...(folders.filter(f => !f.section || f.section === "my").length > 0 || tabs.find(t => t.id === docContextMenu.tabId)?.folderId ? [
                { label: "---", action: () => {} },
                { label: "Move to", action: () => {}, submenu: [
                  ...folders.filter(f => !f.section || f.section === "my").map(f => ({
                    id: `folder:${f.id}`,
                    label: f.name,
                    action: () => setTabs(prev => prev.map(t => t.id === docContextMenu.tabId ? { ...t, folderId: f.id } : t)),
                  })),
                  ...(tabs.find(t => t.id === docContextMenu.tabId)?.folderId ? [{
                    id: "folder:root",
                    label: "Root (no folder)",
                    action: () => setTabs(prev => prev.map(t => t.id === docContextMenu.tabId ? { ...t, folderId: undefined } : t)),
                  }] : []),
                ]},
              ] : []),
              ...(tabs.filter(t => !t.deleted).length > 1 ? [
                { label: "---", action: () => {} },
                { label: "Move to Trash", action: () => {
                  const trashTab = tabs.find(t => t.id === docContextMenu.tabId);
                  if (trashTab) softDeleteOnServer(trashTab);
                  setTabs(prev => prev.map(t => t.id === docContextMenu.tabId ? { ...t, deleted: true, deletedAt: Date.now() } : t));
                  if (docContextMenu.tabId === activeTabId) {
                    const fb = pickFallbackTabAfterDelete(new Set([docContextMenu.tabId]));
                    if (fb) switchTab(fb); else switchToStartSurface();
                  }
                }, danger: true },
              ] : []),
            ];
          })().map((item, i) => {
            const it = item as { label: string; action: () => void; danger?: boolean; submenu?: { id?: string; label: string; action: () => void }[] };
            if (it.label === "---") {
              return <div key={`sep-${i}`} className="my-1" style={{ borderTop: "1px solid var(--border-dim)" }} />;
            }
            if (it.submenu) {
              return (
                <div key={it.label} className="relative group/sub">
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)] flex items-center justify-between"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {it.label}
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
                  </button>
                  <div
                    className="absolute top-0 ml-1 min-w-[140px] rounded-lg shadow-xl py-1 opacity-0 pointer-events-none group-hover/sub:opacity-100 group-hover/sub:pointer-events-auto transition-opacity z-[10001]"
                    style={{ left: "100%", background: "var(--menu-bg)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", ...(docContextMenu && docContextMenu.x > window.innerWidth - 400 ? { left: "auto", right: "100%", marginLeft: 0, marginRight: 4 } : {}) }}
                    ref={(el) => { if (el) { const r = el.getBoundingClientRect(); if (r.right > window.innerWidth) { el.style.left = "auto"; el.style.right = "100%"; el.style.marginLeft = "0"; el.style.marginRight = "4px"; } } }}
                  >
                    {it.submenu.map((sub, si) => (
                      <button
                        key={sub.id ?? `${sub.label}-${si}`}
                        onClick={() => { sub.action(); setDocContextMenu(null); }}
                        className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <button
                key={it.label}
                onClick={() => { it.action(); setDocContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: it.danger ? "#ef4444" : "var(--text-secondary)" }}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      )}

      {/* memory.wiki AI structuring prompt */}
      {/* Sign In / Sign Up modal — Pure redesign:
          - MW brand symbol (morph blob) anchors the top so the
            dialog reads as memory.wiki and not generic OAuth glue
          - Title in Cal Sans 500 (no more 700 bold)
          - OAuth buttons: pure outlined pills with brand glyph in
            its own color, NOT a bright vendor-blue fill
          - Email + Send merged into one bordered group (no separate
            button hex chip)
          - Footnote: no em-dash, "What you get" demoted to text-link
            with ArrowUpRight */}
      {showAuthMenu && !isAuthenticated && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={() => { setShowAuthMenu(false); setAuthEmailSent(false); setAuthEmailMode(false); }}
        >
          <div
            className="rounded-2xl w-[420px] max-w-full"
            style={{ background: "var(--canvas)", border: "1px solid var(--border-dim)", boxShadow: "0 20px 80px rgba(0,0,0,0.45)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cleaner layout: brand lockup at top, 4 identical
                outlined pills (Google / Apple / GitHub / Email) in
                one column, no "or with email" divider, no marketing
                subtitle, minimal footer. Email pill expands inline
                so the modal never reflows between two layouts. */}
            <div className="px-6 pt-7 pb-3 text-center">
              <div className="mx-auto flex items-center justify-center">
                <MemoryWikiLogo size={26} variant="full" />
              </div>
            </div>

            {!authEmailMode && !authEmailSent && (
              <div className="px-6 pt-3 pb-5 space-y-2">
                {/* All four buttons share the same shape:
                      [18px icon slot] gap [centered text label]
                    The icon slot is a fixed inline-flex box so every
                    SVG lands at the SAME column regardless of its
                    intrinsic viewBox padding. Bumped from 15px → 18px
                    so the icons stop looking undersized against the
                    13px label. */}
                <button
                  onClick={() => { signInWithGoogle(); setShowAuthMenu(false); }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
                >
                  <span className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-13l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28.4l-6.6 5A20 20 0 0 0 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.6l6.2 5.2C39.9 36 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
                    </svg>
                  </span>
                  Continue with Google
                </button>
                <button
                  onClick={() => { signInWithApple(); setShowAuthMenu(false); }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
                >
                  <span className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                    {/* Apple SVG renders with empty top space at default
                        viewBox; nudge baseline down 0.5px so the visual
                        center matches the Google / GitHub / mail icons. */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ transform: "translateY(-0.5px)" }}>
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                  </span>
                  Continue with Apple
                </button>
                <button
                  onClick={() => { signInWithGitHub(); setShowAuthMenu(false); }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
                >
                  <span className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.02 0c2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </span>
                  Continue with GitHub
                </button>
                <button
                  onClick={() => setAuthEmailMode(true)}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-full transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
                >
                  <span className="inline-flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="m3 7 9 6 9-6"/>
                    </svg>
                  </span>
                  Continue with email
                </button>
              </div>
            )}

            {authEmailMode && !authEmailSent && (
              <div className="px-6 pt-3 pb-5">
                <div
                  className="flex items-stretch rounded-full overflow-hidden"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <input
                    type="email"
                    autoFocus
                    placeholder="you@email.com"
                    value={authEmailInput}
                    onChange={(e) => setAuthEmailInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && authEmailInput.trim()) {
                        const result = await signInWithEmail(authEmailInput.trim());
                        if (!result.error) {
                          const instant = (result as { instant?: boolean }).instant;
                          if (!instant) setAuthEmailSent(true);
                          else setShowAuthMenu(false);
                        }
                      }
                    }}
                    className="flex-1 min-w-0 px-4 py-2 outline-none"
                    style={{ background: "transparent", color: "var(--text-primary)", fontSize: 13 }}
                  />
                  <button
                    onClick={async () => {
                      if (authEmailInput.trim()) {
                        const result = await signInWithEmail(authEmailInput.trim());
                        if (!result.error) {
                          const instant = (result as { instant?: boolean }).instant;
                          if (!instant) setAuthEmailSent(true);
                          else setShowAuthMenu(false);
                        }
                      }
                    }}
                    className="shrink-0 px-4 transition-colors"
                    style={{ background: "var(--text-primary)", color: "var(--background)", fontSize: 13, fontWeight: 500 }}
                  >
                    Send link
                  </button>
                </div>
                <button
                  onClick={() => setAuthEmailMode(false)}
                  className="mt-3 text-caption transition-colors hover:underline"
                  style={{ color: "var(--text-muted)", fontSize: 12 }}
                >
                  Back to all sign-in options
                </button>
              </div>
            )}

            {authEmailSent && (
              <div className="px-6 pt-3 pb-5">
                <div
                  className="text-center py-3 rounded-lg inline-flex items-center justify-center gap-2 w-full"
                  style={{ background: "rgba(181, 255, 26, 0.10)", color: "var(--micro-lime)", border: "1px solid rgba(181, 255, 26, 0.25)", fontSize: 13 }}
                >
                  Check your email for the login link
                </div>
              </div>
            )}

            <div className="px-6 pb-5 pt-1 flex items-center justify-between" style={{ color: "var(--text-faint)" }}>
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.04em" }}>
                Free during beta, no card.
              </span>
              <button
                onClick={() => { setShowAuthMenu(false); window.open("/pricing", "_blank"); }}
                className="inline-flex items-center gap-1 transition-colors hover:underline"
                style={{ color: "var(--text-muted)", fontSize: 12 }}
              >
                What you get
                <ArrowUpRight width={11} height={11} />
              </button>
            </div>
          </div>
        </div>
      )}

      {mwPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }} onClick={() => !mwLoading && setMdfyPrompt(null)}>
          <div className="rounded-xl p-5 w-80" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}><span style={{ color: "var(--text-primary)" }}>memory.wiki</span> this document?</span>
              <span className="text-caption font-mono" style={{ color: "var(--text-muted)" }}>
                {(mwPrompt.text.length / 1024).toFixed(0)} KB
              </span>
            </div>
            <p className="text-caption mb-2" style={{ color: "var(--text-muted)" }}>
              This file was imported as raw text — all formatting (headings, lists, tables, emphasis) was lost during extraction.
            </p>
            <p className="text-caption mb-4" style={{ color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text-primary)" }}>memory.wiki</strong> uses AI to detect the original structure and rebuild it as clean Markdown — headings, bullet points, tables, code blocks, and more.
              {mwPrompt.text.length > 200_000 && (
                <span style={{ color: "var(--text-faint)" }}> Large documents may take 30–60 seconds.</span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                disabled={mwLoading}
                onClick={() => setMdfyPrompt(null)}
                className="flex-1 px-3 py-2 rounded-md text-caption font-medium transition-colors"
                style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                Keep Raw
              </button>
              <button
                disabled={mwLoading}
                onClick={async () => {
                  setMdfyLoading(true);
                  try {
                    const result = await mwText(mwPrompt.text, mwPrompt.filename);
                    // Update the tab with structured markdown.
                    setTabs(prev => prev.map(t => t.id === mwPrompt.tabId ? { ...t, markdown: result.markdown } : t));
                    if (mwPrompt.tabId === activeTabId) {
                      setMarkdown(result.markdown);
                      doRender(result.markdown);
                      cmSetDocRef.current?.(result.markdown);
                      // Tiptap owns its own DOM and only re-renders via
                      // the imperative ref — without this the Live tab
                      // keeps showing the raw pre-format markdown.
                      // Same fix we applied to handleAIAction.
                      tiptapRef.current?.setMarkdown(result.markdown);
                    }
                    if (result.truncated) {
                      showToast("Document was very large — only the first 3 MB was processed", "info");
                    } else if (result.finishReason === "MAX_TOKENS") {
                      showToast("AI hit its output limit — the result may be incomplete", "info");
                    } else {
                      showToast("Document structured successfully", "success");
                    }
                  } catch (err) {
                    console.error("memory.wiki failed:", err);
                    const message = err instanceof Error ? err.message : "AI processing failed";
                    showToast(message, "error");
                  }
                  setMdfyLoading(false);
                  setMdfyPrompt(null);
                }}
                className="flex-1 px-3 py-2 rounded-md text-caption font-medium transition-colors flex items-center justify-center gap-1.5"
                style={{ background: "var(--border)", color: "var(--text-primary)" }}
              >
                {mwLoading ? (
                  <>
                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    Processing{mwElapsed > 0 ? ` ${mwElapsed}s` : "..."}
                  </>
                ) : (
                  <>Structure it</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar context menu */}
      {sidebarContextMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setSidebarContextMenu(null)} />
          <div
            className="fixed rounded-lg shadow-xl py-1"
            style={{ left: sidebarContextMenu.x, top: sidebarContextMenu.y, zIndex: 9999, background: "var(--menu-bg)", border: "1px solid var(--border)", width: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            ref={(el) => {
              if (!el) return;
              // Measure actual menu height/width then clamp inside viewport
              const r = el.getBoundingClientRect();
              const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
              const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
              if (r.right > vw) el.style.left = `${Math.max(4, vw - r.width - 4)}px`;
              if (r.bottom > vh) el.style.top = `${Math.max(4, vh - r.height - 4)}px`;
            }}
          >
            {sidebarContextMenu.section === "bundles" ? (
              <>
                <button onClick={() => {
                  setShowMyBundles(true);
                  setBundleCreatorDocs([]);
                  setShowBundleCreator(true);
                  setSidebarContextMenu(null);
                }} className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-secondary)" }}>New Bundle</button>
                <button onClick={() => {
                  const id = `folder-${Date.now()}`;
                  setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "bundles" }]);
                  fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "bundles" }) }).catch(() => {});
                  setInlineInput({ label: "Folder name", defaultValue: "New Folder", onSubmit: (name) => { setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f)); fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {}); setInlineInput(null); }});
                  setSidebarContextMenu(null);
                }} className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-secondary)" }}>New Folder</button>
              </>
            ) : (
              <>
                <button onClick={() => { addTab(); setSidebarContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-secondary)" }}>New Document</button>
                <button onClick={() => {
                  const id = `folder-${Date.now()}`;
                  setFolders(prev => [...prev, { id, name: "New Folder", collapsed: false, section: "my" }]);
                  fetch("/api/user/folders", { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name: "New Folder", section: "my" }) }).catch(() => {});
                  setInlineInput({ label: "Folder name", defaultValue: "New Folder", onSubmit: (name) => { setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f)); fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id, name }) }).catch(() => {}); setInlineInput(null); }});
                  setSidebarContextMenu(null);
                }} className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-secondary)" }}>New Folder</button>
                <button onClick={() => {
                  setShowMyBundles(true);
                  setBundleCreatorDocs([]);
                  setShowBundleCreator(true);
                  setSidebarContextMenu(null);
                }} className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]" style={{ color: "var(--text-secondary)" }}>New Bundle</button>
              </>
            )}
          </div>
        </>
      )}

      {/* Folder context menu */}
      {folderContextMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setFolderContextMenu(null)} />
          <div
            className="fixed rounded-lg shadow-xl py-1"
            // Initial position at the click; ref-measured clamp flips
            // up/left when the menu would overflow the viewport.
            style={{
              left: folderContextMenu.x,
              top: folderContextMenu.y,
              zIndex: 9999,
              background: "var(--menu-bg)",
              border: "1px solid var(--border)",
              width: 160,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            ref={(el) => {
              if (!el) return;
              const r = el.getBoundingClientRect();
              const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
              const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
              if (r.right > vw) el.style.left = `${Math.max(4, vw - r.width - 4)}px`;
              if (r.bottom > vh) el.style.top = `${Math.max(4, vh - r.height - 4)}px`;
            }}
          >
            {[
              ...(folderContextMenu.folderId !== EXAMPLES_FOLDER_ID ? [{ label: "Rename", action: () => {
                const folder = folders.find(f => f.id === folderContextMenu.folderId);
                if (!folder) return;
                setRenamingItem({ kind: "folder", id: folder.id });
              }}] : []),
              ...(folderContextMenu.folderId !== EXAMPLES_FOLDER_ID ? [{ label: "Change icon...", action: () => {
                setEmojiPickerFolderId(folderContextMenu.folderId);
              }}] : []),
              { label: "Collapse / Expand", action: () => {
                setFolders(prev => prev.map(f => f.id === folderContextMenu.folderId ? { ...f, collapsed: !f.collapsed } : f));
                fetch("/api/user/folders", { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderContextMenu.folderId, collapsed: !folders.find(f => f.id === folderContextMenu.folderId)?.collapsed }) }).catch(() => {});
              }},
              // Pre-fill the bundle creator with every cloud-backed
              // doc currently in this folder. Skips bundle tabs,
              // example docs (no cloudId), deleted docs, and anything
              // shared-with-me (only owner-side picks can seed a new
              // bundle owned by the current user). Hidden when nothing
              // qualifies so the menu doesn't show a dead option.
              ...((() => {
                const folderDocs = tabs.filter(t =>
                  t.folderId === folderContextMenu.folderId
                  && t.kind !== "bundle"
                  && !t.deleted
                  && !!t.cloudId
                  && (!t.permission || t.permission === "mine")
                  && t.ownerEmail !== EXAMPLE_OWNER
                );
                if (folderDocs.length === 0) return [];
                return [{ label: `Create bundle from folder (${folderDocs.length})`, action: () => {
                  setBundleCreatorDocs(folderDocs.map(t => ({ id: t.cloudId!, title: t.title || "Untitled" })));
                  setShowMyBundles(true);
                  setShowBundleCreator(true);
                }}];
              })()),
              ...(folderContextMenu.folderId !== EXAMPLES_FOLDER_ID ? [{ label: "Delete folder", action: () => {
                setFolderContextMenu(prev => prev ? { ...prev, confirmDelete: true } : null);
              }, danger: true, noClose: true }] : []),
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); if (!(item as { noClose?: boolean }).noClose) setFolderContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]"
                style={{ color: (item as { danger?: boolean }).danger ? "#ef4444" : "var(--text-secondary)" }}
              >
                {item.label}
              </button>
            ))}
            {folderContextMenu.confirmDelete && (
              <>
                <div className="px-3 py-1.5 text-caption" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-dim)" }}>
                  Documents will be moved to root.
                </div>
                <div className="flex gap-1 px-2 pb-1">
                  <button onClick={() => setFolderContextMenu(null)} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>Cancel</button>
                  <button onClick={async () => {
                    const folderId = folderContextMenu.folderId;
                    const prevTabs = tabs;
                    const prevFolders = folders;
                    setTabs(prev => prev.map(t => t.folderId === folderId ? { ...t, folderId: undefined } : t));
                    setFolders(prev => prev.filter(f => f.id !== folderId));
                    setFolderContextMenu(null);
                    try {
                      const res = await fetch("/api/user/folders", { method: "DELETE", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify({ id: folderId }) });
                      if (!res.ok) throw new Error(await res.text().catch(() => "delete failed"));
                    } catch {
                      // Revert: server still has the folder, the next folder fetch
                      // would re-add it anyway, but reverting now keeps the UI
                      // consistent and avoids a confusing flash.
                      setTabs(prevTabs);
                      setFolders(prevFolders);
                      showToast("Couldn't delete folder — server refused", "error");
                    }
                  }} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Delete</button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Bundle context menu */}
      {bundleContextMenu && (() => {
        const b = bundles.find(x => x.id === bundleContextMenu.bundleId);
        if (!b) return null;
        const closeMenu = () => setBundleContextMenu(null);
        const refreshBundles = () => fetch("/api/bundles", { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => { if (d?.bundles) setBundles(d.bundles); }).catch(() => {});
        const ownerBody = (extra: Record<string, unknown> = {}) => ({
          userId: user?.id,
          anonymousId: !user?.id ? getAnonymousId() : undefined,
          ...extra,
        });
        const items: Array<{ label: string; action: () => void; danger?: boolean; noClose?: boolean }> = [
          { label: "Open", action: () => {
            const existingTab = tabs.find(t => t.kind === "bundle" && t.bundleId === b.id);
            if (existingTab) {
              if (b.title && existingTab.title !== b.title) {
                setTabs(prev => prev.map(t => t.id === existingTab.id ? { ...t, title: b.title || t.title } : t));
              }
              switchTab(existingTab.id);
            } else {
              const newId = `bundle-${b.id}-${Date.now()}`;
              const newTab: Tab = { id: newId, kind: "bundle", bundleId: b.id, title: b.title || "Untitled Bundle", markdown: "" };
              flushSync(() => { setTabs(prev => [...prev, newTab]); });
              switchTab(newId);
            }
          }},
          { label: "Open in new tab", action: () => {
            window.open(`/b/${b.id}`, "_blank", "noopener");
          }},
          { label: isPinned("bundle", b.id) ? "Unstar" : "Star", action: () => {
            void togglePin("bundle", b.id);
          }},
          { label: "Rename", action: () => {
            // Sidebar bundle rows use the `bundle-item-<id>` synthetic
            // tabId — match the SidebarFolderTree mount.
            setRenamingItem({ kind: "tab", id: `bundle-item-${b.id}` });
          }},
          { label: "Copy link", action: () => {
            const url = `${window.location.origin}/b/${b.id}`;
            copyToClipboard(url).then(() => showToast("Link copied!", "success")).catch(() => showToast("Copy failed", "error"));
          }},
          { label: "Share...", action: () => {
            // Same ShareModal as docs, with bundle adapters that cascade to all included docs.
            setBundleShareModal({ bundleId: b.id });
          }},
          { label: "Delete bundle", danger: true, noClose: true, action: () => {
            setBundleContextMenu(prev => prev ? { ...prev, confirmDelete: true } : null);
          }},
        ];
        return (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={closeMenu} />
            <div
              className="fixed rounded-lg shadow-xl py-1"
              // Initial position at the click; ref-measured clamp
              // flips up/left when the menu would overflow the
              // viewport — right-clicking the bottom-most bundle row
              // no longer clips the menu.
              style={{
                left: bundleContextMenu.x,
                top: bundleContextMenu.y,
                zIndex: 9999,
                background: "var(--menu-bg)",
                border: "1px solid var(--border)",
                width: 180,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              }}
              ref={(el) => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                const vw = typeof window !== "undefined" ? window.innerWidth : 9999;
                const vh = typeof window !== "undefined" ? window.innerHeight : 9999;
                if (r.right > vw) el.style.left = `${Math.max(4, vw - r.width - 4)}px`;
                if (r.bottom > vh) el.style.top = `${Math.max(4, vh - r.height - 4)}px`;
              }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); if (!item.noClose) closeMenu(); }}
                  className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: item.danger ? "#ef4444" : "var(--text-secondary)" }}
                >
                  {item.label}
                </button>
              ))}
              {bundleContextMenu.confirmDelete && (
                <>
                  <div className="px-3 py-1.5 text-caption" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border-dim)" }}>
                    Documents are not deleted. Bundle only.
                  </div>
                  <div className="flex gap-1 px-2 pb-1">
                    <button onClick={closeMenu} className="flex-1 px-2 py-1 rounded text-caption" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>Cancel</button>
                    <button
                      onClick={() => {
                        // Optimistic local removal
                        setBundles(prev => prev.filter(x => x.id !== b.id));
                        // If a tab is open for this bundle, drop it
                        setTabs(prev => prev.filter(t => !(t.kind === "bundle" && t.bundleId === b.id)));
                        const openTab = tabs.find(t => t.kind === "bundle" && t.bundleId === b.id);
                        if (openTab && activeTabIdRef.current === openTab.id) {
                          const fb = pickFallbackTabAfterDelete(new Set([openTab.id]));
                          if (fb) switchTab(fb); else switchToStartSurface();
                        }
                        fetch(`/api/bundles/${b.id}`, {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json", ...authHeaders },
                          body: JSON.stringify(ownerBody()),
                        }).then(r => {
                          if (!r.ok) {
                            showToast("Failed to delete bundle", "error");
                            refreshBundles();
                          }
                        }).catch(() => { refreshBundles(); });
                        closeMenu();
                      }}
                      className="flex-1 px-2 py-1 rounded text-caption"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* Bundle Share modal — wraps the same ShareModal used for individual docs */}
      {bundleShareModal && user && (() => {
        const b = bundles.find(x => x.id === bundleShareModal.bundleId);
        const bundleTitle = b?.title || "Untitled Bundle";
        return (
          <BundleShareModal
            bundleId={bundleShareModal.bundleId}
            bundleTitle={bundleTitle}
            ownerEmail={user.email || ""}
            ownerName={profile?.display_name || undefined}
            userId={user.id}
            authHeaders={authHeaders}
            onClose={() => setBundleShareModal(null)}
            onBundleUpdated={(changes) => {
              if (typeof changes.is_draft === "boolean") {
                setBundles(prev => prev.map(x => x.id === bundleShareModal.bundleId ? { ...x, is_draft: changes.is_draft! } : x));
              }
              // Refetch bundles so allowed_emails_count + has_password reflect the
              // change immediately in the sidebar icon. Without this, the icon
              // would stay green+globe even after sharing with specific people.
              fetch("/api/bundles", { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(data => {
                if (data?.bundles) setBundles(data.bundles);
              }).catch(() => {});
              fetch("/api/user/documents?includeDeleted=1", { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(data => {
                if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents);
              }).catch(() => {});
            }}
          />
        );
      })()}

      {/* Share Modal */}
      {showShareModal && (docId || tabs.find(t => t.id === activeTabId)?.cloudId) && user && (
        <ShareModal
          docId={(docId || tabs.find(t => t.id === activeTabIdRef.current)?.cloudId)!}
          title={title}
          userId={user.id}
          ownerEmail={user.email || ""}
          ownerName={profile?.display_name || undefined}
          currentEditMode={docEditMode}
          initialAllowedEmails={allowedEmails}
          initialAllowedEditors={allowedEditors}
          loading={shareModalLoading}
          editToken={tabs.find(t => t.id === activeTabIdRef.current)?.editToken}
          onClose={() => {
            setShowShareModal(false);
            const curTabId = activeTabIdRef.current;
            const ct = tabs.find(t => t.id === curTabId);
            if (ct?.cloudId) {
              const closeOthers = allowedEmails.filter(e => e.toLowerCase() !== (user?.email || "").toLowerCase());
              setTabs(prev => prev.map(t => {
                if (t.id !== curTabId) return t;
                return {
                  ...t,
                  isDraft: false,
                  isSharedByMe: true,
                  isRestricted: closeOthers.length > 0,
                  editMode: docEditMode,
                  sharedWithCount: closeOthers.length,
                };
              }));
            }
          }}
          onEditModeChange={(mode) => {
            setDocEditMode(mode); setEditMode(mode);
            // Publish (isDraft → false) when user explicitly changes sharing settings.
            // isSharedByMe is tied to is_draft (= published-readable), NOT
            // to the chosen edit mode — "owner" mode is still publicly
            // READABLE, just owner-edit. Earlier code keyed off mode and
            // mis-stamped restricted-edit publishes as Private.
            const curTabId = activeTabIdRef.current;
            setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, isDraft: false, isSharedByMe: true, editMode: mode } : t));
            const cid = docId || tabs.find(t => t.id === curTabId)?.cloudId;
            if (cid && user) {
              fetch(`/api/docs/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", userId: user.id }) }).catch(() => {});
            }
          }}
          onAllowedEmailsChange={(emails) => {
            setAllowedEmailsState(emails);
            // Publish + update tab state when sharing with specific people.
            // Also persist the new list into the tab cache so the next
            // Share-modal open renders this state instantly, not the
            // pre-edit one.
            const curTabId = activeTabIdRef.current;
            const othersEmails = emails.filter(e => e.toLowerCase() !== (user?.email || "").toLowerCase());
            setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, isDraft: false, isRestricted: othersEmails.length > 0, sharedWithCount: othersEmails.length, allowedEmails: emails } : t));
            const cid = docId || tabs.find(t => t.id === curTabId)?.cloudId;
            if (cid && user) {
              fetch(`/api/docs/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", userId: user.id }) }).catch(() => {});
            }
          }}
          onAllowedEditorsChange={(editors) => {
            setAllowedEditorsState(editors);
            const curTabId = activeTabIdRef.current;
            setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, allowedEditors: editors } : t));
          }}
          isPrivate={tabs.find(t => t.id === activeTabIdRef.current)?.isDraft === true}
          onPublish={async () => {
            const cid = docId || tabs.find(t => t.id === activeTabIdRef.current)?.cloudId;
            if (!cid || !user) return;
            try {
              const res = await fetch(`/api/docs/${cid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "publish", userId: user.id }),
              });
              if (!res.ok) { showToast("Failed to publish", "error"); return; }
              const curTabId = activeTabIdRef.current;
              setTabs(prev => prev.map(t => t.id === curTabId ? { ...t, isDraft: false } : t));
            } catch { showToast("Failed to publish", "error"); }
          }}
          onMakePrivate={async () => {
            const cid = docId || tabs.find(t => t.id === activeTabIdRef.current)?.cloudId;
            if (!cid || !user) return;
            try {
              const res = await fetch(`/api/docs/${cid}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unpublish", userId: user.id }),
              });
              if (!res.ok) { showToast("Failed to make private", "error"); return; }
              const curTabId = activeTabIdRef.current;
              setTabs(prev => prev.map(t => t.id === curTabId ? {
                ...t,
                isDraft: true,
                isSharedByMe: false,
                isRestricted: false,
                editMode: "owner",
                sharedWithCount: 0,
              } : t));
              setAllowedEmailsState([]);
              setAllowedEditorsState([]);
              setDocEditMode("owner");
              setEditMode("owner");
              showToast("Document is now private", "info");
            } catch { showToast("Failed to make private", "error"); }
          }}
        />
      )}

      {/* Conflict Modal — when auto-save detects 409 */}
      {showConflictModal && autoSave.conflict && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => { setShowConflictModal(false); autoSave.dismissConflict(); }}
        >
          <div
            className="w-full max-w-lg rounded-xl shadow-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert width={18} height={18} style={{ color: "#f59e0b" }} />
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Document Conflict
                </h2>
              </div>
              <button
                onClick={() => { setShowConflictModal(false); autoSave.dismissConflict(); }}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X width={14} height={14} />
              </button>
            </div>
            <div className="px-5 pb-3">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This document was modified by someone else while you were editing.
                Your changes could not be saved automatically.
              </p>
              {autoSave.conflict.serverUpdatedAt && (
                <p className="text-caption mt-2" style={{ color: "var(--text-muted)" }}>
                  Server version saved at: {new Date(autoSave.conflict.serverUpdatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => {
                  // Keep mine: force push without conflict check
                  const currentTab = tabs.find(t => t.id === activeTabIdRef.current);
                  if (currentTab?.cloudId) {
                    autoSave.forceSave({
                      cloudId: currentTab.cloudId,
                      markdown: markdownRef.current,
                      title: currentTab.title,
                      userId: user?.id,
                      userEmail: user?.email,
                      anonymousId,
                      editToken: currentTab.editToken,
                    });
                  }
                  setShowConflictModal(false);
                  showToast("Your version saved", "info");
                }}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--border)", color: "var(--text-primary)" }}
              >
                Keep mine
              </button>
              <button
                onClick={async () => {
                  // Keep theirs: pull server version
                  if (autoSave.conflict) {
                    setMarkdownRaw(autoSave.conflict.serverMarkdown);
                    doRender(autoSave.conflict.serverMarkdown);
                    autoSave.setLastServerUpdatedAt(autoSave.conflict.serverUpdatedAt);
                    // User accepted server body — now the in-sync baseline.
                    lastSyncedMdRef.current = autoSave.conflict.serverMarkdown;
                    autoSave.setLastServerBody(autoSave.conflict.serverMarkdown);
                    cmSetDocRef.current?.(autoSave.conflict.serverMarkdown);
                    tiptapRef.current?.setMarkdown(autoSave.conflict.serverMarkdown);
                    autoSave.dismissConflict();
                    setShowConflictModal(false);
                    showToast("Server version loaded", "info");
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--toggle-bg)", color: "var(--text-secondary)" }}
              >
                Keep theirs
              </button>
              <button
                onClick={() => {
                  // View diff: show both versions side by side
                  if (autoSave.conflict) {
                    const serverMd = autoSave.conflict.serverMarkdown;
                    const localMd = markdownRef.current;
                    // Open a new tab with a diff-like view
                    const diffContent = `# Conflict Comparison\n\n---\n\n## Your Version (Local)\n\n${localMd}\n\n---\n\n## Server Version\n\n${serverMd}`;
                    const newId = String(++tabIdCounter);
                    setTabs(prev => [...prev, { id: newId, title: "Conflict Diff", markdown: diffContent, readonly: true }]);
                    setActiveTabId(newId);
                    setShowConflictModal(false);
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
              >
                View diff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Share Modal — for non-owners */}
      {showViewerShareModal && docId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowViewerShareModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl shadow-2xl"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Share{title ? ` "${truncateTitle(title, 30)}"` : ""}
              </h2>
              <button
                onClick={() => setShowViewerShareModal(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X width={14} height={14} />
              </button>
            </div>

            {/* Owner info */}
            <div className="px-5 pb-4">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}>
                <img src={dicebearUrl(tabs.find(t => t.id === activeTabId)?.ownerEmail || "owner", 32)} alt="" className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {tabs.find(t => t.id === activeTabId)?.ownerEmail || "Document owner"}
                  </p>
                  <p className="text-caption" style={{ color: "var(--text-faint)" }}>Owner</p>
                </div>
              </div>
            </div>

            {/* Your access */}
            <div className="px-5 pb-4">
              <label className="text-caption font-medium mb-2 block" style={{ color: "var(--text-muted)" }}>Your access</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--text-faint)" strokeWidth="1.3" strokeLinecap="round">
                  <rect x="4" y="8" width="8" height="6" rx="1.5"/><path d="M6 8V5.5a2 2 0 114 0V8"/>
                </svg>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  View only
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              {/* Duplicate to edit — only if readonly */}
              {!canEdit && (
                <button
                  onClick={() => {
                    const id = `tab-${Date.now()}`;
                    const origMd = markdownRef.current;
                    const t = title ? `${title} (copy)` : "Untitled (copy)";
                    const md = origMd.replace(/^(#\s+.+)$/m, `# ${t}`);
                    const newTab: Tab = { id, title: t, markdown: md, permission: "mine", shared: false, isDraft: true };
                    setTabs(prev => [...prev, newTab]);
                    setIsSharedDoc(false);
                    setIsOwner(true);
                    setDocEditMode("owner");
                    loadTab(newTab);
                    autoSave.createDocument({
                      markdown: md, title: t, userId: user?.id,
                      anonymousId: !user?.id ? ensureAnonymousId() : undefined,
                    }).then(result => {
                      if (result) {
                        setTabs(prev => {
                          const withoutDup = prev.filter(tab => !(tab.cloudId === result.id && tab.id !== id));
                          return withoutDup.map(tab => tab.id === id ? { ...tab, cloudId: result.id, editToken: result.editToken } : tab);
                        });
                        setDocId(result.id);
                        window.history.replaceState(null, "", `/${result.id}`);
                      }
                    });
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}
                >
                  <Copy width={12} height={12} />
                  Duplicate to edit
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-dim)" }}>
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/${docId}`;
                  await copyToClipboard(url);
                  showToast("Link copied!", "success");
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 10l4-4"/><path d="M8.5 3.5L10 2a2 2 0 012.83 2.83L11.5 6.17"/><path d="M4.5 9.83L3.17 11.17A2 2 0 006 14l1.5-1.5"/>
                </svg>
                Copy link
              </button>
              <button
                onClick={() => setShowViewerShareModal(false)}
                className="px-5 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--text-primary)", color: "var(--background)" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concept detail drawer — shows all occurrences of a concept across
          docs. Click an occurrence → opens that doc as a tab. The drawer is
          a full-screen overlay so it works regardless of which view the
          user is in (canvas, doc, home). */}
      {openedConceptId && conceptIndex && (() => {
        const c = conceptIndex.concepts.find(x => x.id === openedConceptId);
        if (!c) return null;
        const close = () => setOpenedConceptId(null);
        const def = conceptDefinitions[c.id];
        return (
          <ModalShell
            open
            onClose={close}
            size="lg"
            title={
              <span className="inline-flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.docCount >= 2 ? "var(--text-primary)" : "var(--text-faint)" }} />
                <span className="truncate">{c.label}</span>
              </span>
            }
            subtitle={`${c.docCount} ${c.docCount === 1 ? "doc" : "docs"} — ${c.occurrenceCount} mentions`}
            headerExtras={
              <div className="flex items-center gap-1">
                {c.types.map(t => <Badge key={t} variant="accent" uppercase>{t}</Badge>)}
              </div>
            }
          >
            <div className="space-y-3">
              {/* AI synthesis only makes sense when the concept actually links
                  multiple docs. Single-doc concepts get a guidance card pointing
                  the user back to the source — the occurrence card below is
                  already the "open in doc" CTA. */}
              {c.docCount >= 2 ? (
                <div className="rounded-md" style={{ background: "var(--border)", border: "1px solid var(--text-primary)", padding: "var(--space-3)" }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
                    <h4 className="text-caption font-semibold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>What it means across your library</h4>
                    {!def && (
                      <Button variant="primary" size="xs" onClick={() => fetchConceptDefinition(c.id, c.label, c.occurrences)}>
                        Define with AI
                      </Button>
                    )}
                    {def && !def.loading && def.text && (
                      <button
                        onClick={() => fetchConceptDefinition(c.id, c.label, c.occurrences)}
                        className="text-caption hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        Re-define
                      </button>
                    )}
                  </div>
                  {def?.loading && (
                    <div className="text-caption flex items-center gap-1.5" style={{ color: "var(--text-faint)" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--text-primary)" }} />
                      Synthesizing definition…
                    </div>
                  )}
                  {def?.error && (
                    <div className="text-caption" style={{ color: "var(--color-danger)" }}>Error: {def.error}</div>
                  )}
                  {def?.text && (
                    <p className="text-body leading-relaxed" style={{ color: "var(--text-primary)" }}>{def.text}</p>
                  )}
                  {!def && (
                    <p className="text-caption leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Synthesize how this concept is used across {c.docCount} docs and {c.occurrenceCount} mentions.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md" style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)", padding: "var(--space-3)" }}>
                  <h4 className="text-caption font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>Not yet a compound</h4>
                  <p className="text-caption leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    This concept only appears in one doc so far. Decompose more docs that touch related ideas — when the same concept lands twice, it surfaces as a cross-linked compound here.
                  </p>
                </div>
              )}
              {/* Occurrences */}
              {c.occurrences.map((occ, i) => (
                <button
                  key={`${occ.docId}-${occ.chunkId}-${i}`}
                  onClick={() => {
                    const existing = tabs.find(t => t.cloudId === occ.docId);
                    if (existing) {
                      switchTab(existing.id);
                    } else {
                      fetch(`/api/docs/${occ.docId}`, { headers: authHeadersRef.current })
                        .then(r => r.ok ? r.json() : null)
                        .then(d => {
                          if (!d) return;
                          const newId = `doc-${occ.docId}-${Date.now()}`;
                          const newTab: Tab = {
                            id: newId, kind: "doc", cloudId: occ.docId,
                            title: d.title || occ.docTitle || "Untitled",
                            markdown: d.markdown || "", isDraft: d.is_draft, permission: "mine",
                          };
                          setTabs(prev => [...prev, newTab]);
                          switchTab(newId);
                        })
                        .catch(() => {});
                    }
                    close();
                  }}
                  className="w-full text-left rounded-md transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)", padding: "var(--space-2) var(--space-3)" }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: "var(--space-1)" }}>
                    <Badge variant="accent" uppercase>{occ.chunkType}</Badge>
                    <span className="text-caption font-semibold truncate" style={{ color: "var(--text-primary)" }}>{occ.docTitle}</span>
                  </div>
                  {occ.snippet && (
                    <p className="text-caption leading-relaxed line-clamp-3" style={{ color: "var(--text-secondary)" }}>{occ.snippet}</p>
                  )}
                </button>
              ))}
            </div>
          </ModalShell>
        );
      })()}

      {/* Toast notifications */}
      <ToastContainer />

      {/* QR Code Modal */}
      {showQr && docId && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowQr(false)}
        >
          <div
            className="rounded-xl p-6 flex flex-col items-center gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              memory.wiki/{docId}
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://memory.wiki/${docId}`)}&bgcolor=18181b&color=fafafa&format=svg`}
              alt="QR Code"
              width={200}
              height={200}
              className="rounded-lg"
            />
            <button
              onClick={() => setShowQr(false)}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Mermaid Editor Modal */}
      {showMermaidModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowMermaidModal(false); setCanvasMermaid(undefined); } }}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowMermaidModal(false); setCanvasMermaid(undefined); } }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className="flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
              width: "95vw",
              height: "90vh",
              maxWidth: "1400px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <MdCanvas
              initialMermaid={canvasMermaid}
              onCancel={() => {
                setShowMermaidModal(false);
                setCanvasMermaid(undefined);
              }}
              onGenerate={(md) => {
                let newMarkdown: string;
                if (!mermaidIsNewRef.current && canvasMermaid) {
                  // Editing existing diagram — find and replace in-place
                  const originalBlock = "```mermaid\n" + canvasMermaid + "\n```";
                  const sourceIdx = mermaidSourceIndexRef.current;
                  if (sourceIdx >= 0 && sourceIdx < markdown.length && markdown.slice(sourceIdx, sourceIdx + originalBlock.length) === originalBlock) {
                    // Replace at exact saved position (handles duplicate mermaid blocks)
                    newMarkdown = markdown.slice(0, sourceIdx) + md + markdown.slice(sourceIdx + originalBlock.length);
                  } else if (markdown.includes(originalBlock)) {
                    // Fallback: replace first occurrence
                    newMarkdown = markdown.replace(originalBlock, md);
                  } else {
                    // Fuzzy match: find block containing first content line
                    const mermaidBlockRegex = /```mermaid\n[\s\S]*?```/g;
                    const blocks = [...markdown.matchAll(mermaidBlockRegex)];
                    const firstContentLine = canvasMermaid.split("\n")[0]?.trim();
                    const match = blocks.find(b => firstContentLine && b[0].includes(firstContentLine));
                    if (match && match.index !== undefined) {
                      newMarkdown = markdown.slice(0, match.index) + md + markdown.slice(match.index + match[0].length);
                    } else {
                      newMarkdown = insertBlockAtCursor(md);
                    }
                  }
                } else {
                  // New diagram — insert at saved cursor position
                  newMarkdown = insertBlockAtCursor(md);
                }
                mermaidIsNewRef.current = false;
                mermaidSourceIndexRef.current = -1;
                setMarkdown(newMarkdown);
                cmSetDoc(newMarkdown);
                doRender(newMarkdown);
                setCanvasMermaid(undefined);
                setShowMermaidModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowTemplatePicker(false); setPendingNewDocFolderId(null); } }}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowTemplatePicker(false); setPendingNewDocFolderId(null); } }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
              width: "min(480px, 92vw)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ padding: "20px 24px 12px", borderBottom: "1px solid var(--border-dim)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>New Document</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>Choose a template to get started</p>
            </div>
            <div style={{ padding: "12px 16px 16px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              {DOCUMENT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.name}
                  onClick={() => {
                    setShowTemplatePicker(false);
                    addTabWithContent(tmpl.markdown);
                  }}
                  className="text-left transition-colors"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--border-dim)",
                    background: "var(--surface)",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--text-primary)";
                    e.currentTarget.style.color = "var(--text-primary)";
                    e.currentTarget.style.background = "var(--border)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-dim)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                    e.currentTarget.style.background = "var(--surface)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d={tmpl.icon}/>
                  </svg>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Code Editor Modal (Tiptap double-click) */}
      {codeEditState && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setCodeEditState(null)}>
          <div className="w-[90%] max-w-[640px] max-h-[80vh] flex flex-col gap-3 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <input
                id="tiptap-code-lang"
                type="text"
                defaultValue={codeEditState.lang}
                placeholder="language"
                className="px-2.5 py-1 text-body font-mono font-semibold uppercase tracking-wider rounded-md outline-none"
                style={{ background: "var(--border)", color: "var(--text-primary)", border: "1px solid transparent", width: 120 }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const textarea = document.getElementById("tiptap-code-textarea") as HTMLTextAreaElement;
                    const langInput = document.getElementById("tiptap-code-lang") as HTMLInputElement;
                    if (!textarea) return;
                    const newCode = textarea.value;
                    const newLang = langInput?.value?.trim() || "";
                    const oldLang = codeEditState.lang;
                    const oldCode = codeEditState.code;
                    if (newCode !== oldCode || newLang !== oldLang) {
                      const md = markdownRef.current;
                      const fence = "```" + oldLang;
                      const idx = md.indexOf(fence);
                      if (idx !== -1) {
                        const contentStart = md.indexOf("\n", idx) + 1;
                        const endFence = md.indexOf("\n```", contentStart);
                        if (endFence !== -1) {
                          const newMd = md.slice(0, idx) + "```" + newLang + "\n" + newCode + md.slice(endFence);
                          markdownRef.current = newMd;
                          setMarkdownRaw(newMd);
                          cmSetDocRef.current?.(newMd);
                          tiptapRef.current?.setMarkdown(newMd);
                          triggerAutoSave(newMd);
                        }
                      }
                    }
                    setCodeEditState(null);
                  }}
                  className="px-3 py-1 text-caption font-semibold rounded-md"
                  style={{ background: "var(--text-primary)", color: "var(--background)" }}
                >Save</button>
                <button onClick={() => setCodeEditState(null)} className="px-3 py-1 text-caption rounded-md" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>Cancel</button>
              </div>
            </div>
            <textarea
              id="tiptap-code-textarea"
              defaultValue={codeEditState.code}
              className="flex-1 min-h-[200px] rounded-lg p-3 font-mono text-body leading-relaxed resize-vertical outline-none"
              style={{ background: "var(--background)", color: "var(--editor-text)", border: "1px solid var(--border)" }}
              spellCheck={false}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") setCodeEditState(null);
                if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  (document.querySelector('[style*="var(--text-primary)"][class*="font-semibold"]') as HTMLButtonElement)?.click();
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Math Editor Modal */}
      {showMathModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowMathModal(false); setInitialMath(undefined); } }}
          onKeyDown={(e) => { if (e.key === "Escape") { setShowMathModal(false); setInitialMath(undefined); } }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div
            className="flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
              width: "95vw",
              height: "80vh",
              maxWidth: "1200px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <MathEditor
              initialMath={initialMath}
              onCancel={() => {
                setShowMathModal(false);
                setInitialMath(undefined);
              }}
              onGenerate={(md) => {
                let newMarkdown = insertBlockAtCursor(md); // default: insert at cursor
                const orig = mathOriginalRef.current;
                const sourceIdx = mathSourceIndexRef.current;
                if (orig && sourceIdx >= 0 && sourceIdx < markdown.length && markdown.slice(sourceIdx, sourceIdx + orig.length) === orig) {
                  // Replace at exact saved position (handles duplicate math blocks)
                  newMarkdown = markdown.slice(0, sourceIdx) + md + markdown.slice(sourceIdx + orig.length);
                } else if (orig && markdown.includes(orig)) {
                  // Fallback: replace first occurrence
                  newMarkdown = markdown.replace(orig, md);
                } else if (orig) {
                  // Try fuzzy match: find math block containing the same TeX source
                  const origTex = orig.replace(/^\$+\s*|\s*\$+$/g, "").trim();
                  if (origTex) {
                    const mathRegex = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g;
                    const matches = [...markdown.matchAll(mathRegex)];
                    const best = matches.find(m => {
                      const mTex = m[0].replace(/^\$+\s*|\s*\$+$/g, "").trim();
                      return mTex === origTex;
                    });
                    if (best && best.index !== undefined) {
                      newMarkdown = markdown.slice(0, best.index) + md + markdown.slice(best.index + best[0].length);
                    }
                  }
                }
                setMarkdown(newMarkdown);
                cmSetDoc(newMarkdown);
                doRender(newMarkdown);
                setInitialMath(undefined);
                mathOriginalRef.current = null;
                mathSourceIndexRef.current = -1;
                setShowMathModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Command Palette (Cmd+K) ── */}
      {/* Old start screen removed — now inline in Live content area */}
      {false && (
        <div className="hidden">
          <div className="hidden">
            {/* Logo */}
            <div className="mb-6">
              <MemoryWikiLogo size={32} />
            </div>
            <p className="text-body mb-8" style={{ color: "var(--text-muted)" }}>
              The Markdown Hub
            </p>

            {/* Quick actions */}
            <div className="space-y-1.5 mb-8">
              {[
                { label: "New Document", shortcut: isMobile ? "" : (typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "\u2318N" : "Ctrl+N"), action: () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} addTab(); } },
                { label: "Paste from Clipboard", shortcut: isMobile ? "" : (typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "\u2318V" : "Ctrl+V"), action: async () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} try { const text = await navigator.clipboard.readText(); if (text) { addTab(); setTimeout(() => { setMarkdown(text); doRender(text); cmSetDocRef.current?.(text); }, 100); } } catch {} } },
                { label: "Import File", shortcut: "", action: () => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} imageFileRef.current?.click(); } },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-body transition-colors hover:bg-[var(--menu-hover)]"
                  style={{ color: "var(--text-secondary)", background: "var(--surface)", border: "1px solid var(--border-dim)" }}
                >
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.shortcut && <kbd className="text-caption font-mono" style={{ color: "var(--text-faint)" }}>{item.shortcut}</kbd>}
                </button>
              ))}
            </div>

            {/* Drop zone */}
            <div
              className="mb-8 py-6 rounded-lg text-center"
              style={{ border: "1px dashed var(--border)", color: "var(--text-faint)" }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--text-primary)"; e.currentTarget.style.color = "var(--text-primary)"; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-faint)"; }}
              onDrop={(e) => {
                e.preventDefault();
                setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {}
                // Let the main drop handler in MdEditor handle the file
              }}
            >
              <p className="text-body">Drop files here to open</p>
              <p className="text-caption mt-1" style={{ opacity: 0.6 }}>MD, PDF, DOCX, PPTX, XLSX, HTML, CSV, TXT</p>
            </div>

            {/* Plugins */}
            <div className="mb-6">
              <p className="text-caption mb-2" style={{ color: "var(--text-faint)" }}>Also available on</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {["Chrome", "VS Code", "Mac", "CLI", "MCP", "GitHub"].map((ch) => (
                  <span key={ch} className="px-2 py-1 rounded text-caption" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)" }}>{ch}</span>
                ))}
              </div>
            </div>

            {/* Skip */}
            <button
              onClick={() => { setShowOnboarding(false); try { localStorage.setItem("mw-onboarded", "1"); } catch {} }}
              className="text-caption transition-colors"
              style={{ color: "var(--text-faint)" }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Image lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
          onClick={() => setLightboxImage(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setLightboxImage(null); return; }
            if (userImages.length <= 1) return;
            const idx = userImages.findIndex(i => i.url === lightboxImage);
            if (idx < 0) return;
            if (e.key === "ArrowLeft" && idx > 0) { e.stopPropagation(); setLightboxImage(userImages[idx - 1].url); }
            if (e.key === "ArrowRight" && idx < userImages.length - 1) { e.stopPropagation(); setLightboxImage(userImages[idx + 1].url); }
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}>
          <button className="absolute top-4 right-4 p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "#fff" }} onClick={() => setLightboxImage(null)}>
            <X width={20} height={20} />
          </button>
          {/* Navigate prev/next */}
          {userImages.length > 1 && (() => {
            const idx = userImages.findIndex(i => i.url === lightboxImage);
            return (<>
              {idx > 0 && (
                <button className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: "#fff" }} onClick={(e) => { e.stopPropagation(); setLightboxImage(userImages[idx - 1].url); }}>
                  <ChevronDown width={24} height={24} style={{ transform: "rotate(90deg)" }} />
                </button>
              )}
              {idx < userImages.length - 1 && (
                <button className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: "#fff" }} onClick={(e) => { e.stopPropagation(); setLightboxImage(userImages[idx + 1].url); }}>
                  <ChevronDown width={24} height={24} style={{ transform: "rotate(-90deg)" }} />
                </button>
              )}
            </>);
          })()}
          <img src={lightboxImage} alt="" onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] rounded-lg cursor-default"
            style={{ objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }} />
          {/* Image info bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-caption"
            style={{ background: "rgba(0,0,0,0.6)", color: "#ccc" }}
            onClick={(e) => e.stopPropagation()}>
            {userImages.find(i => i.url === lightboxImage)?.name || ""}
            <span className="ml-3" style={{ color: "var(--text-faint)" }}>
              {(() => { const idx = userImages.findIndex(i => i.url === lightboxImage); return idx >= 0 ? `${idx + 1} / ${userImages.length}` : ""; })()}
            </span>
          </div>
        </div>
      )}

      {showCommandPalette && (() => {
        // ── Command palette — sectioned, keyboard-driven ──
        // The palette pulls items from five sources and groups
        // them so the user sees Surfaces / Recent / Commands /
        // Documents / Bundles in one place. Keyboard arrows step
        // through the flattened list; Enter runs the highlighted
        // item. Each item has its own glyph so the source is
        // legible at a glance.
        type PaletteItem = {
          id: string;
          label: string;
          hint?: string;
          icon: React.ReactNode;
          kbd?: string;
          action: () => void;
        };
        const closePalette = () => { setShowCommandPalette(false); setCmdSearch(""); };
        const openDocById = (docId: string, title?: string) => {
          const tabId = `cloud-${docId}`;
          const exists = tabs.find(t => t.id === tabId || t.cloudId === docId);
          if (exists) { switchTab(exists.id); return; }
          setTabs(prev => [...prev, { id: tabId, title: title || "Untitled", markdown: "", cloudId: docId, isDraft: true, permission: "mine" as const }]);
          setTimeout(() => switchTab(tabId), 50);
        };
        const openBundleById = (bundleId: string, title?: string) => {
          const existing = tabs.find(t => t.kind === "bundle" && t.bundleId === bundleId);
          if (existing) { switchTab(existing.id); return; }
          const newId = `bundle-${bundleId}-${Date.now()}`;
          setTabs(prev => [...prev, { id: newId, kind: "bundle", bundleId, title: title || "Untitled bundle", markdown: "" }]);
          setTimeout(() => switchTab(newId), 50);
        };

        // Surfaces — always-available navigation targets.
        const surfaces: PaletteItem[] = [
          { id: "surface-start", label: "Start", hint: "Personal workspace", icon: <Smile width={13} height={13} />, action: () => { setShowOnboarding(true); setShowHub(false); setShowGalaxy(false); setShowSettings(false); } },
          ...(hubSlug ? [{ id: "surface-hub", label: "Hub", hint: `/hub/${hubSlug}`, icon: <LayoutDashboard width={13} height={13} />, action: () => { setShowOnboarding(false); setShowSettings(false); setShowGalaxy(false); setShowHub(true); } }] : []),
          ...(hubSlug ? [{ id: "surface-galaxy", label: "Galaxy", hint: "Your hub as a constellation", icon: <Atom width={13} height={13} />, action: () => { setShowOnboarding(false); setShowHub(false); setShowSettings(false); setShowSidebar(false); setShowAIPanel(false); setShowImagePanel(false); setShowOutlinePanel(false); setShowGalaxy(true); } }] : []),
          { id: "surface-settings", label: "Settings", hint: "Profile, appearance, auto-management", icon: <Settings width={13} height={13} />, action: () => { setShowOnboarding(false); setShowHub(false); setShowGalaxy(false); setShowSettings(true); } },
        ];

        // Recent (last 5 visited tabs, excluding hub-overlay ids)
        const recentItems: PaletteItem[] = recentTabIds
          .map(id => tabs.find(t => t.id === id))
          .filter((t): t is Tab => !!t && !t.deleted && !t.readonly)
          .slice(0, 5)
          .map(t => ({
            id: `recent-${t.id}`,
            label: t.title || "Untitled",
            hint: t.kind === "bundle" ? "Bundle" : "Recent doc",
            icon: t.kind === "bundle" ? <Layers width={13} height={13} /> : <FileText width={13} height={13} />,
            action: () => switchTab(t.id),
          }));

        // Commands — actions the user can run regardless of surface.
        const commands: PaletteItem[] = [
          { id: "cmd-new-doc",      label: "New document",        hint: "Blank canvas", icon: <FileText width={13} height={13} />,        action: () => addTab() },
          { id: "cmd-new-bundle",   label: "New bundle",          hint: "Pick docs",    icon: <Layers width={13} height={13} />,          action: () => { setBundleCreatorDocs([]); setShowBundleCreator(true); } },
          // Owner-side semantic search of their own public hub.
          // Cmd+K's doc list is keyword-ILIKE; for concept-aware
          // search the owner can hop to /hub/<slug>/search which
          // uses the same hybrid retrieval that public visitors get.
          ...(hubSlug ? [{
            id: "cmd-hub-search",
            label: "Search your hub (semantic)",
            hint: `/hub/${hubSlug}/search`,
            icon: <Globe width={13} height={13} />,
            action: () => { window.open(`/hub/${hubSlug}/search`, "_blank"); closePalette(); },
          }] : []),
          { id: "cmd-toggle-theme", label: "Toggle dark / light", hint: "Mode",         icon: <LayoutDashboard width={13} height={13} />, action: () => toggleTheme() },
          { id: "cmd-toggle-sidebar", label: "Toggle sidebar",    hint: "Library rail", icon: <List width={13} height={13} />,            action: () => setShowSidebar(prev => !prev) },
          { id: "cmd-toggle-toolbar", label: "Toggle formatting toolbar", hint: "Above editor", icon: <AlignLeft width={13} height={13} />, action: () => setShowToolbar(prev => !prev) },
          { id: "cmd-ai-polish",    label: "Polish with AI",      hint: "Active doc",   icon: <Sparkles width={13} height={13} />,        action: () => handleAIAction("polish") },
          { id: "cmd-ai-summary",   label: "AI summary",          hint: "Active doc",   icon: <Sparkles width={13} height={13} />,        action: () => handleAIAction("summary") },
          { id: "cmd-ai-tldr",      label: "AI TL;DR",            hint: "Active doc",   icon: <Sparkles width={13} height={13} />,        action: () => handleAIAction("tldr") },
          { id: "cmd-ai-panel",     label: "Open Assistant",      hint: "AI chat",      icon: <MessageSquarePlus width={13} height={13} />, action: () => { setShowAIPanel(true); setShowOutlinePanel(false); setShowImagePanel(false); } },
          { id: "cmd-share",        label: "Share document",      hint: "Permissions",  icon: <Globe width={13} height={13} />,           action: () => handleShare() },
          { id: "cmd-export-md",    label: "Export as Markdown",  hint: ".md file",     icon: <FileText width={13} height={13} />,        action: () => handleDownloadMd() },
          { id: "cmd-export-pdf",   label: "Export as PDF",       hint: ".pdf file",    icon: <FileText width={13} height={13} />,        action: () => handleExportPdf() },
          { id: "cmd-history",      label: "Version history",     hint: "Active doc",   icon: <Clock width={13} height={13} />,           action: () => handleToggleHistory() },
        ];

        // Filter all sections against the query (substring on label or hint).
        const q = cmdSearch.trim().toLowerCase();
        const match = (item: PaletteItem) => !q || item.label.toLowerCase().includes(q) || (item.hint || "").toLowerCase().includes(q);
        const matchedSurfaces = surfaces.filter(match);
        const matchedRecent = q ? [] : recentItems; // Recent only shown on empty query
        const matchedCommands = commands.filter(match);

        // Bundles — local list, filtered by query.
        const matchedBundles: PaletteItem[] = (q ? bundles : bundles.slice(0, 5))
          .filter(b => !q || (b.title || "").toLowerCase().includes(q) || (b.description || "").toLowerCase().includes(q))
          .slice(0, 8)
          .map(b => ({
            id: `bundle-${b.id}`,
            label: b.title || "Untitled bundle",
            hint: b.description || `${b.documentCount} docs`,
            icon: <Layers width={13} height={13} />,
            action: () => openBundleById(b.id, b.title),
          }));

        // Server document search — only fires when query >= 3 chars.
        const matchedDocs: PaletteItem[] = cmdSearchResults.map(r => ({
          id: `doc-${r.id}`,
          label: r.title || "Untitled",
          hint: (r.snippet || "").slice(0, 80),
          icon: <FileText width={13} height={13} />,
          action: () => openDocById(r.id, r.title),
        }));

        const groups: { heading: string; items: PaletteItem[] }[] = [];
        if (matchedRecent.length) groups.push({ heading: "Recent",    items: matchedRecent });
        if (matchedSurfaces.length) groups.push({ heading: "Surfaces", items: matchedSurfaces });
        if (matchedCommands.length) groups.push({ heading: "Commands", items: matchedCommands });
        if (matchedBundles.length) groups.push({ heading: "Bundles", items: matchedBundles });
        if (matchedDocs.length) groups.push({ heading: "Documents", items: matchedDocs });

        const flatItems = groups.flatMap(g => g.items);
        const selectedIdx = Math.min(cmdSelectedIdx, Math.max(0, flatItems.length - 1));

        return (
          <div
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={closePalette}
          >
            <div
              className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <Search width={14} height={14} style={{ color: "var(--text-faint)" }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Jump to a doc, bundle, surface, or command…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: "var(--text-primary)" }}
                  value={cmdSearch}
                  onChange={e => setCmdSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Escape") { e.preventDefault(); closePalette(); return; }
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setCmdSelectedIdx((idx) => Math.min(flatItems.length - 1, idx + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setCmdSelectedIdx((idx) => Math.max(0, idx - 1));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const item = flatItems[selectedIdx];
                      if (item) { item.action(); closePalette(); }
                    }
                  }}
                />
                <span className="text-caption font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}>ESC</span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto py-1">
                {flatItems.length === 0 && !isCmdSearching ? (
                  <div className="px-4 py-6 text-caption text-center" style={{ color: "var(--text-faint)" }}>
                    Nothing matches <span className="font-mono" style={{ color: "var(--text-muted)" }}>{cmdSearch}</span>. Try a doc title, bundle name, or command.
                  </div>
                ) : (
                  groups.map((g) => {
                    const offset = groups.slice(0, groups.indexOf(g)).reduce((n, gg) => n + gg.items.length, 0);
                    return (
                      <div key={g.heading} className="mb-1">
                        <div className="px-4 py-1.5 text-caption font-mono uppercase tracking-wider" style={{ color: "var(--text-faint)", fontSize: 9, letterSpacing: 0.8 }}>
                          {g.heading}
                        </div>
                        {g.items.map((item, i) => {
                          const flatIdx = offset + i;
                          const active = flatIdx === selectedIdx;
                          return (
                            <button
                              key={item.id}
                              onMouseEnter={() => setCmdSelectedIdx(flatIdx)}
                              onClick={() => { item.action(); closePalette(); }}
                              className="w-full text-left px-4 py-2 text-sm flex items-center gap-2.5 transition-colors"
                              style={{ background: active ? "var(--border)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-primary)" }}
                            >
                              <span className="shrink-0" style={{ color: active ? "var(--text-primary)" : "var(--text-muted)" }}>{item.icon}</span>
                              <span className="flex-1 min-w-0 flex items-baseline gap-2">
                                <span className="truncate">{item.label}</span>
                                {item.hint && <span className="text-caption truncate" style={{ color: "var(--text-faint)" }}>{item.hint}</span>}
                              </span>
                              {item.kbd && <span className="text-caption font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: "var(--text-faint)", background: "var(--toggle-bg)" }}>{item.kbd}</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
                {isCmdSearching && (
                  <div className="px-4 py-2 text-caption flex items-center gap-2" style={{ color: "var(--text-faint)" }}>
                    <span className="inline-block animate-spin" style={{ width: 10, height: 10, border: "1.5px solid var(--text-faint)", borderTopColor: "transparent", borderRadius: "50%" }} />
                    Searching documents…
                  </div>
                )}
              </div>
              <div className="px-4 py-2 text-caption flex items-center gap-3" style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-dim)" }}>
                <span className="flex items-center gap-1"><span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)" }}>↑↓</span>navigate</span>
                <span className="flex items-center gap-1"><span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)" }}>↵</span>open</span>
                <span className="flex items-center gap-1"><span className="font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--toggle-bg)" }}>esc</span>dismiss</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Folder emoji picker */}
      {emojiPickerFolderId && (() => {
        const f = folders.find(x => x.id === emojiPickerFolderId);
        if (!f) { setEmojiPickerFolderId(null); return null; }
        return (
          <FolderEmojiPicker
            currentEmoji={f.emoji}
            onClose={() => setEmojiPickerFolderId(null)}
            onSelect={(emoji) => {
              setFolders(prev => prev.map(fx => fx.id === f.id ? { ...fx, emoji: emoji || undefined } : fx));
              fetch("/api/user/folders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ id: f.id, emoji: emoji || null }),
              }).catch(() => {});
              setEmojiPickerFolderId(null);
            }}
          />
        );
      })()}

      {/* Unified Import modal — five sources, one polished dialog. */}
      <ImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        authHeaders={authHeaders}
        showToast={showToast}
        onImported={(docId) => {
          // Refresh server docs so the sidebar's MDs section reflects
          // the new import immediately (without a page reload).
          fetch("/api/user/documents?includeDeleted=1", { headers: authHeaders })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data?.documents) setServerDocs(data.documents); ingestDocAiMeta(data.documents); })
            .catch(() => {});
          // Auto-open the freshly imported doc IN PLACE. Used to do
          // window.location.href = `/${docId}` which forced a full
          // page reload — the user reads that as "import requires
          // a refresh". This path mirrors openDocById (defined in the
          // command palette scope): switch to the existing tab if
          // we already have one for this cloudId, otherwise spawn a
          // fresh cloud tab.
          if (docId) {
            const tabId = `cloud-${docId}`;
            const existing = tabs.find((t) => t.id === tabId || t.cloudId === docId);
            if (existing) {
              switchTab(existing.id);
            } else {
              setTabs((prev) => [
                ...prev,
                { id: tabId, title: "", markdown: "", cloudId: docId, isDraft: false, permission: "mine" },
              ]);
              setTimeout(() => switchTab(tabId), 50);
            }
          }
        }}
        onPickFiles={() => {
          // Modal closes itself, then we open the parent's native
          // file picker. The parent's <input ref={importFileRef}>
          // already routes through runFileImport on change, so this
          // is a single code path with no cross-component picker
          // plumbing to drop events on the way back.
          requestAnimationFrame(() => importFileRef.current?.click());
        }}
      />

      {/* Bundle Creator Modal */}
      {showBundleCreator && (
        <BundleCreatorModal
          allDocs={tabs.filter(t => t.cloudId && !t.deleted && !t.readonly && t.permission !== "readonly" && t.permission !== "editable" && t.kind !== "bundle").map(t => ({ id: t.cloudId!, title: t.title || "Untitled", lastOpenedAt: t.lastOpenedAt }))}
          initiallySelected={bundleCreatorDocs}
          authHeaders={authHeaders}
          onClose={() => { setShowBundleCreator(false); setBundleCreatorDocs([]); setPendingNewBundleFolderId(null); }}
          onCreate={async ({ title, description, docIds, annotationByDocId }) => {
            try {
              const targetFolderId = pendingNewBundleFolderId;
              const res = await fetch("/api/bundles", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders },
                body: JSON.stringify({ title, description, documentIds: docIds, isDraft: true, folderId: targetFolderId || undefined }),
              });
              if (!res.ok) {
                showToast("Failed to create bundle", "error");
                return;
              }
              const data = await res.json();
              const bundleId: string = data.id;
              // Persist any AI-suggested annotations onto bundle_documents.
              // Fire-and-forget — annotations are nice-to-have; the bundle
              // exists either way.
              if (annotationByDocId && Object.keys(annotationByDocId).length > 0 && bundleId) {
                fetch(`/api/bundles/${bundleId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json", ...authHeaders },
                  body: JSON.stringify({
                    action: "set-annotations",
                    annotations: annotationByDocId,
                  }),
                }).catch(() => { /* annotations are best-effort */ });
              }
              setShowBundleCreator(false);
              setBundleCreatorDocs([]);
              setPendingNewBundleFolderId(null);
              const newId = `bundle-${bundleId}-${Date.now()}`;
              const newTab: Tab = { id: newId, kind: "bundle", bundleId, title, markdown: "" };
              flushSync(() => { setTabs(prev => [...prev, newTab]); });
              switchTab(newId);
              fetch("/api/bundles", { headers: authHeaders }).then(r => r.ok ? r.json() : null).then(d => { if (d?.bundles) setBundles(d.bundles); }).catch(() => {});
              showToast("Bundle created!", "success");
            } catch {
              showToast("Failed to create bundle", "error");
            }
          }}
        />
      )}

      {/* Synthesis diff/accept overlay (W4). The Update-synthesis button
          on a compiled doc opens this; on Accept the doc's markdown is
          PATCHed and the active editor refreshes. */}
      {synthesisDiffDocId && (() => {
        const tab = tabs.find((t) => t.cloudId === synthesisDiffDocId);
        return (
          <SynthesisDiff
            docId={synthesisDiffDocId}
            auth={{
              accessToken: accessToken || undefined,
              editToken: tab?.editToken,
              userId: user?.id,
              anonymousId: getAnonymousId() || undefined,
            }}
            onClose={closeSynthesisDiff}
            onAccepted={onSynthesisAccepted}
          />
        );
      })()}
    </div>
  );
}
