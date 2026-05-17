"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { getAnonymousId, clearAnonymousId } from "./anonymous-id";
import { readMdfyAnonCookie, clearMdfyAnonCookie } from "./anonymous-cookie-client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  hub_slug?: string | null;
  hub_public?: boolean;
  hub_description?: string | null;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  accessToken: string | null;
}

function fetchProfile(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  setState: React.Dispatch<React.SetStateAction<AuthState>>
) {
  if (!supabase) return;
  supabase
    .from("profiles")
    .select("display_name, avatar_url, plan, hub_slug, hub_public, hub_description")
    .eq("id", userId)
    .single()
    .then((res: { data: Profile | null }) => {
      if (res.data) setState((prev) => ({ ...prev, profile: res.data }));
    });
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
    if (sessionStorage.getItem("mdfy-claim-attempted") === "1") return;
    sessionStorage.setItem("mdfy-claim-attempted", "1");
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
          new CustomEvent("mdfy-anon-claimed", {
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

  useEffect(() => {
    if (!supabase) {
      setState({ user: null, profile: null, loading: false, accessToken: null });
      return;
    }

    supabase.auth.getSession().then((res: { data: { session: { user: User; access_token?: string } | null } }) => {
      const session = res.data.session;
      if (session?.user) {
        setState((prev) => ({ ...prev, user: session.user, accessToken: session.access_token || null, loading: false }));
        fetchProfile(supabase, session.user.id, setState);
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
          fetchProfile(supabase, session.user.id, setState);
          // SIGNED_IN (fresh login) AND repeat events both go through the
          // same idempotent helper. The sessionStorage guard inside
          // tryClaimAnonymousContent prevents repeated API hits per tab.
          if (event === "SIGNED_IN") {
            // Fresh sign-in: reset the per-tab guard so the migrate fires
            // even if a previous page load already attempted it.
            try { sessionStorage.removeItem("mdfy-claim-attempted"); } catch { /* ignore */ }
            tryClaimAnonymousContent(session.access_token || null);
          }
        } else {
          setState({ user: null, profile: null, loading: false, accessToken: null });
        }

        // Detect session expiry: SIGNED_OUT event or TOKEN_REFRESHED failure
        if (event === "SIGNED_OUT" && !session) {
          const wasLoggedIn = typeof window !== "undefined" && localStorage.getItem("mdfy-was-logged-in");
          if (wasLoggedIn) {
            // Dispatch a custom event so components can show a notification
            window.dispatchEvent(new CustomEvent("mdfy-session-expired"));
          }
        }
        if (event === "TOKEN_REFRESHED" && !session) {
          window.dispatchEvent(new CustomEvent("mdfy-session-expired"));
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }, [supabase]);

  const signInWithGitHub = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
      // Keep in sync with DEMO_EMAILS in /api/auth/demo-signin/route.ts.
      if (normalized === "yc@mdfy.app" || normalized === "demo@mdfy.app") {
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
    signInWithEmail,
    signOut,
  };
}
