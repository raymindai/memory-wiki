/*
 * memory.wiki — offscreen document.
 *
 * Service workers can't touch the clipboard. The offscreen API lets us spin
 * up a hidden DOM context just long enough to call navigator.clipboard.
 * Listens for { target: "offscreen", action: "copy", text } messages.
 */

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || request.target !== "offscreen") return;

  if (request.action === "parse-and-extract") {
    // background.js fetched the HTML and forwarded it here so we can
    // run Readability + html-to-markdown using a real DOMParser. Used
    // by the X per-tweet pill when the tweet body is just a URL with
    // a card — pulls the actual article content instead of the
    // truncated card snippet.
    try {
      const html = request.html || "";
      const baseUrl = request.url || "";
      const doc = new DOMParser().parseFromString(html, "text/html");
      // Inject <base href> so relative anchors resolve to the source.
      if (baseUrl && doc.head) {
        const base = doc.createElement("base");
        base.setAttribute("href", baseUrl);
        doc.head.insertBefore(base, doc.head.firstChild || null);
      }
      const title = (doc.querySelector("title")?.textContent || "").trim();
      const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
      let markdown = "";
      try {
        const reader = new Readability(doc.cloneNode(true), {
          keepClasses: false,
          charThreshold: 100,
          nbTopCandidates: 12,
        });
        const article = reader.parse();
        if (article && article.content) {
          const container = document.createElement("div");
          container.innerHTML = article.content;
          markdown = (window.MwMarkdown && window.MwMarkdown.htmlToMarkdown(container)) || "";
        }
      } catch (err) {
        console.warn("[memory.wiki] offscreen Readability threw:", err);
      }
      if (!markdown) {
        const root = doc.querySelector("main, article, [role='main']") || doc.body;
        if (root) {
          root.querySelectorAll("header, footer, nav, aside, script, style, noscript, iframe").forEach((n) => n.remove());
          markdown = (window.MwMarkdown && window.MwMarkdown.htmlToMarkdown(root)) || "";
        }
      }
      sendResponse({ ok: true, title, description: ogDesc, markdown });
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
    return true;
  }

  if (request.action === "copy") {
    (async () => {
      try {
        await navigator.clipboard.writeText(request.text || "");
        sendResponse({ ok: true });
      } catch (err) {
        // Fallback: textarea + execCommand (still works in offscreen docs).
        try {
          const ta = document.createElement("textarea");
          ta.value = request.text || "";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          sendResponse({ ok: true });
        } catch (err2) {
          sendResponse({ ok: false, error: err2.message });
        }
      }
    })();
    return true;
  }
});
