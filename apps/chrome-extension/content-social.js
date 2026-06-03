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
  const isLinkedIn = /(^|\.)linkedin\.com$/.test(HOST);
  if (!isX && !isThreads && !isLinkedIn) return;

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
         '...' (more) menu button. Threads renders a wider menu cluster
         (icon + spacing) so it gets an extra 24px nudge. */
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
      .mw-social-btn.mw-saving .mw-glyph,.mw-social-btn.mw-done .mw-glyph{color:#fafafa!important}
      .mw-social-btn.mw-error .mw-glyph{color:#f87171!important}
      .mw-social-btn .mw-glyph svg{width:14px!important;height:14px!important;display:block!important}
      .mw-social-btn .mw-spin{display:inline-block!important;width:12px!important;height:12px!important;border:1.6px solid rgba(250,250,250,0.25)!important;border-top-color:#fafafa!important;border-radius:50%!important;animation:mw-social-spin .8s linear infinite!important;box-sizing:border-box!important}
      @keyframes mw-social-spin{to{transform:rotate(360deg)}}
      .mw-social-host{position:relative!important}
      html.mw-social-threads .mw-social-btn{right:48px!important}
      /* LinkedIn: wide overflow-menu cluster (… + Save + dismiss) at
         the post top-right. Nudge clear. ALSO force the pill always
         visible (not hover-only) — LinkedIn's React stack re-renders
         posts frequently, and a hover-revealed button often hasn't
         rebuilt itself before the user moves the cursor. Persistent
         opacity:1 lets the user see + click reliably. */
      html.mw-social-linkedin .mw-social-btn{
        right:96px!important;top:12px!important;
        opacity:1!important;pointer-events:auto!important;
        z-index:9999999!important;
      }
    `;
    document.head.appendChild(s);
  }

  const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  // ─── Saved-toast (mirrors content-page.js showSavedToast) ────────
  let toastEl = null;
  let toastTimer = null;
  function injectToastStyles() {
    if (document.getElementById("mw-social-toast-style")) return;
    const s = document.createElement("style");
    s.id = "mw-social-toast-style";
    s.textContent =
      "@keyframes mw-social-toast-in{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}" +
      "@keyframes mw-social-toast-out{to{transform:translateY(-8px);opacity:0}}";
    document.head.appendChild(s);
  }
  function dismissToast() {
    if (!toastEl) return;
    const el = toastEl;
    toastEl = null;
    clearTimeout(toastTimer);
    el.style.animation = "mw-social-toast-out 180ms ease-in forwards";
    setTimeout(() => { try { el.remove(); } catch {} }, 200);
  }
  async function showSavedPostToast(docUrl) {
    injectToastStyles();
    const seenKey = "mw-saved-post-toast-seen";
    const seenObj = await new Promise((r) => chrome.storage.local.get([seenKey], r));
    const firstTime = !seenObj[seenKey];
    if (firstTime) chrome.storage.local.set({ [seenKey]: Date.now() });

    if (toastEl) { clearTimeout(toastTimer); toastEl.remove(); toastEl = null; }
    toastEl = document.createElement("div");
    toastEl.setAttribute("data-mw-social-toast", "1");
    toastEl.style.cssText = [
      "position:fixed!important",
      "top:18px!important",
      "right:18px!important",
      "z-index:2147483647!important",
      "display:flex!important",
      "flex-direction:column!important",
      "gap:" + (firstTime ? "10px" : "6px") + "!important",
      "padding:" + (firstTime ? "12px 14px" : "10px 12px") + "!important",
      "width:" + (firstTime ? "340px" : "260px") + "!important",
      "max-width:calc(100vw - 36px)!important",
      "background:#09090b!important",
      "color:#fafafa!important",
      "border:1px solid rgba(255,255,255,0.10)!important",
      "border-radius:12px!important",
      "box-shadow:0 8px 24px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.30)!important",
      "font-family:-apple-system,BlinkMacSystemFont,sans-serif!important",
      "font-size:13px!important",
      "line-height:1.4!important",
      "animation:mw-social-toast-in 220ms ease-out!important",
      "box-sizing:border-box!important",
    ].join(";");

    const headRow = document.createElement("div");
    headRow.style.cssText = "display:flex!important;align-items:center!important;gap:10px!important;width:100%!important";

    const markWrap = document.createElement("span");
    markWrap.style.cssText = "display:inline-flex!important;align-items:center!important;justify-content:center!important;width:22px!important;height:22px!important;flex-shrink:0!important";
    markWrap.innerHTML = '<img src="' + BLOB_DATA + '" alt="" style="width:22px!important;height:22px!important;display:block!important;border:0!important;margin:0!important;padding:0!important;background:transparent!important">';
    headRow.appendChild(markWrap);

    const title = document.createElement("div");
    title.style.cssText = "flex:1 1 auto!important;min-width:0!important;font-weight:600!important;color:#fafafa!important;font-size:13px!important;line-height:1.3!important";
    title.textContent = firstTime ? `Post saved to memory.wiki` : "Post saved";
    headRow.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.style.cssText = "background:transparent!important;border:0!important;padding:2px!important;margin:0!important;color:#71717a!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:4px!important;flex-shrink:0!important;width:18px!important;height:18px!important";
    closeBtn.innerHTML = '<span style="display:inline-flex;width:12px;height:12px;color:currentColor">' + X_SVG + '</span>';
    closeBtn.addEventListener("click", dismissToast);
    closeBtn.addEventListener("mouseenter", () => { closeBtn.style.color = "#fafafa"; });
    closeBtn.addEventListener("mouseleave", () => { closeBtn.style.color = "#71717a"; });

    function makeOpenBtn(label, opts) {
      const a = document.createElement("a");
      a.href = docUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = label;
      a.style.cssText = [
        "display:inline-flex!important",
        "align-items:center!important",
        "padding:" + (opts.large ? "6px 12px" : "3px 9px") + "!important",
        "border-radius:" + (opts.large ? "8px" : "6px") + "!important",
        "background:rgba(255,255,255,0.08)!important",
        "color:#fafafa!important",
        "border:1px solid rgba(255,255,255,0.14)!important",
        "text-decoration:none!important",
        "font-size:" + (opts.large ? "12px" : "11px") + "!important",
        "font-weight:500!important",
        "font-family:inherit!important",
        "cursor:pointer!important",
        "flex-shrink:0!important",
        "transition:background 140ms, border-color 140ms!important",
      ].join(";");
      a.addEventListener("mouseenter", () => {
        a.style.background = "rgba(255,255,255,0.14)";
        a.style.borderColor = "rgba(255,255,255,0.24)";
      });
      a.addEventListener("mouseleave", () => {
        a.style.background = "rgba(255,255,255,0.08)";
        a.style.borderColor = "rgba(255,255,255,0.14)";
      });
      return a;
    }

    if (firstTime) {
      toastEl.appendChild(headRow);
      const sub = document.createElement("div");
      sub.style.cssText = "color:#a1a1aa!important;font-size:12px!important;line-height:1.5!important;padding-left:32px!important";
      sub.textContent = "The post (text, attached images, author + date) is now a markdown doc you can edit, share, or paste into any AI.";
      toastEl.appendChild(sub);

      const actionRow = document.createElement("div");
      actionRow.style.cssText = "display:flex!important;padding-left:32px!important";
      actionRow.appendChild(makeOpenBtn("Open doc", { large: true }));
      toastEl.appendChild(actionRow);
      headRow.appendChild(closeBtn);
    } else {
      headRow.appendChild(makeOpenBtn("Open", { large: false }));
      headRow.appendChild(closeBtn);
      // headRow already inserts Open before close — adjust order
      headRow.insertBefore(headRow.lastChild.previousSibling, closeBtn);
      toastEl.appendChild(headRow);
    }

    document.body.appendChild(toastEl);
    toastTimer = setTimeout(dismissToast, firstTime ? 8000 : 3500);
  }

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
    linkedin: {
      // Class-agnostic: ANY element with data-urn containing
      // 'activity:' — covers every LinkedIn post wrapper variant
      // (feed-shared-update-v2, update-components-update, sponsored,
      // article reshares) without depending on class names that
      // change between LinkedIn versions.
      selector: '[data-urn*="activity:"]:not([data-mw-social-attached])',
      extract(el) {
        // Body: LinkedIn renders the post text inside an
        // .update-components-text or .feed-shared-update-v2__commentary
        // span. Sponsored posts use slightly different classes but
        // share the same outer wrapper, so we fall through to the
        // longest dir="ltr" span.
        const textEl = el.querySelector(".update-components-text, .feed-shared-update-v2__commentary, .feed-shared-text");
        let body = textEl ? collectText(textEl) : "";
        if (!body) {
          // Fallback: pick the longest text node block inside.
          const candidates = el.querySelectorAll('[dir="ltr"], span[lang]');
          for (const c of candidates) {
            const t = collectText(c);
            if (t.length > body.length) body = t;
          }
        }
        if (!body) return null;
        // Author: actor title (display name) + headline (sub-description).
        const nameEl = el.querySelector(".update-components-actor__title, .feed-shared-actor__name");
        let author = "";
        if (nameEl) author = collectText(nameEl).split("\n")[0].trim();
        // Handle: linkedin doesn't really have @-handles, use slug from author link.
        const profileLink = el.querySelector('a[href*="/in/"], a[href*="/company/"]');
        let handle = "";
        if (profileLink) {
          const m = (profileLink.getAttribute("href") || "").match(/\/(in|company)\/([^/?#]+)/);
          if (m) handle = "@" + m[2];
        }
        // Timestamp: <time> if present, else the visible sub-description text.
        const timeEl = el.querySelector("time");
        const ts = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent || "").trim() : "";
        // Permalink: built from data-urn.
        const urn = el.getAttribute("data-urn") || el.querySelector("[data-urn]")?.getAttribute("data-urn") || "";
        let url = location.href;
        if (urn) {
          const activityId = urn.replace(/^urn:li:activity:/, "");
          if (activityId) url = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
        }
        // Images: post media + linked previews. Skip avatar + reaction icons.
        const images = Array.from(el.querySelectorAll(
          ".update-components-image img, " +
          ".feed-shared-image img, " +
          ".update-components-article__image img, " +
          ".feed-shared-linkedin-video img"
        ))
          .map(img => img.currentSrc || img.src)
          .filter(s => s && /^https?:/.test(s));
        return { body, author, handle, ts, url, images };
      },
    },
  };

  const platform = isX ? "x" : (isThreads ? "threads" : "linkedin");
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

  // Shared Recent-list writer (matches popup.js's mw-recent schema)
  function addToRecent(entry) {
    try {
      chrome.storage.local.get(["mw-recent"], (data) => {
        const prev = Array.isArray(data["mw-recent"]) ? data["mw-recent"] : [];
        const next = [entry, ...prev.filter((p) => p.url !== entry.url)].slice(0, 5);
        chrome.storage.local.set({ "mw-recent": next });
      });
    } catch { /* noop */ }
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
        try {
          const parsed = JSON.parse(resp.body || "{}");
          if (parsed.id) {
            // Editor URL: `?from={id}&token={editToken}` lands the
            // owner directly inside the editor for that doc. Without
            // the token + 'from' param they hit the public viewer
            // even when signed in, which felt like a read-only
            // landing for a doc they just created.
            const tokenParam = parsed.editToken ? `&token=${encodeURIComponent(parsed.editToken)}` : "";
            const editorUrl = `https://memory.wiki/?from=${parsed.id}${tokenParam}`;
            const viewerUrl = `https://memory.wiki/${parsed.id}`;
            showSavedPostToast(editorUrl);
            addToRecent({
              // Use the viewer URL in Recent so clicking from the popup
              // list works on any browser (token-less). The toast 'Open
              // doc' button gets the editor URL because it's a one-shot
              // 'open right now' affordance the user just earned.
              url: viewerUrl,
              title: data.body.split("\n")[0].slice(0, 80) || `Post by ${data.handle || "unknown"}`,
              source: `chrome-${platform}`,
              ts: Date.now(),
            });
          }
        } catch { /* still show done state */ }
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
      // Re-check that the button still exists. React on LinkedIn /
      // Threads often replaces the host's children on re-render and
      // wipes our button out — without this guard the data flag
      // sticks, but the button is gone for good.
      if (el.dataset.mwSocialAttached && el.querySelector(".mw-social-btn")) return;
      el.dataset.mwSocialAttached = "1";
      el.classList.add("mw-social-host");
      el.appendChild(makeButton());
    });
  }

  // ─── Debug helper ──────────────────────────────────────────────
  // Run `window.__mwSocialDebug()` in DevTools on x/threads/linkedin
  // to see what content-social.js is finding. Logs the count of
  // matched posts + attached buttons.
  window.__mwSocialDebug = function () {
    const all = document.querySelectorAll('[data-urn*="activity:"], div.feed-shared-update-v2, article.feed-shared-update-v2');
    const matched = document.querySelectorAll(adapter.selector);
    const attached = document.querySelectorAll(".mw-social-btn");
    const info = {
      platform,
      host: location.hostname,
      anyDataUrnOrUpdate: all.length,
      matchedByCurrentSelector: matched.length,
      attachedButtons: attached.length,
      sampleHost: matched[0] ? (matched[0].tagName + "." + (matched[0].className || "").toString().slice(0, 80)) : "(none)",
    };
    console.table(info);
    alert(JSON.stringify(info, null, 2));
    return info;
  };
  console.log("[memory.wiki social] loaded on", location.hostname, "— platform:", isX ? "x" : isThreads ? "threads" : isLinkedIn ? "linkedin" : "(none)");

  function start() {
    injectStyles();
    if (isThreads) document.documentElement.classList.add("mw-social-threads");
    if (isLinkedIn) document.documentElement.classList.add("mw-social-linkedin");
    attachToVisiblePosts();
    console.log("[memory.wiki social] initial attach: matched", document.querySelectorAll(adapter.selector).length, "buttons placed", document.querySelectorAll(".mw-social-btn").length);
    const obs = new MutationObserver(() => {
      if (start._t) return;
      start._t = setTimeout(() => { start._t = null; attachToVisiblePosts(); }, 200);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // Belt-and-braces: re-check every 1.5s. MutationObserver can miss
    // mutations on heavy-virtualized pages (LinkedIn lazy-load, X
    // Bordered Element re-mounts). Cheap idempotent re-attach.
    setInterval(attachToVisiblePosts, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
