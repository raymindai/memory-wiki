/**
 * Shared types for the editor surface — extracted from MdEditor.tsx
 * so other modules (samples, modals, panels) can import them without
 * pulling the whole editor.
 */

import { extractTitleFromMd } from "@/lib/extract-title";

export type ViewMode = "split" | "preview" | "editor";
export type Theme = "dark" | "light";

export interface Folder {
  id: string;
  name: string;
  collapsed: boolean;
  section?: "my" | "shared" | "bundles"; // which section this folder belongs to
  parentId?: string | null;  // null/undefined = root level; otherwise nested under another folder
  emoji?: string;            // optional folder emoji prefix
  sortOrder?: number;        // manual sort_order from server (used in custom mode)
}

export interface Tab {
  id: string;
  title: string;
  markdown: string;
  kind?: "doc" | "bundle" | "hub";  // tab type — defaults to "doc"
  bundleId?: string;        // for bundle tabs — Supabase bundle id
  hubSlug?: string;         // for hub tabs — public hub slug
  folderId?: string;       // null = root level
  cloudId?: string;        // Supabase document id
  editToken?: string;      // for token-based ownership
  deleted?: boolean;       // soft delete → trash
  deletedAt?: number;      // timestamp for auto-purge
  readonly?: boolean;      // example docs — not editable
  shared?: boolean;        // opened from shared URL (not mine)
  isDraft?: boolean;       // auto-saved but not yet published
  permission?: "mine" | "editable" | "readonly";  // for sidebar badge
  editMode?: string;       // "owner" | "token" | "view" | "public"
  // Cached server share state — populated whenever we fetch the doc
  // and used to open ShareModal instantly with the right defaults
  // instead of showing a stale empty list while a fresh GET resolves.
  allowedEmails?: string[];
  allowedEditors?: string[];
  sharedWithCount?: number;
  isSharedByMe?: boolean;
  isRestricted?: boolean;
  hasPassword?: boolean;
  viewCount?: number;
  ownerEmail?: string;
  source?: string;
  lastOpenedAt?: number;
  sortOrder?: number;
  compileKind?: "memo" | "faq" | "brief";
  intent?: "note" | "definition" | "comparison" | "decision" | "question" | "reference" | null;
  compileFrom?: {
    bundleId?: string;
    docIds?: string[];
    intent?: string | null;
    sources?: Array<{ bundleId: string; docIds: string[]; intent?: string | null; compiledAt?: string | null }>;
  };
  compiledAt?: string;
  inBundles?: Array<{ id: string; title: string }>;
  unread?: boolean;
}

// Module-level stable filter functions for SidebarFolderTree's rootFolderFilter
// prop. MUST be stable across renders — if the function identity changes each
// render the tree's useMemo (which depends on this filter) invalidates,
// rebuilding the tree and reconciling root tab DOM nodes. That reconciliation
// cancels in-flight HTML5 drags (Chrome aborts the drag if the dragged element
// is replaced mid-drag).
export const FOLDER_FILTER_MY = (f: { section?: string }) => !f.section || f.section === "my";
export const FOLDER_FILTER_BUNDLES = (f: { section?: string }) => f.section === "bundles";

// Sources that count as "synced from an external client" for the
// sidebar's Synced filter + DocStatusIcon badge. A doc with source
// in this set was created in a companion app (VS Code, Desktop,
// CLI, MCP, Chrome) and is kept in sync with the web. Sources NOT
// in this list (web, api, github:..., AI provider names from
// one-shot imports) are treated as "made here" — the badge stays
// off and they fall under Private/Shared in the filter.
export const SYNCED_SOURCES: readonly string[] = ["vscode", "desktop", "cli", "mcp", "chrome"];

// Re-exported so consumers can build tabs without an extra import line.
export { extractTitleFromMd };
