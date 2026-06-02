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
      "script, style, noscript, template, link, meta, svg, " +
      "[aria-hidden='true'], .sr-only, .screen-reader-only, " +
      "header, nav, footer, aside, " +
      "[role='navigation'], [role='banner'], " +
      "[role='complementary'], [role='contentinfo'], " +
      ".sidebar, .nav, .menu, .ad, .advertisement, .ads, " +
      ".header, .footer, .navbar, .navigation, " +
      "[class*='mobile-nav'], [class*='lang-menu'], " +
      "[class*='cookie'], [class*='cookies'], " +
      "iframe, details > summary, " +
      ".social-share, .share-buttons, .newsletter-signup, " +
      "[role='navigation'][aria-label*='breadcrumb' i]"
    ).forEach((el) => {
      // Preserve when it contains real content: code, tables, headings,
      // OR images (mockup screenshots / hero illustrations on landing
      // pages often live inside aria-hidden / decorative wrappers).
      if (el.querySelector && el.querySelector("pre, table, h1, h2, h3, img")) return;
      el.remove();
    });

    // 1) Images first (before links wrap them).
    //    Modern sites (Next.js, Astro, etc.) often render <img> with
    //    a tiny placeholder in src + the real asset in srcset, or wrap
    //    in <picture><source srcset>. Walk multiple fallbacks.
    function bestSrcFromSrcset(srcset) {
      // "url 1x, url2 2x" or "url 320w, url2 640w" — return the
      // highest descriptor's URL (usually the largest, sharpest).
      if (!srcset) return "";
      const parts = srcset.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const m = s.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)([xw]))?/);
          if (!m) return null;
          return { url: m[1], n: parseFloat(m[2] || "1"), unit: m[3] || "x" };
        })
        .filter(Boolean);
      if (parts.length === 0) return "";
      parts.sort((a, b) => b.n - a.n);
      return parts[0].url;
    }
    function pickImgSrc(img) {
      // 1. explicit src that isn't a tiny data: placeholder
      const rawSrc = img.getAttribute("src") || "";
      const isPlaceholder = /^data:image\/[^;]+;base64,/.test(rawSrc) && rawSrc.length < 200;
      if (rawSrc && !isPlaceholder) return rawSrc;
      // 2. srcset on the img itself
      const fromImgSrcset = bestSrcFromSrcset(img.getAttribute("srcset") || "");
      if (fromImgSrcset) return fromImgSrcset;
      // 3. <picture> wrapper — pick the first source's largest srcset
      const picture = img.closest("picture");
      if (picture) {
        for (const source of picture.querySelectorAll("source")) {
          const url = bestSrcFromSrcset(source.getAttribute("srcset") || "");
          if (url) return url;
        }
      }
      // 4. common lazy-load attribute fallbacks
      return img.getAttribute("data-src")
          || img.getAttribute("data-original")
          || img.getAttribute("data-lazy-src")
          || rawSrc; // worst case keep the placeholder so at least it's captured
    }

    // UI / chrome image detection — site logos, avatars, sprite icons,
    // tracking pixels. These pollute captures without adding value.
    function isUiImage(img) {
      const alt = (img.getAttribute("alt") || "").trim().toLowerCase();
      const cls = (img.className || "").toString().toLowerCase();
      const title = (img.getAttribute("title") || "").toLowerCase();
      // alt / title / class hints
      if (/^(icon|logo|avatar|profile|badge|emoji|favicon|chevron|arrow|caret|close|menu|search|share|like|sponsor)$/.test(alt)) return true;
      if (/(^|[\s_-])(icon|logo|avatar|profile|favicon|sprite|emoji|badge|chevron|arrow|close|burger|hamburger|menu-btn)([\s_-]|$)/.test(cls)) return true;
      if (/^(icon|logo|avatar)$/.test(title)) return true;
      // Pixel / tracker
      const w = parseInt(img.getAttribute("width") || "0", 10) || img.naturalWidth || img.clientWidth || 0;
      const h = parseInt(img.getAttribute("height") || "0", 10) || img.naturalHeight || img.clientHeight || 0;
      if (w === 1 || h === 1) return true;
      // Small square = icon. 80px threshold catches most UI marks but
      // keeps thumbnails / inline diagrams.
      if (w > 0 && h > 0 && w < 80 && h < 80) return true;
      // Source-side hints: only flag when "icon" / "logo" / etc. is a
      // whole path segment, not a substring of a real filename like
      // "obsidian-web-clipper-icon.png" (that's a real hero image).
      const src = (img.getAttribute("src") || img.getAttribute("data-src") || "").toLowerCase();
      if (/\/(logos?|icons?|favicons?|avatars?|sprites?|emojis?)\//.test(src)) return true;
      if (/lucide|phosphor|heroicon|feather|fontawesome/.test(src)) return true;
      // Note: we deliberately do NOT flag "img inside link with no text"
      // as UI — that pattern is common for hero logos, content image
      // lightbox wrappers (Wikipedia, blogs), and product shots that
      // happen to link out. The alt/class/size/src signals above are
      // enough to catch true UI icons.
      return false;
    }

    clone.querySelectorAll("img").forEach((img) => {
      if (isUiImage(img)) { img.remove(); return; }
      let src = pickImgSrc(img);
      const alt = (img.getAttribute("alt") || "").trim();
      if (!src) {
        img.remove();
        return;
      }
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

    // 3.5) Empty inline-formatting elements. Modern sites use
    // `<i data-lucide="...">` / `<b class="icon">` as ICON
    // placeholders that get hydrated to SVG at runtime — but in the
    // static DOM they're empty, and our bold/italic wrappers below
    // would turn them into stray `**` or `*` tokens.
    clone.querySelectorAll("i, em, b, strong").forEach((el) => {
      const txt = (el.textContent || "").trim();
      const hasImg = el.querySelector && el.querySelector("img");
      if (!txt && !hasImg) el.remove();
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
      // Collapse the anchor's inner text to a single line. Real-world
      // anchors often contain block-level children (<span>, <div>,
      // multi-line whitespace), which would otherwise produce broken
      // `[\ntext\n](url)` markdown that no parser renders as a link.
      const inner = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (!inner) {
        // Empty / icon-only link — drop entirely (no text = no value).
        a.remove();
        return;
      }
      try { href = new URL(href, document.baseURI).href; } catch { /* keep original */ }
      // Replace anchor with a single flat text node containing the link.
      const flat = document.createTextNode("[" + inner + "](" + href + ")");
      a.replaceWith(flat);
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

    // Strip leading TAB / 4+ spaces from non-code lines. HTML source
    // often preserves source-file indentation in text nodes \u2014 markdown
    // parsers then read those lines as CODE BLOCKS.
    {
      let inFence = false;
      text = text.split("\n").map((line) => {
        if (/^\s*```/.test(line)) { inFence = !inFence; return line; }
        if (inFence) return line;
        return line.replace(/^[\t ]{4,}/, "").replace(/^\t+/, "");
      }).join("\n");
    }

    // Post-trim: strip junk lines that are clearly chrome, not content.
    // Headings / images / lists / code / blockquotes are preserved.
    const junkPatterns = [
      /^\s*(share|tweet|like|follow|subscribe|sign up|log in|sign in|comments?|reply)\s*$/i,
      /^\s*\d+\s*(comments?|shares?|likes?|min(?:\s|ute)s?\s*read)\s*$/i,
      /^\s*(read more|continue reading|learn more|see more|view all)\s*$/i,
      /^\s*(home|menu|search|skip to content)\s*$/i,
    ];
    text = text.split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        // Preserve any markdown construct.
        if (/^(#+\s|>\s|[-*]\s|\d+\.\s|```|!\[|\|)/.test(t)) return true;
        // Strip if matches any junk pattern.
        return !junkPatterns.some((re) => re.test(t));
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");

    // Cleanup orphan formatting tokens that survive when their content
    // was emptied by upstream stripping:
    //   - `**` / `__` on their own line (empty bold/italic)
    //   - `[ ]` / `[ Foo ]()` links with empty/whitespace href
    //   - bullet lines like "- []()" or "- [ ]()" (empty image / link)
    //   - `_  _` empty italic
    text = text
      .replace(/^\s*[*_]{1,3}\s*$/gm, "")           // orphan ** _ *** etc.
      .replace(/\*\*\s*\*\*/g, "")                   // empty inline **  **
      // Empty-text links — but NOT empty-alt images, which legitimately
      // render `![](src)` for unlabeled photos. Negative lookbehind on `!`.
      .replace(/(?<!!)\[\s*\]\([^)]*\)/g, "")
      .replace(/!\[\s*\]\(\s*\)/g, "")               // images with empty src (drop)
      .replace(/^\s*-\s*$/gm, "")                    // empty bullets
      .replace(/^\s*-\s*\[\s*\]\(\s*\)\s*$/gm, "")  // bullets with empty link
      // Collapse `[<newline>text]` (or `[text<newline>]`) into a single
      // line. Happens when bracketed footnote markers like `[1]` span
      // multiple text nodes around an empty anchor.
      .replace(/\[\s*\n+\s*([^\[\]\n]+?)\s*\]/g, "[$1]")
      .replace(/\[([^\[\]\n]+?)\s*\n+\s*\]/g, "[$1]")
      .replace(/\n{3,}/g, "\n\n");

    return text.trim();
  }

  root.MwMarkdown = { htmlToMarkdown };
})(typeof window !== "undefined" ? window : this);
