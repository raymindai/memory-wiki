// auth-bridge.js — runs in the page context of memory.wiki domains.
//
// Safari's Storage Partitioning prevents the extension from reading
// memory.wiki cookies via chrome.cookies.getAll (returns count=0)
// AND from fetching /api/me with credentials:"include" from the
// extension origin (the cookie isn't attached because Safari treats
// safari-web-extension://… as third-party). Both Chrome-style paths
// are blocked.
//
// Workaround: a content script in the PAGE context of memory.wiki
// can read document.cookie just like the page's own JS. It picks up
// the Supabase auth cookies (sb-*-auth-token), concatenates the
// chunks, decodes, extracts user id + email, and forwards to the
// background via chrome.runtime.sendMessage. The background caches
// the result in chrome.storage.local. The popup's auth check then
// reads from storage first, which works regardless of cookie
// partitioning.
//
// Runs on every memory.wiki page load — sign-in, sign-out, and
// session refresh all naturally flow through.

(function () {
  function readSupabaseSession() {
    try {
      // Supabase auth cookies are named sb-<projectref>-auth-token,
      // sometimes split across .0 / .1 suffix chunks. Reassemble in
      // sorted order to handle the chunked variant.
      const all = document.cookie.split("; ");
      const auth = all
        .map((kv) => {
          const eq = kv.indexOf("=");
          return { name: kv.slice(0, eq), value: decodeURIComponent(kv.slice(eq + 1)) };
        })
        .filter((c) => /^sb-[^=]+-auth-token(\.\d+)?$/.test(c.name))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!auth.length) return null;
      const combined = auth.map((c) => c.value).join("").replace(/^base64-/, "");
      // Cookie value may be JSON-quoted base64 — strip surrounding quotes if
      // present, then base64-decode to JSON.
      const stripped = combined.replace(/^"|"$/g, "");
      let json;
      try {
        json = JSON.parse(atob(stripped));
      } catch {
        // Some Supabase versions store as plain JSON, not base64. Try that.
        try { json = JSON.parse(stripped); } catch { return null; }
      }
      if (!json || !json.user) return null;
      return {
        userId: json.user.id,
        email: json.user.email || null,
        displayName:
          json.user.user_metadata?.full_name ||
          json.user.user_metadata?.name ||
          (json.user.email ? json.user.email.split("@")[0] : null),
        avatarUrl: json.user.user_metadata?.avatar_url || null,
      };
    } catch {
      return null;
    }
  }

  function relayToBackground(session) {
    try {
      chrome.runtime.sendMessage({ action: "auth-from-page", session });
    } catch { /* extension context invalidated — ignore */ }
  }

  function syncOnce() {
    const session = readSupabaseSession();
    if (session) {
      relayToBackground(session);
    } else {
      // Tell background the page has no auth — covers sign-out path.
      relayToBackground(null);
    }
  }

  // Initial sync on page load.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncOnce);
  } else {
    syncOnce();
  }

  // Re-sync on visibility change — covers the "user signed in another
  // tab, came back to this tab" flow.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncOnce();
  });

  // Re-sync every 30s while the tab is foregrounded — keeps the cache
  // fresh through session refreshes that Supabase performs in the
  // background.
  setInterval(() => {
    if (!document.hidden) syncOnce();
  }, 30000);
})();
