/*
 * memory.wiki — general page content script.
 *
 * Runs on every page EXCEPT the AI sites (chatgpt / claude / gemini) and
 * memory.wiki itself, which keep their own dedicated content scripts. This
 * file is intentionally passive — no UI is injected on load. It only reacts
 * to `capture-page` / `capture-page-selection` messages sent from the popup
 * or from the keyboard-command handler in background.js.
 *
 * Dependencies (loaded BEFORE this file via the manifest's content_scripts
 * array, so they live on the same isolated-world window):
 *   - lib/readability.js     → window.Readability
 *   - lib/html-to-markdown.js → window.MwMarkdown.htmlToMarkdown
 */

(function () {
  "use strict";

  if (document.documentElement.dataset.mwPageInjected) return;
  document.documentElement.dataset.mwPageInjected = "1";

  function siteName() {
    return location.hostname.replace(/^www\./, "");
  }

  // ─── Metadata extraction ────────────────────────────────────────────
  // Parses JSON-LD, Open Graph, Twitter Card, and standard meta tags.
  // Returns a flat object the caller turns into both visible front matter
  // and page-type detection input.
  function getMeta(name, attr = "name") {
    const el = document.querySelector(`meta[${attr}="${name}" i]`);
    return el ? (el.getAttribute("content") || "").trim() : "";
  }
  function parseJsonLd() {
    const blocks = document.querySelectorAll('script[type="application/ld+json"]');
    const out = [];
    for (const b of blocks) {
      try {
        const data = JSON.parse(b.textContent || "{}");
        const items = Array.isArray(data) ? data : (data["@graph"] || [data]);
        for (const it of items) if (it && typeof it === "object") out.push(it);
      } catch { /* malformed JSON-LD on the page — skip */ }
    }
    return out;
  }
  function pickLdAuthor(ld) {
    const a = ld.author || ld.creator;
    if (!a) return "";
    if (typeof a === "string") return a;
    if (Array.isArray(a)) return a.map((x) => (x && x.name) || x).filter(Boolean).join(", ");
    return a.name || "";
  }
  function extractMetadata() {
    const ldList = parseJsonLd();
    // Pick the most "article-y" JSON-LD block
    const primaryLd = ldList.find((x) => {
      const t = x["@type"];
      const types = Array.isArray(t) ? t : [t];
      return types.some((tt) => /article|recipe|movie|product|book|videoobject|newsarticle|scholarlyarticle|webpage/i.test(String(tt)));
    }) || ldList[0] || {};

    const ldTypeRaw = primaryLd["@type"];
    const ldTypes = (Array.isArray(ldTypeRaw) ? ldTypeRaw : [ldTypeRaw]).filter(Boolean).map(String);

    return {
      title:
        getMeta("og:title", "property") ||
        getMeta("twitter:title") ||
        primaryLd.headline || primaryLd.name ||
        (document.title || "").trim(),
      description:
        getMeta("og:description", "property") ||
        getMeta("twitter:description") ||
        getMeta("description") ||
        primaryLd.description || "",
      author:
        pickLdAuthor(primaryLd) ||
        getMeta("author") ||
        getMeta("article:author", "property") ||
        getMeta("twitter:creator") || "",
      published:
        getMeta("article:published_time", "property") ||
        getMeta("article:published", "property") ||
        primaryLd.datePublished || primaryLd.dateCreated ||
        getMeta("date") || "",
      site:
        getMeta("og:site_name", "property") ||
        (primaryLd.publisher && primaryLd.publisher.name) ||
        siteName(),
      image:
        getMeta("og:image", "property") ||
        getMeta("twitter:image") ||
        (primaryLd.image && (primaryLd.image.url || primaryLd.image[0] || primaryLd.image)) || "",
      tags:
        (getMeta("keywords") || getMeta("article:tag", "property") ||
         (Array.isArray(primaryLd.keywords) ? primaryLd.keywords.join(", ") : primaryLd.keywords) || "")
          .split(/[,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8),
      ogType: getMeta("og:type", "property"),
      ldTypes,
      url: location.href,
    };
  }

  function detectPageType(meta) {
    const t = (meta.ldTypes || []).join(" ").toLowerCase() + " " + (meta.ogType || "").toLowerCase();
    const host = (location.hostname || "").toLowerCase();
    const path = (location.pathname || "").toLowerCase();
    if (/recipe/.test(t)) return "recipe";
    if (/movie|video\.movie/.test(t)) return "movie";
    if (/product/.test(t)) return "product";
    if (/scholarlyarticle/.test(t) || /arxiv\.org|doi\.org|biorxiv|nature\.com|sciencedirect|aclanthology/.test(host)) return "paper";
    if (/newsarticle/.test(t) || /^article$/.test(meta.ogType || "")) return "article";
    if (/discussion|forum|qaanswer|socialmedia/.test(t) || /reddit\.com|news\.ycombinator|stackoverflow\.com|stackexchange\.com/.test(host)) return "discussion";
    if (/github\.com|gitlab\.com|sourcegraph\.com/.test(host) && /\/(blob|tree|releases|issues)\//.test(path) === false) return "code";
    if (/youtube\.com|vimeo\.com/.test(host)) return "video";
    return "generic";
  }

  function buildHeaderBlock(meta) {
    // Visible attribution block at the top of the captured doc. Reads
    // as a quoted line in any markdown renderer and is plain enough
    // that downstream AI calls can use the metadata as instruction
    // context.
    const bits = [];
    if (meta.author)    bits.push("by **" + meta.author + "**");
    if (meta.published) bits.push(formatDate(meta.published));
    if (meta.site)      bits.push(meta.site);
    const line = bits.join(" · ");
    let header = "";
    if (line) header += "> " + line + "\n";
    if (meta.description) header += "> \n> _" + meta.description.replace(/\s+/g, " ").trim() + "_\n";
    if (header) header += "\n";
    return header;
  }
  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
    return `${m} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function buildMarkdownFromArticle(article, meta) {
    const title = (meta.title || article.title || document.title || "Untitled").trim();
    const url = location.href;
    const html = article.content || "";
    const container = document.createElement("div");
    container.innerHTML = html;
    const body = window.MwMarkdown.htmlToMarkdown(container) || "";

    let md = "# " + title + "\n\n";
    md += buildHeaderBlock(meta);
    md += "Source: " + url + "\n\n---\n\n";
    md += body;
    return { markdown: md.trim(), title };
  }

  function fallbackPageMarkdown(meta) {
    const root = (
      document.querySelector("main, article, [role='main']") ||
      document.body
    ).cloneNode(true);
    root.querySelectorAll(
      "header, footer, nav, aside, " +
      "script, style, noscript, iframe, template, " +
      ".header, .footer, .navbar, .nav, .navigation, " +
      ".cookie, .cookie-banner, .cookies"
    ).forEach((el) => el.remove());
    const body = window.MwMarkdown.htmlToMarkdown(root) || "";
    const title = (meta.title || document.title || "Untitled").trim();
    let md = "# " + title + "\n\n";
    md += buildHeaderBlock(meta);
    md += "Source: " + location.href + "\n\n---\n\n" + body;
    return { markdown: md.trim(), title };
  }

  function capturePage() {
    const meta = extractMetadata();
    const pageType = detectPageType(meta);

    let article = null;
    try {
      const docClone = document.cloneNode(true);
      const reader = new window.Readability(docClone, {
        keepClasses: false,
        charThreshold: 100,
        nbTopCandidates: 12,
      });
      article = reader.parse();
    } catch (err) {
      console.warn("[memory.wiki] Readability failed, falling back:", err);
    }

    const pageHeadings = collectPageHeadings();
    const readabilityOut =
      article && article.content && article.content.length > 200
        ? buildMarkdownFromArticle(article, meta)
        : null;
    const fallbackOut = fallbackPageMarkdown(meta);

    let chosen;
    if (readabilityOut && fallbackOut) {
      const rCov = headingCoverage(readabilityOut.markdown, pageHeadings);
      const fCov = headingCoverage(fallbackOut.markdown, pageHeadings);
      chosen = (rCov >= fCov - 0.2 && readabilityOut.markdown.length > 400)
        ? readabilityOut
        : fallbackOut;
    } else {
      chosen = readabilityOut || fallbackOut;
    }
    return {
      markdown: chosen.markdown,
      title: chosen.title,
      pageType,                   // popup.js uses this to decide AI auto-apply
      metadata: meta,             // surfaced for downstream consumers
    };
  }

  function collectPageHeadings() {
    return Array.from(document.querySelectorAll("h1, h2"))
      .map((h) => (h.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length >= 4 && t.length <= 200);
  }
  function headingCoverage(md, headings) {
    if (!headings || headings.length === 0) return 1;
    const lower = md.toLowerCase();
    let hits = 0;
    for (const h of headings) {
      if (lower.includes(h.toLowerCase().slice(0, 60))) hits++;
    }
    return hits / headings.length;
  }

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return { markdown: null };
    }
    const range = selection.getRangeAt(0);
    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
    const body = window.MwMarkdown.htmlToMarkdown(container) || "";
    if (!body.trim()) return { markdown: null };
    const title = "Selection from " + siteName();
    const md = "# " + title + "\n\n" +
      "Source: " + location.href + "\n\n---\n\n" + body;
    return { markdown: md.trim(), title };
  }

  // ─── Per-image hover save button ────────────────────────────────────
  //
  // Hover any reasonably-sized <img> on the page → a branded pill
  // appears at the image's top-right showing the memory.wiki blob
  // mark + a "+" icon. Click → image is uploaded to the user's
  // library (Supabase storage via /api/upload). No doc is created.
  //
  // Detection uses throttled mousemove + elementsFromPoint instead
  // of mouseover/mouseout — this catches images sitting beneath
  // overlay siblings (Pinterest, Twitter, Instagram, gallery sites)
  // that would otherwise swallow mouse events. The button uses
  // position:fixed so it doesn't fight a stacking context.
  (function attachImageHoverSave() {
    const MIN_SIDE = 100;
    // SVG icons are inlined into <img src="data:..."> so host pages
    // can't restyle their internals (some sites have global
    // `svg{fill:currentColor}` or `g[fill]{fill:...}` resets that
    // were turning the blob mark invisible). xmlns is required for
    // data: URLs.
    function svgUrl(svg) {
      return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    }
    function makeIcon(svg, color, size) {
      const fg = color || "#fafafa";
      const px = (size || 14) + "px";
      const recolored = svg.replace(/__FG__/g, fg);
      const url = svgUrl(recolored);
      return '<img src="' + url + '" alt="" style="width:' + px + '!important;height:' + px + '!important;display:block!important;border:none!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;margin:0!important;padding:0!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;filter:none!important;opacity:1!important;vertical-align:middle!important">';
    }
    // The mark SVG has its own dark rounded-rect background baked
    // in, so it reads as a self-contained branded dot regardless of
    // what the host page's CSS does to <svg> children.
    const BLOB_RAW  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 45 48" fill="none"><rect x="-3" y="-3" width="45" height="48" rx="5" fill="#09090b"/><g fill="__FG__"><path d="M36.19,21.04c-1.54,0-2.79,1.25-2.79,2.79s1.25,2.79,2.79,2.79,2.79-1.25,2.79-2.79-1.25-2.79-2.79-2.79Z"/><circle cx="20.11" cy="4.37" r="4.37"/><path d="M6.09,31.53c-1.36.53-1.74,2.06-1.19,3.18.54,1.08,1.79,1.54,2.98,1.09,1.22-.47,1.67-1.69,1.19-3-.39-1.05-1.67-1.78-2.97-1.27Z"/><path d="M31.93,18.82c2.47-2.05,2.41-5.6.47-7.8-1.92-2.16-5.43-2.47-7.7-.32-2.15,2.04-5.57,2.85-8.1.78-1.26-1.03-2.59-1.93-4.38-1.4-1.39.41-2.59,1.52-3.11,3.13-.43,1.31-1.93,1.77-3.24,1.79-2.08.03-3.88,1.36-4.81,2.83-1.2,1.89-1.36,4-.55,5.97,1.08,2.61,3.64,4.2,6.5,3.77,1.85-.28,3.83.15,4.96,1.89.79,1.21,1.1,2.94.65,4.25-.7,2.06-.72,4.22.66,5.94,1.58,1.99,4.03,2.8,6.51,2.11,2.19-.6,3.53-2.47,4.23-4.79.5-1.65,2.55-2.28,4.07-2.36,1.9-.09,3.25-1.65,3.74-3.1.68-1.98-.28-3.55-1.42-4.94-2.11-2.56-.75-5.9,1.51-7.77ZM25.08,26.71c-1.04.64-2.02-.84-3.78-1.5-.57,1.76.47,3.42-.46,4-.46.29-1.19.31-1.56.03-.95-.71.23-2.3-.43-4.05-1.92.7-3.05,2.62-4.08,1.16-.44-.62-.32-1.46.47-1.79.95-.39,1.67-.74,2.71-1.36l-2.86-1.7c-.48-.29-.52-.96-.32-1.38.26-.54.99-.86,1.52-.51l2.61,1.73c.55-1.54-.35-3.26.38-3.92.3-.27,1.04-.31,1.51-.12,1,.41.09,2.34.49,4.02l2.49-1.66c.52-.35,1.23-.14,1.57.33.38.52.34,1.29-.35,1.61-.94.44-1.71.86-2.68,1.55,1.38,1.14,3.27,1.24,3.37,2.34.04.42-.28,1.03-.61,1.23Z"/></g></svg>';
    const PLUS_RAW  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__FG__" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
    const CHECK_RAW = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__FG__" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const X_RAW     = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="__FG__" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    const SPIN_HTML = '<span style="display:inline-block!important;width:14px!important;height:14px!important;border:1.6px solid rgba(250,250,250,0.25)!important;border-top-color:#fafafa!important;border-radius:50%!important;animation:mw-spin 0.7s linear infinite!important;background:transparent!important;box-shadow:none!important;box-sizing:border-box!important;padding:0!important;margin:0!important"></span>';

    let btn = null;
    let mark = null;
    let glyph = null;
    let currentImg = null;
    let hideTimer = null;
    let positionRaf = 0;

    function injectStyles() {
      if (document.getElementById("mw-save-img-style")) return;
      const s = document.createElement("style");
      s.id = "mw-save-img-style";
      s.textContent =
        "@keyframes mw-spin{to{transform:rotate(360deg)}}" +
        "@keyframes mw-toast-in{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}" +
        "@keyframes mw-toast-out{to{transform:translateY(-8px);opacity:0}}";
      document.head.appendChild(s);
    }

    // Top-right toast that tells the user *where* the image went and
    // gives them a one-click way to go check. Without it the only
    // feedback was a green check on the button, which doesn't answer
    // "ok... and now what / where?". First-save toast carries a
    // longer explainer; repeat saves use a compact form.
    let toastEl = null;
    let toastTimer = null;
    async function showSavedToast(imageUrl) {
      try {
        const wasSeenKey = "mw-saved-image-toast-seen";
        const seenObj = await new Promise((r) => chrome.storage.local.get([wasSeenKey], r));
        const firstTime = !seenObj[wasSeenKey];
        if (firstTime) chrome.storage.local.set({ [wasSeenKey]: Date.now() });

        if (toastEl) { clearTimeout(toastTimer); toastEl.remove(); toastEl = null; }
        toastEl = document.createElement("div");
        toastEl.setAttribute("data-mw-save-img", "1");
        // Toast container — vertical card layout. Header row pairs
        // the brand mark + title + dismiss; body row is the sub
        // copy; footer row is the action button. Each row owns its
        // own line so the title doesn't fight for horizontal space
        // with the CTA and the description doesn't wrap at 10
        // characters anymore.
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
          "animation:mw-toast-in 220ms ease-out!important",
          "box-sizing:border-box!important",
        ].join(";");

        // ── Row 1: blob + title + × ─────────────────────────────────
        const headRow = document.createElement("div");
        headRow.style.cssText = "display:flex!important;align-items:center!important;gap:10px!important;width:100%!important";

        const markWrap = document.createElement("span");
        markWrap.style.cssText = "display:inline-flex!important;align-items:center!important;justify-content:center!important;width:22px!important;height:22px!important;flex-shrink:0!important";
        markWrap.innerHTML = makeIcon(BLOB_RAW, "#fafafa", 22);
        headRow.appendChild(markWrap);

        const title = document.createElement("div");
        title.style.cssText = "flex:1 1 auto!important;min-width:0!important;font-weight:600!important;color:#fafafa!important;font-size:13px!important;line-height:1.3!important";
        title.textContent = firstTime ? "Saved to your image library" : "Saved";
        headRow.appendChild(title);

        const closeBtn = document.createElement("button");
        closeBtn.setAttribute("aria-label", "Dismiss");
        closeBtn.style.cssText = "background:transparent!important;border:0!important;padding:2px!important;margin:0!important;color:#71717a!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:4px!important;flex-shrink:0!important;width:18px!important;height:18px!important";
        closeBtn.innerHTML = makeIcon(X_RAW, "#71717a", 12);
        closeBtn.addEventListener("click", () => dismissToast());
        closeBtn.addEventListener("mouseenter", () => { closeBtn.style.color = "#fafafa"; });
        closeBtn.addEventListener("mouseleave", () => { closeBtn.style.color = "#71717a"; });
        headRow.appendChild(closeBtn);

        toastEl.appendChild(headRow);

        if (firstTime) {
          // ── Row 2: subcopy ─────────────────────────────────────────
          const sub = document.createElement("div");
          sub.style.cssText = "color:#a1a1aa!important;font-size:12px!important;line-height:1.5!important;padding-left:32px!important";
          sub.textContent = "Open memory.wiki/library anytime to browse, copy, or insert it into any doc.";
          toastEl.appendChild(sub);

          // ── Row 3: action button ───────────────────────────────────
          const actionRow = document.createElement("div");
          actionRow.style.cssText = "display:flex!important;padding-left:32px!important";
          const openBtn = document.createElement("a");
          openBtn.href = "https://memory.wiki/library";
          openBtn.target = "_blank";
          openBtn.rel = "noopener";
          openBtn.textContent = "Open library";
          openBtn.style.cssText = [
            "display:inline-flex!important",
            "align-items:center!important",
            "justify-content:center!important",
            "padding:6px 12px!important",
            "border-radius:8px!important",
            "background:rgba(255,255,255,0.08)!important",
            "color:#fafafa!important",
            "border:1px solid rgba(255,255,255,0.14)!important",
            "text-decoration:none!important",
            "font-size:12px!important",
            "font-weight:500!important",
            "font-family:inherit!important",
            "cursor:pointer!important",
            "transition:background 140ms, border-color 140ms!important",
          ].join(";");
          openBtn.addEventListener("mouseenter", () => {
            openBtn.style.background = "rgba(255,255,255,0.14)";
            openBtn.style.borderColor = "rgba(255,255,255,0.24)";
          });
          openBtn.addEventListener("mouseleave", () => {
            openBtn.style.background = "rgba(255,255,255,0.08)";
            openBtn.style.borderColor = "rgba(255,255,255,0.14)";
          });
          actionRow.appendChild(openBtn);
          toastEl.appendChild(actionRow);
        } else {
          // Compact (non-first) toast: small inline 'Open' link
          // beside the title row. No separate action row.
          const openBtn = document.createElement("a");
          openBtn.href = "https://memory.wiki/library";
          openBtn.target = "_blank";
          openBtn.rel = "noopener";
          openBtn.textContent = "Open";
          openBtn.style.cssText = [
            "display:inline-flex!important",
            "align-items:center!important",
            "padding:3px 9px!important",
            "border-radius:6px!important",
            "background:rgba(255,255,255,0.08)!important",
            "color:#fafafa!important",
            "border:1px solid rgba(255,255,255,0.14)!important",
            "text-decoration:none!important",
            "font-size:11px!important",
            "font-weight:500!important",
            "font-family:inherit!important",
            "cursor:pointer!important",
            "flex-shrink:0!important",
            "margin-right:6px!important",
          ].join(";");
          // Insert before the close button so layout is title - Open - ×
          headRow.insertBefore(openBtn, closeBtn);
        }

        document.body.appendChild(toastEl);
        toastTimer = setTimeout(dismissToast, firstTime ? 8000 : 3500);
      } catch (e) { /* noop */ }
    }
    function dismissToast() {
      if (!toastEl) return;
      const el = toastEl;
      toastEl = null;
      clearTimeout(toastTimer);
      el.style.animation = "mw-toast-out 180ms ease-in forwards";
      setTimeout(() => { try { el.remove(); } catch {} }, 200);
    }

    function makeButton() {
      injectStyles();
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Save image to memory.wiki library");
      el.setAttribute("data-mw-save-img", "1");
      // Geometry mirrors the per-message mw-mini-btn in content.js
      // (Claude/ChatGPT save button): 14px radius, 4-8-4-4 padding,
      // 20px mark + 14px glyph + 6px gap.
      el.style.cssText = [
        "position:fixed!important",
        "z-index:2147483647!important",
        "display:none",
        "align-items:center!important",
        "justify-content:center!important",
        "gap:6px!important",
        "padding:4px 8px 4px 4px!important",
        "border-radius:14px!important",
        "background:#09090b!important",
        "border:1px solid rgba(255,255,255,0.10)!important",
        "box-shadow:0 2px 10px rgba(0,0,0,0.35)!important",
        "color:#fafafa!important",
        "cursor:pointer!important",
        "user-select:none!important",
        "pointer-events:auto!important",
        "font-family:-apple-system,BlinkMacSystemFont,sans-serif!important",
        "line-height:0!important",
        "opacity:0",
        "transition:opacity 140ms, transform 140ms, border-color 140ms, background 140ms",
        "transform:translateY(2px)",
        "box-sizing:border-box!important",
      ].join(";");

      mark = document.createElement("span");
      mark.setAttribute("data-mw-save-img", "1");
      mark.style.cssText = "display:inline-flex!important;align-items:center!important;justify-content:center!important;width:20px!important;height:20px!important;flex-shrink:0!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important";
      mark.innerHTML = makeIcon(BLOB_RAW, "#fafafa", 20);
      el.appendChild(mark);

      glyph = document.createElement("span");
      glyph.setAttribute("data-mw-save-img", "1");
      glyph.style.cssText = "display:inline-flex!important;align-items:center!important;justify-content:center!important;width:14px!important;height:14px!important;flex-shrink:0!important;color:#a1a1aa!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important";
      glyph.innerHTML = makeIcon(PLUS_RAW, "#a1a1aa", 14);
      el.appendChild(glyph);

      el.addEventListener("mouseenter", () => {
        clearTimeout(hideTimer);
        el.style.transform = "translateY(0) scale(1.04)";
        el.style.borderColor = "rgba(255,255,255,0.20)";
        // Glyph brightens on hover to match mw-mini-btn
        if (btn && btn.dataset.state === "idle" && glyph) {
          glyph.style.color = "#fafafa";
          glyph.innerHTML = makeIcon(PLUS_RAW, "#fafafa", 14);
        }
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translateY(0) scale(1)";
        el.style.borderColor = "rgba(255,255,255,0.10)";
        if (btn && btn.dataset.state === "idle" && glyph) {
          glyph.style.color = "#a1a1aa";
          glyph.innerHTML = makeIcon(PLUS_RAW, "#a1a1aa", 14);
        }
        scheduleHide(220);
      });
      el.addEventListener("mousedown", (e) => e.stopPropagation());
      el.addEventListener("click", onSaveClick);
      document.body.appendChild(el);
      return el;
    }

    function positionButton() {
      if (!btn || !currentImg || !currentImg.isConnected) { hideNow(); return; }
      const r = currentImg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) { hideNow(); return; }
      // Off-screen → hide
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
        hideNow(); return;
      }
      // Position at top-right, inset 8px. Use viewport coords (fixed).
      btn.style.top = (r.top + 8) + "px";
      btn.style.left = (r.right - 8 - btn.offsetWidth) + "px";
    }

    function resetButtonChrome() {
      if (!btn) return;
      btn.style.background = "#09090b";
      btn.style.color = "#fafafa";
      btn.style.borderColor = "rgba(255,255,255,0.10)";
      btn.title = "Save to memory.wiki library";
      if (mark) mark.innerHTML = makeIcon(BLOB_RAW, "#fafafa", 20);
      if (glyph) {
        glyph.style.color = "#a1a1aa";
        glyph.innerHTML = makeIcon(PLUS_RAW, "#a1a1aa", 14);
      }
    }

    function showFor(img) {
      if (!btn) btn = makeButton();
      currentImg = img;
      btn.dataset.state = "idle";
      resetButtonChrome();
      btn.style.display = "inline-flex";
      btn.style.opacity = "0";
      btn.style.transform = "translateY(2px) scale(1)";
      // Wait one frame so offsetWidth is correct, then position + fade in.
      requestAnimationFrame(() => {
        positionButton();
        requestAnimationFrame(() => {
          if (!btn) return;
          btn.style.opacity = "1";
          btn.style.transform = "translateY(0) scale(1)";
        });
      });
    }
    function hideNow() {
      clearTimeout(hideTimer);
      if (!btn) return;
      btn.style.opacity = "0";
      btn.style.transform = "translateY(2px) scale(1)";
      setTimeout(() => { if (btn) btn.style.display = "none"; }, 140);
      currentImg = null;
    }
    function scheduleHide(ms = 250) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideNow, ms);
    }

    function isEligible(img) {
      if (!img || !(img instanceof HTMLImageElement)) return false;
      const src = img.currentSrc || img.src || "";
      if (!/^https?:|^data:|^blob:/.test(src)) return false;
      const r = img.getBoundingClientRect();
      if (r.width < MIN_SIDE || r.height < MIN_SIDE) return false;
      if (img.closest && img.closest("[data-mw-save-img]")) return false;
      // Map tiles — every tile would otherwise sprout a save button.
      // Detect by URL pattern (most map providers expose /tiles/, /vt/,
      // /maptile/ or known CDNs) and by canonical tile dimensions
      // (256/512 px exact). Also skip anything sitting inside a known
      // map container.
      if (isMapTile(img, src, r)) return false;
      return true;
    }
    function isMapTile(img, src, rect) {
      const lower = src.toLowerCase();
      if (/\/(tile|tiles|vt|maptile|map-tile)\//.test(lower)) return true;
      if (/maps\.googleapis\.com|maps\.gstatic\.com|tile\.openstreetmap|tiles?\.mapbox|api\.mapbox\.com\/styles\/v1/.test(lower)) return true;
      if (/\.tiles?\.|tile\.|tilecache|wmts|wms/.test(lower)) return true;
      // Square 256 / 512 tiles in dense grids — map providers' default.
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if ((w === 256 && h === 256) || (w === 512 && h === 512)) return true;
      // Inside a known map container.
      if (img.closest && img.closest(
        '[role="application"][aria-label*="map" i], ' +
        '.gm-style, .leaflet-tile-pane, .mapboxgl-canvas-container, .maplibregl-canvas-container, ' +
        '.ol-viewport, [class*="mapbox-gl"], [class*="leaflet-"], [class*="map-canvas"]'
      )) return true;
      return false;
    }

    // Find an eligible <img> at viewport (x,y), walking through any
    // overlay siblings that elementFromPoint would normally surface
    // first. Returns the topmost image whose bounding box contains
    // the point.
    function findImageAt(x, y) {
      const stack = (document.elementsFromPoint && document.elementsFromPoint(x, y)) || [];
      for (const el of stack) {
        if (el instanceof HTMLImageElement && isEligible(el)) return el;
      }
      // Sometimes the cursor is on the button itself — keep current img.
      if (btn && stack.includes(btn)) return currentImg;
      return null;
    }

    let lastMouseMoveTs = 0;
    function onMouseMove(e) {
      const now = performance.now();
      if (now - lastMouseMoveTs < 30) return;   // throttle to ~33 FPS
      lastMouseMoveTs = now;
      const img = findImageAt(e.clientX, e.clientY);
      if (img) {
        if (img !== currentImg) showFor(img);
        else { clearTimeout(hideTimer); positionButton(); }
      } else {
        scheduleHide(220);
      }
    }

    async function onSaveClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!currentImg || !btn) return;
      const src = currentImg.currentSrc || currentImg.src;
      if (btn.dataset.state === "saving") return;
      btn.dataset.state = "saving";
      if (glyph) glyph.innerHTML = SPIN_HTML;
      try {
        const resp = await chrome.runtime.sendMessage({ action: "save-image-to-library", src });
        if (resp && resp.ok) {
          btn.dataset.state = "saved";
          btn.style.borderColor = "rgba(255,255,255,0.50)";
          btn.style.background = "rgba(255,255,255,0.10)";
          if (glyph) glyph.innerHTML = makeIcon(CHECK_RAW, "#fb923c", 14);
          showSavedToast(resp.url || src);
          setTimeout(hideNow, 900);
        } else {
          btn.dataset.state = "error";
          btn.style.borderColor = "rgba(248,113,113,0.45)";
          btn.style.background = "rgba(248,113,113,0.10)";
          btn.title = (resp && resp.error) || "Failed";
          if (glyph) glyph.innerHTML = makeIcon(X_RAW, "#f87171", 14);
          setTimeout(hideNow, 1500);
        }
      } catch (err) {
        console.warn("[memory.wiki] save-image failed:", err);
        hideNow();
      }
    }

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("scroll", () => {
      if (!btn || btn.style.display === "none") return;
      cancelAnimationFrame(positionRaf);
      positionRaf = requestAnimationFrame(positionButton);
    }, true);
    window.addEventListener("resize", () => {
      if (!btn || btn.style.display === "none") return;
      positionButton();
    });
    // Hide if the user starts typing — they're done browsing images
    document.addEventListener("keydown", () => scheduleHide(0), true);
  })();

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === "capture-page") {
      const out = capturePage();
      sendResponse(out);
      return true;
    }
    if (request && (request.action === "capture-page-selection" || request.action === "capture-selection")) {
      const out = captureSelection();
      sendResponse(out);
      return true;
    }
    if (request && request.action === "ping-page") {
      sendResponse({ ok: true, kind: "general" });
      return true;
    }
  });
})();
