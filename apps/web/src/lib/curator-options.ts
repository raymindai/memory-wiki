// Curator options — user-configurable list of auto-management
// signals that memory.wiki runs against the user's hub. Each option owns
// one rule; the user toggles which ones surface in Needs Review.
//
// Storage: localStorage in v1 (key `mdfy-curator-settings`). v2 can
// promote this to a profiles.curator_settings JSONB column for
// cross-device sync; the shape here is already JSON-serializable so
// the migration is just "read from profile when present, fall back
// to localStorage."
//
// Why a config layer at all: the founder wants curator signals to be
// opt-in per user. A power user may want every signal on; a casual
// user may only want orphan + duplicate. Hard-wiring all eight on by
// default produces noise; hard-wiring all off produces no value. The
// toggle list lets each user dial it.

export type CuratorOptionId =
  | "orphan"
  | "duplicate"
  | "stale"
  | "title-mismatch"
  | "citation-rot"
  | "rollup"
  | "merge"
  | "auto-archive";

export interface CuratorOption {
  id: CuratorOptionId;
  label: string;
  description: string;
  /** True when the rule is wired into the lint backend today. False
   *  when the toggle exists but the signal isn't running yet — UI
   *  shows "Coming soon" and disables the toggle. */
  shipped: boolean;
  /** Default state for a new user. We default-enable the two signals
   *  that actually ship (orphan, duplicate) and leave the rest off
   *  until they land — so a brand-new account starts useful but quiet. */
  defaultEnabled: boolean;
}

export const CURATOR_OPTIONS: CuratorOption[] = [
  {
    id: "orphan",
    label: "Orphan docs",
    description: "Docs that aren't in any bundle, aren't linked from another doc, and don't share concepts with anything else. Resolve re-runs concept extraction.",
    shipped: true,
    defaultEnabled: true,
  },
  {
    id: "duplicate",
    label: "Likely duplicates",
    description: "Two docs whose embeddings are close enough that you probably meant to merge or supersede one. Resolve moves the older copy to Trash.",
    shipped: true,
    defaultEnabled: true,
  },
  {
    id: "stale",
    label: "Stale claims",
    description: "Docs older than 90 days that are still heavily referenced — flagged so you can re-read and confirm they're still true.",
    shipped: false,
    defaultEnabled: false,
  },
  {
    id: "title-mismatch",
    label: "Title / body mismatch",
    description: "Title doesn't mention the doc's central concept. Common after AI capture picked a generic header.",
    shipped: true,
    defaultEnabled: false,
  },
  {
    id: "citation-rot",
    label: "Citation rot",
    description: "External links in your docs that return 4xx/5xx. Surfaced so you can replace or remove.",
    shipped: false,
    defaultEnabled: false,
  },
  {
    id: "rollup",
    label: "Roll-up suggestions",
    description: "When 10+ docs share a concept, memory.wiki suggests synthesising them into a single summary doc you can compile.",
    shipped: false,
    defaultEnabled: false,
  },
  {
    id: "merge",
    label: "Merge suggestions",
    description: "Two docs covering the same topic from different angles. Surfaced so you can decide whether to merge them.",
    shipped: false,
    defaultEnabled: false,
  },
  {
    id: "auto-archive",
    label: "Auto-archive",
    description: "Docs untouched for 90+ days that no other doc references move to an Archive folder automatically. Always restorable.",
    shipped: false,
    defaultEnabled: false,
  },
];

const STORAGE_KEY = "mdfy-curator-settings";

// Auto-management trigger — when the system attempts to act on the
// findings the curator surfaces. The per-signal toggles still govern
// WHICH signals run; this governs WHEN auto-resolution fires.
//
//   manual    — surface only. User clicks Resolve / Resolve All to act.
//   on-open   — every time the Hub overlay opens, the level's action
//               matrix runs.
//   interval  — every 30 minutes while the app is in the foreground.
export type AutoTrigger = "manual" | "on-open" | "interval";

// How aggressively auto-management acts when it fires. Four-level
// scale, all reversible (irreversible actions — public publish,
// external-link rewrites, hard delete — are NEVER automated, even
// at Aggressive).
//
//   off          No auto-action. Findings just surface in Needs
//                Review / Suggestions for manual resolve.
//
//   conservative Only non-destructive automation. Orphans get an
//                automatic refresh-concepts pass; nothing else runs.
//
//   standard     Above + reversible content fixes. Title-mismatch
//                auto-renames the doc title to match the dominant
//                concept; stale docs get a "stale" tag; rollup +
//                merge stay as Suggestions; duplicates still ASK
//                before trashing.
//
//   aggressive   Above + reversible trash moves. Duplicates auto-
//                trash the older copy; auto-archive moves
//                90-day-untouched docs into an Archive folder.
//                Everything still recoverable from Trash.
export type AutoLevel = "off" | "conservative" | "standard" | "aggressive";

export interface AutoLevelDescriptor {
  id: AutoLevel;
  label: string;
  shortDesc: string;
  /** One-line description of the action matrix at this level. */
  longDesc: string;
}

export const AUTO_LEVELS: AutoLevelDescriptor[] = [
  {
    id: "off",
    label: "Off",
    shortDesc: "Surface only",
    longDesc: "Findings appear in Needs Review and Suggestions; you resolve them by hand. Nothing is changed automatically.",
  },
  {
    id: "conservative",
    label: "Conservative",
    shortDesc: "Safe auto-fix",
    longDesc: "Orphan docs get an automatic concept refresh — if they share concepts with another doc, they drop off the list. Everything else still asks.",
  },
  {
    id: "standard",
    label: "Standard",
    shortDesc: "+ reversible fixes",
    longDesc: "Adds title-mismatch auto-rename and a stale-tag pass. Duplicates still ask before trashing; rollup + merge stay as suggestions.",
  },
  {
    id: "aggressive",
    label: "Aggressive",
    shortDesc: "+ reversible trash",
    longDesc: "Adds auto-trash of duplicate older copies (recoverable from Trash) and auto-archive of 90-day-untouched docs. Public publishing + external rewrites are NEVER automated.",
  },
];

// CuratorSettings was a flat Record<id, boolean>. It now also
// carries orchestration knobs — aggressiveness level + trigger.
// Consumers keep the same `.orphan` / `.duplicate` access pattern
// they had before; the new fields sit alongside the signal booleans.
export interface CuratorSettings extends Record<CuratorOptionId, boolean> {
  /** Aggressiveness level. "off" preserves the prior manual-only
   *  behaviour. Higher levels widen the action matrix; see the
   *  AUTO_LEVELS descriptors and curator-actions.ts. Default "off"
   *  so a fresh account never silently mutates docs. */
  autoLevel: AutoLevel;
  /** When auto-resolution fires. Ignored when autoLevel === "off". */
  autoTrigger: AutoTrigger;
}

export function defaultCuratorSettings(): CuratorSettings {
  const out = {
    autoLevel: "off" as AutoLevel,
    autoTrigger: "on-open" as AutoTrigger,
  } as CuratorSettings;
  for (const opt of CURATOR_OPTIONS) out[opt.id] = opt.defaultEnabled;
  return out;
}

export function loadCuratorSettings(): CuratorSettings {
  if (typeof window === "undefined") return defaultCuratorSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCuratorSettings();
    const parsed = JSON.parse(raw) as Partial<CuratorSettings> & { autoEnabled?: boolean };
    const merged = defaultCuratorSettings();
    for (const opt of CURATOR_OPTIONS) {
      if (typeof parsed[opt.id] === "boolean") merged[opt.id] = parsed[opt.id]!;
    }
    // New shape — autoLevel — takes precedence.
    if (parsed.autoLevel === "off" || parsed.autoLevel === "conservative"
        || parsed.autoLevel === "standard" || parsed.autoLevel === "aggressive") {
      merged.autoLevel = parsed.autoLevel;
    } else if (typeof parsed.autoEnabled === "boolean") {
      // Migrate prior boolean autoEnabled → conservative when true.
      merged.autoLevel = parsed.autoEnabled ? "conservative" : "off";
    }
    if (parsed.autoTrigger === "manual" || parsed.autoTrigger === "on-open" || parsed.autoTrigger === "interval") {
      merged.autoTrigger = parsed.autoTrigger;
    }
    return merged;
  } catch {
    return defaultCuratorSettings();
  }
}

// Per-action capability check — single source of truth for "does
// this level auto-handle this action?". UI uses this to decide
// whether to show a Resolve button or an "auto" badge; runtime
// uses it to decide what to actually do.
export type CuratorAction =
  | "orphan-refresh"
  | "title-fix"
  | "stale-tag"
  | "duplicate-trash"
  | "auto-archive";

export function autoHandles(level: AutoLevel, action: CuratorAction): boolean {
  if (level === "off") return false;
  switch (action) {
    case "orphan-refresh":
      // Safe at every active level.
      return level === "conservative" || level === "standard" || level === "aggressive";
    case "title-fix":
    case "stale-tag":
      // Reversible content edits — Standard+ takes them.
      return level === "standard" || level === "aggressive";
    case "duplicate-trash":
    case "auto-archive":
      // Reversible moves into Trash / Archive — Aggressive only.
      return level === "aggressive";
  }
}

export function saveCuratorSettings(settings: CuratorSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / disabled storage */
  }
}
