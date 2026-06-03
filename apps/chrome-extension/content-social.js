/*
 * memory.wiki — social post per-item capture.
 *
 * Injects a small "Save to memory.wiki" pill into each social post on
 * X (twitter.com, x.com) and Threads (threads.net, threads.com). Click
 * extracts {author, timestamp, body text, media URLs} → posts to
 * memory.wiki/api/docs as a markdown doc.
 *
 * Phase 1: X + Threads only (DOM stable, AI workflow priority).
 * LinkedIn / Instagram / Facebook ship in subsequent passes.
 *
 * Pattern mirrors content.js's per-message mw-mini-btn — same brand
 * pill, same loading/done/error states.
 */

(function () {
  "use strict";

  if (document.documentElement.dataset.mwSocialInjected) return;
  document.documentElement.dataset.mwSocialInjected = "1";

  const HOST = (location.hostname || "").toLowerCase();
  const isX = /(^|\.)x\.com$|(^|\.)twitter\.com$/.test(HOST);
  const isThreads = /(^|\.)threads\.(net|com)$/.test(HOST);
  if (!isX && !isThreads) return;

  // ─── Brand assets (data URLs so host CSS can't reach in) ─────────
  // Full blob mark: outer 4 elements PLUS the inner square detail
  // (the ZM25.08… subpath). Without that subpath the mark renders
  // as a blank silhouette and looks like a different icon entirely.
  const BLOB_DATA = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 45 48" fill="none">' +
    '<rect x="-3" y="-3" width="45" height="48" rx="5" fill="#09090b"/>' +
    '<g fill="#fafafa">' +
    '<path d="M36.19,21.04c-1.54,0-2.79,1.25-2.79,2.79s1.25,2.79,2.79,2.79,2.79-1.25,2.79-2.79-1.25-2.79-2.79-2.79Z"/>' +
    '<circle cx="20.11" cy="4.37" r="4.37"/>' +
    '<path d="M6.09,31.53c-1.36.53-1.74,2.06-1.19,3.18.54,1.08,1.79,1.54,2.98,1.09,1.22-.47,1.67-1.69,1.19-3-.39-1.05-1.67-1.78-2.97-1.27Z"/>' +
    '<path d="M31.93,18.82c2.47-2.05,2.41-5.6.47-7.8-1.92-2.16-5.43-2.47-7.7-.32-2.15,2.04-5.57,2.85-8.1.78-1.26-1.03-2.59-1.93-4.38-1.4-1.39.41-2.59,1.52-3.11,3.13-.43,1.31-1.93,1.77-3.24,1.79-2.08.03-3.88,1.36-4.81,2.83-1.2,1.89-1.36,4-.55,5.97,1.08,2.61,3.64,4.2,6.5,3.77,1.85-.28,3.83.15,4.96,1.89.79,1.21,1.1,2.94.65,4.25-.7,2.06-.72,4.22.66,5.94,1.58,1.99,4.03,2.8,6.51,2.11,2.19-.6,3.53-2.47,4.23-4.79.5-1.65,2.55-2.28,4.07-2.36,1.9-.09,3.25-1.65,3.74-3.1.68-1.98-.28-3.55-1.42-4.94-2.11-2.56-.75-5.9,1.51-7.77ZM25.08,26.71c-1.04.64-2.02-.84-3.78-1.5-.57,1.76.47,3.42-.46,4-.46.29-1.19.31-1.56.03-.95-.71.23-2.3-.43-4.05-1.92.7-3.05,2.62-4.08,1.16-.44-.62-.32-1.46.47-1.79.95-.39,1.67-.74,2.71-1.36l-2.86-1.7c-.48-.29-.52-.96-.32-1.38.26-.54.99-.86,1.52-.51l2.61,1.73c.55-1.54-.35-3.26.38-3.92.3-.27,1.04-.31,1.51-.12,1,.41.09,2.34.49,4.02l2.49-1.66c.52-.35,1.23-.14,1.57.33.38.52.34,1.29-.35,1.61-.94.44-1.71.86-2.68,1.55,1.38,1.14,3.27,1.24,3.37,2.34.04.42-.28,1.03-.61,1.23Z"/>' +
    '</g></svg>'
  );

  function injectStyles() {
    if (document.getElementById("mw-social-style")) return;
    const s = document.createElement("style");
    s.id = "mw-social-style";
    s.textContent = `
      /* Position: top-right minus 44px so we clear the platform's own
         '...' (more) menu button, which sits at the post's top-right
         on both X and Threads. With right:8 the save pill was
         overlapping their menu and stealing the click. */
      .mw-social-btn{position:absolute!important;top:6px!important;right:44px!important;z-index:9999!important;
        display:inline-flex!important;align-items:center!important;gap:6px!important;
        padding:4px 8px 4px 4px!important;border-radius:14px!important;
        background:#09090b!important;border:1px solid rgba(255,255,255,0.10)!important;
        box-shadow:0 2px 10px rgba(0,0,0,0.35)!important;
        cursor:pointer!important;line-height:0!important;
        opacity:0!important;pointer-events:none!important;
        transition:opacity 140ms,border-color 140ms,background 140ms,transform 120ms!important;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif!important;box-sizing:border-box!important}
      .mw-social-host:hover>.mw-social-btn,.mw-social-btn:hover{opacity:1!important;pointer-events:auto!important}
      .mw-social-btn:hover{border-color:rgba(255,255,255,0.20)!important;transform:scale(1.04)!important}
      .mw-social-btn:active{transform:scale(0.96)!important}
      .mw-social-btn.mw-saving{opacity:1!important;pointer-events:none!important;border-color:rgba(255,255,255,0.30)!important}
      .mw-social-btn.mw-done{opacity:1!important;pointer-events:none!important;border-color:rgba(255,255,255,0.50)!important;background:rgba(255,255,255,0.10)!important}
      .mw-social-btn.mw-error{opacity:1!important;pointer-events:none!important;border-color:rgba(248,113,113,0.45)!important;background:rgba(248,113,113,0.10)!important}
      .mw-social-btn .mw-mark{display:inline-flex!important;width:20px!important;height:20px!important;flex-shrink:0!important}
      .mw-social-btn .mw-mark img{width:20px!important;height:20px!important;display:block!important;border:0!important;margin:0!important;padding:0!important;background:transparent!important;max-width:none!important;border-radius:0!important;filter:none!important;opacity:1!important}
      .mw-social-btn .mw-glyph{display:inline-flex!important;width:14px!important;height:14px!important;flex-shrink:0!important;color:#a1a1aa!important;align-items:center!important;justify-content:center!important}
      .mw-social-btn:hover .mw-glyph{color:#fafafa!important}
      .mw-social-btn.mw-saving .mw-glyph,.mw-social-btn.mw-done .mw-glyph{color:#fb923c!important}
      .mw-social-btn.mw-error .mw-glyph{color:#f87171!important}
      .mw-social-btn .mw-glyph svg{width:14px!important;height:14px!important;display:block!important}
      .mw-social-btn .mw-spin{display:inline-block!important;width:12px!important;height:12px!important;border:1.6px solid rgba(251,146,60,0.25)!important;border-top-color:#fb923c!important;border-radius:50%!important;animation:mw-social-spin .8s linear infinite!important;box-sizing:border-box!important}
      @keyframes mw-social-spin{to{transform:rotate(360deg)}}
      .mw-social-host{position:relative!important}
    `;
    document.head.appendChild(s);
  }

  const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  // ─── Per-platform adapters ───────────────────────────────────────
  // Each returns: { selector, extract(el): {body, author, handle, ts, url, images} | null }
  const ADAPTERS = {
    x: {
      // Tweet container — works on x.com timeline + permalink pages.
      selector: 'article[data-testid="tweet"]:not([data-mw-social-attached])',
      extract(el) {
        const textEl = el.querySelector('[data-testid="tweetText"]');
        const body = textEl ? collectText(textEl) : "";
        if (!body && !el.querySelector('[data-testid="tweetPhoto"]')) return null;
        const userEl = el.querySelector('[data-testid="User-Name"]');
        let author = "", handle = "";
        if (userEl) {
          const names = userEl.querySelectorAll("span");
          // Twitter shows display name + @handle in spans
          const arr = Array.from(names).map(s => (s.textContent || "").trim()).filter(Boolean);
          author = arr[0] || "";
          const h = arr.find(s => s.startsWith("@"));
          handle = h || "";
        }
        const timeEl = el.querySelector("time");
        const ts = timeEl ? timeEl.getAttribute("datetime") || "" : "";
        // Permalink: any anchor with /status/ in href
        const permalinkEl = el.querySelector('a[href*="/status/"]');
        const url = permalinkEl ? new URL(permalinkEl.getAttribute("href") || "", location.origin).href : location.href;
        const images = Array.from(el.querySelectorAll('[data-testid="tweetPhoto"] img'))
          .map(img => img.currentSrc || img.src)
          .filter(Boolean);
        return { body, author, handle, ts, url, images };
      },
    },
    threads: {
      // Each post is a pressable container. Filter to those with text content.
      selector: 'div[data-pressable-container="true"]:not([data-mw-social-attached])',
      extract(el) {
        // Threads body: the first long span with dir="auto" inside the post,
        // skipping author chips.
        const candidates = el.querySelectorAll('span[dir="auto"], div[dir="auto"]');
        let body = "";
        for (const c of candidates) {
          const t = collectText(c);
          if (t.length > body.length) body = t;
        }
        if (!body) return null;
        // Author: first <a> with href starting with /@
        const userLink = el.querySelector('a[href^="/@"]');
        const handle = userLink ? "@" + (userLink.getAttribute("href") || "").replace(/^\/@/, "").split("/")[0] : "";
        const timeEl = el.querySelector("time");
        const ts = timeEl ? timeEl.getAttribute("datetime") || "" : "";
        const permalinkEl = el.querySelector('a[href*="/post/"]');
        const url = permalinkEl ? new URL(permalinkEl.getAttribute("href") || "", location.origin).href : location.href;
        const images = Array.from(el.querySelectorAll("picture img, img[alt]"))
          .map(img => img.currentSrc || img.src)
          .filter(s => s && /^https?:/.test(s) && !/profile_images|emoji|avatar/i.test(s));
        return { body, author: handle, handle, ts, url, images };
      },
    },
  };

  const platform = isX ? "x" : "threads";
  const adapter = ADAPTERS[platform];

  function collectText(el) {
    // Preserve line breaks from <br> and block-level children. Strip
    // tracking pixels / hidden content.
    const out = [];
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent || ""); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === "BR") { out.push("\n"); return; }
      if (tag === "IMG") {
        // Twitter renders custom emoji as <img alt="emoji">
        const alt = node.getAttribute("alt") || "";
        if (alt) out.push(alt);
        return;
      }
      const cs = window.getComputedStyle ? window.getComputedStyle(node) : null;
      if (cs && (cs.display === "none" || cs.visibility === "hidden")) return;
      for (const c of node.childNodes) walk(c);
      // Treat block elements as paragraph breaks.
      const isBlock = tag === "P" || tag === "DIV" || tag === "LI";
      if (isBlock) out.push("\n");
    }
    walk(el);
    return out.join("").replace(/\n{3,}/g, "\n\n").trim();
  }

  function buildMarkdown(data) {
    const lines = [];
    const titleSeed = (data.body.split("\n")[0] || "").slice(0, 80).trim() || `Post by ${data.handle || data.author || "unknown"}`;
    lines.push("# " + titleSeed);
    lines.push("");
    const meta = [];
    if (data.author && data.handle && data.author !== data.handle) meta.push(`**${data.author}** ${data.handle}`);
    else if (data.handle) meta.push(`**${data.handle}**`);
    else if (data.author) meta.push(`**${data.author}**`);
    if (data.ts) {
      const d = new Date(data.ts);
      if (!isNaN(d.getTime())) meta.push(d.toISOString().replace("T", " ").slice(0, 16) + " UTC");
    }
    meta.push(platform);
    lines.push("> " + meta.join(" · "));
    lines.push("");
    lines.push(data.body);
    if (data.images.length) {
      lines.push("");
      for (const u of data.images) lines.push(`![](${u})`);
    }
    if (data.url) {
      lines.push("");
      lines.push(`[Original post](${data.url})`);
    }
    return { markdown: lines.join("\n").trim(), title: titleSeed };
  }

  function makeButton() {
    const el = document.createElement("div");
    el.className = "mw-social-btn";
    el.setAttribute("aria-label", "Save post to memory.wiki");
    el.setAttribute("title", "Save post to memory.wiki");
    el.innerHTML =
      '<span class="mw-mark"><img src="' + BLOB_DATA + '" alt=""></span>' +
      '<span class="mw-glyph">' + PLUS_SVG + '</span>';
    el.addEventListener("click", onSaveClick);
    el.addEventListener("mousedown", (e) => e.stopPropagation());
    return el;
  }

  function setState(btn, state) {
    btn.classList.remove("mw-saving", "mw-done", "mw-error");
    const glyph = btn.querySelector(".mw-glyph");
    if (!glyph) return;
    if (state === "saving") { btn.classList.add("mw-saving"); glyph.innerHTML = '<span class="mw-spin"></span>'; }
    else if (state === "done") { btn.classList.add("mw-done"); glyph.innerHTML = CHECK_SVG; }
    else if (state === "error") { btn.classList.add("mw-error"); glyph.innerHTML = X_SVG; }
    else glyph.innerHTML = PLUS_SVG;
  }

  async function onSaveClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const btn = e.currentTarget;
    const host = btn.closest("[data-mw-social-attached]");
    if (!host) return;
    setState(btn, "saving");
    try {
      const data = adapter.extract(host);
      if (!data) { setState(btn, "error"); setTimeout(() => setState(btn, "idle"), 1500); return; }
      const { markdown, title } = buildMarkdown(data);
      const resp = await chrome.runtime.sendMessage({
        action: "proxy-fetch",
        url: "https://memory.wiki/api/docs",
        options: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown,
            title,
            source: `chrome-${platform}`,
            isDraft: false,
            editMode: "account",
          }),
        },
      });
      if (resp && resp.ok) {
        setState(btn, "done");
        // After 1.5s, revert to idle so the user can re-save if they
        // want a fresh copy (different revision, etc.).
        setTimeout(() => setState(btn, "idle"), 1500);
      } else {
        setState(btn, "error");
        setTimeout(() => setState(btn, "idle"), 2000);
      }
    } catch {
      setState(btn, "error");
      setTimeout(() => setState(btn, "idle"), 2000);
    }
  }

  function attachToVisiblePosts() {
    const nodes = document.querySelectorAll(adapter.selector);
    nodes.forEach((el) => {
      if (el.dataset.mwSocialAttached) return;
      el.dataset.mwSocialAttached = "1";
      el.classList.add("mw-social-host");
      el.appendChild(makeButton());
    });
  }

  function start() {
    injectStyles();
    attachToVisiblePosts();
    const obs = new MutationObserver(() => {
      // Throttled — virtual scrolling fires many mutations per second.
      if (start._t) return;
      start._t = setTimeout(() => { start._t = null; attachToVisiblePosts(); }, 200);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
