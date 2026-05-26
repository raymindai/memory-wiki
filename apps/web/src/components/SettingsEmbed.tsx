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

// Shared with the editor header/profile menu so the avatar updates
// everywhere as soon as the user changes Settings → Profile.
import { dicebearUrl, resolveAvatar } from "@/lib/editor-helpers";
import { showToast } from "@/components/Toast";

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
    return (localStorage.getItem("mw-settings-section") as SettingsSection) || "profile";
  });
  // If parent passes a fresh initialSection mid-mount (e.g. Hub's
  // "Settings" deep-link reopens the same overlay with a different
  // section), honour that.
  useEffect(() => {
    if (initialSection) setActiveSection(initialSection);
  }, [initialSection]);
  useEffect(() => {
    try { localStorage.setItem("mw-settings-section", activeSection); } catch {}
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
  const [keyColor, setKeyColor] = useState<AccentColor>("lime");
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Server (profile) wins when present — keeps the picks
    // consistent across devices. Falls back to localStorage so
    // the surface still works offline / signed-out.
    const p = profile as { color_scheme?: string | null; accent_color?: string | null } | null;
    const serverScheme = (p?.color_scheme as ColorScheme | null) || null;
    const serverAccent = (p?.accent_color as AccentColor | null) || null;
    const s = serverScheme || (localStorage.getItem("mw-scheme") as ColorScheme) || "default";
    const a = serverAccent || (localStorage.getItem("mw-accent") as AccentColor) || "lime";
    setSkinScheme(s);
    setKeyColor(a);
    // Re-apply to DOM in case the server value differed from the
    // localStorage cache the editor's useTheme hydrated from.
    applyScheme(s);
    applyAccent(a);
  }, [profile]);
  // Cross-sync — when the user changes scheme/accent from the
  // profile menu (useTheme dispatches "mw-theme-changed"), re-read
  // localStorage so the Appearance picker also reflects the change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onThemeChanged = () => {
      try {
        const s = (localStorage.getItem("mw-scheme") as ColorScheme) || "default";
        const a = (localStorage.getItem("mw-accent") as AccentColor) || "lime";
        setSkinScheme(s);
        setKeyColor(a);
      } catch { /* ignore */ }
    };
    window.addEventListener("mw-theme-changed", onThemeChanged);
    return () => window.removeEventListener("mw-theme-changed", onThemeChanged);
  }, []);
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
    // Lime is the root default — removing the attribute lets the
    // :root :root[data-theme] value apply. Anything else writes the
    // attribute so the [data-accent="..."] override picks up.
    if (a === "lime") document.documentElement.removeAttribute("data-accent");
    else document.documentElement.setAttribute("data-accent", a);
  };
  // Broadcast helper — tells MdEditor's useTheme to re-read from
  // localStorage so the profile menu's FlyoutMenu reflects the new
  // selection. Without this the menu still shows the OLD scheme /
  // accent because we update DOM + localStorage but not useTheme's
  // React state.
  const broadcastThemeChange = () => {
    try { window.dispatchEvent(new CustomEvent("mw-theme-changed")); } catch { /* ignore */ }
  };
  const selectScheme = (s: ColorScheme) => {
    setSkinScheme(s);
    applyScheme(s);
    try { localStorage.setItem("mw-scheme", s); } catch {}
    syncPrefToProfile("color_scheme", s);
    broadcastThemeChange();
  };
  const selectAccent = (a: AccentColor) => {
    setKeyColor(a);
    applyAccent(a);
    try { localStorage.setItem("mw-accent", a); } catch {}
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
      try { window.dispatchEvent(new CustomEvent("mw-curator-settings-changed", { detail: updated })); } catch { /* ignore */ }
      // Server sync. Surfaces visible feedback (toast) and logs hard
      // failures so the user sees that the toggle actually persisted
      // (the previous silent-fail path made it look like nothing
      // happened when the DB write returned an error).
      if (user) {
        (async () => {
          try {
            const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
            const supabase = getSupabaseBrowserClient();
            if (!supabase) {
              showToast("Saved locally — sign-in required to sync across devices", "info");
              return;
            }
            const { error } = await supabase.from("profiles").update({ curator_settings: updated }).eq("id", user.id);
            if (error) {
              console.error("Curator settings save failed:", error);
              showToast(`Couldn't sync to server: ${error.message}`, "error");
              return;
            }
            showToast("Auto-management settings saved", "success");
          } catch (err) {
            console.error("Curator settings save threw:", err);
            showToast("Couldn't sync settings — saved locally", "error");
          }
        })();
      } else {
        showToast("Saved locally — sign in to sync across devices", "info");
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
      // .select() back the updated row so we can verify the write
      // actually landed — under RLS, a denied UPDATE returns success
      // with zero rows, which previously made the save silently
      // no-op. If the returned row is empty, surface that explicitly.
      const { data, error } = await supabase
        .from("profiles")
        .update({ avatar_style: style })
        .eq("id", user.id)
        .select("avatar_style");
      if (error) { showToast(`Couldn't save avatar: ${error.message}`, "error"); return; }
      if (!data || data.length === 0) {
        showToast("Avatar save blocked (no row updated, RLS?)", "error");
        return;
      }
      showToast("Avatar saved", "success");
      // Re-fetch the profile in useAuth so the editor header avatar
      // (and any <MemoryWikiLogo /> using profile data) flips to the
      // newly-picked style immediately.
      try { window.dispatchEvent(new CustomEvent("mw-profile-changed")); } catch { /* ignore */ }
    } catch (err) {
      showToast(`Couldn't save avatar: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
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
      // CRITICAL: never null out hub_slug from a Save action. The
      // earlier `slug || null` clobbered existing slugs whenever the
      // user cleared the input and clicked Save, deleting their hub
      // address from the DB. Now we only patch slug when the input
      // holds a valid value; otherwise the patch leaves slug alone.
      const patch: Record<string, unknown> = {
        hub_public: hubPublic,
        hub_description: hubDescription.trim() || null,
      };
      if (slug) patch.hub_slug = slug;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("hub_slug, hub_public, hub_description");
      if (error) {
        if (error.code === "23505") setHubError("That slug is already taken — pick another.");
        else setHubError(error.message);
        return;
      }
      if (!data || data.length === 0) {
        setHubError("Save blocked (no row updated). Sign out and back in?");
        return;
      }
      setHubSaved(true);
      setTimeout(() => setHubSaved(false), 2000);
      // Broadcast so useAuth re-hydrates the profile (header avatar
      // + accent + hub data all read from the cached profile object).
      try { window.dispatchEvent(new CustomEvent("mw-profile-changed")); } catch { /* ignore */ }
    } catch (err) {
      setHubError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setHubSaving(false);
    }
  }, [user, hubSlug, hubPublic, hubDescription]);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mw-theme") : null;
    setTheme((stored as "dark" | "light") || "dark");
  }, []);

  const handleSaveDisplayName = useCallback(async () => {
    if (!accessToken || !user) return;
    setSaving(true);
    try {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { showToast("Couldn't save (client unavailable)", "error"); return; }
      // UPDATE (not upsert) — every signed-in user already has a
      // profile row, and an upsert with only {id, display_name} risks
      // nulling other columns. .select() back to verify the write
      // actually landed (RLS denials return success with zero rows
      // and previously failed silently).
      const { data, error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null })
        .eq("id", user.id)
        .select("display_name");
      if (error) { showToast(`Couldn't save name: ${error.message}`, "error"); return; }
      if (!data || data.length === 0) { showToast("Name save blocked (no row updated)", "error"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast("Name saved", "success");
      try { window.dispatchEvent(new CustomEvent("mw-profile-changed")); } catch { /* ignore */ }
    } catch (err) {
      showToast(`Couldn't save name: ${err instanceof Error ? err.message : String(err)}`, "error");
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
  // mw-export-YYYY-MM-DD.json.
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
      a.download = `mw-export-${date}.json`;
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
    try { localStorage.setItem("mw-theme", newTheme); } catch {}
    try { window.dispatchEvent(new CustomEvent("mw-theme-changed")); } catch { /* ignore */ }
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
        <Loader2 className="animate-spin" width={24} height={24} style={{ color: "var(--text-primary)" }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Sign in to access account settings.</p>
        {onClose ? (
          <button onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-lg" style={{ background: "var(--text-primary)", color: "var(--background)" }}>
            Close
          </button>
        ) : (
          <Link href="/" className="text-sm font-medium px-4 py-2 rounded-lg" style={{ background: "var(--text-primary)", color: "var(--background)", textDecoration: "none" }}>
            Go to Memory.Wiki
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "var(--canvas)", color: "var(--text-primary)" }}>
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
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[var(--border)]"
              style={{ color: "var(--text-muted)" }}
            >
              <ArrowLeft width={16} height={16} />
            </Link>
          </div>
        )}
        <header className="mb-8">
          <h1 style={{ color: "var(--text-primary)", margin: 0, fontSize: 32, lineHeight: 1.15, fontWeight: 500, letterSpacing: 0 }}>
            Settings
          </h1>
          <p className="mt-2" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Tune your account, hub, and how Memory.Wiki auto-manages your knowledge.
          </p>
        </header>

        {/* Section tabs — horizontal nav. Active tab carries the
            accent underline. No overflow-x-auto on the desktop
            width; tabs fit cleanly. Wraps to two rows on narrow
            viewports rather than showing a scrollbar. */}
        {/* Section nav — quiet pill chips, active = soft surface fill.
            Same shape as the "How to use" tool tabs so Settings reads
            as the same family of surfaces. */}
        <nav className="flex items-center gap-1 mb-8 flex-wrap">
          {SETTINGS_SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="px-3 py-1.5 rounded-md shrink-0 transition-colors"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  background: active ? "var(--toggle-bg)" : "transparent",
                  fontSize: 13,
                  fontWeight: 500,
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
                style={{ right: -2, bottom: -2, width: 22, height: 22, background: "var(--text-primary)", border: "2px solid var(--surface)", color: "#000" }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, lineHeight: 1.2 }}>
                {profile?.display_name || user?.email?.split("@")[0] || "Account"}
              </div>
              <div className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {user?.email}
              </div>
              <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: "var(--toggle-bg)", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em" }}>
                {(profile?.plan || "free").charAt(0).toUpperCase() + (profile?.plan || "free").slice(1)} plan
              </div>
            </div>
          </div>

          {avatarPickerOpen && (
            <div className="mb-5 rounded-lg p-3" style={{ background: "var(--canvas)", border: "1px solid var(--border-dim)" }}>
              <div className="mb-2.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                Pick a style
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AVATAR_STYLES.map((s) => {
                  const active = avatarStyle === s.id;
                  const previewUrl = s.id === "oauth"
                    ? (user?.user_metadata?.avatar_url || dicebearUrl(user?.email || "user", 48))
                    : dicebearStyleUrl(s.dicebearStyle!, user?.email || "user", 48);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectAvatarStyle(s.id)}
                      className="flex flex-col items-center gap-2 p-3 rounded-md transition-colors"
                      style={{
                        background: active ? "var(--toggle-bg)" : "transparent",
                        border: `1px solid ${active ? "var(--border)" : "var(--border-dim)"}`,
                      }}
                    >
                      <img src={previewUrl} alt="" className="rounded-full" style={{ width: 40, height: 40, border: "1px solid var(--border-dim)" }} />
                      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500 }}>
                        <span
                          aria-hidden
                          style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "var(--micro-lime)" : "var(--border)" }}
                        />
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block mb-1.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
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
                style={{ background: "var(--text-primary)", color: "var(--background)", opacity: saving ? 0.6 : 1 }}
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
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>Knowledge Hub</h2>
          <p className="leading-relaxed mb-4" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            A single URL pointing to all your public docs and bundles, paste it into any AI to deploy your entire hub as context. Disabled by default.
          </p>
          {/* Public toggle — match the Auto-management Signals
              toggle: lime ON, red OFF, solid hex. */}
          <div
            className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-lg"
            style={{ background: hubPublic ? "var(--toggle-bg)" : "transparent", border: "1px solid var(--border-dim)" }}
          >
            <div className="min-w-0">
              <div style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>Make my hub public</div>
              <div className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>
                {hubPublic ? "Listed at memory.wiki/hub/<slug>" : "Only you can read your hub"}
              </div>
            </div>
            <label className="relative inline-flex items-center shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={hubPublic}
                onChange={(e) => setHubPublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full transition-colors" style={{ background: hubPublic ? "#7CC400" : "#9A2A2A" }}>
                <div
                  className="w-4 h-4 rounded-full transition-transform"
                  style={{
                    background: "#fff",
                    transform: `translate(${hubPublic ? 18 : 2}px, 2px)`,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
            </label>
          </div>
          {hubPublic && (
            <>
              <div className="mb-3">
                <label className="block mb-1.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                  Slug
                </label>
                {/* Slug input — single bordered group so the prefix
                    label and the input share the exact same height. */}
                <div
                  className="flex items-stretch rounded-lg overflow-hidden"
                  style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
                >
                  <span
                    className="text-xs flex items-center px-3 shrink-0 font-mono"
                    style={{ color: "var(--text-faint)", borderRight: "1px solid var(--border-dim)", letterSpacing: "0.04em" }}
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
                <p className="mt-1.5 font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>
                  3-32 chars, lowercase, hyphens or underscores
                </p>
              </div>
              <div className="mb-3">
                <label className="block mb-1.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
                  Description
                </label>
                <textarea
                  value={hubDescription}
                  onChange={e => setHubDescription(e.target.value)}
                  placeholder="Building knowledge in public, capture / bundle / deploy."
                  rows={2}
                  maxLength={280}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: "var(--background)", border: "1px solid var(--border-dim)", color: "var(--text-primary)" }}
                />
              </div>
            </>
          )}
          {hubError && (
            <p className="mb-2" style={{ color: "var(--micro-red)", fontSize: 12 }}>{hubError}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSaveHub}
              disabled={hubSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "var(--text-primary)", color: "var(--background)", opacity: hubSaving ? 0.6 : 1 }}
            >
              {hubSaving ? "Saving..." : hubSaved ? "Saved" : "Save"}
            </button>
            {/* Recovery button — force-creates a hub slug when the
                user's row has lost it (or never had one). Surfaces
                the API response inline so failures stop being silent. */}
            <button
              onClick={async () => {
                if (!user) return;
                try {
                  const res = await fetch("/api/user/hub/ensure", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                      "Content-Type": "application/json",
                      "x-user-id": user.id,
                      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    },
                  });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    showToast(`Hub recover failed (${res.status}): ${body.error || ""}${body.detail ? " — " + body.detail : ""}`, "error");
                    return;
                  }
                  if (body.slug) {
                    setHubSlug(body.slug);
                    showToast(`Hub ${body.created ? "created" : "already present"}: ${body.slug}`, "success");
                    // Pass the slug in the event detail so useAuth can
                    // patch its state directly (no roundtrip needed),
                    // covering the case where the browser-side SELECT
                    // is silently returning no row.
                    try { window.dispatchEvent(new CustomEvent("mw-profile-changed", { detail: { slug: body.slug } })); } catch { /* ignore */ }
                  } else {
                    showToast("Hub recover returned no slug — see console", "error");
                    // eslint-disable-next-line no-console
                    console.warn("hub/ensure unexpected response", body);
                  }
                } catch (err) {
                  showToast(`Hub recover error: ${err instanceof Error ? err.message : String(err)}`, "error");
                }
              }}
              className="px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--toggle-bg)]"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border-dim)" }}
              title="Force-create or recover your hub slug if it's missing"
            >
              Recover hub
            </button>
            {hubPublic && hubSlug && /^[a-z0-9_-]{3,32}$/.test(hubSlug) && (
              <Link
                href={`/hub/${hubSlug}`}
                className="inline-flex items-center gap-1 transition-colors hover:underline"
                style={{ color: "var(--text-muted)", fontSize: 12 }}
                target="_blank"
              >
                View at memory.wiki/hub/{hubSlug}
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
          <label className="block mb-1.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
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

        {/* Mode (Dark / Light). Hover preview removed — flashing
            the whole UI on hover was disorienting. Click commits. */}
        <section className="mb-10">
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>Mode</h2>
          <p className="leading-relaxed mb-3" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Light or dark canvas.
          </p>
          {/* Soft segmented chip pair — same shape as the Compact/Full
              options in bundle/hub. Active = lime dot + toggle-bg. */}
          <div
            className="inline-flex p-0.5 rounded-md"
            style={{ background: "var(--surface)", border: "1px solid var(--border-dim)" }}
          >
            {(["dark", "light"] as const).map((t) => {
              const active = theme === t;
              return (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
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
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: active ? "var(--micro-lime)" : "var(--border)",
                      display: "inline-block",
                    }}
                  />
                  {t === "dark" ? "Dark" : "Light"}
                </button>
              );
            })}
          </div>
        </section>

        {/* Skin Theme — each preset offers TWO clickable variants
            (dark + light). Click commits both scheme + mode. Hover
            preview was distracting (whole UI flashed on every row). */}
        <section className="mb-10">
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>Skin Theme</h2>
          <p className="leading-relaxed mb-3" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Pick a scheme. Each row offers dark and light variants.
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
                    background: isSchemeSelected ? "var(--toggle-bg)" : "transparent",
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
                          className="rounded-md flex items-center justify-center transition-colors"
                          style={{
                            width: 28,
                            height: 28,
                            background: bg,
                            border: active ? `1.5px solid var(--micro-lime)` : "1px solid var(--border-dim)",
                          }}
                          title={`${s.label}, ${mode}`}
                        >
                          <span className="rounded-full" style={{ width: 11, height: 11, background: s.preview }} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{s.label}</div>
                    <div className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>{s.desc}</div>
                  </div>
                  {isSchemeSelected && (
                    <span
                      aria-hidden
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--micro-lime)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Key Color — nine accents. Each row shows the dark-mode
            tone next to the light-mode tone so the user sees both
            variants; hovering applies the accent globally. */}
        <section className="mb-10">
          <label className="block mb-1.5" style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>
            Key Color
          </label>
          <p className="leading-relaxed mb-3" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Drives editor links, blockquote borders, and task-list checks.
          </p>
          {/* Live editor preview — uses the same .mdcore-rendered styles
              the real doc viewer uses, so what the user sees here is
              exactly what their docs will look like with the chosen
              accent. */}
          <div
            className="mdcore-rendered rounded-lg px-4 py-3 mb-3 text-sm"
            style={{ background: "var(--background)", border: "1px solid var(--border-dim)" }}
          >
            <p style={{ margin: 0 }}>
              Sample paragraph with a <a href="#" onClick={(e) => e.preventDefault()}>configurable link</a> and some <code>inline code</code>.
            </p>
            <blockquote>
              <p style={{ margin: 0 }}>
                <strong>Heads up:</strong> blockquote borders, links, and task checks all pick up the accent.
              </p>
            </blockquote>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-dim)" }}>
            {ACCENT_COLORS.map((c, idx) => {
              const isSelected = keyColor === c.name;
              const isLast = idx === ACCENT_COLORS.length - 1;
              // Lime is the implicit scheme-default — selecting it
              // removes the data-accent override so the root value
              // applies. The row's swatches mirror the current
              // scheme's natural accent so the UI stops claiming
              // "lime" when the rendered colour is teal under Nord.
              const isDefaultRow = c.name === "lime";
              const naturalName = isDefaultRow ? SCHEME_ACCENT_MAP[skinScheme] : c.name;
              const display = ACCENT_COLORS.find((x) => x.name === naturalName) || c;
              const showLabel = isDefaultRow
                ? (skinScheme === "default" ? "Default (Lime)" : `Default (${display.label})`)
                : c.label;
              return (
                <button
                  key={c.name}
                  onClick={() => selectAccent(c.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: isSelected ? "var(--toggle-bg)" : "transparent",
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
                    <div style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>{showLabel}</div>
                    <div className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>
                      Dark {display.dark} / Light {display.light}
                    </div>
                  </div>
                  {isSelected && (
                    <span
                      aria-hidden
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--micro-lime)" }}
                    />
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
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>Auto-management</h2>
          <p className="leading-relaxed mb-5" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Curator signals scan your hub and surface findings in Needs Review. With auto-management ON, safe findings are resolved for you on the trigger you pick; destructive ones (like duplicate trash) still ask first.
          </p>

          {/* Aggressiveness — four-step scale, each step a distinct
              micro color so the gradient (off → red) reads at a
              glance: off=faint, conservative=info, standard=lime,
              aggressive=warn. Active row carries a colored left
              border in its own hue. */}
          <h3 className="mb-2 mt-2" style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
            Aggressiveness
          </h3>
          <div className="rounded-lg overflow-hidden mb-6" style={{ border: "1px solid var(--border-dim)" }}>
            {AUTO_LEVELS.map((lvl, idx) => {
              const active = curatorSettings.autoLevel === lvl.id;
              const isLast = idx === AUTO_LEVELS.length - 1;
              const levelColors = ["var(--text-faint)", "var(--micro-info)", "var(--micro-lime)", "var(--micro-warn)"];
              const levelColor = levelColors[idx] || "var(--text-muted)";
              return (
                <button
                  key={lvl.id}
                  onClick={() => toggleCurator("autoLevel", lvl.id)}
                  className="w-full flex items-start gap-3 px-3 py-3 text-left transition-colors"
                  style={{
                    borderBottom: isLast ? "none" : "1px solid var(--border-dim)",
                    background: active ? "var(--toggle-bg)" : "transparent",
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
                          background: i <= idx ? levelColor : "var(--border-dim)",
                          opacity: i <= idx ? 1 : 1,
                        }}
                      />
                    ))}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: active ? levelColor : "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{lvl.label}</span>
                      <span className="font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>{lvl.shortDesc}</span>
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
              level is Off. Soft chip pair (segmented control) instead
              of three bordered card buttons. */}
          <div className="mb-6" style={{ opacity: curatorSettings.autoLevel === "off" ? 0.5 : 1 }}>
            <h3 className="mb-2" style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              Trigger
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md text-left transition-colors"
                    style={{
                      background: active ? "var(--toggle-bg)" : "transparent",
                      border: `1px solid ${active ? "var(--border)" : "var(--border-dim)"}`,
                      cursor: enabled ? "pointer" : "not-allowed",
                    }}
                  >
                    <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}>
                      <span
                        aria-hidden
                        style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "var(--micro-lime)" : "var(--border)" }}
                      />
                      {label}
                    </span>
                    <span style={{ color: "var(--text-faint)", fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <h3 className="mb-2" style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
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
                    background: enabled && opt.shipped ? "var(--toggle-bg)" : "transparent",
                    opacity: opt.shipped ? 1 : 0.6,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 500 }}>{opt.label}</span>
                      {!opt.shipped && (
                        <span
                          className="px-2 py-0.5 rounded-full font-mono"
                          style={{ background: "var(--toggle-bg)", color: "var(--text-faint)", fontSize: 10, letterSpacing: "0.04em" }}
                        >
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{opt.description}</p>
                  </div>
                  {/* ON = lime, OFF = red. Solid hex per the design
                      rule that negative states use red (orange felt
                      too "AI-generated"). Inactive thumb is dim
                      gray, active thumb is white. */}
                  <label className="relative inline-flex items-center shrink-0 mt-1" style={{ cursor: opt.shipped ? "pointer" : "not-allowed" }}>
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
                        background: !opt.shipped
                          ? "var(--border-dim)"
                          : enabled
                            ? "#7CC400"
                            : "#9A2A2A",
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
          <p className="mt-3" style={{ color: "var(--text-faint)", fontSize: 12 }}>
            Synced to your account, settings follow you across devices. Local cache stays in case you go offline.
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
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>Plan</h2>
          <p className="leading-relaxed mb-4" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
            You&apos;re on the <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{(profile?.plan || "free").charAt(0).toUpperCase() + (profile?.plan || "free").slice(1)}</span> plan. Free does almost everything, Pro unlocks privacy and scale, Team (v9) brings real-time collaboration.
          </p>
          {(() => {
            const plan = profile?.plan || "free";
            // Mirrors the /about Pricing tiers in
            // apps/web/src/app/about/content.ts. When that source of
            // truth changes, mirror the edit here so the in-app plan
            // surface and the marketing pricing page stay in sync.
            const TIERS = [
              {
                key: "free",
                name: "Free",
                badge: "Always",
                badgeColor: "var(--micro-lime)",
                sub: "Unlimited public knowledge. All apps.",
                price: "$0 forever",
                features: [
                  "Unlimited documents",
                  "Public docs and a public hub",
                  "All native apps (Web, Chrome, VS Code, Mac, iOS, Android, CLI, MCP)",
                  "AI auto-organize (tags, clusters, summaries)",
                  "Cross-AI reads (Claude, ChatGPT, Gemini, Cursor, Codex)",
                  "Modest image storage",
                ],
              },
              {
                key: "pro",
                name: "Pro",
                badge: "TBD",
                badgeColor: "var(--micro-info)",
                sub: "Privacy controls, custom domain, generous storage.",
                price: "Pricing TBD",
                features: [
                  "Everything in Free",
                  "Private documents and private hub",
                  "Per-doc and per-bundle permissions (allowed emails)",
                  "Custom domain",
                  "Generous image and file storage",
                  "MCP server with full write access",
                  "Custom GPT integration",
                ],
                cta: "Upgrade to Pro",
                highlighted: true,
              },
              {
                key: "team",
                name: "Team",
                badge: "v9",
                badgeColor: "var(--micro-ai)",
                sub: "Per-seat, shared workspaces.",
                price: "Coming after PMF",
                features: [
                  "Everything in Pro",
                  "Multi-tenant workspace",
                  "Real-time collaboration on docs and bundles",
                  "Role-based access",
                  "SSO and SAML",
                  "Per-seat billing",
                  "Audit log",
                ],
              },
            ] as const;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TIERS.map((t) => {
                  const isCurrent = plan === t.key;
                  return (
                    <div
                      key={t.key}
                      className="rounded-xl p-5 relative flex flex-col"
                      style={{
                        background: isCurrent ? "var(--toggle-bg)" : "var(--surface)",
                        border: `1px solid var(--border-dim)`,
                      }}
                    >
                      {/* Name + meta chip on one row. Current = small
                          lime dot rather than a label, so all three
                          cards keep the same shape regardless of state. */}
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500, lineHeight: 1 }}>{t.name}</span>
                        {isCurrent && (
                          <span
                            aria-label="Current plan"
                            style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--micro-lime)", display: "inline-block" }}
                          />
                        )}
                        <span
                          className="ml-auto font-mono"
                          style={{ color: t.badgeColor, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}
                        >
                          {isCurrent ? "Current" : t.badge}
                        </span>
                      </div>
                      <p className="mb-1" style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.45 }}>{t.sub}</p>
                      <p className="mb-4 font-mono" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.04em" }}>{t.price}</p>
                      <ul className="space-y-1.5 mb-4 flex-1">
                        {t.features.map((f) => (
                          <li key={f} className="flex items-start gap-2" style={{ color: "var(--text-secondary)", fontSize: 12.5, lineHeight: 1.5 }}>
                            <Check width={11} height={11} className="shrink-0 mt-1" style={{ color: "var(--micro-lime)" }} />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {"highlighted" in t && t.highlighted && !isCurrent && (
                        <button
                          onClick={() => window.open("/about#pricing", "_blank")}
                          className="w-full px-3 py-2 rounded-lg transition-colors mt-auto"
                          style={{ background: "var(--text-primary)", color: "var(--background)", fontSize: 13, fontWeight: 500 }}
                        >
                          {t.cta}
                        </button>
                      )}
                    </div>
                  );
                })}
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
        <section className="mb-10">
          <h2 style={{ color: "var(--text-primary)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>
            Your data
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Download every document, bundle, folder, and concept you own as a single JSON file. Your data is yours, this works any time, no questions asked. GDPR right-to-portability and your daily backup, the same endpoint.
          </p>
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              background: "var(--toggle-bg)",
              border: "1px solid var(--border-dim)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 500,
              opacity: exporting ? 0.6 : 1,
              cursor: exporting ? "not-allowed" : "pointer",
            }}
          >
            <Download width={14} height={14} />
            {exporting ? "Preparing export…" : "Export all my data"}
          </button>
        </section>

        {/* Danger Zone — same shape as other sections, with a red
            tint instead of an outline pill so the destructive intent
            reads at a glance without competing with the regular UI. */}
        <section>
          <h2 style={{ color: "var(--micro-red)", margin: 0, marginBottom: 6, fontSize: 22, lineHeight: 1.25, fontWeight: 500, letterSpacing: 0 }}>
            Danger zone
          </h2>
          <p className="leading-relaxed mb-4" style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>
            Account deletion is permanent. Your docs, bundles, hub URL, and concept index all disappear, no recovery.
          </p>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{
                background: "rgba(239, 68, 68, 0.10)",
                border: "1px solid rgba(239, 68, 68, 0.28)",
                color: "var(--micro-red)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Trash2 width={14} height={14} />
              Delete account
            </button>
          ) : (
            <div className="rounded-lg p-4" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.28)" }}>
              <p className="mb-3" style={{ color: "var(--micro-red)", fontSize: 13, fontWeight: 500 }}>
                This will permanently delete your account, all documents, and all data. This action cannot be undone.
              </p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{ background: "var(--micro-red)", color: "#fff", fontSize: 13, fontWeight: 500, opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{ background: "var(--toggle-bg)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", fontSize: 13, fontWeight: 500 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        </>)}
      </div>
    </div>
  );
}
