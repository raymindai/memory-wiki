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
  // On any page, hovering an <img> larger than ~100×100 shows a small
  // floating "save to library" button anchored to the image. Click →
  // background sends image bytes to memory.wiki/api/upload (Supabase
  // storage). No doc created — just lands in the user's image library
  // visible in the web editor's right sidebar.
  (function attachImageHoverSave() {
    const MIN_SIDE = 100;
    let btn = null;
    let currentImg = null;
    let hideTimer = null;
    let positionRaf = 0;

    function makeButton() {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", "Save image to memory.wiki library");
      el.style.cssText = [
        "position:absolute",
        "z-index:2147483647",
        "width:28px",
        "height:28px",
        "border-radius:50%",
        "border:1px solid rgba(0,0,0,0.08)",
        "background:rgba(255,255,255,0.95)",
        "backdrop-filter:blur(6px)",
        "-webkit-backdrop-filter:blur(6px)",
        "box-shadow:0 2px 10px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)",
        "color:#111",
        "cursor:pointer",
        "display:none",
        "align-items:center",
        "justify-content:center",
        "padding:0",
        "transition:transform 140ms, opacity 140ms",
        "font-family:inherit",
        "opacity:0",
      ].join(";");
      el.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="2.5"/>' +
        '<path d="M8 12h8"/><path d="M12 8v8"/></svg>';
      el.addEventListener("mouseenter", () => { clearTimeout(hideTimer); el.style.transform = "scale(1.08)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; scheduleHide(200); });
      el.addEventListener("click", onSaveClick);
      document.body.appendChild(el);
      return el;
    }

    function positionButton() {
      if (!btn || !currentImg) return;
      const r = currentImg.getBoundingClientRect();
      btn.style.top = (window.scrollY + r.top + 8) + "px";
      btn.style.left = (window.scrollX + r.right - 8 - 28) + "px";
    }

    function showFor(img) {
      if (!btn) btn = makeButton();
      currentImg = img;
      btn.dataset.state = "idle";
      btn.style.display = "inline-flex";
      btn.style.opacity = "0";
      positionButton();
      requestAnimationFrame(() => { btn.style.opacity = "1"; });
    }
    function scheduleHide(ms = 250) {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (!btn) return;
        btn.style.opacity = "0";
        setTimeout(() => { if (btn) btn.style.display = "none"; }, 140);
        currentImg = null;
      }, ms);
    }

    function isEligible(img) {
      if (!(img instanceof HTMLImageElement)) return false;
      if (!img.src && !img.currentSrc) return false;
      const w = img.naturalWidth || img.clientWidth || 0;
      const h = img.naturalHeight || img.clientHeight || 0;
      if (w < MIN_SIDE || h < MIN_SIDE) return false;
      const src = img.currentSrc || img.src;
      if (!/^https?:|^data:/.test(src)) return false;
      return true;
    }

    function onMouseOver(e) {
      const img = e.target;
      if (!isEligible(img)) return;
      if (img === currentImg) { clearTimeout(hideTimer); return; }
      showFor(img);
    }
    function onMouseOut(e) {
      // Only hide when we leave the image AND not entering the button.
      if (e.relatedTarget === btn) return;
      scheduleHide(220);
    }

    async function onSaveClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!currentImg || !btn) return;
      const src = currentImg.currentSrc || currentImg.src;
      const wasState = btn.dataset.state;
      if (wasState === "saving") return;
      btn.dataset.state = "saving";
      btn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>';
      try {
        const resp = await chrome.runtime.sendMessage({ action: "save-image-to-library", src });
        if (resp && resp.ok) {
          btn.dataset.state = "saved";
          btn.style.background = "rgba(209, 255, 82, 0.95)";   // lime success
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => scheduleHide(0), 900);
        } else {
          btn.dataset.state = "error";
          btn.style.background = "rgba(239,68,68,0.95)";
          btn.style.color = "#fff";
          btn.title = (resp && resp.error) || "Failed";
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>';
          setTimeout(() => scheduleHide(0), 1500);
        }
      } catch (err) {
        console.warn("[memory.wiki] save-image failed:", err);
        scheduleHide(0);
      }
    }

    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    // Reposition while scrolling so the button tracks the image.
    document.addEventListener("scroll", () => {
      if (!btn || btn.style.display === "none") return;
      cancelAnimationFrame(positionRaf);
      positionRaf = requestAnimationFrame(positionButton);
    }, true);
    window.addEventListener("resize", positionButton);
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
