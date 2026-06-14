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

  // ─── Force sign-out (Safari Storage Partitioning workaround) ───────
  //
  // chrome.cookies.remove can't touch memory.wiki's sb-* cookies from
  // the extension context on Safari macOS — the partition blocks it.
  // So the popup's sign-out cleared chrome.storage.local but the page
  // cookies survived, and on the next memory.wiki page load this very
  // script read them back, repopulated the cache, and the user looked
  // signed in again.
  //
  // Fix: the popup broadcasts {action:"force-signout"} to every
  // memory.wiki tab. This listener runs in page context so document.cookie
  // and localStorage ARE writeable. We expire every sb-* cookie at every
  // plausible path / domain combination, drop the Supabase localStorage
  // entries, then push a null session to background so the popup's chip
  // updates immediately without waiting for the 30s poll.
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg || msg.action !== "force-signout") return;
      try {
        // Cookies. Re-set each sb-* with an expired date on every
        // (path, domain) combo a browser might have stored it under.
        // Without the multiple domain variants ("memory.wiki" vs
        // ".memory.wiki" vs no-domain), one of them survives and
        // document.cookie still returns the auth token next read.
        const cookies = document.cookie.split("; ");
        const past = "Thu, 01 Jan 1970 00:00:00 GMT";
        const host = location.hostname;
        const baseHost = host.replace(/^www\./, "");
        for (const kv of cookies) {
          const name = kv.split("=")[0];
          if (!/^sb-/.test(name)) continue;
          for (const domain of ["", "; domain=" + host, "; domain=." + baseHost, "; domain=" + baseHost]) {
            for (const path of ["/", "/api", "/auth"]) {
              document.cookie = name + "=; expires=" + past + "; path=" + path + domain;
            }
          }
        }
        // Supabase also writes session data to localStorage on some
        // configurations. Wipe anything that looks like it.
        try {
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (/^sb-/.test(k) || /supabase/i.test(k))) {
              localStorage.removeItem(k);
            }
          }
        } catch { /* private mode / locked storage — ignore */ }
        // Tell background the session is gone NOW so the popup's chip
        // updates without waiting for the next poll tick.
        relayToBackground(null);
        if (typeof sendResponse === "function") sendResponse({ ok: true });
      } catch (e) {
        if (typeof sendResponse === "function") sendResponse({ ok: false, error: String(e) });
      }
      return true;
    });
  } catch { /* extension context invalidated — ignore */ }
})();
