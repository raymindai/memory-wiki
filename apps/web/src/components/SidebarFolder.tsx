"use client";

import { useState, useMemo, memo, useRef, useLayoutEffect, type ReactNode } from "react";
import { ChevronDown, Folder, FolderOpen, MoreHorizontal, FilePlus2, FolderPlus, Star } from "lucide-react";
import Tooltip from "@/components/Tooltip";

// Synchronous drag state. React's state batching means the first dragover events
// after dragstart see the OLD value of dragTabId/dragFolderId props (still null),
// so the gate `if (!dragTabId && !dragFolderId) return;` early-returns without
// preventDefault, and Chrome marks the element as "not a drop target" → drag ends
// with dropEffect: "none" the moment the user releases. A module-level ref updates
// synchronously inside the dragstart handler, so dragover handlers can read it
// immediately without waiting for a React re-render.
let _dragTabIdRef: string | null = null;
let _dragFolderIdRef: string | null = null;
// When the dragged tab is part of a multi-selection, this holds ALL the
// selected tab ids (including the primary `_dragTabIdRef`). When it's a
// single-tab drag, this is just `[_dragTabIdRef]`. Drop handlers iterate
// this list to move all selected tabs together.
let _dragTabIdsRef: string[] = [];

export interface SidebarFolderItem {
  id: string;
  name: string;
  collapsed: boolean;
  parentId?: string | null;
  emoji?: string;
  section?: string;
  sortOrder?: number;
}

export interface SidebarTabItem {
  id: string;
  title?: string;
  cloudId?: string;
  folderId?: string;
  lastOpenedAt?: number;
  viewCount?: number;
  permission?: string;
  isDraft?: boolean;
  editMode?: string;
  isRestricted?: boolean;
  isSharedByMe?: boolean;
  source?: string;
  sharedWithCount?: number;
  ownerEmail?: string;
  sortOrder?: number;
  // Distinguishes doc vs bundle so cross-section drops (e.g. dropping a doc
  // into a bundle canvas) can filter to doc items only. The "hub" kind is
  // a synthetic editor-only tab (one per session, never persisted to a
  // sidebar folder), so this list never actually contains hub items —
  // accept the wider union just so the upstream Tab type satisfies it.
  kind?: "doc" | "bundle" | "hub";
  // Newly added but not yet opened — drives the pulsing orange dot indicator.
  unread?: boolean;
}

export interface SidebarFolderHandlers {
  onToggleCollapsed: (folderId: string) => void;
  onRename: (folderId: string, currentName: string) => void;
  /** Optional inline-rename commits. When provided, double-click on a
   *  row + the parent's "Rename" menu entries flip the row into an
   *  in-place input; pressing Enter (or blurring) calls this with the
   *  trimmed value. Falls back to the legacy onRename prompt when
   *  absent, so older callers keep working. */
  onCommitFolderRename?: (folderId: string, newName: string) => void;
  onCommitTabRename?: (tabId: string, newName: string) => void;
  onCreateDocInFolder: (folderId: string) => void;
  onCreateSubfolder: (folderId: string) => void;
  onChangeEmoji: (folderId: string) => void;
  onOpenContextMenu: (folderId: string, x: number, y: number) => void;
  onTabClick: (tabId: string, e: React.MouseEvent) => void;
  onTabContextMenu: (tabId: string, x: number, y: number) => void;
  onTabKebab: (tabId: string, anchorRect: DOMRect) => void;
  /** Toggle a tab's starred (pinned) state from the row's hover star. */
  onTabStar?: (tabId: string) => void;
  onDropTabIntoFolder: (tabId: string, folderId: string | null) => void;
  onDropFolderIntoFolder: (movedFolderId: string, newParentId: string | null) => void;
  // Reorder a folder before/after a sibling. siblingId is the anchor folder; position
  // is "before" (new precedes sibling) or "after" (new follows sibling). Both folders
  // must end up sharing the same parent — the caller decides whether to also re-parent.
  onReorderFolder: (movedFolderId: string, siblingId: string, position: "before" | "after") => void;
  // Reorder a tab before/after a sibling tab. Both end up in the sibling's folder.
  // Only invoked when sortMode === "custom".
  onReorderTab?: (movedTabId: string, siblingTabId: string, position: "before" | "after") => void;
}

export interface SidebarFolderTreeProps {
  folders: SidebarFolderItem[];
  tabs: SidebarTabItem[];
  handlers: SidebarFolderHandlers;
  activeTabId?: string;
  selectedTabIds: Set<string>;
  activeBundleDocIds: Set<string>;
  /** Cloud IDs that received an external update within the last few
   *  seconds (e.g. MCP / CLI / iOS / another browser / AI organize
   *  pass). Their rows pulse briefly so the user sees that the doc
   *  changed even when they weren't looking at it. Parent owns the
   *  auto-clear timer. */
  freshCloudIds?: Set<string>;
  sidebarSearch: string;
  sortMode: "az" | "za" | "custom" | "newest" | "oldest";
  sidebarMode: string;
  docFilter: "all" | "private" | "shared" | "synced";
  dragTabId: string | null;
  dragFolderId: string | null;
  setDragTabId: (id: string | null) => void;
  setDragFolderId: (id: string | null) => void;
  renderTabIcon: (tab: SidebarTabItem, isActive: boolean) => ReactNode;
  // Detailed mode meta — small text under the title, only shown when sidebarMode === "detailed"
  renderTabMeta?: (tab: SidebarTabItem) => ReactNode;
  // Always-visible right-side slot (between title and kebab). Hidden on hover so the
  // kebab can take its place. Used by the bundles tree to show document count.
  renderTabBadge?: (tab: SidebarTabItem) => ReactNode;
  // Whether a tab is starred (pinned). When provided (with handlers.onTabStar),
  // each row shows a star toggle on hover, left of the kebab.
  isTabStarred?: (tab: SidebarTabItem) => boolean;
  rootFolderFilter?: (folder: SidebarFolderItem) => boolean;
  // When false, the tree skips rendering tabs that have no folderId — useful for
  // sections (like "MDs") that render root-level docs in their own block above the tree.
  // Defaults to true so callers like the bundles section see all items.
  includeRootTabs?: boolean;
  /** Controlled inline-rename. When set, the matching row renders an
   *  in-place input. Parent updates this in response to the "Rename"
   *  context menu entries OR the sidebar's own double-click trigger. */
  renamingItem?: { kind: "folder" | "tab"; id: string } | null;
  setRenamingItem?: (next: { kind: "folder" | "tab"; id: string } | null) => void;
}

interface PrecomputedTree {
  childrenByFolder: Map<string, SidebarFolderItem[]>;
  rootFolders: SidebarFolderItem[];
  tabsByFolder: Map<string, SidebarTabItem[]>;
  // Tabs without folderId — rendered at the top level of the tree
  rootTabs: SidebarTabItem[];
  totalTabCount: Map<string, number>;
  descendantsByFolder: Map<string, Set<string>>;
  // Folders that are forced-expanded because the active search has descendant matches.
  forceExpanded: Set<string>;
  parentByFolder: Map<string, string | null>;
}

function buildTree(
  folders: SidebarFolderItem[],
  tabs: SidebarTabItem[],
  search: string,
  rootFilter?: (folder: SidebarFolderItem) => boolean,
): PrecomputedTree {
  const q = search.trim().toLowerCase();
  const matches = (text: string) => !q || (text || "").toLowerCase().includes(q);

  const filteredFolders = rootFilter ? folders.filter(rootFilter) : folders;
  const idSet = new Set(filteredFolders.map(f => f.id));

  const childrenByFolder = new Map<string, SidebarFolderItem[]>();
  const parentByFolder = new Map<string, string | null>();
  const rootFolders: SidebarFolderItem[] = [];
  for (const f of filteredFolders) {
    const p = f.parentId && idSet.has(f.parentId) ? f.parentId : null;
    parentByFolder.set(f.id, p);
    if (p) {
      const arr = childrenByFolder.get(p) || [];
      arr.push(f);
      childrenByFolder.set(p, arr);
    } else {
      rootFolders.push(f);
    }
  }

  const tabsByFolder = new Map<string, SidebarTabItem[]>();
  const rootTabs: SidebarTabItem[] = [];
  for (const t of tabs) {
    if (!matches(t.title || "")) continue;
    // A tab is "root" if it has no folderId or points to a folder that's not in this section
    const folderInSection = t.folderId && idSet.has(t.folderId);
    if (!folderInSection) {
      rootTabs.push(t);
      continue;
    }
    const arr = tabsByFolder.get(t.folderId!) || [];
    arr.push(t);
    tabsByFolder.set(t.folderId!, arr);
  }

  const totalTabCount = new Map<string, number>();
  const descendantsByFolder = new Map<string, Set<string>>();
  function visit(folder: SidebarFolderItem): { count: number; descendants: Set<string> } {
    const cached = totalTabCount.get(folder.id);
    if (cached !== undefined) {
      return { count: cached, descendants: descendantsByFolder.get(folder.id) || new Set([folder.id]) };
    }
    let count = (tabsByFolder.get(folder.id) || []).length;
    const descendants = new Set<string>([folder.id]);
    const kids = childrenByFolder.get(folder.id) || [];
    for (const child of kids) {
      const sub = visit(child);
      count += sub.count;
      sub.descendants.forEach(d => descendants.add(d));
    }
    totalTabCount.set(folder.id, count);
    descendantsByFolder.set(folder.id, descendants);
    return { count, descendants };
  }
  for (const f of filteredFolders) visit(f);

  // Force-expand any folder whose descendants contain a search match
  const forceExpanded = new Set<string>();
  if (q) {
    for (const f of filteredFolders) {
      if ((totalTabCount.get(f.id) || 0) > 0 || matches(f.name || "")) {
        // Walk parents up
        let cursor: string | null = f.id;
        while (cursor) {
          forceExpanded.add(cursor);
          cursor = parentByFolder.get(cursor) ?? null;
        }
      }
    }
  }

  return { childrenByFolder, rootFolders, tabsByFolder, rootTabs, totalTabCount, descendantsByFolder, forceExpanded, parentByFolder };
}

function sortTabs(tabs: SidebarTabItem[], sortMode: SidebarFolderTreeProps["sortMode"]): SidebarTabItem[] {
  return [...tabs].sort((a, b) => {
    if (sortMode === "custom") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sortMode === "za") return (b.title || "").localeCompare(a.title || "");
    if (sortMode === "newest") return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
    if (sortMode === "oldest") return (a.lastOpenedAt ?? 0) - (b.lastOpenedAt ?? 0);
    return (a.title || "").localeCompare(b.title || "");
  });
}

function sortFolders(folders: SidebarFolderItem[], sortMode: SidebarFolderTreeProps["sortMode"], _original: SidebarFolderItem[]): SidebarFolderItem[] {
  return [...folders].sort((a, b) => {
    if (sortMode === "custom") return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (sortMode === "za") return b.name.localeCompare(a.name);
    // Folders don't carry timestamps; for newest/oldest we fall back
    // to alphabetical (custom users can drag-reorder if they want).
    if (sortMode === "newest" || sortMode === "oldest") return a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
}

type DropZone = "above" | "into" | "below";

function computeDropZone(e: React.DragEvent<HTMLElement>, allowAboveBelow: boolean): DropZone {
  if (!allowAboveBelow) return "into";
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const y = e.clientY - rect.top;
  const h = rect.height || 1;
  const t = y / h;
  if (t < 0.25) return "above";
  if (t > 0.75) return "below";
  return "into";
}

interface TabRowProps {
  tab: SidebarTabItem;
  isSelected: boolean;
  isMultiSelected: boolean;
  isActive: boolean;
  isFresh?: boolean;
  selectedTabIds: Set<string>;
  paddingLeft: number;
  paddingRight: number;
  indentGuideLeft?: number;
  sortMode: SidebarFolderTreeProps["sortMode"];
  setDragTabId: (id: string | null) => void;
  renderTabIcon: (tab: SidebarTabItem, isActive: boolean) => ReactNode;
  renderTabMeta?: (tab: SidebarTabItem) => ReactNode;
  renderTabBadge?: (tab: SidebarTabItem) => ReactNode;
  sidebarMode: string;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onKebab: (rect: DOMRect) => void;
  onStar?: () => void;
  starred?: boolean;
  onReorderTab?: SidebarFolderHandlers["onReorderTab"];
  isRenaming?: boolean;
  onCommitRename?: (value: string) => void;
  onCancelRename?: () => void;
  onStartRename?: () => void;
}

/**
 * Inline rename input — used for both tabs and folders. Autofocus +
 * select-all on mount, Enter commits, Escape cancels, blur commits.
 * Click is stopped from bubbling so the surrounding row's click
 * handler (which would activate/toggle the row) doesn't fire while
 * the user is typing.
 */
function InlineNameInput({
  defaultValue,
  onCommit,
  onCancel,
  className,
  style,
}: {
  defaultValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <input
      autoFocus
      defaultValue={defaultValue}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = e.currentTarget.value.trim();
          if (v) onCommit(v); else onCancel();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim();
        if (v && v !== defaultValue) onCommit(v); else onCancel();
      }}
      className={className}
      style={{
        background: "var(--background)",
        color: "var(--text-primary)",
        border: "1px solid var(--text-primary)",
        borderRadius: 4,
        padding: "1px 4px",
        outline: "none",
        font: "inherit",
        width: "100%",
        minWidth: 0,
        ...style,
      }}
    />
  );
}

const TabRow = memo(function TabRow(p: TabRowProps) {
  const [zone, setZone] = useState<"above" | "below" | null>(null);
  const allowReorder = p.sortMode === "custom" && !!p.onReorderTab;
  return (
    <div
      data-sidebar-tab-id={p.tab.id}
      data-fresh={p.isFresh ? "1" : undefined}
      draggable
      onDragStart={(e) => {
        _dragTabIdRef = p.tab.id;
        _dragFolderIdRef = null;
        // If the dragged tab is part of a multi-selection, drag all selected
        // together. Otherwise just this one tab.
        const ids = (p.selectedTabIds.has(p.tab.id) && p.selectedTabIds.size > 1)
          ? Array.from(p.selectedTabIds)
          : [p.tab.id];
        _dragTabIdsRef = ids;
        // "copyMove" lets the bundle canvas treat the drop as a copy (add to
        // bundle) while sidebar reorder targets still treat it as move. If we
        // restrict to "move", the browser silently rejects "copy" dropEffect
        // requested by the canvas dragover and the drop event never fires —
        // leaving the canvas's drop overlay stuck on screen.
        e.dataTransfer.effectAllowed = "copyMove";
        // Cross-section drop payload: any non-bundle dragged tab also exposes
        // its cloudId (= server document id) so a bundle canvas can read it on
        // drop and add it to the bundle. Bundle items skip this so they can't
        // be dropped onto another bundle as documents.
        // Two MIME types so the receiver can prefer doc IDs (sync needed) and
        // fall back to tab IDs for an "ineligible drop" UX hint.
        if (p.tab.kind !== "bundle") {
          try {
            if (p.tab.cloudId) {
              e.dataTransfer.setData("application/x-memorywiki-doc-ids", JSON.stringify([p.tab.cloudId]));
            }
            e.dataTransfer.setData("application/x-memorywiki-tab-ids", JSON.stringify([p.tab.id]));
            // text/plain fallback — some browsers (Chrome's "protected drag")
            // hide custom MIMEs from `types` during dragover, but always expose
            // text/* types. This guarantees the dragover handler can match
            // even before the drop fires.
            if (p.tab.cloudId) {
              e.dataTransfer.setData("text/plain", `mw-doc:${p.tab.cloudId}`);
            }
          } catch { /* ignore */ }
        }
        // Show "N items" badge on drag image when multi-select
        if (ids.length > 1) {
          try {
            const ghost = document.createElement("div");
            ghost.style.cssText = "position:absolute;top:-9999px;left:-9999px;padding:6px 10px;border-radius:6px;font:600 12px system-ui;background:var(--text-primary);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.4);";
            ghost.textContent = `${ids.length} documents`;
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 10, 10);
            setTimeout(() => ghost.remove(), 0);
          } catch { /* ignore */ }
        }
        requestAnimationFrame(() => p.setDragTabId(p.tab.id));
      }}
      onDragEnd={() => {
        _dragTabIdRef = null;
        _dragTabIdsRef = [];
        requestAnimationFrame(() => p.setDragTabId(null));
        setZone(null);
      }}
      onDragOver={(e) => {
        if (!allowReorder) return;
        const draggedTabId = _dragTabIdRef;
        if (!draggedTabId || draggedTabId === p.tab.id) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const t = (e.clientY - rect.top) / (rect.height || 1);
        const next = t < 0.5 ? "above" : "below";
        if (next !== zone) setZone(next);
      }}
      onDragLeave={() => setZone(null)}
      onDrop={(e) => {
        if (!allowReorder) return;
        const draggedTabId = _dragTabIdRef;
        if (!draggedTabId || draggedTabId === p.tab.id) return;
        e.preventDefault();
        e.stopPropagation();
        if (p.onReorderTab && zone) p.onReorderTab(draggedTabId, p.tab.id, zone === "above" ? "before" : "after");
        _dragTabIdRef = null;
        p.setDragTabId(null);
        setZone(null);
      }}
      // Three selection states:
      //  - isActive: full accent-dim fill, primary text.
      //  - bundle-member (isSelected && !isActive && !isMultiSelected):
      //      faint tinted background only — no left stripe. Same color
      //      cue as active but at much lower visual weight, so the user
      //      can scan which docs belong to the active bundle without
      //      mistaking them for the focused doc.
      //  - isMultiSelected: 1px outline.
      className={`flex items-center gap-1.5 py-1 rounded-md cursor-pointer group/tab text-xs transition-colors relative ${p.isActive ? "bg-[var(--border)]" : (p.isSelected && !p.isMultiSelected ? "" : "hover:bg-[var(--toggle-bg)]")}`}
      style={{
        paddingLeft: p.paddingLeft,
        paddingRight: p.paddingRight,
        color: p.isActive ? "var(--text-primary)" : "var(--text-secondary)",
        opacity: 1,
        outline: p.isMultiSelected ? "1px solid var(--text-primary)" : "none",
        outlineOffset: "-1px",
        background: !p.isActive && p.isSelected && !p.isMultiSelected ? "color-mix(in srgb, var(--border) 40%, transparent)" : undefined,
      }}
      onClick={p.onClick}
      onContextMenu={p.onContextMenu}
      onDoubleClick={(e) => {
        if (!p.onStartRename) return;
        e.preventDefault();
        e.stopPropagation();
        p.onStartRename();
      }}
    >
      {zone === "above" && (
        <div aria-hidden className="absolute left-1 right-1 -top-px h-0.5 rounded" style={{ background: "var(--text-primary)" }} />
      )}
      {zone === "below" && (
        <div aria-hidden className="absolute left-1 right-1 -bottom-px h-0.5 rounded" style={{ background: "var(--text-primary)" }} />
      )}
      {p.indentGuideLeft !== undefined && (
        <div aria-hidden className="absolute top-0 bottom-0" style={{ left: p.indentGuideLeft, width: 1, background: "var(--border-dim)" }} />
      )}
      {/* Unread indicator — newly added tab the user hasn't opened yet.
          Cleared on first activation. Pulses orange to draw the eye in a
          long sidebar list. Sits left of the tab icon so it's the first
          thing the eye lands on. */}
      {p.tab.unread && (
        <span aria-label="New" title="New — not yet opened"
          className="sidebar-unread-dot shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: "var(--text-primary)" }} />
      )}
      {p.renderTabIcon(p.tab, p.isActive)}
      <div className="truncate flex-1 min-w-0">
        {p.isRenaming && p.onCommitRename && p.onCancelRename ? (
          <InlineNameInput
            defaultValue={p.tab.title || ""}
            onCommit={p.onCommitRename}
            onCancel={p.onCancelRename}
            className="text-body"
          />
        ) : (
          <span className="truncate block text-body">{p.tab.title || "Untitled"}</span>
        )}
        {p.sidebarMode === "detailed" && p.renderTabMeta?.(p.tab)}
      </div>
      {(() => {
        // Only reserve the right-side slot when the badge actually
        // renders something. Empty badges (e.g. unstarred docs whose
        // renderTabBadge returns null) used to leave a 20px gap that
        // truncated long file names; now the title gets the full
        // remaining width whenever no badge content exists. Position
        // (right-aligned, hidden on hover) matches folder/bundle
        // count headers above so a star here lands at the same x.
        if (!p.renderTabBadge) return null;
        const badgeNode = p.renderTabBadge(p.tab);
        if (!badgeNode) return null;
        return (
          <span className="shrink-0 inline-flex items-center justify-end tabular-nums group-hover/tab:hidden" style={{ minWidth: 20 }}>
            {badgeNode}
          </span>
        );
      })()}
      {p.onStar && (
        <Tooltip text={p.starred ? "Unstar" : "Star"}>
          <button
            onClick={(e) => { e.stopPropagation(); p.onStar!(); }}
            data-action="star"
            data-starred={p.starred ? "1" : "0"}
            className="shrink-0 rounded flex items-center justify-center w-0 group-hover/tab:w-[22px] overflow-hidden transition-all duration-150 hover:bg-[var(--toggle-bg)]"
            style={{ color: p.starred ? "var(--micro-warn)" : "var(--text-muted)" }}
          >
            <Star width={14} height={14} fill={p.starred ? "currentColor" : "none"} />
          </button>
        </Tooltip>
      )}
      <Tooltip text="More options (rename, share, delete…)">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            p.onKebab(rect);
          }}
          className="shrink-0 rounded flex items-center justify-center w-0 group-hover/tab:w-[22px] overflow-hidden transition-all duration-150 hover:bg-[var(--toggle-bg)]"
          style={{ color: "var(--text-muted)" }}
        >
          <MoreHorizontal width={15} height={15} />
        </button>
      </Tooltip>
    </div>
  );
});

interface FolderNodeProps {
  folder: SidebarFolderItem;
  depth: number;
  tree: PrecomputedTree;
  folders: SidebarFolderItem[];
  handlers: SidebarFolderHandlers;
  activeTabId?: string;
  selectedTabIds: Set<string>;
  activeBundleDocIds: Set<string>;
  sidebarSearch: string;
  sortMode: SidebarFolderTreeProps["sortMode"];
  sidebarMode: string;
  docFilter: SidebarFolderTreeProps["docFilter"];
  dragTabId: string | null;
  dragFolderId: string | null;
  setDragTabId: (id: string | null) => void;
  setDragFolderId: (id: string | null) => void;
  renderTabIcon: (tab: SidebarTabItem, isActive: boolean) => ReactNode;
  renderTabMeta?: (tab: SidebarTabItem) => ReactNode;
  renderTabBadge?: (tab: SidebarTabItem) => ReactNode;
  isTabStarred?: (tab: SidebarTabItem) => boolean;
  freshCloudIds?: Set<string>;
  /** Controlled inline-rename state, threaded from the tree root. */
  renamingItem?: { kind: "folder" | "tab"; id: string } | null;
  setRenamingItem?: (next: { kind: "folder" | "tab"; id: string } | null) => void;
  isRenaming?: boolean;
  onCommitRename?: (value: string) => void;
  onCancelRename?: () => void;
}

function FolderNode(props: FolderNodeProps) {
  const {
    folder,
    depth,
    tree,
    folders,
    handlers,
    activeTabId,
    selectedTabIds,
    activeBundleDocIds,
    sidebarSearch,
    sortMode,
    sidebarMode,
    docFilter,
    dragTabId,
    dragFolderId,
    setDragTabId,
    setDragFolderId,
    renderTabIcon,
    renderTabMeta,
    renderTabBadge,
  } = props;

  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  const subfolders = tree.childrenByFolder.get(folder.id) || [];
  const folderTabs = tree.tabsByFolder.get(folder.id) || [];
  const totalCount = tree.totalTabCount.get(folder.id) || 0;
  const expanded = !folder.collapsed || tree.forceExpanded.has(folder.id);

  if ((sidebarSearch || docFilter !== "all") && totalCount === 0) return null;

  const folderHasBundleDoc = activeBundleDocIds.size > 0 && (() => {
    if (folderTabs.some(t => t.cloudId && activeBundleDocIds.has(t.cloudId))) return true;
    const descendants = tree.descendantsByFolder.get(folder.id) || new Set();
    for (const dId of descendants) {
      if (dId === folder.id) continue;
      const ts = tree.tabsByFolder.get(dId) || [];
      if (ts.some(t => t.cloudId && activeBundleDocIds.has(t.cloudId))) return true;
    }
    return false;
  })();

  const wouldCreateCycle = !!dragFolderId && (tree.descendantsByFolder.get(dragFolderId)?.has(folder.id) ?? false);

  const sortedSubfolders = sortFolders(subfolders, sortMode, folders);
  const sortedTabs = sortTabs(folderTabs, sortMode);

  const indentLeft = depth * 12;

  return (
    <div className="mt-0.5">
      <div
        data-sidebar-folder-id={folder.id}
        draggable
        onDragStart={(e) => {
          _dragFolderIdRef = folder.id;
          _dragTabIdRef = null;
          e.dataTransfer.effectAllowed = "move";
          // Defer the React state update — calling setDragFolderId synchronously
          // re-renders the entire MdEditor (~12K LoC) inside the dragstart handler,
          // which can take 200ms+. Chrome cancels the drag if dragstart is too slow.
          // The module-level ref above is the source of truth during the drag;
          // the React state only drives "Move to root" UI which can wait one frame.
          requestAnimationFrame(() => setDragFolderId(folder.id));
        }}
        onDragEnd={() => {
          _dragFolderIdRef = null;
          requestAnimationFrame(() => setDragFolderId(null));
          setDropZone(null);
        }}
        className={`flex items-center gap-1 py-1 rounded-md cursor-pointer text-xs font-medium transition-colors group/folder relative ${dropZone === "into" && !wouldCreateCycle ? "bg-[var(--border)]" : "hover:bg-[var(--toggle-bg)]"}`}
        style={{
          paddingLeft: indentLeft + 2,
          paddingRight: 6,
          color: folderHasBundleDoc ? "var(--text-primary)" : "var(--text-muted)",
          opacity: 1,
          outline: dropZone === "into" && !wouldCreateCycle ? "1px solid var(--text-primary)" : "none",
        }}
        onClick={() => handlers.onToggleCollapsed(folder.id)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (handlers.onCommitFolderRename && props.setRenamingItem) {
            props.setRenamingItem({ kind: "folder", id: folder.id });
            return;
          }
          handlers.onRename(folder.id, folder.name);
        }}
        onDragOver={(e) => {
          // ALWAYS preventDefault — matches the old working pattern. Gating on
          // ref/state and returning without preventDefault makes Chrome mark
          // this element as a non-drop-target and cancels the drag.
          e.preventDefault();
          const tabId = _dragTabIdRef;
          const folderId = _dragFolderIdRef;
          if (!tabId && !folderId) return;
          if (folderId === folder.id) return;
          const allowAboveBelow = !!folderId;
          const zone = computeDropZone(e, allowAboveBelow);
          if (zone === "into" && wouldCreateCycle) return;
          e.dataTransfer.dropEffect = "move";
          if (zone !== dropZone) setDropZone(zone);
        }}
        onDragLeave={() => setDropZone(null)}
        onDrop={(e) => {
          e.preventDefault();
          // Stop the tree-level "drop to root" handler from also firing
          // — a folder drop is a folder drop, not a root move.
          e.stopPropagation();
          const tabIds = _dragTabIdsRef.length > 0 ? _dragTabIdsRef : (_dragTabIdRef ? [_dragTabIdRef] : (dragTabId ? [dragTabId] : []));
          const folderId = _dragFolderIdRef ?? dragFolderId;
          if (tabIds.length > 0) {
            for (const tid of tabIds) handlers.onDropTabIntoFolder(tid, folder.id);
          } else if (folderId && folderId !== folder.id) {
            if (dropZone === "into" && !wouldCreateCycle) {
              handlers.onDropFolderIntoFolder(folderId, folder.id);
            } else if (dropZone === "above" || dropZone === "below") {
              handlers.onReorderFolder(folderId, folder.id, dropZone === "above" ? "before" : "after");
            }
          }
          _dragTabIdRef = null;
          _dragTabIdsRef = [];
          _dragFolderIdRef = null;
          setDragTabId(null);
          setDragFolderId(null);
          setDropZone(null);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handlers.onOpenContextMenu(folder.id, e.clientX, e.clientY);
        }}
      >
        {/* Drop indicator lines */}
        {dropZone === "above" && (
          <div aria-hidden className="absolute left-1 right-1 -top-px h-0.5 rounded" style={{ background: "var(--text-primary)" }} />
        )}
        {dropZone === "below" && (
          <div aria-hidden className="absolute left-1 right-1 -bottom-px h-0.5 rounded" style={{ background: "var(--text-primary)" }} />
        )}
        {/* Indent guide */}
        {depth > 0 && (
          <div
            aria-hidden
            className="absolute top-0 bottom-0"
            style={{ left: indentLeft - 6, width: 1, background: "var(--border-dim)" }}
          />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handlers.onToggleCollapsed(folder.id); }}
          className="shrink-0 flex items-center justify-center transition-transform"
          style={{ width: 12, height: 12, color: "var(--text-faint)", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
          tabIndex={-1}
        >
          <ChevronDown width={10} height={10} />
        </button>
        {/* Folder icon / emoji — clicking opens emoji picker */}
        <Tooltip text="Change folder icon">
          <button
            onClick={(e) => { e.stopPropagation(); handlers.onChangeEmoji(folder.id); }}
            className="shrink-0 flex items-center justify-center hover:bg-[var(--toggle-bg)] rounded"
            style={{ width: 18, height: 18 }}
            tabIndex={-1}
          >
            {folder.emoji ? (
              <span className="text-body leading-none">{folder.emoji}</span>
            ) : expanded ? (
              <FolderOpen width={14} height={14} style={{ color: "var(--text-faint)" }} />
            ) : (
              <Folder width={14} height={14} style={{ color: "var(--text-faint)" }} />
            )}
          </button>
        </Tooltip>
        {props.isRenaming && props.onCommitRename && props.onCancelRename ? (
          <div className="flex-1 min-w-0">
            <InlineNameInput
              defaultValue={folder.name}
              onCommit={props.onCommitRename}
              onCancel={props.onCancelRename}
            />
          </div>
        ) : (
          <span className="truncate flex-1">{folder.name}</span>
        )}
        {/* Right cluster — wrap count + action buttons with same gap-1.5 used
            inside TabRow so trailing counts line up at exactly the same x. */}
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Same marginRight=0 as the TabRow badge so the folder
              count lands at the exact same x as tab counts inside
              this folder (and as the section header count above). */}
          <span className="text-caption text-right tabular-nums group-hover/folder:hidden" style={{ color: "var(--text-faint)", opacity: 0.6, minWidth: 20 }}>
            {totalCount}
          </span>
          <div className="flex items-center gap-0.5 overflow-hidden transition-all duration-150 w-0 group-hover/folder:w-auto">
            <Tooltip text="New document in this folder">
              <button
                onClick={(e) => { e.stopPropagation(); handlers.onCreateDocInFolder(folder.id); }}
                className="rounded flex items-center justify-center w-5 h-5 hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-faint)" }}
              >
                <FilePlus2 width={13} height={13} />
              </button>
            </Tooltip>
            <Tooltip text="New subfolder">
              <button
                onClick={(e) => { e.stopPropagation(); handlers.onCreateSubfolder(folder.id); }}
                className="rounded flex items-center justify-center w-5 h-5 hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-faint)" }}
              >
                <FolderPlus width={13} height={13} />
              </button>
            </Tooltip>
            <Tooltip text="Folder options (rename, delete, move…)">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  handlers.onOpenContextMenu(folder.id, rect.right, rect.bottom);
                }}
                className="rounded flex items-center justify-center w-5 h-5 hover:bg-[var(--toggle-bg)]"
                style={{ color: "var(--text-faint)" }}
              >
                <MoreHorizontal width={13} height={13} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Children render only when expanded. We previously wrapped this in an
          animated `overflow: hidden` container, but that broke HTML5 drag for
          all descendants (Chrome treats nested draggable items inside a clipped
          ancestor as un-draggable). Conditional render restores drag at the
          cost of the collapse animation — animation comes back in a Phase 3
          using View Transitions or per-item slide instead of clip. */}
      {expanded && (
        <>
          {sortedSubfolders.map(sub => {
            const subRenaming = props.renamingItem?.kind === "folder" && props.renamingItem.id === sub.id;
            return (
              <FolderNode
                key={sub.id}
                {...props}
                folder={sub}
                depth={depth + 1}
                isRenaming={subRenaming}
                onCommitRename={subRenaming && handlers.onCommitFolderRename
                  ? (v) => { handlers.onCommitFolderRename?.(sub.id, v); props.setRenamingItem?.(null); }
                  : undefined}
                onCancelRename={subRenaming ? () => props.setRenamingItem?.(null) : undefined}
              />
            );
          })}
          {sortedTabs.map(tab => {
            const inActiveBundle = activeBundleDocIds.size > 0 && !!tab.cloudId && activeBundleDocIds.has(tab.cloudId);
            const isSelected = selectedTabIds.has(tab.id) || tab.id === activeTabId || inActiveBundle;
            const tabIndent = (depth + 1) * 12;
            const tabRenaming = props.renamingItem?.kind === "tab" && props.renamingItem.id === tab.id;
            const isFresh = !!(tab.cloudId && props.freshCloudIds?.has(tab.cloudId));
            return (
              <TabRow
                key={tab.id}
                tab={tab}
                isSelected={isSelected}
                isMultiSelected={selectedTabIds.has(tab.id)}
                isActive={tab.id === activeTabId}
                isFresh={isFresh}
                selectedTabIds={selectedTabIds}
                paddingLeft={tabIndent + 4}
                paddingRight={6}
                indentGuideLeft={tabIndent - 6}
                sortMode={sortMode}
                setDragTabId={setDragTabId}
                renderTabIcon={renderTabIcon}
                renderTabMeta={renderTabMeta}
                renderTabBadge={renderTabBadge}
                sidebarMode={sidebarMode}
                onClick={(e) => handlers.onTabClick(tab.id, e)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handlers.onTabContextMenu(tab.id, e.clientX, e.clientY); }}
                onKebab={(rect) => handlers.onTabKebab(tab.id, rect)}
                onStar={handlers.onTabStar ? () => handlers.onTabStar!(tab.id) : undefined}
                starred={props.isTabStarred?.(tab)}
                onReorderTab={handlers.onReorderTab}
                isRenaming={tabRenaming}
                onStartRename={handlers.onCommitTabRename && props.setRenamingItem
                  ? () => props.setRenamingItem?.({ kind: "tab", id: tab.id })
                  : undefined}
                onCommitRename={tabRenaming && handlers.onCommitTabRename
                  ? (v) => { handlers.onCommitTabRename?.(tab.id, v); props.setRenamingItem?.(null); }
                  : undefined}
                onCancelRename={tabRenaming ? () => props.setRenamingItem?.(null) : undefined}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

export default function SidebarFolderTree(props: SidebarFolderTreeProps) {
  const { folders, tabs, sidebarSearch, sortMode, rootFolderFilter } = props;

  const tree = useMemo(
    () => buildTree(folders, tabs, sidebarSearch, rootFolderFilter),
    [folders, tabs, sidebarSearch, rootFolderFilter],
  );

  const sortedRoots = useMemo(
    () => sortFolders(tree.rootFolders, sortMode, folders),
    [tree.rootFolders, sortMode, folders],
  );

  // FLIP reorder animation for every tab row in the tree, regardless of
  // which section rendered it. The Recent list got this first; founder
  // feedback was that flipping the sort mode (or renaming a doc that
  // changes its A→Z slot) in the MDs/Bundles/Shared sections felt jumpy
  // because rows just teleported. Each TabRow tags itself with
  // data-sidebar-tab-id, so a single post-render pass queries them in
  // visual order, compares against the captured previous order, and
  // applies an inverted translate animated back to identity for rows
  // whose top changed by more than 1px. Re-captures every render so
  // unrelated commits don't strand stale rects.
  const treeRef = useRef<HTMLDivElement>(null);
  const lastOrderRef = useRef<string>("");
  const lastRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // Track whether a drag was in flight on the previous render AND
  // which item was being dragged. When a drop lands, dragTabId/
  // dragFolderId clear AND the folder_id update hits state in the
  // same commit, so the next render sees a brand-new row order.
  // Animating the long traversal (e.g. a row jumping from a deep
  // folder to the root) bounces every row in between — founder
  // feedback called this out as the worst part of the drag-out UX.
  // We skip FLIP for the post-drop frame so rows snap into place,
  // then immediately scroll the dropped item into view and pulse it
  // so the user can see WHERE it landed.
  const wasDraggingRef = useRef(false);
  const lastDraggedTabIdRef = useRef<string | null>(null);
  const lastDraggedFolderIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const root = treeRef.current;
    if (!root) return;
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-sidebar-tab-id]"));
    const orderKey = rows.map(r => r.dataset.sidebarTabId).join("|");
    const isFirstPaint = lastOrderRef.current === "";
    const changed = !isFirstPaint && orderKey !== lastOrderRef.current;
    const isDragNow = !!(props.dragTabId || props.dragFolderId);
    const justDropped = wasDraggingRef.current && !isDragNow;
    // Capture the dragged id BEFORE it clears so we can locate the
    // dropped row on the post-drop frame.
    if (props.dragTabId)    lastDraggedTabIdRef.current    = props.dragTabId;
    if (props.dragFolderId) lastDraggedFolderIdRef.current = props.dragFolderId;
    wasDraggingRef.current = isDragNow;

    // On the post-drop frame, find the dropped row in its new
    // position, scroll it into view (smooth, nearest edge so we don't
    // jolt the sidebar), and stamp `data-just-dropped` so the CSS
    // pulse fires. The attribute clears after 1.6s.
    if (justDropped && changed) {
      const droppedTabId = lastDraggedTabIdRef.current;
      const droppedFolderId = lastDraggedFolderIdRef.current;
      const target = droppedTabId
        ? root.querySelector<HTMLElement>(`[data-sidebar-tab-id="${CSS.escape(droppedTabId)}"]`)
        : droppedFolderId
        ? root.querySelector<HTMLElement>(`[data-sidebar-folder-id="${CSS.escape(droppedFolderId)}"]`)
        : null;
      if (target) {
        try { target.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch { /* ignore */ }
        target.setAttribute("data-just-dropped", "1");
        setTimeout(() => target.removeAttribute("data-just-dropped"), 1600);
      }
      lastDraggedTabIdRef.current = null;
      lastDraggedFolderIdRef.current = null;
    }
    // Fast path — when nothing about the row set / order changed, the
    // expensive getBoundingClientRect() loop below is pure waste (it
    // forces a layout pass on every commit, which on the editor's
    // ~16K-LoC parent re-renders pegs the scheduler with 200-300ms
    // "long task" violations). lastRectsRef stays consistent because
    // the visual layout also didn't change.
    if (!isFirstPaint && !changed) return;
    // The FLIP animation is for REORDERING (sort flip, rename moves
    // a doc into a different alphabetical slot). Folder expand/
    // collapse adds or removes child rows — same parent siblings
    // shift to make room, but that's container chrome, not reorder.
    // If the set of ids changed (any add or remove), skip the FLIP
    // pass — otherwise every folder toggle bounces all rows below
    // it through a 280ms slide.
    const prevIds = new Set(lastOrderRef.current.split("|"));
    const nextIds = new Set(rows.map((r) => r.dataset.sidebarTabId || ""));
    let setEqual = prevIds.size === nextIds.size;
    if (setEqual) for (const id of nextIds) if (!prevIds.has(id)) { setEqual = false; break; }
    // Same skip when this commit is the immediate aftermath of a drop
    // — let the dropped item (and the rows it displaced) settle into
    // place instantly instead of sliding.
    const shouldFlip = changed && setEqual && !justDropped;

    if (shouldFlip) {
      const prev = lastRectsRef.current;
      for (const el of rows) {
        const id = el.dataset.sidebarTabId;
        if (!id) continue;
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

    const next = new Map<string, DOMRect>();
    for (const el of rows) {
      const id = el.dataset.sidebarTabId;
      if (id) next.set(id, el.getBoundingClientRect());
    }
    lastRectsRef.current = next;
    lastOrderRef.current = orderKey;
  });

  // Explicit, visible "Move to root" drop slot at the bottom of the tree. Shows
  // only while something is being dragged and the dragged item isn't already at root.
  const [rootHover, setRootHover] = useState(false);
  const draggingTab = !!props.dragTabId;
  const draggingFolder = !!props.dragFolderId;
  const draggedTab = draggingTab ? props.tabs.find(t => t.id === props.dragTabId) : null;
  const draggedFolder = draggingFolder ? props.folders.find(f => f.id === props.dragFolderId) : null;
  // Don't bother showing the slot if the item is already a root item (no-op drop)
  const itemAlreadyAtRoot = (draggedTab && !draggedTab.folderId) || (draggedFolder && !draggedFolder.parentId);
  const showRootSlot = (draggingTab || draggingFolder) && !itemAlreadyAtRoot;

  // Tree-level drop-to-root: any drop that lands on the tree
  // background (not a folder row, not a tab reorder zone) moves the
  // dragged item to the root. Folder onDrop calls stopPropagation, so
  // this only fires when the drop missed every inner target.
  // Visual: when dragging, the tree shows a faint tint to indicate the
  // whole area is droppable.
  const [treeRootHover, setTreeRootHover] = useState(false);
  return (
    <div
      ref={treeRef}
      onDragOver={(e) => {
        if (!draggingTab && !draggingFolder) return;
        if (itemAlreadyAtRoot) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!treeRootHover) setTreeRootHover(true);
      }}
      onDragLeave={(e) => {
        // Only clear the hover when the pointer actually leaves the
        // tree (not when it transitions between child rows).
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setTreeRootHover(false);
      }}
      onDrop={(e) => {
        if (!draggingTab && !draggingFolder) return;
        e.preventDefault();
        const tabIds = _dragTabIdsRef.length > 0 ? _dragTabIdsRef : (_dragTabIdRef ? [_dragTabIdRef] : (props.dragTabId ? [props.dragTabId] : []));
        const folderId = _dragFolderIdRef ?? props.dragFolderId;
        for (const tid of tabIds) props.handlers.onDropTabIntoFolder(tid, null);
        if (folderId) props.handlers.onDropFolderIntoFolder(folderId, null);
        _dragTabIdRef = null;
        _dragTabIdsRef = [];
        _dragFolderIdRef = null;
        props.setDragTabId(null);
        props.setDragFolderId(null);
        setTreeRootHover(false);
        setRootHover(false);
      }}
      style={{
        // Drag catchment area: gives users a real empty-space drop
        // target below the last row so they don't have to hunt for
        // the explicit "Drop here…" tile.
        //
        // Only inflate WHILE a drag is in flight. In idle state the
        // 120px reservation made empty sections (e.g. MDs with 0
        // docs) look weirdly tall vs. neighbouring sections that
        // don't use this tree component (Recent / Shared with me /
        // Trash). Founder noted: "why does only this section have
        // empty space?".
        minHeight: (draggingTab || draggingFolder) ? 120 : 0,
        paddingBottom: (draggingTab || draggingFolder) ? 16 : 0,
        // Subtle background tint while a non-root item is being dragged
        // — communicates "drop anywhere here = move out of folder".
        background: treeRootHover && (draggingTab || draggingFolder) && !itemAlreadyAtRoot
          ? "color-mix(in srgb, var(--border) 40%, transparent)"
          : undefined,
        borderRadius: 6,
        transition: "background 0.12s, min-height 0.12s, padding-bottom 0.12s",
      }}
    >
      {/* Folders first — matches Finder / VS Code / Notion / Obsidian
          convention. Containers scan first; loose items below. */}
      {sortedRoots.map(folder => {
        const isRen = props.renamingItem?.kind === "folder" && props.renamingItem.id === folder.id;
        return (
          <FolderNode
            key={folder.id}
            folder={folder}
            depth={0}
            tree={tree}
            folders={folders}
            handlers={props.handlers}
            activeTabId={props.activeTabId}
            selectedTabIds={props.selectedTabIds}
            activeBundleDocIds={props.activeBundleDocIds}
            sidebarSearch={sidebarSearch}
            sortMode={sortMode}
            sidebarMode={props.sidebarMode}
            docFilter={props.docFilter}
            dragTabId={props.dragTabId}
            dragFolderId={props.dragFolderId}
            setDragTabId={props.setDragTabId}
            setDragFolderId={props.setDragFolderId}
            renderTabIcon={props.renderTabIcon}
            renderTabMeta={props.renderTabMeta}
            renderTabBadge={props.renderTabBadge}
            isTabStarred={props.isTabStarred}
            freshCloudIds={props.freshCloudIds}
            renamingItem={props.renamingItem}
            setRenamingItem={props.setRenamingItem}
            isRenaming={isRen}
            onCommitRename={isRen && props.handlers.onCommitFolderRename
              ? (v) => { props.handlers.onCommitFolderRename?.(folder.id, v); props.setRenamingItem?.(null); }
              : undefined}
            onCancelRename={isRen ? () => props.setRenamingItem?.(null) : undefined}
          />
        );
      })}
      {/* Root-level tabs (no folder) — rendered AFTER folders so the
          containers scan first. Sections that render their own root
          list separately set includeRootTabs={false}. */}
      {(props.includeRootTabs !== false) && sortTabs(tree.rootTabs, sortMode).map(tab => {
        const inActiveBundle = props.activeBundleDocIds.size > 0 && !!tab.cloudId && props.activeBundleDocIds.has(tab.cloudId);
        const isSelected = props.selectedTabIds.has(tab.id) || tab.id === props.activeTabId || inActiveBundle;
        const tabRenaming = props.renamingItem?.kind === "tab" && props.renamingItem.id === tab.id;
        return (
          // Wrap in mt-0.5 div to match FolderNode's outer structure. Without this
          // wrapper, root tabs rendered as direct children of SidebarFolderTree's
          // wrapper div have HTML5 drag canceled by Chrome.
          <div key={tab.id} className="mt-0.5">
            <TabRow
              tab={tab}
              isSelected={isSelected}
              isMultiSelected={props.selectedTabIds.has(tab.id)}
              isActive={tab.id === props.activeTabId}
              isFresh={!!(tab.cloudId && props.freshCloudIds?.has(tab.cloudId))}
              selectedTabIds={props.selectedTabIds}
              paddingLeft={6}
              paddingRight={6}
              sortMode={sortMode}
              setDragTabId={props.setDragTabId}
              renderTabIcon={props.renderTabIcon}
              renderTabMeta={props.renderTabMeta}
              renderTabBadge={props.renderTabBadge}
              sidebarMode={props.sidebarMode}
              onClick={(e) => props.handlers.onTabClick(tab.id, e)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); props.handlers.onTabContextMenu(tab.id, e.clientX, e.clientY); }}
              onKebab={(rect) => props.handlers.onTabKebab(tab.id, rect)}
              onStar={props.handlers.onTabStar ? () => props.handlers.onTabStar!(tab.id) : undefined}
              starred={props.isTabStarred?.(tab)}
              onReorderTab={props.handlers.onReorderTab}
              isRenaming={tabRenaming}
              onStartRename={props.handlers.onCommitTabRename && props.setRenamingItem
                ? () => props.setRenamingItem?.({ kind: "tab", id: tab.id })
                : undefined}
              onCommitRename={tabRenaming && props.handlers.onCommitTabRename
                ? (v) => { props.handlers.onCommitTabRename?.(tab.id, v); props.setRenamingItem?.(null); }
                : undefined}
              onCancelRename={tabRenaming ? () => props.setRenamingItem?.(null) : undefined}
            />
          </div>
        );
      })}
      {/* Visible "Move to root" drop slot — only while dragging a non-root item */}
      {showRootSlot && (
        <div
          className="mx-1 mt-2 mb-1 px-3 py-2 rounded-md text-caption text-center select-none"
          style={{
            border: `1px dashed ${rootHover ? "var(--text-primary)" : "var(--border)"}`,
            color: rootHover ? "var(--text-primary)" : "var(--text-faint)",
            background: rootHover ? "var(--border)" : "transparent",
            transition: "background 0.1s, color 0.1s, border-color 0.1s",
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!rootHover) setRootHover(true); }}
          onDragLeave={() => setRootHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            const tabIds = _dragTabIdsRef.length > 0 ? _dragTabIdsRef : (_dragTabIdRef ? [_dragTabIdRef] : (props.dragTabId ? [props.dragTabId] : []));
            const folderId = _dragFolderIdRef ?? props.dragFolderId;
            for (const tid of tabIds) props.handlers.onDropTabIntoFolder(tid, null);
            if (folderId) props.handlers.onDropFolderIntoFolder(folderId, null);
            _dragTabIdRef = null;
            _dragTabIdsRef = [];
            _dragFolderIdRef = null;
            props.setDragTabId(null);
            props.setDragFolderId(null);
            setRootHover(false);
          }}
        >
          Drop here to move to top level
        </div>
      )}
    </div>
  );
}
