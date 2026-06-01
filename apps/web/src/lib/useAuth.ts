"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { getAnonymousId, clearAnonymousId } from "./anonymous-id";
import { readMdfyAnonCookie, clearMdfyAnonCookie } from "./anonymous-cookie-client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  /** DiceBear style id ("identicon" / "oauth" / etc.) — when set
   *  (and not "oauth") it overrides avatar_url in resolveAvatar. */
  avatar_style?: string | null;
  plan: string;
  hub_slug?: string | null;
  hub_public?: boolean;
  hub_description?: string | null;
  /** Auto-management config — synced from Settings → Auto-management. */
  curator_settings?: Record<string, unknown> | null;
  /** Key Color picker — drives `--accent` everywhere (links,
   *  blockquotes, task checks). */
  accent_color?: string | null;
  /** Skin scheme picker (default / nord / dracula / …). */
  color_scheme?: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  accessToken: string | null;
}

async function fetchProfileFromServer(
  userId: string,
  accessToken: string | null,
): Promise<Profile | null> {
  try {
    const res = await fetch("/api/user/profile", {
      credentials: "include",
      headers: {
        "x-user-id": userId,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return (body?.profile as Profile | null) ?? null;
  } catch {
    return null;
  }
}

function fetchProfile(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  setState: React.Dispatch<React.SetStateAction<AuthState>>,
  accessToken: string | null,
) {
  if (!supabase) return;
  supabase
    .from("profiles")
    .select("display_name, avatar_url, avatar_style, plan, hub_slug, hub_public, hub_description, curator_settings, accent_color, color_scheme")
    .eq("id", userId)
    .maybeSingle()
    .then(async (res: { data: Profile | null; error: { message: string } | null }) => {
      // Authoritative source: browser SELECT may return a row whose
      // hub_slug column reads null (RLS quirk, stale replica, etc.)
      // even when the DB row really has a slug. Fall through to the
      // server endpoint, which uses the service role and is the
      // ground truth.
      let profile: Profile | null = res.data ?? null;
      if (!profile || !profile.hub_slug) {
        const fromServer = await fetchProfileFromServer(userId, accessToken);
        if (fromServer) profile = fromServer;
      }
      if (profile) {
        // MERGE rather than REPLACE — preserves any field already in
        // state that the fetched row happens to be missing (avoids
        // the prior class of bug where an inline SELECT with fewer
        // columns silently nulled out avatar_style / accent_color /
        // hub_slug for the rest of the session). Also preserves a
        // hub_slug that was patched in via a "mw-profile-changed"
        // detail payload if the fetched copy lost it.
        setState((prev) => {
          const merged: Profile = { ...(prev.profile || ({} as Profile)) };
          for (const k of Object.keys(profile!) as (keyof Profile)[]) {
            const v = profile![k];
            if (v !== null && v !== undefined) {
              (merged[k] as unknown) = v;
            }
          }
          return { ...prev, profile: merged };
        });
        if (!profile.hub_slug) {
          ensureHubSlug(supabase, userId, accessToken, setState);
        }
      } else {
        ensureHubSlug(supabase, userId, accessToken, setState);
      }
    });
}

function ensureHubSlug(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  accessToken: string | null,
  setState: React.Dispatch<React.SetStateAction<AuthState>>,
) {
  if (typeof window === "undefined") return;
  // Guard removed — the endpoint is idempotent (returns the existing
  // slug when one already exists), and the earlier sessionStorage
  // guard meant users stuck in a "no slug" state had no way to
  // recover within a tab session without a full reload.
  fetch("/api/user/hub/ensure", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
    .then(async (r) => {
      if (!r.ok) return null;
      return r.json().catch(() => null);
    })
    .then((data) => {
      if (!data?.slug || !supabase) return;
      // Re-hydrate via the SAME fetch path as the initial load — the
      // earlier inline SELECT here was missing avatar_style /
      // curator_settings / accent_color / color_scheme, so on every
      // sign-in path that triggered hub-ensure, the profile state
      // was clobbered and the picked avatar/accent silently reverted.
      fetchProfile(supabase, userId, setState, accessToken);
      if (data.created) {
        // Surface a one-shot notice so the user knows where to
        // customize. Components subscribe via the event listener.
        try {
          window.dispatchEvent(new CustomEvent("mw-hub-auto-created", { detail: { slug: data.slug } }));
        } catch { /* ignore */ }
      }
    })
    .catch(() => { /* best-effort — Settings can still fix manually */ });
}

/**
 * Migrate any anonymously-captured docs / bundles to the now-signed-in
 * user. Idempotent — safe to call on every auth load. Used to fire only
 * on the SIGNED_IN event, which meant a user who was already signed in
 * before visiting an anonymous doc URL never got the auto-claim. Now we
 * also call it on the initial getSession() pass, with a one-shot
 * sessionStorage guard so it doesn't thrash the API on every navigation.
 */
function tryClaimAnonymousContent(accessToken: string | null) {
  if (typeof window === "undefined") return;
  const localAnon = getAnonymousId();
  const cookieAnon = readMdfyAnonCookie();
  if (!localAnon && !cookieAnon) return;
  // Per-tab guard — once we've attempted claim for this tab, don't
  // retry on every onAuthStateChange (TOKEN_REFRESHED fires often).
  // A real new sign-in flow resets the tab (OAuth redirect) so this
  // doesn't block legitimate re-attempts.
  try {
    if (sessionStorage.getItem("mw-claim-attempted") === "1") return;
    sessionStorage.setItem("mw-claim-attempted", "1");
  } catch { /* private mode etc. — fall through, still safe */ }

  fetch("/api/user/migrate", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      anonymousId: localAnon || undefined,
      cookieAnonymousId: cookieAnon || undefined,
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      const total = (data.documentsMigrated || 0) + (data.bundlesMigrated || 0);
      if (total > 0) {
        if (localAnon) clearAnonymousId();
        if (cookieAnon) clearMdfyAnonCookie();
        window.dispatchEvent(
          new CustomEvent("mw-anon-claimed", {
            detail: {
              documents: data.documentsMigrated || 0,
              bundles: data.bundlesMigrated || 0,
            },
          })
        );
      }
    })
    .catch(() => { /* best-effort */ });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    accessToken: null,
  });

  const supabase = getSupabaseBrowserClient();
  // Stable ref to the latest state so the window-level
  // "mw-profile-changed" listener can always reach the *current* user
  // + token without re-binding (and without the stale-closure bug that
  // made avatar swaps silently no-op when state changed between mount
  // and event-fire).
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!supabase) {
      setState({ user: null, profile: null, loading: false, accessToken: null });
      return;
    }

    supabase.auth.getSession().then((res: { data: { session: { user: User; access_token?: string } | null } }) => {
      const session = res.data.session;
      if (session?.user) {
        // Mark "this device has a logged-in user" so the pre-paint
        // auth gate (layout.tsx inline script) knows to show the
        // MW-blob loader instead of letting the public viewer chrome
        // flash for ~500ms before the ownership-check redirect fires.
        try { localStorage.setItem("mw-was-logged-in", "1"); } catch { /* ignore */ }
        setState((prev) => ({ ...prev, user: session.user, accessToken: session.access_token || null, loading: false }));
        fetchProfile(supabase, session.user.id, setState, session.access_token || null);
        // Already-signed-in path: SIGNED_IN event won't fire, so trigger
        // the anonymous-content claim here too. Per-tab guarded so the
        // API isn't hit on every page navigation.
        tryClaimAnonymousContent(session.access_token || null);
      } else {
        setState({ user: null, profile: null, loading: false, accessToken: null });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, session: { user: User; access_token?: string } | null) => {
        if (session?.user) {
          setState((prev) => ({ ...prev, user: session.user, accessToken: session.access_token || null, loading: false }));
          fetchProfile(supabase, session.user.id, setState, session.access_token || null);
          // SIGNED_IN (fresh login) AND repeat events both go through the
          // same idempotent helper. The sessionStorage guard inside
          // tryClaimAnonymousContent prevents repeated API hits per tab.
          if (event === "SIGNED_IN") {
            // Fresh sign-in: reset the per-tab guard so the migrate fires
            // even if a previous page load already attempted it.
            try { sessionStorage.removeItem("mw-claim-attempted"); } catch { /* ignore */ }
            tryClaimAnonymousContent(session.access_token || null);
          }
        } else {
          setState({ user: null, profile: null, loading: false, accessToken: null });
        }

        // Detect session expiry: SIGNED_OUT event or TOKEN_REFRESHED failure
        if (event === "SIGNED_OUT" && !session) {
          const wasLoggedIn = typeof window !== "undefined" && localStorage.getItem("mw-was-logged-in");
          if (wasLoggedIn) {
            // Dispatch a custom event so components can show a notification
            window.dispatchEvent(new CustomEvent("mw-session-expired"));
          }
        }
        if (event === "TOKEN_REFRESHED" && !session) {
          window.dispatchEvent(new CustomEvent("mw-session-expired"));
        }
      }
    );

    // Listen for profile-changed events fired from SettingsEmbed
    // (avatar swap, accent picker, hub edits). Re-fetch the profile
    // so the header avatar / colors update immediately. Reads user +
    // token from stateRef so the listener doesn't capture a stale
    // snapshot — the previous closure-based read kept firing with the
    // user=null value from the first effect run and silently bailed.
    const onProfileChanged = (evt: Event) => {
      const u = stateRef.current.user;
      if (!supabase || !u) return;
      // If the dispatcher attached a `detail` payload with the
      // changed fields, patch state directly and TRUST IT — don't
      // call fetchProfile, because fetchProfile's RLS-bound browser
      // SELECT was returning a profile with hub_slug=null and
      // overwriting the slug we just patched (the load-bearing race
      // that kept "Recover hub" from ever surfacing the slug in the
      // header). Issuer is expected to send the authoritative value.
      const detail = (evt as CustomEvent<{ slug?: string; profilePatch?: Partial<Profile> }>).detail;
      if (detail?.profilePatch) {
        setState((prev) => ({ ...prev, profile: { ...(prev.profile || ({} as Profile)), ...detail.profilePatch } }));
        return;
      }
      if (detail?.slug) {
        setState((prev) => ({ ...prev, profile: { ...(prev.profile || ({} as Profile)), hub_slug: detail.slug } }));
        return;
      }
      // No detail payload — fall back to a full re-fetch.
      fetchProfile(supabase, u.id, setState, stateRef.current.accessToken);
    };
    window.addEventListener("mw-profile-changed", onProfileChanged);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("mw-profile-changed", onProfileChanged);
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    // prompt=select_account forces Google to show the account chooser
    // even when the user has an active Google session; without it,
    // signing in after a memory.wiki sign-out silently re-uses the
    // last-used Google identity and there's no way to switch.
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }, [supabase]);

  const signInWithGitHub = useCallback(async () => {
    if (!supabase) return;
    // GitHub doesn't honor `prompt`; the user has to sign out on
    // github.com to switch GitHub identities.
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const signInWithApple = useCallback(async () => {
    if (!supabase) return;
    // Apple respects `prompt=select_account` and shows the chooser.
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }, [supabase]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) return { error: "Supabase not configured" };
      const normalized = email.trim().toLowerCase();

      // Demo-account fast path — yc@mdfy.app and similar allowlisted
      // emails skip the magic-link round-trip and sign in immediately
      // via /api/auth/demo-signin. Returns { instant: true } so the UI
      // can navigate straight in without showing "check your email."
      // Keep in sync with DEMO_EMAILS in /api/auth/demo-signin/route.ts
      // and with EmailAuthSheet.demoEmails on iOS.
      if (
        normalized === "yc@mdfy.app"
        || normalized === "demo@mdfy.app"
        || normalized === "demo@memory.wiki"
      ) {
        try {
          const res = await fetch("/api/auth/demo-signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: normalized }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { error: err.error || `Demo sign-in failed (${res.status})` };
          }
          const data = await res.json();
          if (!data.access_token || !data.refresh_token) {
            return { error: "Demo sign-in returned no session" };
          }
          const { error: setErr } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });
          if (setErr) return { error: setErr.message };
          return { error: null, instant: true };
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Demo sign-in error" };
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error?.message || null };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "local" });
    // Clear all Supabase-related storage to prevent auto-login on next sign-in
    Object.keys(localStorage).forEach(key => {
      if (key.includes("supabase") || key.includes("sb-")) {
        localStorage.removeItem(key);
      }
    });
    setState({ user: null, profile: null, loading: false, accessToken: null });
  }, [supabase]);

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    accessToken: state.accessToken,
    isAuthenticated: !!state.user,
    signInWithGoogle,
    signInWithGitHub,
    signInWithApple,
    signInWithEmail,
    signOut,
  };
}
