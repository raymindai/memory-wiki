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

  function buildMarkdownFromArticle(article) {
    const title = (article.title || document.title || "Untitled").trim();
    const byline = (article.byline || "").trim();
    const site = (article.siteName || siteName()).trim();
    const url = location.href;

    const html = article.content || "";
    const container = document.createElement("div");
    container.innerHTML = html;
    const body = window.MwMarkdown.htmlToMarkdown(container) || "";

    // Front matter is plain markdown, not YAML — keep it readable as a doc.
    let md = "# " + title + "\n\n";
    const metaBits = [];
    if (byline) metaBits.push(byline);
    if (site) metaBits.push(site);
    if (metaBits.length) md += "_" + metaBits.join(" / ") + "_\n\n";
    md += "Source: " + url + "\n\n---\n\n";
    md += body;
    return { markdown: md.trim(), title };
  }

  function fallbackPageMarkdown() {
    // If Readability returned null (single-page apps, paywalls, login walls),
    // fall back to a best-effort sweep of <main> / <article> / <body>.
    const main = document.querySelector("main, article, [role='main']") || document.body;
    const body = window.MwMarkdown.htmlToMarkdown(main) || "";
    const title = (document.title || "Untitled").trim();
    const md = "# " + title + "\n\n" +
      "Source: " + location.href + "\n\n---\n\n" + body;
    return { markdown: md.trim(), title };
  }

  function capturePage() {
    try {
      // Readability mutates the document it parses, so always clone first.
      const docClone = document.cloneNode(true);
      const reader = new window.Readability(docClone, { keepClasses: false });
      const article = reader.parse();
      if (article && article.content) {
        return buildMarkdownFromArticle(article);
      }
    } catch (err) {
      console.warn("[memory.wiki] Readability failed, falling back:", err);
    }
    return fallbackPageMarkdown();
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

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === "capture-page") {
      const out = capturePage();
      sendResponse(out);
      return true;
    }
    if (request && request.action === "capture-page-selection") {
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
