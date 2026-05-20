/**
 * Memory.Wiki bookmarklet — capture any AI conversation to your hub.
 *
 * Loaded by a small javascript: stub on the user's bookmarks bar.
 * Runs in the user's browser, so it sees the rendered DOM and is not
 * blocked by Cloudflare or affected by streaming/XHR data fetches.
 *
 * Supports ChatGPT, Claude, Gemini today. Adding a provider means
 * teaching `extractMessages()` how to walk the relevant DOM.
 *
 * The extractor is intentionally compact (no Turndown, no heavy deps)
 * so the script stays under ~20 KB and loads in under 200ms.
 */
(function () {
  "use strict";

  // Re-entrancy guard. If the user clicks the bookmarklet twice we don't
  // want two overlays.
  if (window.__mwBookmarkletActive) return;
  window.__mwBookmarkletActive = true;

  // Where to send captured docs. The bookmarklet stub sets this so we can
  // run against staging during dev.
  var BASE = (window.__mwHost || "https://memory.wiki").replace(/\/$/, "");

  function detectProvider() {
    var h = location.hostname.toLowerCase();
    if (h === "chatgpt.com" || h === "chat.openai.com") return "chatgpt";
    if (h === "claude.ai") return "claude";
    if (h === "gemini.google.com" || h === "g.co") return "gemini";
    return null;
  }

  function providerLabel(p) {
    return p === "chatgpt" ? "ChatGPT" : p === "claude" ? "Claude" : p === "gemini" ? "Gemini" : "AI";
  }

  // ─── HTML → Markdown (compact, no deps) ───
  // Walks an element tree producing markdown. Handles the subset of HTML
  // AI providers actually emit: paragraphs, headings, lists, code, tables,
  // blockquotes, inline emphasis, links, images.

  function nodeToMd(node, ctx) {
    ctx = ctx || { listDepth: 0 };
    if (node.nodeType === 3) return (node.nodeValue || "").replace(/\s+/g, " ");
    if (node.nodeType !== 1) return "";
    var el = node;
    var tag = (el.tagName || "").toLowerCase();
    var children = function () { return Array.from(el.childNodes).map(function (c) { return nodeToMd(c, ctx); }).join(""); };

    switch (tag) {
      case "h1": return "\n\n# " + children().trim() + "\n\n";
      case "h2": return "\n\n## " + children().trim() + "\n\n";
      case "h3": return "\n\n### " + children().trim() + "\n\n";
      case "h4": return "\n\n#### " + children().trim() + "\n\n";
      case "h5": return "\n\n##### " + children().trim() + "\n\n";
      case "h6": return "\n\n###### " + children().trim() + "\n\n";
      case "p":
      case "div":
      case "section":
      case "article":
        return "\n\n" + children().trim() + "\n\n";
      case "br": return "\n";
      case "hr": return "\n\n---\n\n";
      case "strong":
      case "b":
        return "**" + children().trim() + "**";
      case "em":
      case "i":
        return "*" + children().trim() + "*";
      case "code": {
        // Inline code unless inside a <pre>
        if (el.closest && el.closest("pre")) return el.textContent || "";
        return "`" + (el.textContent || "") + "`";
      }
      case "pre": {
        var codeEl = el.querySelector("code");
        var text = (codeEl ? codeEl.textContent : el.textContent) || "";
        var lang = "";
        if (codeEl) {
          var cls = codeEl.className || "";
          var m = cls.match(/language-([\w-]+)/);
          if (m) lang = m[1];
        }
        return "\n\n```" + lang + "\n" + text.replace(/\s+$/, "") + "\n```\n\n";
      }
      case "ul":
      case "ol": {
        ctx.listDepth = (ctx.listDepth || 0) + 1;
        var items = Array.from(el.children).filter(function (c) { return c.tagName.toLowerCase() === "li"; });
        var out = "\n";
        items.forEach(function (li, i) {
          var prefix = (tag === "ol" ? (i + 1) + ". " : "- ");
          var indent = "  ".repeat(Math.max(0, ctx.listDepth - 1));
          var itemMd = Array.from(li.childNodes).map(function (c) { return nodeToMd(c, ctx); }).join("").trim();
          out += indent + prefix + itemMd.replace(/\n+/g, " ") + "\n";
        });
        ctx.listDepth -= 1;
        return out + "\n";
      }
      case "blockquote":
        return "\n\n" + children().trim().split("\n").map(function (l) { return "> " + l; }).join("\n") + "\n\n";
      case "a": {
        var href = el.getAttribute("href") || "";
        var label = children().trim() || href;
        if (!href) return label;
        return "[" + label + "](" + href + ")";
      }
      case "img": {
        var src = el.getAttribute("src") || "";
        var alt = el.getAttribute("alt") || "";
        if (!src) return "";
        return "![" + alt + "](" + src + ")";
      }
      case "table": return "\n\n" + tableToMd(el) + "\n\n";
      case "script":
      case "style":
      case "noscript":
      case "svg":
      case "button":
        return "";
      default:
        return children();
    }
  }

  function tableToMd(table) {
    var rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return "";
    var lines = [];
    rows.forEach(function (row, rowIdx) {
      var cells = Array.from(row.querySelectorAll("th,td"));
      var line = "| " + cells.map(function (c) {
        return Array.from(c.childNodes).map(function (n) { return nodeToMd(n, {}); }).join("").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
      }).join(" | ") + " |";
      lines.push(line);
      if (rowIdx === 0) lines.push("| " + cells.map(function () { return "---"; }).join(" | ") + " |");
    });
    return lines.join("\n");
  }

  function htmlToMarkdown(el) {
    if (!el) return "";
    var raw = nodeToMd(el, { listDepth: 0 });
    // Collapse 3+ newlines to 2, trim
    return raw.replace(/\n{3,}/g, "\n\n").replace(/^\s+|\s+$/g, "");
  }

  // ─── Provider-specific message walkers ───
  // Each returns an array of { role: 'user' | 'assistant', markdown }.
  // The DOM patterns below are tested as of 2026-05; if a vendor breaks
  // them, update the selectors here.

  function extractChatGPT() {
    var blocks = Array.from(document.querySelectorAll("[data-message-author-role]"));
    return blocks.map(function (el) {
      var role = el.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") return null;
      // The visible message content lives in the inner [class*='markdown']
      // (assistant) or `.whitespace-pre-wrap` (user).
      var contentEl =
        el.querySelector(".markdown, [class*='markdown']") ||
        el.querySelector(".whitespace-pre-wrap") ||
        el;
      var md = htmlToMarkdown(contentEl).trim();
      if (!md) return null;
      return { role: role, markdown: md };
    }).filter(Boolean);
  }

  function extractClaude() {
    var nodes = Array.from(document.querySelectorAll(
      "[data-testid='user-message'], div.font-claude-message, div.font-claude-response, [data-testid='assistant-message'], [class*='font-claude']"
    ));
    var seen = new Set();
    var out = [];
    nodes.forEach(function (el) {
      // Dedupe overlapping selectors
      if (seen.has(el)) return;
      // Skip elements that contain another match (we want the innermost)
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] !== el && el.contains(nodes[i])) {
          // Skip outer; inner will be processed
          return;
        }
      }
      seen.add(el);
      var testid = el.getAttribute("data-testid") || "";
      var cls = el.className || "";
      var role = testid === "user-message" ? "user"
        : testid.indexOf("assistant") !== -1 ? "assistant"
          : (cls.indexOf("font-claude-response") !== -1 || cls.indexOf("font-claude-message") !== -1) ? "assistant"
            : null;
      if (!role) return;
      var md = htmlToMarkdown(el).trim();
      if (md) out.push({ role: role, markdown: md });
    });
    return out;
  }

  function extractGemini() {
    // Gemini uses Angular components. user-query / model-response are
    // visible in the DOM after the conversation renders.
    var blocks = Array.from(document.querySelectorAll("user-query, model-response"));
    if (!blocks.length) {
      // Fallback: class-based
      blocks = Array.from(document.querySelectorAll("[class*='user-query'], [class*='model-response']"));
    }
    return blocks.map(function (el) {
      var tag = el.tagName.toLowerCase();
      var role = tag === "user-query" || /user-query/.test(el.className) ? "user" : "assistant";
      var md = htmlToMarkdown(el).trim();
      if (!md) return null;
      return { role: role, markdown: md };
    }).filter(Boolean);
  }

  function extractMessages(provider) {
    if (provider === "chatgpt") return extractChatGPT();
    if (provider === "claude") return extractClaude();
    if (provider === "gemini") return extractGemini();
    return [];
  }

  function buildMarkdown(provider, messages) {
    var parts = [];
    var title = (document.title || "").replace(/ - (ChatGPT|Claude|Gemini.*)$/i, "").trim() || ("Captured " + providerLabel(provider) + " conversation");
    parts.push("# " + title);
    parts.push("");
    parts.push("> Captured from " + location.href);
    parts.push("");
    messages.forEach(function (m) {
      var heading = m.role === "user" ? "## You" : "## " + providerLabel(provider);
      parts.push(heading);
      parts.push("");
      parts.push(m.markdown);
      parts.push("");
    });
    return { title: title, markdown: parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n" };
  }

  // ─── Minimal overlay UI ───
  // We don't want to inject styled elements that conflict with the host
  // page. A single fixed-position div with inline styles keeps the
  // footprint small and reversible.

  function mountOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "mw-bookmarklet-overlay";
    overlay.style.cssText = [
      "position:fixed", "top:24px", "right:24px", "z-index:2147483647",
      "background:#0a0a0a", "color:#fafafa", "border:1px solid #fb923c",
      "border-radius:12px", "padding:16px 20px", "font:14px/1.4 -apple-system,system-ui,Segoe UI,sans-serif",
      "box-shadow:0 10px 40px rgba(0,0,0,.45)", "max-width:340px"
    ].join(";");
    document.body.appendChild(overlay);
    return overlay;
  }

  function setStatus(overlay, html) {
    overlay.innerHTML = html;
  }

  function teardown(overlay, delayMs) {
    setTimeout(function () {
      try { overlay.remove(); } catch (e) { /* ignore */ }
      window.__mwBookmarkletActive = false;
    }, delayMs || 0);
  }

  // ─── Main flow ───

  var provider = detectProvider();
  var overlay = mountOverlay();

  if (!provider) {
    setStatus(overlay,
      "<strong>Memory.Wiki</strong><br>This page isn't a supported AI conversation. " +
      "Try the bookmarklet on chatgpt.com, claude.ai, or gemini.google.com."
    );
    teardown(overlay, 5000);
    return;
  }

  setStatus(overlay,
    "<strong>Memory.Wiki</strong><br>Capturing " + providerLabel(provider) + " conversation…"
  );

  // Defer extraction one frame to let any pending render complete.
  requestAnimationFrame(function () {
    var messages;
    try {
      messages = extractMessages(provider);
    } catch (err) {
      console.error("[Memory.Wiki] extraction failed:", err);
      setStatus(overlay,
        "<strong>Memory.Wiki</strong><br>Couldn't read this " + providerLabel(provider) + " conversation. " +
        "Try refreshing the page."
      );
      teardown(overlay, 5000);
      return;
    }

    if (!messages.length) {
      setStatus(overlay,
        "<strong>Memory.Wiki</strong><br>No conversation found on this page. Open a chat first, then click the bookmarklet."
      );
      teardown(overlay, 5000);
      return;
    }

    var built = buildMarkdown(provider, messages);

    setStatus(overlay,
      "<strong>Memory.Wiki</strong><br>Saving " + messages.length + " message" + (messages.length === 1 ? "" : "s") + "…"
    );

    fetch(BASE + "/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // include lets us send and receive the mw_anon cookie so this
      // capture is grouped with the user's other anonymous docs.
      credentials: "include",
      body: JSON.stringify({
        markdown: built.markdown,
        title: built.title,
        source: "bookmarklet-" + provider,
        isDraft: false,
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data.id) throw new Error("no id in response");
        var url = BASE + "/" + data.id;
        setStatus(overlay,
          "<strong>Memory.Wiki</strong><br>Saved! Opening your doc…<br>" +
          "<a href=\"" + url + "\" target=\"_blank\" rel=\"noopener\" style=\"color:#fb923c;text-decoration:underline\">" + url + "</a>"
        );
        try { window.open(url, "_blank", "noopener"); } catch (e) { /* popup blocked */ }
        teardown(overlay, 4000);
      })
      .catch(function (err) {
        console.error("[Memory.Wiki] save failed:", err);
        setStatus(overlay,
          "<strong>Memory.Wiki</strong><br>Couldn't save. " + (err && err.message ? err.message : "Try again.") +
          "<br><span style=\"color:#a1a1aa;font-size:12px\">If this keeps happening, check your network or try Memory.Wiki directly.</span>"
        );
        teardown(overlay, 6000);
      });
  });
})();
