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
    // Marketing pages, SPAs, sparse landing pages — Readability either
    // returns null or a tiny fragment because text density is low.
    // Walk the live document, strip the obvious chrome, convert.
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
    const title = (document.title || "Untitled").trim();
    const md = "# " + title + "\n\n" +
      "Source: " + location.href + "\n\n---\n\n" + body;
    return { markdown: md.trim(), title };
  }

  function capturePage() {
    let article = null;
    try {
      // Readability mutates the document it parses, so always clone first.
      // - charThreshold lowered from 500 → 100 so landing / marketing
      //   pages (low text density per section) aren't truncated to a
      //   single chunk.
      // - nbTopCandidates raised from 5 → 12 so Readability considers
      //   more content regions before picking the winner.
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
    // If Readability produced something substantial, use it. If it
    // returned nothing or only a tiny shard (< 1500 chars of HTML —
    // typical sign that it locked onto a sidebar / tab-button block
    // instead of the page body), fall back to a body walk.
    if (article && article.content && article.content.length > 1500) {
      return buildMarkdownFromArticle(article);
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
