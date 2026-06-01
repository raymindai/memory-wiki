/*
 * memory.wiki — shared HTML to Markdown helper for content scripts.
 *
 * Loaded BEFORE both content-page.js and (eventually) content.js via the
 * manifest's content_scripts array — chrome flattens the array into one
 * isolated world per page, so this file's exports land on `window.MwMarkdown`
 * for both scripts to share without a bundler.
 *
 * Conversion strategy matches lib/render.ts on the server: GFM-ish output
 * (fenced code with language hint, pipe tables, footnoteless), conservative
 * about lossy transforms (we'd rather keep extra newlines than strip a list).
 *
 * The AI-conversation content.js file (1400+ LOC) has its own htmlToMarkdown
 * that knows about KaTeX annotations, Mermaid iframes, ChatGPT codeblock
 * language labels, etc. That code is unchanged. This helper is the SIMPLER
 * cousin used for plain web pages (blogs, MDN, Wikipedia) where Mozilla's
 * Readability already gave us clean HTML.
 */

(function (root) {
  "use strict";

  const KNOWN_LANGS = /^(mermaid|wat|wasm|rust|python|javascript|typescript|js|ts|go|golang|java|cpp|c\+\+|csharp|c#|c|ruby|swift|kotlin|bash|sh|shell|zsh|sql|html|css|scss|json|yaml|yml|xml|toml|dockerfile|makefile|r|php|perl|scala|haskell|lua|dart|graphql|proto|protobuf|text|plaintext|markdown|md|diff|powershell|elixir|erlang|clojure|tsx|jsx|nix|terraform|tf|hcl)$/i;

  function htmlToMarkdown(rootEl) {
    if (!rootEl) return "";
    const clone = rootEl.cloneNode(true);

    // 0) Strip script/style/noscript/template + invisible chrome.
    clone.querySelectorAll(
      "script, style, noscript, template, link, meta, " +
      "[aria-hidden='true'], .sr-only, .screen-reader-only, " +
      "nav, footer, aside, [role='navigation'], [role='banner'], " +
      "[role='complementary'], [role='contentinfo'], " +
      ".sidebar, .nav, .menu, .ad, .advertisement, .ads, " +
      "iframe"
    ).forEach((el) => {
      // Don't remove if it contains a code block or table the user might want.
      if (el.querySelector && el.querySelector("pre, table")) return;
      el.remove();
    });

    // 1) Images first (before links wrap them).
    clone.querySelectorAll("img").forEach((img) => {
      let src = img.getAttribute("src") || img.getAttribute("data-src") || "";
      const alt = (img.getAttribute("alt") || "").trim();
      if (!src) {
        img.remove();
        return;
      }
      // Resolve relative URLs.
      try { src = new URL(src, document.baseURI).href; } catch { /* keep original */ }
      const text = document.createTextNode("![" + alt + "](" + src + ")");
      img.replaceWith(text);
    });

    // 2) Code blocks (pre > code).
    clone.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      const target = code || pre;
      target.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      let text = target.innerText || target.textContent || "";
      let lang = "";
      const langClass = (code || pre).className.match(/language-(\w[\w+#-]*)|lang-(\w[\w+#-]*)/);
      if (langClass) lang = (langClass[1] || langClass[2] || "").toLowerCase();
      if (!lang && pre.getAttribute("lang")) lang = pre.getAttribute("lang").toLowerCase();
      if (!text.trim()) {
        pre.textContent = "";
        return;
      }
      pre.textContent = "\n```" + (KNOWN_LANGS.test(lang) ? lang : lang || "") + "\n" + text.replace(/\s+$/, "") + "\n```\n";
    });

    // 3) Inline code (skip if inside <pre> already handled).
    clone.querySelectorAll("code").forEach((code) => {
      if (code.closest("pre")) return;
      code.textContent = "`" + (code.textContent || "") + "`";
    });

    // 4) Links — wrap in [text](href). Skip in-page anchors and javascript:.
    clone.querySelectorAll("a").forEach((a) => {
      let href = a.getAttribute("href");
      if (!href || href.startsWith("javascript:") || href.startsWith("#")) {
        // Unwrap: keep text, drop the anchor.
        while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
        a.remove();
        return;
      }
      try { href = new URL(href, document.baseURI).href; } catch { /* keep original */ }
      const before = document.createTextNode("[");
      const after = document.createTextNode("](" + href + ")");
      a.insertBefore(before, a.firstChild);
      a.appendChild(after);
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      a.remove();
    });

    // 5) Bold + italic.
    clone.querySelectorAll("strong, b").forEach((el) => {
      const before = document.createTextNode("**");
      const after = document.createTextNode("**");
      el.insertBefore(before, el.firstChild);
      el.appendChild(after);
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });
    clone.querySelectorAll("em, i").forEach((el) => {
      const before = document.createTextNode("*");
      const after = document.createTextNode("*");
      el.insertBefore(before, el.firstChild);
      el.appendChild(after);
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.remove();
    });

    // 6) Tables (after inline formatting so cells inherit **bold** / `code`).
    clone.querySelectorAll("table").forEach((table) => {
      const rows = table.querySelectorAll("tr");
      if (rows.length === 0) return;
      let md = "\n";
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("th, td");
        const cellTexts = Array.from(cells).map((c) =>
          (c.textContent || "").trim().replace(/\n\s*/g, " ").replace(/\|/g, "\\|") || " "
        );
        md += "| " + cellTexts.join(" | ") + " |\n";
        if (rowIndex === 0) {
          md += "| " + cellTexts.map(() => "---").join(" | ") + " |\n";
        }
      });
      table.textContent = md;
    });

    // 7) Lists.
    clone.querySelectorAll("ol").forEach((ol) => {
      const items = ol.querySelectorAll(":scope > li");
      items.forEach((li, i) => {
        const prefix = (i + 1) + ". ";
        if (li.querySelector("pre, table")) {
          const text = (li.textContent || "").trim();
          const lines = text.split("\n");
          const indent = " ".repeat(prefix.length);
          li.textContent = prefix + lines[0] + (lines.length > 1
            ? "\n" + lines.slice(1).map((l) => indent + l).join("\n")
            : "");
        } else {
          li.textContent = prefix + (li.textContent || "").replace(/\n\s*/g, " ").trim();
        }
      });
    });
    clone.querySelectorAll("ul").forEach((ul) => {
      const items = ul.querySelectorAll(":scope > li");
      items.forEach((li) => {
        const prefix = "- ";
        if (li.querySelector("pre, table")) {
          const text = (li.textContent || "").trim();
          const lines = text.split("\n");
          const indent = " ".repeat(prefix.length);
          li.textContent = prefix + lines[0] + (lines.length > 1
            ? "\n" + lines.slice(1).map((l) => indent + l).join("\n")
            : "");
        } else {
          li.textContent = prefix + (li.textContent || "").replace(/\n\s*/g, " ").trim();
        }
      });
    });

    // 8) Headings.
    clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      const level = parseInt(h.tagName[1]);
      h.textContent = "\n\n" + "#".repeat(level) + " " + (h.textContent || "").trim() + "\n\n";
    });

    // 9) Blockquotes.
    clone.querySelectorAll("blockquote").forEach((bq) => {
      const lines = (bq.textContent || "").trim().split("\n");
      bq.textContent = lines.map((l) => "> " + l).join("\n");
    });

    // 10) Horizontal rules.
    clone.querySelectorAll("hr").forEach((hr) => {
      hr.textContent = "\n---\n";
    });

    // 11) Walk DOM to extract text with block-element newlines (CSS independent).
    const blockTags = new Set([
      "P", "DIV", "UL", "OL", "LI", "BLOCKQUOTE",
      "H1", "H2", "H3", "H4", "H5", "H6",
      "HR", "PRE", "TABLE", "TR", "SECTION", "ARTICLE", "FIGURE", "FIGCAPTION",
    ]);
    function extractText(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      if (node.tagName === "BR") return "\n";
      const isBlock = blockTags.has(node.tagName);
      let result = isBlock ? "\n" : "";
      for (const child of node.childNodes) result += extractText(child);
      if (isBlock) result += "\n";
      return result;
    }
    let text = extractText(clone);

    // Collapse list items spanning multiple lines (bullet + code/text on one line).
    text = text.replace(/^([-*] |\d+\. )(.+)/gm, (match, prefix, content) => {
      if (content.includes("\n")) {
        return prefix + content.replace(/\n\s*/g, " ").trim();
      }
      return match;
    });

    // Cleanup invisible unicode + collapse triple+ newlines.
    text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, ""); // zero-width chars
    text = text.replace(/\u00A0/g, " "); // non-breaking space
    text = text.replace(/[ \t]+$/gm, "");
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  root.MwMarkdown = { htmlToMarkdown };
})(typeof window !== "undefined" ? window : this);
