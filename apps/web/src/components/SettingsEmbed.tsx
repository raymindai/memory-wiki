"use client";

// Account Settings — reusable surface.
//
// Two render contexts:
//   1. The /settings page route. Wraps this component in min-h-screen
//      and lets the back arrow navigate to `/`.
//   2. An in-app overlay inside MdEditor (founder ask: settings should
//      not be a separate page navigation). The overlay passes
//      `onClose` so the header swaps the back arrow for an X that
//      dismisses the overlay instead of routing away.
//
// State + handlers are identical across both; only the wrapper and
// the close affordance differ.

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/useAuth";
import { buildAuthHeaders } from "@/lib/auth-fetch";
import { ArrowLeft, Trash2, Loader2, Check, Download } from "lucide-react";
import Link from "next/link";
import {
  CURATOR_OPTIONS,
  AUTO_LEVELS,
  defaultCuratorSettings,
  loadCuratorSettings,
  saveCuratorSettings,
  type CuratorSettings,
  type AutoLevel,
} from "@/lib/curator-options";
import {
  ACCENT_COLORS,
  COLOR_SCHEMES,
  SCHEME_ACCENT_MAP,
  type AccentColor,
  type ColorScheme,
} from "@/lib/theme-options";

// Avatar styles offered to the user. Founder direction: keep it
// to two — the OAuth photo (whatever Google/GitHub passed through
// user_metadata.avatar_url; the user changes it on that platform,
// not here) and a deterministic Identicon (DiceBear). The earlier
// roster of 8 DiceBear styles was decision-fatigue.
const AVATAR_STYLES: { id: string; label: string; dicebearStyle?: string }[] = [
  { id: "oauth",     label: "Photo" },
  { id: "identicon", label: "Identicon", dicebearStyle: "identicon" },
];

function dicebearStyleUrl(style: string, seed: string, size = 80): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

function dicebearUrl(seed: string, size = 80): string {
  return dicebearStyleUrl("identicon", seed, size);
}

function resolveAvatar(
  profile: { avatar_url?: string | null; avatar_style?: string | null } | null,
  user: { email?: string; user_metadata?: { avatar_url?: string } } | null,
  size = 80
): string {
  const style = profile?.avatar_style;
  const seed = user?.email || "user";
  // Explicit style override always wins (so a picked DiceBear
  // beats the OAuth photo when the user has picked one).
  if (style && style !== "oauth") {
    const desc = AVATAR_STYLES.find((s) => s.id === style);
    if (desc?.dicebearStyle) return dicebearStyleUrl(desc.dicebearStyle, seed, size);
  }
  return profile?.avatar_url || user?.user_metadata?.avatar_url || dicebearUrl(seed, size);
}

type SettingsSection = "profile" | "appearance" | "auto-management" | "hub" | "danger";

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "profile",         label: "Profile" },
  { id: "appearance",      label: "Appearance" },
  { id: "auto-management", label: "Auto-management" },
  { id: "hub",             label: "Hub" },
  { id: "danger",          label: "Danger" },
];

export default function SettingsEmbed({ onClose, initialSection }: { onClose?: () => void; initialSection?: SettingsSection }) {
  const { user, profile, loading: authLoading, accessToken, isAuthenticated, signOut } = useAuth();
  // One section visible at a time. Founder feedback: stacking
  // everything on one column made sections blur together; tabs
  // give each its own surface. Persisted to localStorage so a
  // refresh keeps the user where they were.
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    if (initialSection) return initialSection;
    if (typeof window === "undefined") return "profile";
    return (localStorage.getItem("mdfy-settings-section") as SettingsSection) || "profile";
  });
  // If parent passes a fresh initialSection mid-mount (e.g. Hub's
  // "Settings" deep-link reopens the same overlay with a different
  // section), honour that.
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    try { localStorage.setItem("mdfy-settings-section", activeSection); } catch {}
  }, [activeSection]);

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState<string>("oauth");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // Skin Theme + Key Color — selected and hover-preview values. The
  // hover-preview path writes the data-scheme / data-accent
  // attributes directly so the whole UI re-themes instantly; on
  // mouseleave we restore the attributes to whatever the user has
  // actually selected. Selection writes localStorage so MdEditor's
  // useTheme picks the same value up on its next mount.
  const [skinScheme, setSkinScheme] = useState<ColorScheme>("default");
  const [keyColor, setKeyColor] = useState<AccentColor>("orange");
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Server (profile) wins when present — keeps the picks
    // consistent across devices. Falls back to localStorage so
    // the surface still works offline / signed-out.
    const p = profile as { color_scheme?: string | null; accent_color?: string | null } | null;
    const serverScheme = (p?.color_scheme as ColorScheme | null) || null;
    const serverAccent = (p?.accent_color as AccentColor | null) || null;
    const s = serverScheme || (localStorage.getItem("mdfy-scheme") as ColorScheme) || "default";
    const a = serverAccent || (localStorage.getItem("mdfy-accent") as AccentColor) || "orange";
    setSkinScheme(s);
    setKeyColor(a);
    // Re-apply to DOM in case the server value differed from the
    // localStorage cache the editor's useTheme hydrated from.
    applyScheme(s);
    applyAccent(a);
  }, [profile]);
  // Persist pref changes to the profile row. Debounce-free —
  // selectScheme/selectAccent already fire on click only.
  const syncPrefToProfile = useCallback(async (col: "color_scheme" | "accent_color", value: string) => {
    if (!user) return;
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      await supabase.from("profiles").update({ [col]: value }).eq("id", user.id);
    } catch { /* ignore — localStorage still has the value */ }
  }, [user]);
  const applyScheme = (s: ColorScheme) => {
    if (typeof document === "undefined") return;
    if (s === "default") document.documentElement.removeAttribute("data-scheme");
    else document.documentElement.setAttribute("data-scheme", s);
  };
  const applyAccent = (a: AccentColor) => {
    if (typeof document === "undefined") return;
    if (a === "orange") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", a);
  };
  // Broadcast helper — tells MdEditor's useTheme to re-read from
  // localStorage so the profile menu's FlyoutMenu reflects the new
  // selection. Without this the menu still shows the OLD scheme /
  // accent because we update DOM + localStorage but not useTheme's
  // React state.
  const broadcastThemeChange = () => {
    try { window.dispatchEvent(new CustomEvent("mdfy-theme-changed")); } catch { /* ignore */ }
  };
  const selectScheme = (s: ColorScheme) => {
    setSkinScheme(s);
    applyScheme(s);
    try { localStorage.setItem("mdfy-scheme", s); } catch {}
    syncPrefToProfile("color_scheme", s);
    broadcastThemeChange();
  };
  const selectAccent = (a: AccentColor) => {
    setKeyColor(a);
    applyAccent(a);
    try { localStorage.setItem("mdfy-accent", a); } catch {}
    syncPrefToProfile("accent_color", a);
    broadcastThemeChange();
  };
  const [curatorSettings, setCuratorSettings] = useState<CuratorSettings>(() => defaultCuratorSettings());
  useEffect(() => {
    // Hydrate: localStorage first (offline-first), then merge any
    // server snapshot from the profile row on top. Last-write-wins
    // is fine here — the server snapshot is updated by the same
    // user from any device, and the value space is small.
    const local = loadCuratorSettings();
    const p = profile as { curator_settings?: Partial<CuratorSettings> | null } | null;
    if (p?.curator_settings && typeof p.curator_settings === "object") {
      setCuratorSettings({ ...local, ...p.curator_settings });
    } else {
      setCuratorSettings(local);
    }
  }, [profile]);
  const toggleCurator = <K extends keyof CuratorSettings>(id: K, next: CuratorSettings[K]) => {
    setCuratorSettings((prev) => {
      const updated = { ...prev, [id]: next } as CuratorSettings;
      saveCuratorSettings(updated);
      try { window.dispatchEvent(new CustomEvent("mdfy-curator-settings-changed", { detail: updated })); } catch { /* ignore */ }
      // Fire-and-forget profile sync. Best-effort — localStorage
      // still has the canonical value if the server write fails.
      if (user) {
        (async () => {
          try {
            const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
            const supabase = getSupabaseBrowserClient();
            if (!supabase) return;
            await supabase.from("profiles").update({ curator_settings: updated }).eq("id", user.id);
          } catch { /* ignore */ }
        })();
      }
      return updated;
    });
  };

  const [hubSlug, setHubSlug] = useState("");
  const [hubPublic, setHubPublic] = useState(false);
  const [hubDescription, setHubDescription] = useState("");
  const [hubSaving, setHubSaving] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);
  const [hubSaved, setHubSaved] = useState(false);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
    const p = profile as { hub_slug?: string | null; hub_public?: boolean; hub_description?: string | null; avatar_style?: string | null } | null;
    if (p?.hub_slug) setHubSlug(p.hub_slug);
    if (typeof p?.hub_public === "boolean") setHubPublic(p.hub_public);
    if (p?.hub_description) setHubDescription(p.hub_description);
    if (p?.avatar_style) setAvatarStyle(p.avatar_style);
  }, [profile]);

  const selectAvatarStyle = useCallback(async (style: string) => {
    setAvatarStyle(style);
    setAvatarPickerOpen(false);
    if (!user) return;
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      await supabase.from("profiles").update({ avatar_style: style }).eq("id", user.id);
    } catch { /* ignore */ }
  }, [user]);

  const handleSaveHub = useCallback(async () => {
    if (!user) return;
    setHubError(null);
    const slug = hubSlug.trim().toLowerCase();
    if (hubPublic && !/^[a-z0-9_-]{3,32}$/.test(slug)) {
      setHubError("Slug must be 3-32 chars (lowercase letters, digits, hyphens, underscores).");
      return;
    }
    setHubSaving(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("client unavailable");
      const { error } = await supabase.from("profiles").update({
        hub_slug: slug || null,
        hub_public: hubPublic,
        hub_description: hubDescription.trim() || null,
      }).eq("id", user.id);
      if (error) {
        if (error.code === "23505") setHubError("That slug is already taken — pick another.");
        else setHubError(error.message);
        return;
      }
      setHubSaved(true);
      setTimeout(() => setHubSaved(false), 2000);
    } catch (err) {
      setHubError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setHubSaving(false);
    }
  }, [user, hubSlug, hubPublic, hubDescription]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mdfy-theme") : null;
    setTheme((stored as "dark" | "light") || "dark");
  }, []);

  const handleSaveDisplayName = useCallback(async () => {
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.from("profiles").upsert({ id: user.id, display_name: displayName });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }, [accessToken, user, displayName]);

  const handleDeleteAccount = useCallback(async () => {
    if (!accessToken) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "DELETE",
        headers: buildAuthHeaders({ accessToken, userId: user?.id, userEmail: user?.email }),
      });
      if (res.ok) {
        signOut();
        window.location.href = "/";
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  }, [accessToken, user, signOut]);

  // Export all user data as a JSON file. Single round-trip; the
  // server assembles the payload and returns it with a
  // Content-Disposition header so the browser downloads as
  // mdfy-export-YYYY-MM-DD.json.
  const [exporting, setExporting] = useState(false);
  const handleExportData = useCallback(async () => {
    if (!accessToken || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/user/export", {
        headers: buildAuthHeaders({ accessToken, userId: user?.id, userEmail: user?.email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `mdfy-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [accessToken, user, exporting]);

  const handleThemeChange = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    try { localStorage.setItem("mdfy-theme", newTheme); } catch {}
    try { window.dispatchEvent(new CustomEvent("mdfy-theme-changed")); } catch { /* ignore */ }
  };
  // Hover-preview helpers for Theme — applies the candidate to the
  // <html> attribute without flipping React state. Leave restores
  // the user's actual selection.
  const previewTheme = (t: "dark" | "light") => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", t);
  };
  const restoreTheme = () => previewTheme(theme);
  // Combined preview: apply scheme + theme together so Skin Theme
  // rows can showcase "this is what nord+dark looks like" and
  // "this is what nord+light looks like" as two distinct hover
  // targets within the same row.
  const previewSchemeTheme = (s: ColorScheme, t: "dark" | "light") => {
    applyScheme(s);
    previewTheme(t);
  };
  const restoreSchemeTheme = () => {
    applyScheme(skinScheme);
    previewTheme(theme);
  };
  const selectSchemeWithTheme = (s: ColorScheme, t: "dark" | "light") => {
    selectScheme(s);
    handleThemeChange(t);
  };

  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: "var(--background)" }}>
        <Loader2 className="animate-spin" width={24} height={24} style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sign in to access account settings.</p>
        {onClose ? (
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg" style={{ background: "var(--accent)", color: "#000" }}>
            Close
          </button>
        ) : (
          <Link href="/" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ background: "var(--accent)", color: "#000", textDecoration: "none" }}>
            Go to memory.wiki
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      {/* Frame matches HubEmbed and BundleOverview (max-w-3xl, px-6
          py-10) so Settings reads as part of the same destination
          family. Page title is "Settings"; identity (avatar + name)
          lives inside the Profile section now so the page header is
          one consistent voice across all five tabs. */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Page route gets a back arrow at top-left. Overlay
            doesn't need a close affordance here — Home / Hub /
            view-mode pills in the toolbar already dismiss the
            overlay, and double-affordance was reading as clutter. */}
        {!onClose && (
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[var(--accent-dim)]"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeft width={16} height={16} />
            </Link>
          </div>
        )}
        <header className="mb-8">
          <h1 className="text-display font-bold tracking-tight" style={{ color: "var(--text-primary)", lineHeight: 1.2 }}>
            Settings
          </h1>
          <p className="text-body mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Tune your account, hub, and how memory.wiki auto-manages your knowledge.
          </p>
        </header>

        {/* Section tabs — horizontal nav. Active tab carries the
            accent underline. No overflow-x-auto on the desktop
            width; tabs fit cleanly. Wraps to two rows on narrow
            viewports rather than showing a scrollbar. */}
        <nav className="flex items-center gap-0.5 mb-6 flex-wrap" style={{ borderBottom: "1px solid var(--border-dim)" }}>
          {SETTINGS_SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="px-3.5 py-2.5 text-sm font-medium shrink-0 transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* ── Profile section ── */}
        {activeSection === "profile" && (<>

        {/* Identity card — circle avatar + click-to-change overlay.
            The avatar shows whatever style the user has picked
            (or the OAuth photo by default). Clicking the avatar
            opens a small picker with the available DiceBear
            styles. Below sits the display-name input. */}
        <section
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="relative shrink-0">
              <button
                onClick={() => setAvatarPickerOpen((v) => !v)}
                className="block rounded-full overflow-hidden transition-transform hover:scale-[1.02]"
                style={{ width: 72, height: 72, border: "2px solid var(--border)" }}
                title="Change avatar style"
              >
                <img
                  src={resolveAvatar({ ...profile, avatar_style: avatarStyle } as { avatar_url?: string | null; avatar_style?: string | null }, user, 72)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
              {/* Camera badge — affordance that the avatar is
                  clickable. */}
              <span
                aria-hidden
                className="absolute rounded-full flex items-center justify-center pointer-events-none"
                style={{ right: -2, bottom: -2, width: 22, height: 22, background: "var(--accent)", border: "2px solid var(--surface)", color: "#000" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {profile?.display_name || user?.email?.split("@")[0] || "Account"}
              </div>
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                {user?.email}
              </div>
              <div className="text-caption font-mono mt-2 inline-flex items-center px-1.5 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                {(profile?.plan || "free").toUpperCase()}
              </div>
            </div>
          </div>

          {avatarPickerOpen && (
            <div className="mb-5 rounded-lg p-3" style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}>
              <div className="text-xs font-medium uppercase tracking-wide mb-2.5" style={{ color: "var(--text-faint)" }}>
                Pick a style
              </div>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_STYLES.map((s) => {
                  const active = avatarStyle === s.id;
                  const previewUrl = s.id === "oauth"
                    ? (user?.user_metadata?.avatar_url || dicebearUrl(user?.email || "user", 48))
                    : dicebearStyleUrl(s.dicebearStyle!, user?.email || "user", 48);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectAvatarStyle(s.id)}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-md transition-colors hover:bg-[var(--toggle-bg)]"
                      style={{
                        background: active ? "var(--accent-dim)" : "transparent",
                        border: `1px solid ${active ? "var(--accent)" : "var(--border-dim)"}`,
                      }}
                    >
                      <img src={previewUrl} alt="" className="rounded-full" style={{ width: 36, height: 36, border: "1px solid var(--border)" }} />
                      <span className="text-[10px]" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-caption font-medium mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
              Display name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-colors"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: "var(--accent)", color: "#000", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </section>

        </>)}

        {/* ── Hub section ── */}
        {activeSection === "hub" && (<>

        {/* Hub URL — opt-in public knowledge hub */}
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}>Knowledge Hub</h2>
          <p className="text-caption leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
            A single URL pointing to all your public docs and bundles — paste it into any AI to deploy your entire hub as context. Disabled by default.
          </p>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hubPublic}
              onChange={e => setHubPublic(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-sm" style={{ color: "var(--text-primary)" }}>Make my hub public</span>
          </label>
          {hubPublic && (
            <>
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>
                  Slug (3–32 chars, lowercase, hyphens/underscores allowed)
                </label>
                {/* Slug input — single bordered group so the prefix
                    label and the input share the exact same height
                    (founder caught the mismatched py-on-different-
                    font-sizes version of this). One border around
                    both, internal divider between them. */}
                <div
                  className="flex items-stretch rounded-lg overflow-hidden"
                  style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                >
                  <span
                    className="text-xs flex items-center px-3 shrink-0 font-mono"
                    style={{ color: "var(--text-faint)", borderRight: "1px solid var(--border)" }}
                  >
                    memory.wiki/hub/
                  </span>
                  <input
                    type="text"
                    value={hubSlug}
                    onChange={e => setHubSlug(e.target.value.toLowerCase())}
                    placeholder="your-handle"
                    maxLength={32}
                    className="flex-1 min-w-0 px-3 py-2 text-sm outline-none font-mono"
                    style={{ background: "transparent", color: "var(--text-primary)" }}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-faint)" }}>
                  Description (optional, shown on hub page)
                </label>
                <textarea
                  value={hubDescription}
                  onChange={e => setHubDescription(e.target.value)}
                  placeholder="Building knowledge in public — capture, bundle, deploy."
                  rows={2}
                  maxLength={280}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: "var(--input-bg, var(--surface))", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </>
          )}
          {hubError && (
            <p className="text-caption mb-2" style={{ color: "var(--color-danger, #ef4444)" }}>{hubError}</p>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveHub}
              disabled={hubSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--accent)", color: "#000", opacity: hubSaving ? 0.6 : 1 }}
            >
              {hubSaving ? "Saving..." : hubSaved ? "Saved" : "Save"}
            </button>
            {hubPublic && hubSlug && /^[a-z0-9_-]{3,32}$/.test(hubSlug) && (
              <Link
                href={`/hub/${hubSlug}`}
                className="text-xs underline"
                style={{ color: "var(--accent)" }}
                target="_blank"
              >
                View at memory.wiki/hub/{hubSlug} →
              </Link>
            )}
          </div>
        </section>

        </>)}

        {/* Email lives in Profile but rendered above with the
            Hub section's close in case the user wants to confirm
            account identity from the appearance / auto-management
            section too. We move it into Profile to keep one
            source of truth — fold the email read-only block back
            under Profile. */}
        {activeSection === "profile" && (<>

        {/* Email (read-only) */}
        <div className="mb-6">
          <label className="block text-caption font-medium mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Email
          </label>
          <div
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--input-bg, var(--surface))",
              border: "1px solid var(--border)",
              color: "var(--text-faint)",
              opacity: 0.7,
            }}
          >
            {user?.email}
          </div>
        </div>

        </>)}

        {/* ── Appearance section ── */}
        {activeSection === "appearance" && (<>

        {/* Mode (formerly "Theme") — Dark vs Light. Hover previews
            apply live so the user sees the swap before clicking. */}
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}>Mode</h2>
          <p className="text-caption leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
            Light or dark canvas. Hover to preview, click to keep.
          </p>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => {
              const active = theme === t;
              return (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  onMouseEnter={() => previewTheme(t)}
                  onMouseLeave={restoreTheme}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: active ? "var(--accent-dim)" : "var(--surface)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              );
            })}
          </div>
        </section>

        {/* Skin Theme — each preset offers TWO clickable variants
            (dark + light). Hovering either previews scheme + mode
            together; clicking commits both. The label shows which
            (scheme, mode) pair is the currently active one. */}
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}>Skin Theme</h2>
          <p className="text-caption leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
            Each row offers a dark and a light pick — hover to preview the entire UI re-skinning live, click to keep that scheme + mode.
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
            {COLOR_SCHEMES.map((s, idx) => {
              const isSchemeSelected = skinScheme === s.name;
              const isLast = idx === COLOR_SCHEMES.length - 1;
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: isSchemeSelected ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(["dark", "light"] as const).map((mode) => {
                      const active = isSchemeSelected && theme === mode;
                      const bg = mode === "dark" ? s.darkBg : s.lightBg;
                      return (
                        <button
                          key={mode}
                          onClick={() => selectSchemeWithTheme(s.name, mode)}
                          onMouseEnter={() => previewSchemeTheme(s.name, mode)}
                          onMouseLeave={restoreSchemeTheme}
                          className="rounded-md flex items-center justify-center transition-transform hover:scale-[1.05]"
                          style={{
                            width: 28,
                            height: 28,
                            background: bg,
                            border: active ? "1.5px solid var(--accent)" : "1px solid var(--border-dim)",
                          }}
                          title={`${s.label} — ${mode}`}
                        >
                          <span className="rounded-full" style={{ width: 11, height: 11, background: s.preview }} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: isSchemeSelected ? "var(--accent)" : "var(--text-primary)" }}>{s.label}</div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>{s.desc}</div>
                  </div>
                  {isSchemeSelected && (
                    <Check width={14} height={14} className="shrink-0" style={{ color: "var(--accent)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Key Color — eight accents. Each row shows the dark-mode
            tone next to the light-mode tone so the user sees both
            variants; hovering applies the accent globally. */}
        <section className="mb-10">
          <label className="block text-caption font-medium mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Key Color
          </label>
          <p className="text-caption leading-relaxed mb-3" style={{ color: "var(--text-muted)" }}>
            Hover a color to preview it across the UI; click to keep it.
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
            {ACCENT_COLORS.map((c, idx) => {
              const isSelected = keyColor === c.name;
              const isLast = idx === ACCENT_COLORS.length - 1;
              // "Orange" is the implicit scheme-default — selecting
              // it removes the data-accent override so each Skin
              // Theme's natural accent wins (Nord = teal, Dracula =
              // purple, etc.). The row's swatches + hex caption now
              // mirror whatever the current scheme's natural accent
              // actually IS, so the UI stops claiming "orange" when
              // the rendered colour is teal.
              const isDefaultRow = c.name === "orange";
              const naturalName = isDefaultRow ? SCHEME_ACCENT_MAP[skinScheme] : c.name;
              const display = ACCENT_COLORS.find((x) => x.name === naturalName) || c;
              const showLabel = isDefaultRow
                ? (skinScheme === "default" ? "Default (Orange)" : `Default (${display.label})`)
                : c.label;
              return (
                <button
                  key={c.name}
                  onClick={() => selectAccent(c.name)}
                  onMouseEnter={() => applyAccent(c.name)}
                  onMouseLeave={() => applyAccent(keyColor)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: isSelected ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-1 shrink-0" title={`${showLabel} dark / light`}>
                    <span
                      className="rounded-md"
                      style={{ width: 22, height: 22, background: display.dark, border: "1px solid var(--border-dim)" }}
                    />
                    <span
                      className="rounded-md"
                      style={{ width: 22, height: 22, background: display.light, border: "1px solid var(--border-dim)" }}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}>{showLabel}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>
                      Dark {display.dark} / Light {display.light}
                    </div>
                  </div>
                  {isSelected && (
                    <Check width={14} height={14} className="shrink-0" style={{ color: "var(--accent)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        </>)}

        {/* ── Auto-management section ── */}
        {activeSection === "auto-management" && (<>

        {/* Auto-management — Curator toggle list */}
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}>Auto-management</h2>
          <p className="text-caption leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
            Curator signals scan your hub and surface findings in Needs Review. With auto-management ON, safe findings are resolved for you on the trigger you pick; destructive ones (like duplicate trash) still ask first. With it OFF, findings just surface and you act on them by hand.
          </p>

          {/* Aggressiveness — four-step scale. "Off" is current
              manual-only behaviour; each step up widens the action
              matrix. Irreversible actions (public publish, external
              link rewrites, hard delete) are NEVER automated even at
              Aggressive — every auto-action is recoverable from
              Trash. The dots act as a slider indicator so the scale
              reads as continuous, not four equal radio options. */}
          <h3 className="text-sm font-semibold mb-2 mt-2" style={{ color: "var(--text-secondary)" }}>
            Aggressiveness
          </h3>
          <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border-dim)" }}>
            {AUTO_LEVELS.map((lvl, idx) => {
              const active = curatorSettings.autoLevel === lvl.id;
              const isLast = idx === AUTO_LEVELS.length - 1;
              return (
                <button
                  key={lvl.id}
                  onClick={() => toggleCurator("autoLevel", lvl.id)}
                  className="w-full flex items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--toggle-bg)]"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: active ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  <span className="flex items-center gap-0.5 shrink-0 mt-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className="rounded-full"
                        style={{
                          width: 6,
                          height: 6,
                          background: i <= idx ? (active ? "var(--accent)" : "var(--text-muted)") : "var(--border-dim)",
                        }}
                      />
                    ))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>{lvl.label}</span>
                      <span className="text-xs font-mono" style={{ color: "var(--text-faint)" }}>{lvl.shortDesc}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {lvl.longDesc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Trigger — when does auto-resolution fire. Greyed when
              level is Off since the trigger has no effect. */}
          <div className="mb-6" style={{ opacity: curatorSettings.autoLevel === "off" ? 0.5 : 1 }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
              Trigger
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { v: "manual", label: "Manual", desc: "Only when you click" },
                { v: "on-open", label: "On hub open", desc: "Each Hub visit" },
                { v: "interval", label: "Every 30 min", desc: "Background scan" },
              ] as const).map(({ v, label, desc }) => {
                const active = curatorSettings.autoTrigger === v;
                const enabled = curatorSettings.autoLevel !== "off";
                return (
                  <button
                    key={v}
                    onClick={() => enabled && toggleCurator("autoTrigger", v)}
                    disabled={!enabled}
                    className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-md text-left transition-colors"
                    style={{
                      background: active ? "var(--accent-dim)" : "var(--surface)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border-dim)"}`,
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      cursor: enabled ? "pointer" : "not-allowed",
                    }}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            Signals
          </h3>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
            {CURATOR_OPTIONS.map((opt, idx) => {
              const enabled = curatorSettings[opt.id];
              const isLast = idx === CURATOR_OPTIONS.length - 1;
              return (
                <div
                  key={opt.id}
                  className="flex items-start gap-3 px-3 py-3"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: enabled && opt.shipped ? "var(--surface)" : "transparent",
                    opacity: opt.shipped ? 1 : 0.6,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{opt.label}</span>
                      {!opt.shipped && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider"
                          style={{ background: "var(--toggle-bg)", color: "var(--text-faint)", letterSpacing: 1 }}
                        >
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{opt.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1" style={{ cursor: opt.shipped ? "pointer" : "not-allowed" }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => opt.shipped && toggleCurator(opt.id, e.target.checked)}
                      disabled={!opt.shipped}
                      className="sr-only peer"
                    />
                    <div
                      className="w-9 h-5 rounded-full transition-colors"
                      style={{
                        background: enabled && opt.shipped ? "var(--accent)" : "var(--border-dim)",
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full transition-transform"
                        style={{
                          background: "#fff",
                          transform: `translate(${enabled && opt.shipped ? 18 : 2}px, 2px)`,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                        }}
                      />
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
            Synced to your account — settings follow you across devices. Local cache stays in case you go offline.
          </p>
        </section>

        </>)}

        {/* Plan lives at the bottom of Profile (since it's identity-
            adjacent). Re-open the profile fragment for it. */}
        {activeSection === "profile" && (<>

        {/* Plan — current tier badge + side-by-side comparison of
            Free vs Pro with the upgrade CTA. Pro card is the
            primary call-to-action; Free card just confirms what
            the user already has. Both cards keep the bordered-
            surface style the rest of Settings uses; the Pro card
            adds an accent border so the eye lands on it. */}
        <section className="mb-10">
          <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)", letterSpacing: "-0.005em" }}>Plan</h2>
          <p className="text-caption leading-relaxed mb-4" style={{ color: "var(--text-muted)" }}>
            You&apos;re on the <span className="font-mono font-semibold" style={{ color: "var(--accent)" }}>{(profile?.plan || "free").toUpperCase()}</span> plan. Free covers the core workflow; Pro adds custom domain, branding, and viewer analytics.
          </p>
          {(() => {
            const isPro = profile?.plan === "pro";
            const FREE_FEATURES = [
              "Unlimited docs, bundles, and hubs",
              "Deploy to any AI (Claude, ChatGPT, Cursor)",
              "Auto-management (curator findings)",
              "Cross-device sync",
            ];
            const PRO_FEATURES = [
              "Everything in Free",
              "Custom domain (yourname.memory.wiki)",
              "Remove memory.wiki badge from public hub",
              "Viewer analytics (who opened, how long)",
              "Priority concept extraction + larger limits",
            ];
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Free</span>
                    {!isPro && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>$0 forever</p>
                  <ul className="space-y-1.5">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Check width={11} height={11} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-4 relative" style={{ background: "var(--surface)", border: `1px solid ${isPro ? "var(--accent)" : "var(--border)"}` }}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Pro</span>
                    {isPro ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>CURRENT</span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>UPGRADE</span>
                    )}
                  </div>
                  <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>$8/mo, cancel any time</p>
                  <ul className="space-y-1.5 mb-3">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <Check width={11} height={11} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!isPro && (
                    <button
                      onClick={() => window.open("/pricing", "_blank")}
                      className="w-full px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ background: "var(--accent)", color: "#000" }}
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </section>

        </>)}

        {/* ── Danger section ── */}
        {activeSection === "danger" && (<>

        {/* Export — sits in the same section as Delete because both
            are "I want to leave / move my data" actions. Export is
            non-destructive so it lives above Danger Zone. */}
        <div className="mb-8">
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
            Your data
          </label>
          <p className="text-sm mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
            Download every document, bundle, folder, and concept you own as a single JSON file. Your data is yours — this works any time, no questions asked. GDPR right-to-portability and your daily backup, the same endpoint.
          </p>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              opacity: exporting ? 0.6 : 1,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            <Download width={14} height={14} />
            {exporting ? "Preparing export…" : "Export all my data"}
          </button>
        </div>

        {/* Danger Zone */}
        <div>
          <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: "#ef4444" }}>
            Danger Zone
          </label>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#f87171",
              }}
            >
              <Trash2 width={14} height={14} />
              Delete Account
            </button>
          ) : (
            <div className="p-4 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <p className="text-sm mb-3" style={{ color: "#f87171" }}>
                This will permanently delete your account, all documents, and all data. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "#ef4444", color: "#fff", opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "Deleting..." : "Yes, Delete My Account"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        </>)}
      </div>
    </div>
  );
}
