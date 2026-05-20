/**
 * Memory.Wiki Chrome Extension — Content Script
 *
 * Injected into ChatGPT, Claude, and Gemini pages.
 * Adds a floating "Memory.Wiki" button and per-message mini buttons.
 * Extracts conversation content as Markdown and sends to Memory.Wiki.
 */

(function () {
  "use strict";

  // Prevent double-injection
  if (document.documentElement.dataset.mwInjected) return;
  document.documentElement.dataset.mwInjected = "1";

  const MDFY_URL = "https://memory.wiki";
  const MAX_URL_BYTES = 8000; // ~8KB limit for URL hash

  // ─── Platform Detection ───

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("gemini.google.com")) return "gemini";
    return null;
  }

  const platform = detectPlatform();
  if (!platform) return;

  // ─── Compression (matches Memory.Wiki's share.ts) ───

  function arrayBufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  async function compressToBase64Url(text) {
    try {
      const stream = new Blob([text])
        .stream()
        .pipeThrough(new CompressionStream("gzip"));
      const compressed = await new Response(stream).arrayBuffer();
      return arrayBufferToBase64Url(compressed);
    } catch (err) {
      console.warn("[Memory.Wiki] Compression failed, using plain base64:", err);
      // Fallback: plain base64
      return btoa(unescape(encodeURIComponent(text)));
    }
  }

  // ─── Proxy Fetch (via background to bypass CORS) ───

  function proxyFetch(url, options = {}) {
    if (!chrome.runtime?.id) return Promise.resolve({ ok: false, error: "extension context invalidated" });
    return new Promise((resolve) => {
      const serializableOptions = { ...options };
      if (options.body instanceof FormData) {
        resolve({ ok: false, error: "FormData not supported via proxy" });
        return;
      }
      try {
        chrome.runtime.sendMessage(
          { action: "proxy-fetch", url, options: serializableOptions },
          (r) => {
            if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
            resolve(r || { ok: false, error: "no response" });
          }
        );
      } catch {
        resolve({ ok: false, error: "extension context invalidated" });
      }
    });
  }

  // ─── Toast Notification ───

  function showToast(message, duration = 3000) {
    const existing = document.getElementById("mw-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "mw-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("mw-toast-visible");
    });

    setTimeout(() => {
      toast.classList.remove("mw-toast-visible");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ─── SVG to Data URL ───

  function svgToDataUrl(svgEl) {
    try {
      // Serialize SVG to string
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgEl);
      // Encode as data URL
      const encoded = encodeURIComponent(svgStr)
        .replace(/'/g, "%27")
        .replace(/"/g, "%22");
      return "data:image/svg+xml," + encoded;
    } catch {
      return null;
    }
  }

  // ─── HTML to Markdown Conversion (lightweight) ───

  function htmlToMarkdown(el) {
    if (!el) return "";

    // Clone to avoid mutating the page
    const clone = el.cloneNode(true);

    // ── Step 0a: Preserve mermaid source from hidden elements before removal ──
    const mermaidSources = new Map();
    clone.querySelectorAll("pre, code").forEach((el) => {
      const text = el.textContent || "";
      const cls = el.className || "";
      const trimmed = text.trim();
      const isMermaid = /language-mermaid|lang-mermaid/i.test(cls) ||
        /^mermaid\s*$/im.test(trimmed.split("\n")[0]) ||
        /^(graph |flowchart |sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie |gitGraph|journey|mindmap|timeline)/m.test(trimmed);
      if (isMermaid && trimmed.length > 5) {
        // Strip "Mermaid" header line if present (ChatGPT adds language label as first line)
        let source = trimmed;
        if (/^mermaid\s*$/im.test(source.split("\n")[0])) {
          source = source.split("\n").slice(1).join("\n").trim();
        }
        // Store source keyed by ancestor containers (walk up for iframe matching)
        let container = el.closest("div") || el.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          mermaidSources.set(container, source);
          container = container.parentElement;
        }
      }
    });

    // ── Step 0b: Remove injected UI (but NOT aria-hidden yet — math needs it) ──
    clone.querySelectorAll(
      ".mw-mini-btn, .mw-float-btn, #mw-float-btn, [class*='Memory.Wiki'], " +
      "button[class*='copy'], button[class*='Copy'], button[class*='group/status'], " +
      "style, script, noscript, " +
      "button[class*='skill'], button[class*='status'], " +
      "[class*='show_widget'], [class*='Visualize'], [class*='visualize'], " +
      "[class*='thinking'], [class*='streaming'], [class*='feedback'], " +
      "[class*='thumbs'], button[class*='share'], button[class*='export'], " +
      "[class*='artifact-control'], [class*='canvas-control'], " +
      ".sr-only"
    ).forEach((el) => {
      // Don't remove elements that contain code blocks or tables
      if (el.querySelector("pre, code, table")) return;
      el.remove();
    });

    // ── Step 0c: Extract math from KaTeX/MathJax annotations ──
    const processedMathEls = new Set();
    clone.querySelectorAll('annotation[encoding="application/x-tex"]').forEach((annotation) => {
      const tex = annotation.textContent?.trim();
      if (!tex) return;
      // Find the outermost math container (specific selectors only)
      const mathEl = annotation.closest(".katex-display") ||
                     annotation.closest(".katex") ||
                     annotation.closest("[class*='katex']") ||
                     annotation.closest(".MathJax_Display") ||
                     annotation.closest(".MathJax") ||
                     annotation.closest("[role='math']");
      if (!mathEl || !clone.contains(mathEl) || processedMathEls.has(mathEl)) return;
      const isDisplay = mathEl.classList?.contains("katex-display") ||
                        mathEl.classList?.contains("MathJax_Display");
      const cleanTex = tex.replace(/\s+/g, " ");
      mathEl.textContent = isDisplay ? "\n$$\n" + cleanTex + "\n$$\n" : "$" + cleanTex + "$";
      processedMathEls.add(mathEl);
    });
    // Fallback: aria-label on math elements without annotation
    clone.querySelectorAll(".katex, .katex-display, .MathJax, .MathJax_Display, mjx-container, [role='math'], .math-inline, .math-display").forEach((el) => {
      if (!clone.contains(el) || processedMathEls.has(el)) return;
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel && ariaLabel.length > 1) {
        const isDisplay = el.classList.contains("katex-display") || el.classList.contains("MathJax_Display");
        el.textContent = isDisplay ? "\n$$\n" + ariaLabel + "\n$$\n" : "$" + ariaLabel + "$";
        processedMathEls.add(el);
      }
    });

    // ── Step 0d: NOW remove aria-hidden (math already extracted above) ──
    clone.querySelectorAll("[aria-hidden='true']").forEach((el) => el.remove());

    // ── Step 1a: Iframes → mermaid code blocks or artifact placeholders ──
    clone.querySelectorAll("iframe").forEach((iframe) => {
      // Check if this iframe is near a stored mermaid source
      let mermaidSource = null;
      let container = iframe.closest("div") || iframe.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        if (mermaidSources.has(container)) {
          mermaidSource = mermaidSources.get(container);
          break;
        }
        container = container.parentElement;
      }

      if (mermaidSource) {
        iframe.textContent = "\n```mermaid\n" + mermaidSource + "\n```\n";
        return;
      }

      // Claude artifact iframes
      const src = iframe.getAttribute("src") || "";
      if (src.includes("claudemcpcontent.com") || src.includes("artifact")) {
        const cont = iframe.closest("div");
        const heading = cont?.querySelector("h1, h2, h3, [class*='title']");
        const title = heading?.textContent?.trim() || iframe.getAttribute("title") || "";
        const label = title ? "**" + title + "**" : "**Interactive diagram**";
        iframe.textContent = "\n\n" + label + "\n*(Download the diagram from the original conversation and paste it here)*\n\n";
      }
    });

    // ── Step 1b: SVG diagrams → inline image or mermaid code ──
    clone.querySelectorAll("svg").forEach((svg) => {
      // Skip icons: check class, size, and Lottie/animation SVGs
      const svgCls = svg.className?.baseVal || svg.getAttribute("class") || "";
      if (/\bicon\b|lottie/i.test(svgCls)) { svg.remove(); return; }
      // Skip Lottie animation SVGs (Gemini uses these for UI icons)
      if (svg.querySelector("defs clipPath, defs mask, defs linearGradient") && !svg.querySelector("text, foreignObject")) {
        svg.remove(); return;
      }
      const w = parseInt(svg.getAttribute("width") || svg.style.width || "0");
      const h = parseInt(svg.getAttribute("height") || svg.style.height || "0");
      const viewBox = svg.getAttribute("viewBox");
      const isLarge = w > 100 || h > 100 || (viewBox && w > 50 && h > 50);

      if (!isLarge) {
        svg.remove();
        return;
      }

      // Detect mermaid SVG by multiple signals
      const svgId = svg.getAttribute("id") || "";
      const ariaRole = svg.getAttribute("aria-roledescription") || "";
      const svgClass = svg.className?.baseVal || svg.getAttribute("class") || "";
      const isMermaidSvg = /mermaid/i.test(svgId) || /mermaid/i.test(svgClass) ||
        /flowchart|sequence|class|state|er|gantt|pie|git|journey|mindmap|timeline/i.test(ariaRole);

      // Check for mermaid source: data attribute, nearby stored source, or nearby code block
      let mermaidSource = svg.getAttribute("data-mermaid-source") ||
        svg.closest("[data-mermaid-source]")?.getAttribute("data-mermaid-source") || "";

      if (!mermaidSource && isMermaidSvg) {
        // Look for preserved mermaid source from Step 0a
        const container = svg.closest("div");
        for (let el = container; el && !mermaidSource; el = el.parentElement) {
          if (mermaidSources.has(el)) {
            mermaidSource = mermaidSources.get(el);
          }
        }
        // Also check sibling/nearby pre elements
        if (!mermaidSource) {
          const parent = svg.parentElement;
          const nearbyPre = parent?.querySelector("pre") || parent?.parentElement?.querySelector("pre");
          if (nearbyPre) {
            const preText = nearbyPre.textContent?.trim() || "";
            if (/^(graph |flowchart |sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie |gitGraph|journey|mindmap|timeline)/m.test(preText)) {
              mermaidSource = preText;
            }
          }
        }
      }

      if (mermaidSource) {
        svg.textContent = "\n```mermaid\n" + mermaidSource + "\n```\n";
        return;
      }

      // Fallback: convert SVG to data URL image
      const dataUrl = svgToDataUrl(svg);
      if (dataUrl) {
        const alt = svg.getAttribute("aria-label") || svg.getAttribute("title") || "diagram";
        svg.textContent = "\n![" + alt + "](" + dataUrl + ")\n";
      } else {
        svg.remove();
      }
    });

    // Clean up remaining MathML / KaTeX internals that weren't processed above
    clone.querySelectorAll("math, .katex-mathml, [class*='katex-mathml'], annotation, semantics").forEach((el) => {
      if (clone.contains(el)) el.remove();
    });

    // ── Step 4: Code blocks ──
    const knownLangs = /^(mermaid|wat|wasm|rust|python|javascript|typescript|js|ts|go|golang|java|c\+\+|cpp|c#|csharp|c|ruby|swift|kotlin|bash|sh|shell|zsh|sql|html|css|scss|json|yaml|yml|xml|toml|dockerfile|makefile|r|php|perl|scala|haskell|lua|dart|graphql|proto|protobuf|text|plaintext|markdown|md|diff|assembly|asm|powershell|objective-c|elixir|erlang|clojure|groovy|matlab|latex|tex|vim|ini|nginx|apache|csv|tsx|jsx|zig|nim|mojo|svelte|astro|solidity|sol|prisma|terraform|tf|hcl|nix|cuda|v)$/i;
    clone.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      const target = code || pre;
      // Replace <br> with \n — some sites use <br> for line breaks in code
      target.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      // Use innerText for code: respects visual line breaks from <div>, <span> lines, white-space:pre
      // textContent misses line breaks on Claude/Gemini where lines are in block elements
      let text = target.innerText || target.textContent;
      let lang = "";
      // Try class-based detection
      const langClass = (code || pre).className.match(/language-(\w+)|lang-(\w+)/);
      if (langClass) lang = langClass[1] || langClass[2];
      // Check pre's lang attribute
      if (!lang && pre.getAttribute("lang")) lang = pre.getAttribute("lang");
      // Check previous sibling header for language name
      if (!lang) {
        const header = pre.previousElementSibling;
        if (header && header.textContent.trim().length < 30) {
          const headerText = header.textContent.trim().toLowerCase();
          if (knownLangs.test(headerText)) {
            lang = headerText;
            header.remove();
          }
        }
      }
      // ChatGPT ONLY: language label in first child element or first line
      // ChatGPT has no <code>, uses <div> children inside <pre>
      if (!lang && platform === "chatgpt") {
        // Method 1: check first child element for language name
        const firstChild = pre.children[0];
        if (firstChild && firstChild !== (code || pre)) {
          const childText = firstChild.textContent.trim().toLowerCase();
          if (knownLangs.test(childText) || childText === "c" || childText === "r") {
            lang = childText;
            firstChild.remove();
            text = (target.innerText || target.textContent);
          }
        }
        // Method 2: prefix matching on text content
        if (!lang) {
          text = text.trimStart();
          const textLower = text.toLowerCase();
          const langPrefixes = ["objective-c","javascript","typescript","powershell","dockerfile","protobuf","plaintext","assembly","markdown","graphql","makefile","mermaid","csharp","python","kotlin","haskell","elixir","erlang","clojure","groovy","matlab","golang","apache","latex","swift","scala","shell","nginx","ruby","rust","java","bash","html","scss","css","json","yaml","toml","diff","dart","perl","php","lua","vim","ini","csv","tsx","jsx","sql","cpp","asm","yml","zsh","tex","wat","md","go","js","ts","sh"];
          for (const lp of langPrefixes) {
            if (textLower.startsWith(lp) && text.length > lp.length) {
              lang = lp;
              text = text.slice(lp.length);
              break;
            }
          }
          if (!lang) {
            const firstLine = text.split("\n")[0].trim().toLowerCase();
            if ((firstLine === "c" || firstLine === "r") && text.split("\n").length > 1) {
              lang = firstLine;
              text = text.split("\n").slice(1).join("\n");
            }
          }
        }
      }
      // Skip empty code blocks (e.g., ChatGPT rendered mermaid with no source in DOM)
      if (!text.trim()) {
        pre.textContent = "";
        return;
      }
      pre.textContent = "\n```" + lang + "\n" + text.trim() + "\n```\n";
    });

    // ── Step 4b: Multi-line <code> with language class but no <pre> wrapper ──
    // Some platforms (Claude edge cases) render code blocks as <code class="language-X">
    // without a <pre> wrapper. Convert these to fenced code blocks.
    clone.querySelectorAll("code[class*='language-'], code[class*='lang-']").forEach((code) => {
      if (code.closest("pre")) return; // Already handled by Step 4
      const text = code.innerText || code.textContent || "";
      if (text.split("\n").length < 2) return; // Single line → keep as inline code
      const langMatch = code.className.match(/language-(\w+)|lang-(\w+)/);
      const lang = langMatch ? (langMatch[1] || langMatch[2]) : "";
      const pre = document.createElement("pre");
      pre.textContent = "\n```" + lang + "\n" + text.trim() + "\n```\n";
      code.replaceWith(pre);
    });

    // ── Step 5: Inline code ──
    clone.querySelectorAll("code").forEach((code) => {
      if (code.closest("pre")) return;
      code.textContent = "`" + code.textContent + "`";
    });

    // ── Step 6: Images ──
    clone.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "image";
      if (src) {
        const placeholder = document.createTextNode("![" + alt + "](" + src + ")");
        img.replaceWith(placeholder);
      }
    });

    // ── Step 7: Links ──
    clone.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href) {
        const before = document.createTextNode("[");
        const after = document.createTextNode("](" + href + ")");
        a.insertBefore(before, a.firstChild);
        a.appendChild(after);
        while (a.firstChild) {
          a.parentNode.insertBefore(a.firstChild, a);
        }
        a.remove();
      }
    });

    // ── Step 8: Bold ──
    clone.querySelectorAll("strong, b").forEach((el) => {
      const before = document.createTextNode("**");
      const after = document.createTextNode("**");
      el.insertBefore(before, el.firstChild);
      el.appendChild(after);
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.remove();
    });

    // ── Step 9: Italic ──
    clone.querySelectorAll("em, i").forEach((el) => {
      const before = document.createTextNode("*");
      const after = document.createTextNode("*");
      el.insertBefore(before, el.firstChild);
      el.appendChild(after);
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.remove();
    });

    // ── Tables ── (moved after inline formatting so cells contain **bold**, `code`, [links], etc.)
    clone.querySelectorAll("table").forEach((table) => {
      const rows = table.querySelectorAll("tr");
      if (rows.length === 0) return;
      let md = "\n";
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("th, td");
        const cellTexts = Array.from(cells).map((c) =>
          c.textContent.trim().replace(/\n\s*/g, " ").replace(/\|/g, "\\|") || " "
        );
        md += "| " + cellTexts.join(" | ") + " |\n";
        if (rowIndex === 0) {
          md += "| " + cellTexts.map(() => "---").join(" | ") + " |\n";
        }
      });
      table.textContent = md;
    });

    // ── Step 10: Lists ──
    // Preserve code blocks and tables inside list items (don't collapse their newlines)
    clone.querySelectorAll("ol").forEach((ol) => {
      const items = ol.querySelectorAll(":scope > li");
      items.forEach((li, i) => {
        const prefix = (i + 1) + ". ";
        if (li.querySelector("pre, table")) {
          // Has code block or table — preserve structure, indent continuation lines
          const text = li.textContent.trim();
          const lines = text.split("\n");
          const indent = " ".repeat(prefix.length);
          li.textContent = prefix + lines[0] + (lines.length > 1
            ? "\n" + lines.slice(1).map((l) => indent + l).join("\n")
            : "");
        } else {
          li.textContent = prefix + li.textContent.replace(/\n\s*/g, " ").trim();
        }
      });
    });
    clone.querySelectorAll("ul").forEach((ul) => {
      const items = ul.querySelectorAll(":scope > li");
      items.forEach((li) => {
        const prefix = "- ";
        if (li.querySelector("pre, table")) {
          const text = li.textContent.trim();
          const lines = text.split("\n");
          const indent = " ".repeat(prefix.length);
          li.textContent = prefix + lines[0] + (lines.length > 1
            ? "\n" + lines.slice(1).map((l) => indent + l).join("\n")
            : "");
        } else {
          li.textContent = prefix + li.textContent.replace(/\n\s*/g, " ").trim();
        }
      });
    });

    // ── Step 11: Headings (ensure newlines around headings) ──
    clone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      const level = parseInt(h.tagName[1]);
      h.textContent = "\n\n" + "#".repeat(level) + " " + h.textContent.trim() + "\n\n";
    });

    // ── Step 12: Blockquotes ──
    clone.querySelectorAll("blockquote").forEach((bq) => {
      const lines = bq.textContent.trim().split("\n");
      bq.textContent = lines.map((l) => "> " + l).join("\n");
    });

    // ── Step 13: Horizontal rules ──
    clone.querySelectorAll("hr").forEach((hr) => {
      hr.textContent = "\n---\n";
    });

    // Extract text with CSS-independent newlines for block elements
    const blockTags = new Set(["P", "DIV", "UL", "OL", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "PRE", "TABLE", "TR", "SECTION", "ARTICLE"]);
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

    // Remove platform-specific UI artifacts that slip through
    if (platform === "claude") {
      text = text.replace(/\bV\s*\n\s*visualize\b/gi, "");
      text = text.replace(/^\s*visualize\s*$/gim, ""); // only standalone "visualize" lines
      text = text.replace(/\bshow_widget\b\s*/gi, "");
      text = text.replace(/Reading\s+\w+\s+design\s+skill[^\n]*/gi, "");
      text = text.replace(/Click any node to learn more\s*/gi, "");
      text = text.replace(/\bConnecting to\s*\.{3}\s*/gi, "");
      text = text.replace(/^\s*Analyzing\.\.\.\s*$/gm, "");
      text = text.replace(/^\s*Creating artifact\.\.\.\s*$/gm, "");
      text = text.replace(/^\s*Running code\.\.\.\s*$/gm, "");
      text = text.replace(/^\s*V\s*$/gm, "");
    }

    // Fix list items: collapse internal newlines so bullet + math + text stay on one line
    text = text.replace(/^([-*] |\d+\. )(.+)/gm, (match, prefix, content) => {
      if (content.includes("\n")) {
        return prefix + content.replace(/\n\s*/g, " ").trim();
      }
      return match;
    });

    // Fix inline math spanning multiple lines: $...$ must be single-line
    // Only match LaTeX-like content (contains backslash) to avoid catching code variables like $add
    text = text.replace(/\$([^$]+?)\$/g, (match, inner) => {
      if (inner.includes("\n") && inner.includes("\\")) {
        return "$" + inner.replace(/\s*\n\s*/g, " ").trim() + "$";
      }
      return match;
    });

    // Clean up: remove invisible unicode characters that break markdown parsing
    text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, ""); // zero-width chars
    text = text.replace(/\u00A0/g, " "); // non-breaking space → regular space
    text = text.replace(/[ \t]+$/gm, ""); // trailing whitespace per line
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  }

  // ─── Conversation Extraction ───

  function extractChatGPT() {
    const messages = [];

    // Strategy 1: data-message-author-role (current ChatGPT)
    const msgElements = document.querySelectorAll("[data-message-author-role]");
    if (msgElements.length > 0) {
      msgElements.forEach((el) => {
        const role = el.getAttribute("data-message-author-role");
        if (role === "user" || role === "assistant") {
          const contentEl = el.querySelector(".markdown, .whitespace-pre-wrap, [data-message-id]") || el;
          const text = htmlToMarkdown(contentEl);
          if (text.length > 2) messages.push({ role, content: text });
        }
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 2: article elements with author markers
    const articles = document.querySelectorAll("article[data-testid^='conversation-turn']");
    if (articles.length > 0) {
      articles.forEach((article) => {
        const userMarker = article.querySelector("[data-message-author-role='user']");
        const assistantMarker = article.querySelector("[data-message-author-role='assistant']");
        const role = userMarker ? "user" : assistantMarker ? "assistant" : null;
        if (!role) return;
        const contentEl = article.querySelector(".markdown, .whitespace-pre-wrap") || article;
        const text = htmlToMarkdown(contentEl);
        if (text.length > 2) messages.push({ role, content: text });
      });
      if (messages.length > 0) return messages;
    }

    // Strategy 3: legacy div.group with conversation-turn class
    const turns = document.querySelectorAll("div[class*='conversation-turn'], div.group\\/conversation-turn");
    turns.forEach((turn, i) => {
      const text = htmlToMarkdown(turn);
      if (text.length > 2) {
        // Heuristic: alternating user/assistant
        messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: text });
      }
    });

    return messages;
  }

  function extractClaude() {
    const messages = [];

    // Claude DOM structure changes frequently. Try multiple selector strategies.
    // Each strategy returns {userEls, assistantEls} or null.
    const strategies = [
      // Strategy 1: data-testid + font-claude (broad partial match for resilience)
      () => {
        const userEls = document.querySelectorAll("[data-testid='user-message'], [data-testid*='user-turn']");
        const assistantEls = document.querySelectorAll("[class*='font-claude'], [data-testid*='assistant']");
        return userEls.length || assistantEls.length ? { userEls, assistantEls } : null;
      },
      // Strategy 2: specific font classes (legacy + current)
      () => {
        const userEls = document.querySelectorAll(".font-user-message, [class*='font-user']");
        const assistantEls = document.querySelectorAll(".font-claude-message, .font-claude-response, [class*='font-claude']");
        return userEls.length || assistantEls.length ? { userEls, assistantEls } : null;
      },
      // Strategy 3: data-test-render-count or testid-based turns
      () => {
        const userEls = document.querySelectorAll("[data-test-render-count] [data-testid*='user'], .user-turn, [data-testid*='human']");
        const assistantEls = document.querySelectorAll("[data-test-render-count] .standard-markdown, .assistant-turn, [data-testid*='assistant']");
        return userEls.length || assistantEls.length ? { userEls, assistantEls } : null;
      },
      // Strategy 4: structural fallback — alternating divs in main scroll container
      () => {
        const main = document.querySelector("main") || document.querySelector("[role='main']");
        if (!main) return null;
        const turns = main.querySelectorAll("div.group, div[class*='turn'], article");
        if (turns.length === 0) return null;
        // Heuristic: user turns tend to be shorter and contain no code blocks
        const userEls = [];
        const assistantEls = [];
        turns.forEach((t, i) => {
          const hasCode = t.querySelector("pre, code");
          // Alternate: even = user, odd = assistant (rough heuristic)
          if (i % 2 === 0 && !hasCode) userEls.push(t);
          else assistantEls.push(t);
        });
        return userEls.length || assistantEls.length ? { userEls, assistantEls } : null;
      },
    ];

    let result = null;
    for (const strategy of strategies) {
      try {
        result = strategy();
        if (result) break;
      } catch { /* try next */ }
    }

    if (!result) return messages;
    const { userEls, assistantEls } = result;

    // Collect all messages with their DOM position for ordering
    const allMsgs = [];

    userEls.forEach((el) => {
      const text = htmlToMarkdown(el);
      if (text.length > 2) {
        allMsgs.push({ role: "user", content: text, el });
      }
    });

    assistantEls.forEach((el) => {
      // Use el directly — Step 0 in htmlToMarkdown removes UI chrome.
      // This preserves captured diagram images that are outside .markdown.
      const text = htmlToMarkdown(el);
      if (text.length > 2) {
        allMsgs.push({ role: "assistant", content: text, el });
      }
    });

    // Sort by DOM order
    allMsgs.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    // Deduplicate (some strategies may double-count nested elements)
    const seen = new Set();
    allMsgs.forEach((m) => {
      const key = m.role + ":" + m.content.slice(0, 100);
      if (seen.has(key)) return;
      seen.add(key);
      messages.push({ role: m.role, content: m.content });
    });

    return messages;
  }

  function extractGemini() {
    const messages = [];

    // Gemini uses various selectors
    // Try message containers with data-message-id
    const msgContainers = document.querySelectorAll(
      "[data-message-id], .message-content, .conversation-message, model-response, user-query"
    );

    if (msgContainers.length > 0) {
      msgContainers.forEach((container) => {
        const tagName = container.tagName?.toLowerCase();
        const isUser = tagName === "user-query" ||
                       container.classList.contains("user-message") ||
                       container.querySelector(".query-text, .user-text") !== null ||
                       container.getAttribute("data-message-author") === "user";

        // For model responses, look for the formatted content
        const contentEl = container.querySelector(
          ".markdown-main-panel, .response-content, .model-response-text, .message-text"
        ) || container;

        const text = htmlToMarkdown(contentEl);
        if (text.length > 2) {
          messages.push({
            role: isUser ? "user" : "assistant",
            content: text,
          });
        }
      });
      return messages;
    }

    // Fallback: try to find response containers
    const responses = document.querySelectorAll(
      ".response-container, .model-response, [class*='response']"
    );
    const queries = document.querySelectorAll(
      ".query-container, .user-query, [class*='query']"
    );

    // Interleave if counts match
    const maxLen = Math.max(responses.length, queries.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < queries.length) {
        const text = htmlToMarkdown(queries[i]);
        if (text) messages.push({ role: "user", content: text });
      }
      if (i < responses.length) {
        const text = htmlToMarkdown(responses[i]);
        if (text) messages.push({ role: "assistant", content: text });
      }
    }

    return messages;
  }

  /**
   * Pre-process Claude artifact iframes: fetch SVG content via background
   * and replace iframes with inline SVG data URL images in the DOM.
   * Must be called BEFORE extractConversation/htmlToMarkdown.
   */
  /**
   * Pre-process artifact iframes: screenshot visible iframes and replace
   * with inline images. Uses chrome.tabs.captureVisibleTab + canvas crop.
   */
  async function preProcessArtifactIframes() {
    if (!chrome.runtime?.id) return; // extension context invalidated
    const iframes = document.querySelectorAll(".font-claude-response iframe");
    if (iframes.length === 0) return;

    // Diagrams are captured and uploaded regardless of login status
    // (anonymous uploads are rate-limited server-side)

    // Collect all artifact iframes
    const targets = [];
    for (const iframe of iframes) {
      const src = iframe.getAttribute("src") || "";
      if (!src.includes("claudemcpcontent.com") && !src.includes("artifact")) continue;
      if (iframe.getBoundingClientRect().width > 50) {
        targets.push(iframe);
      }
    }

    if (targets.length === 0) return;

    const dpr = window.devicePixelRatio || 1;

    for (let ti = 0; ti < targets.length; ti++) {
      const iframe = targets[ti];
      try {
        // Scroll iframe into view
        iframe.scrollIntoView({ behavior: "instant", block: "start" });
        // Scroll down 30px extra to clear sticky header
        iframe.closest("[style*='overflow']")?.scrollBy(0, -30) || window.scrollBy(0, -30);
        // Wait for scroll + render
        await new Promise((r) => setTimeout(r, 300));

        const rect = iframe.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;

        // Take screenshot
        const screenshotDataUrl = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "capture-tab" }, (r) => resolve(r?.dataUrl || null));
        });
        if (!screenshotDataUrl) continue;

        const screenshotImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = screenshotDataUrl;
        });
        if (!screenshotImg) continue;

        // Crop iframe area
        const canvas = document.createElement("canvas");
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          screenshotImg,
          rect.left * dpr, rect.top * dpr,
          rect.width * dpr, rect.height * dpr,
          0, 0,
          rect.width * dpr, rect.height * dpr
        );
        const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.7);

        // Upload
        const uploadUrl = await uploadImageToMdfy(croppedDataUrl);
        if (uploadUrl) {
          console.log("[Memory.Wiki] diagram uploaded:", uploadUrl);
          const img = document.createElement("img");
          img.src = uploadUrl;
          img.alt = "diagram";
          img.style.maxWidth = "100%";
          iframe.replaceWith(img);
        }
      } catch (err) {
        console.error("[Memory.Wiki] diagram capture failed:", err);
      }
    }
  }

  function extractConversation() {
    switch (platform) {
      case "chatgpt": return extractChatGPT();
      case "claude": return extractClaude();
      case "gemini": return extractGemini();
      default: return [];
    }
  }

  function extractSingleMessage(messageEl) {
    return htmlToMarkdown(messageEl);
  }

  // ─── Format as Markdown ───

  function platformName() {
    switch (platform) {
      case "chatgpt": return "ChatGPT";
      case "claude": return "Claude";
      case "gemini": return "Gemini";
      default: return "AI";
    }
  }

  function formatConversation(messages) {
    if (messages.length === 0) return "";

    // Try to get conversation title
    let title = "";
    if (platform === "chatgpt") {
      const titleEl = document.querySelector("h1, [class*='title'], title");
      title = titleEl?.textContent?.trim() || "";
    } else if (platform === "claude") {
      const titleEl = document.querySelector("[data-testid='chat-title'], h1, title");
      title = titleEl?.textContent?.trim() || "";
    } else if (platform === "gemini") {
      title = document.title?.replace(/ - Google.*$/, "").trim() || "";
    }

    // Clean up title
    if (title && (title.includes("ChatGPT") || title.includes("Claude") || title.includes("Gemini"))) {
      // Use it only if it looks like a real conversation title
      if (title.length > 50) title = "";
    }

    let md = "";
    if (title) {
      md += "# " + title + "\n\n";
    }
    md += "> Captured from " + platformName() + " on " + new Date().toLocaleDateString() + "\n\n---\n\n";

    messages.forEach((msg) => {
      const roleLabel = msg.role === "user" ? "User" : platformName();
      md += "## " + roleLabel + "\n\n";
      md += msg.content + "\n\n---\n\n";
    });

    // Remove trailing separator
    md = md.replace(/\n---\n\n$/, "\n");

    return md;
  }

  // ─── Image Upload ───

  async function uploadImageToMdfy(imageUrl) {
    try {
      const userId = await getUserId();

      // Upload via background service worker (bypasses CORS)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "upload-image", dataUrl: imageUrl, userId: userId || undefined },
          (r) => resolve(r || { error: "no response" })
        );
      });

      if (response.url) return response.url;
      console.warn("[Memory.Wiki] Image upload failed:", response.error);
      return null;
    } catch (err) {
      console.warn("[Memory.Wiki] Image upload failed:", err);
      return null;
    }
  }

  async function getUserId() {
    if (!chrome.runtime?.id) return null; // extension context invalidated
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: "get-user-id" }, (response) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(response?.userId || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async function processMarkdownImages(markdown) {
    // Find all image references: ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const matches = [...markdown.matchAll(imgRegex)];

    if (matches.length === 0) return markdown;

    // If logged in, upload images to Memory.Wiki permanent storage
    const userId = await getUserId();
    if (!userId) return markdown; // Keep original URLs as-is

    // Filter to uploadable images (include data: URLs from captured diagrams)
    const uploadable = matches.filter((match) => {
      const url = match[2];
      if (url.includes("supabase") || url.includes("Memory.Wiki")) return false;
      if (url.startsWith("data:")) return true; // captured diagram screenshots
      if (!url.startsWith("http")) return false;
      return true;
    });

    if (uploadable.length === 0) return markdown;

    // Upload all images in parallel
    const uploadPromises = uploadable.map(async (match) => {
      const originalUrl = match[2];
      try {
        const permanentUrl = await uploadImageToMdfy(originalUrl);
        return { originalUrl, permanentUrl };
      } catch (err) {
        console.warn("[Memory.Wiki] Failed to upload image:", originalUrl, err);
        return { originalUrl, permanentUrl: null };
      }
    });

    const results = await Promise.all(uploadPromises);

    let result = markdown;
    for (const { originalUrl, permanentUrl } of results) {
      if (permanentUrl) {
        result = result.replace(originalUrl, permanentUrl);
      }
    }

    return result;
  }

  // ─── Send to Memory.Wiki ───

  async function sendToMdfy(markdown) {
    if (!markdown || markdown.trim().length === 0) {
      throw new Error("No content found");
    }

    // Upload images to permanent storage before sending
    markdown = await processMarkdownImages(markdown);

    // Try authenticated sharing first (creates a permanent short URL)
    const userId = await getUserId();
    if (userId) {
      try {
        const titleMatch = markdown.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim().slice(0, 100) : "Captured from " + platformName();

        const res = await proxyFetch(MDFY_URL + "/api/docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown, userId, title, editMode: "account", source: "chrome" }),
        });

        if (res.ok) {
          let parsed;
          try {
            parsed = JSON.parse(res.body);
          } catch (parseErr) {
            console.warn("[Memory.Wiki] Failed to parse response:", parseErr);
            throw parseErr;
          }
          const { id, editToken } = parsed;
          const tokenParam = editToken ? "&token=" + encodeURIComponent(editToken) : "";
          window.open(MDFY_URL + "/?from=" + id + tokenParam, "memorywiki_" + Date.now());
          return;
        }
        // Check for auth failure
        if (res.status === 401 || res.status === 403) {
          showToast("Session expired. Log in at Memory.Wiki to sync.", 5000);
        }
      } catch (err) {
        console.warn("[Memory.Wiki] Authenticated share failed, falling back to hash URL:", err);
      }
    }

    // Fallback: hash-based URL (no account needed)
    const compressed = await compressToBase64Url(markdown);
    const url = MDFY_URL + "/#md=" + compressed;

    if (url.length <= MAX_URL_BYTES) {
      window.open(url, "memorywiki_" + Date.now());
    } else {
      try {
        await navigator.clipboard.writeText(markdown);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = markdown;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      window.open(MDFY_URL, "memorywiki_" + Date.now());
    }
  }

  // ─── Floating Button ───

  function createFloatingButton() {
    const container = document.createElement("div");
    container.id = "mw-float-container";

    const btn = document.createElement("button");
    btn.id = "mw-float-btn";
    btn.innerHTML = '<span class="mw-btn-logo"><span class="mw-logo-md">md</span><span class="mw-logo-fy">fy</span></span><span class="mw-btn-label">All</span>';
    btn.title = "Capture entire conversation and publish on Memory.Wiki";

    const toggle = document.createElement("button");
    toggle.id = "mw-float-toggle";
    toggle.innerHTML = "&#9662;";
    toggle.title = "Choose range";

    const menu = document.createElement("div");
    menu.id = "mw-float-menu";
    menu.innerHTML = [
      '<div class="mw-menu-item" data-range="0"><span class="mw-menu-accent">All</span> messages</div>',
      '<div class="mw-menu-item" data-range="3">Last <span class="mw-menu-accent">3</span> exchanges</div>',
      '<div class="mw-menu-item" data-range="5">Last <span class="mw-menu-accent">5</span> exchanges</div>',
      '<div class="mw-menu-item" data-range="10">Last <span class="mw-menu-accent">10</span> exchanges</div>',
    ].join("");

    container.appendChild(btn);
    container.appendChild(toggle);
    container.appendChild(menu);
    document.body.appendChild(container);

    const setFloatStatus = (status, state) => {
      const logo = '<span class="mw-btn-logo"><span class="mw-logo-md">md</span><span class="mw-logo-fy">fy</span></span>';
      const stateClass = state === "done" ? " mw-btn-status-done" : state === "error" ? " mw-btn-status-error" : "";
      btn.innerHTML = logo + '<span class="mw-btn-label' + stateClass + '">' + status + '</span>';
    };
    const resetFloat = () => {
      btn.innerHTML = '<span class="mw-btn-logo"><span class="mw-logo-md">md</span><span class="mw-logo-fy">fy</span></span><span class="mw-btn-label">All</span>';
    };

    async function captureAndSend(lastN) {
      menu.classList.remove("mw-menu-visible");
      container.classList.remove("mw-done", "mw-error");
      container.classList.add("mw-loading");
      setFloatStatus("Capturing...");
      try {
        await preProcessArtifactIframes();
        setFloatStatus("Converting...");
        let messages = extractConversation();
        if (lastN > 0) messages = messages.slice(-(lastN * 2));
        const markdown = formatConversation(messages);
        setFloatStatus("Publishing...");
        await sendToMdfy(markdown);
        container.classList.remove("mw-loading");
        container.classList.add("mw-done");
        setFloatStatus("Published ✓", "done");
        setTimeout(() => { container.classList.remove("mw-done"); resetFloat(); }, 3000);
      } catch (err) {
        console.error("[Memory.Wiki] capture failed:", err);
        container.classList.remove("mw-loading");
        container.classList.add("mw-error");
        setFloatStatus("Failed", "error");
        setTimeout(() => { container.classList.remove("mw-error"); resetFloat(); }, 3000);
      }
    }

    btn.addEventListener("click", () => captureAndSend(0));

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("mw-menu-visible");
    });

    menu.querySelectorAll(".mw-menu-item").forEach((item) => {
      item.addEventListener("click", () => {
        captureAndSend(parseInt(item.dataset.range));
      });
    });

    document.addEventListener("click", (e) => {
      if (!container.contains(e.target)) {
        menu.classList.remove("mw-menu-visible");
      }
    });
  }

  // ─── Per-Message Mini Buttons ───

  function getAssistantMessageSelector() {
    switch (platform) {
      case "chatgpt":
        return "[data-message-author-role='assistant']";
      case "claude":
        return ".font-claude-response, [class*='font-claude'], [data-testid*='assistant']";
      case "gemini":
        return "model-response, .model-response, [data-message-author='model']";
      default:
        return null;
    }
  }

  function getUserMessageSelector() {
    switch (platform) {
      case "chatgpt":
        return "[data-message-author-role='user']";
      case "claude":
        return "[data-testid='user-message'], .font-user-message";
      case "gemini":
        return "user-query, .user-query, [data-message-author='user']";
      default:
        return null;
    }
  }

  function findQAPair(messageEl, role) {
    const userSelector = getUserMessageSelector();
    const assistantSelector = getAssistantMessageSelector();
    if (!userSelector || !assistantSelector) return { userEl: null, assistantEl: null };

    const allUsers = [...document.querySelectorAll(userSelector)];
    const allAssistants = [...document.querySelectorAll(assistantSelector)];

    if (role === "assistant") {
      let nearestUser = null;
      for (const userEl of allUsers) {
        const pos = userEl.compareDocumentPosition(messageEl);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
          nearestUser = userEl;
        }
      }
      return { userEl: nearestUser, assistantEl: messageEl };
    } else {
      let nearestAssistant = null;
      for (const aEl of allAssistants) {
        const pos = messageEl.compareDocumentPosition(aEl);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) {
          nearestAssistant = aEl;
          break;
        }
      }
      return { userEl: messageEl, assistantEl: nearestAssistant };
    }
  }

  function formatQAPair(userEl, assistantEl) {
    const pName = platformName();
    const date = new Date().toLocaleDateString();
    const userText = userEl ? htmlToMarkdown(userEl) : "";
    const assistantText = assistantEl ? htmlToMarkdown(assistantEl) : "";

    const firstLine = userText.split("\n")[0].replace(/^#+\s*/, "").trim();
    const title = firstLine.length > 80 ? firstLine.slice(0, 77) + "..." : firstLine;

    let md = "";
    if (title) md += "# " + title + "\n\n";
    md += "> Captured from " + pName + " on " + date + "\n\n---\n\n";
    if (userText) md += "## User\n\n" + userText + "\n\n---\n\n";
    if (assistantText) md += "## " + pName + "\n\n" + assistantText + "\n";
    return md;
  }

  function addMiniButtons() {
    const assistantSelector = getAssistantMessageSelector();
    const userSelector = getUserMessageSelector();

    function attachMiniButton(msg, role) {
      if (msg.querySelector(".mw-mini-btn")) return;

      const computedPos = window.getComputedStyle(msg).position;
      if (computedPos === "static") msg.style.position = "relative";

      const miniBtn = document.createElement("button");
      miniBtn.className = "mw-mini-btn";
      miniBtn.innerHTML = '<span class="mw-mini-logo"><span class="mw-mini-md">md</span><span class="mw-mini-fy">fy</span></span><span class="mw-mini-label">this</span>';
      miniBtn.title = "Send this Q&A to Memory.Wiki";

      const resetMini = () => {
        miniBtn.innerHTML = '<span class="mw-mini-logo"><span class="mw-mini-md">md</span><span class="mw-mini-fy">fy</span></span><span class="mw-mini-label">this</span>';
      };
      const setMiniStatus = (status, state) => {
        const logo = '<span class="mw-mini-logo"><span class="mw-mini-md">md</span><span class="mw-mini-fy">fy</span></span>';
        const stateClass = state === "done" ? " mw-mini-status-done" : state === "error" ? " mw-mini-status-error" : "";
        miniBtn.innerHTML = logo + '<span class="mw-mini-status' + stateClass + '">' + status + '</span>';
      };

      miniBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        miniBtn.classList.remove("mw-done", "mw-error");
        miniBtn.classList.add("mw-loading");
        setMiniStatus("Capturing...");
        try {
          await preProcessArtifactIframes();
          setMiniStatus("Converting...");
          const { userEl, assistantEl } = findQAPair(msg, role);
          const markdown = formatQAPair(userEl, assistantEl);
          setMiniStatus("Publishing...");
          await sendToMdfy(markdown);
          miniBtn.classList.remove("mw-loading");
          miniBtn.classList.add("mw-done");
          setMiniStatus("Published ✓", "done");
          setTimeout(() => { miniBtn.classList.remove("mw-done"); resetMini(); }, 3000);
        } catch (err) {
          console.error("[Memory.Wiki] capture failed:", err);
          miniBtn.classList.remove("mw-loading");
          miniBtn.classList.add("mw-error");
          setMiniStatus("Failed", "error");
          setTimeout(() => { miniBtn.classList.remove("mw-error"); resetMini(); }, 3000);
        }
      });

      msg.insertBefore(miniBtn, msg.firstChild);
    }

    if (assistantSelector) {
      document.querySelectorAll(assistantSelector).forEach((msg) => attachMiniButton(msg, "assistant"));
    }
  }

  // ─── Listen for messages from popup/background ───

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "capture-conversation") {
      const lastN = request.lastN || 0;
      preProcessArtifactIframes().then(() => {
        let messages = extractConversation();
        if (lastN > 0) messages = messages.slice(-(lastN * 2));
        const markdown = formatConversation(messages);
        sendResponse({ markdown, platform });
      });
      return true;
    }

    if (request.action === "get-platform") {
      sendResponse({ platform });
      return true;
    }

    if (request.action === "capture-selection") {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = document.createElement("div");
        container.appendChild(range.cloneContents());
        const markdown = htmlToMarkdown(container);
        sendResponse({ markdown });
      } else {
        sendResponse({ markdown: null });
      }
      return true;
    }

    if (request.action === "toggle-float-button") {
      const existing = document.getElementById("mw-float-container");
      if (request.show && !existing) {
        createFloatingButton();
      } else if (!request.show && existing) {
        existing.remove();
      }
      sendResponse({ ok: true });
      return true;
    }

    if (request.action === "capture-page") {
      // On AI pages: extract conversation (with artifact pre-processing)
      // On other pages: return null (background.js will handle it)
      if (platform) {
        preProcessArtifactIframes().then(() => {
          const messages = extractConversation();
          const markdown = formatConversation(messages);
          sendResponse({ markdown });
        });
      } else {
        sendResponse({ markdown: null });
      }
      return true;
    }
  });

  // ─── Platform Layout ───

  const layoutConfig = {
    chatgpt: { headerH: 56, inputH: 100 },
    claude: { headerH: 8, inputH: 150 },
    gemini: { headerH: 8, inputH: 180 },
  };
  const layout = layoutConfig[platform] || { headerH: 48, inputH: 100 };
  document.documentElement.style.setProperty("--mw-header-h", layout.headerH + "px");
  document.documentElement.style.setProperty("--mw-input-h", layout.inputH + "px");

  // Align Memory.Wiki All to the right edge of the message content area
  function measureContentRight() {
    const msgSelectors = {
      chatgpt: "[data-message-author-role='assistant']",
      claude: ".font-claude-response",
      gemini: "model-response, .model-response",
    };
    const msg = document.querySelector(msgSelectors[platform] || "main");
    if (msg) {
      const right = window.innerWidth - msg.getBoundingClientRect().right;
      document.documentElement.style.setProperty("--mw-content-right", Math.max(8, right) + "px");
    }
  }
  measureContentRight();
  window.addEventListener("resize", measureContentRight);

  // ─── Initialize ───

  // Only show floating "Memory.Wiki All" button if user opted in (default: hidden)
  try {
    chrome.storage.sync.get({ showFloatingButton: false }, (data) => {
      if (data && data.showFloatingButton) {
        createFloatingButton();
      }
    });
  } catch (e) {
    console.warn("[Memory.Wiki] storage access failed, skipping float button", e);
  }
  addMiniButtons();

  // Re-run mini button injection when new messages appear (MutationObserver)
  // Debounced to avoid performance issues during streaming responses
  let observerTimer;
  const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      addMiniButtons();
      measureContentRight();
    }, 300);
  });

  // Observe the main content area for changes
  const observeTarget = document.querySelector("main, [role='main'], #__next, #app") || document.body;
  observer.observe(observeTarget, {
    childList: true,
    subtree: true,
  });

  // Disconnect observer on page unload to prevent memory leaks
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    if (observerTimer) clearTimeout(observerTimer);
  });
})();
