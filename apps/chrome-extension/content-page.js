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
    const BLOB_SVG = '<svg viewBox="-3 -3 45 48" fill="none" aria-hidden style="width:14px;height:14px;display:block"><g fill="#fafafa"><path d="M36.19,21.04c-1.54,0-2.79,1.25-2.79,2.79s1.25,2.79,2.79,2.79,2.79-1.25,2.79-2.79-1.25-2.79-2.79-2.79Z"/><circle cx="20.11" cy="4.37" r="4.37"/><path d="M6.09,31.53c-1.36.53-1.74,2.06-1.19,3.18.54,1.08,1.79,1.54,2.98,1.09,1.22-.47,1.67-1.69,1.19-3-.39-1.05-1.67-1.78-2.97-1.27Z"/><path d="M31.93,18.82c2.47-2.05,2.41-5.6.47-7.8-1.92-2.16-5.43-2.47-7.7-.32-2.15,2.04-5.57,2.85-8.1.78-1.26-1.03-2.59-1.93-4.38-1.4-1.39.41-2.59,1.52-3.11,3.13-.43,1.31-1.93,1.77-3.24,1.79-2.08.03-3.88,1.36-4.81,2.83-1.2,1.89-1.36,4-.55,5.97,1.08,2.61,3.64,4.2,6.5,3.77,1.85-.28,3.83.15,4.96,1.89.79,1.21,1.1,2.94.65,4.25-.7,2.06-.72,4.22.66,5.94,1.58,1.99,4.03,2.8,6.51,2.11,2.19-.6,3.53-2.47,4.23-4.79.5-1.65,2.55-2.28,4.07-2.36,1.9-.09,3.25-1.65,3.74-3.1.68-1.98-.28-3.55-1.42-4.94-2.11-2.56-.75-5.9,1.51-7.77ZM25.08,26.71c-1.04.64-2.02-.84-3.78-1.5-.57,1.76.47,3.42-.46,4-.46.29-1.19.31-1.56.03-.95-.71.23-2.3-.43-4.05-1.92.7-3.05,2.62-4.08,1.16-.44-.62-.32-1.46.47-1.79.95-.39,1.67-.74,2.71-1.36l-2.86-1.7c-.48-.29-.52-.96-.32-1.38.26-.54.99-.86,1.52-.51l2.61,1.73c.55-1.54-.35-3.26.38-3.92.3-.27,1.04-.31,1.51-.12,1,.41.09,2.34.49,4.02l2.49-1.66c.52-.35,1.23-.14,1.57.33.38.52.34,1.29-.35,1.61-.94.44-1.71.86-2.68,1.55,1.38,1.14,3.27,1.24,3.37,2.34.04.42-.28,1.03-.61,1.23Z"/></g></svg>';
    const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="width:14px;height:14px;display:block;color:#fafafa"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
    const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:block;color:#fafafa"><polyline points="20 6 9 17 4 12"/></svg>';
    const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" style="width:14px;height:14px;display:block;color:#fafafa"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    const SPIN_SVG = '<span style="display:inline-block;width:14px;height:14px;border:1.6px solid rgba(250,250,250,0.25);border-top-color:#fafafa;border-radius:50%;animation:mw-spin 0.7s linear infinite"></span>';

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
      s.textContent = "@keyframes mw-spin{to{transform:rotate(360deg)}}";
      document.head.appendChild(s);
    }

    function makeButton() {
      injectStyles();
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Save image to memory.wiki library");
      el.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "display:none",
        "align-items:center",
        "justify-content:center",
        "gap:8px",
        "padding:6px 11px",
        "border-radius:999px",
        "background:#09090b",
        "border:1px solid rgba(255,255,255,0.08)",
        "box-shadow:0 2px 10px rgba(0,0,0,0.30), 0 0 0 1px rgba(0,0,0,0.30)",
        "color:#fafafa",
        "cursor:pointer",
        "user-select:none",
        "pointer-events:auto",
        "font-family:-apple-system,BlinkMacSystemFont,sans-serif",
        "opacity:0",
        "transition:opacity 140ms, transform 140ms",
        "transform:translateY(2px)",
      ].join(";");

      mark = document.createElement("span");
      mark.style.cssText = "display:inline-flex;align-items:center;justify-content:center";
      mark.innerHTML = BLOB_SVG;
      el.appendChild(mark);

      glyph = document.createElement("span");
      glyph.style.cssText = "display:inline-flex;align-items:center;justify-content:center";
      glyph.innerHTML = PLUS_SVG;
      el.appendChild(glyph);

      el.addEventListener("mouseenter", () => {
        clearTimeout(hideTimer);
        el.style.transform = "translateY(0) scale(1.04)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "translateY(0) scale(1)";
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
      btn.style.borderColor = "rgba(255,255,255,0.08)";
      btn.title = "Save to memory.wiki library";
      if (glyph) glyph.innerHTML = PLUS_SVG;
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
      // Use rendered size, not naturalSize — Pinterest etc. shrink imgs.
      if (r.width < MIN_SIDE || r.height < MIN_SIDE) return false;
      // Skip the save button's own icon
      if (img.closest && img.closest("[data-mw-save-img]")) return false;
      return true;
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
      if (glyph) glyph.innerHTML = SPIN_SVG;
      try {
        const resp = await chrome.runtime.sendMessage({ action: "save-image-to-library", src });
        if (resp && resp.ok) {
          btn.dataset.state = "saved";
          btn.style.background = "#d1ff52";   // lime success
          if (mark) mark.style.color = "#09090b";
          if (glyph) glyph.innerHTML = CHECK_SVG.replace(/#fafafa/g, "#09090b");
          mark.innerHTML = BLOB_SVG.replace(/#fafafa/g, "#09090b");
          setTimeout(hideNow, 900);
        } else {
          btn.dataset.state = "error";
          btn.style.background = "#ef4444";
          btn.title = (resp && resp.error) || "Failed";
          if (glyph) glyph.innerHTML = X_SVG;
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
