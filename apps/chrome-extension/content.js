/*
 * memory.wiki chrome extension — AI conversation content script.
 *
 * Injected into ChatGPT, Claude, and Gemini pages.
 * Adds a floating "memory.wiki" button and per-message mini buttons.
 * Extracts conversation content as Markdown and sends to memory.wiki.
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
      // Strategy 1: data-testid + the exact response wrapper. The
      // wildcard [class*='font-claude'] used to be here but matched
      // every paragraph inside a response — Last N then sliced
      // paragraphs instead of messages. Restrict to message wrappers.
      () => {
        const userEls = document.querySelectorAll("[data-testid='user-message'], [data-testid*='user-turn']");
        const assistantEls = document.querySelectorAll(".font-claude-response, [data-testid*='assistant']");
        return userEls.length || assistantEls.length ? { userEls, assistantEls } : null;
      },
      // Strategy 2: explicit wrapper classes only (no wildcard).
      () => {
        const userEls = document.querySelectorAll(".font-user-message");
        const assistantEls = document.querySelectorAll(".font-claude-message, .font-claude-response");
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

    md += formatMessages(messages);
    return md;
  }

  // The per-message blocks only (## User / ## AI ...), --- separated. Shared by
  // formatConversation (full doc) and the incremental append (delta only).
  function formatMessages(messages) {
    let md = "";
    messages.forEach((msg) => {
      const roleLabel = msg.role === "user" ? "User" : platformName();
      md += "## " + roleLabel + "\n\n" + msg.content + "\n\n---\n\n";
    });
    return md.replace(/\n---\n\n$/, "\n");
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
      if (url.includes("supabase") || url.includes("memory.wiki")) return false;
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
        const title = titleMatch ? titleMatch[1].trim().slice(0, 100) : "captured from " + platformName();

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
          // Push to popup Recent so per-message captures show up
          // in the extension's capture history alongside everything else.
          try {
            const docUrl = MDFY_URL + "/" + id;
            chrome.storage.local.get(["mw-recent"], (data) => {
              const prev = Array.isArray(data["mw-recent"]) ? data["mw-recent"] : [];
              const entry = {
                url: docUrl,
                title,
                source: "chrome-" + platformName().toLowerCase(),
                ts: Date.now(),
              };
              const next = [entry, ...prev.filter((p) => p.url !== docUrl)].slice(0, 5);
              chrome.storage.local.set({ "mw-recent": next });
            });
          } catch { /* noop */ }
          try {
            await navigator.clipboard.writeText("Use " + MDFY_URL + "/" + id + " as my context.");
            showToast("published. URL copied for AI.", 3000);
          } catch { /* clipboard may be blocked on some sites; still published */ }
          return;
        }
        // Check for auth failure
        if (res.status === 401 || res.status === 403) {
          showToast("session expired. sign in at memory.wiki to sync.", 5000);
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
    if (!extActive()) return; // dormant when paused / disabled on this site
    if (document.getElementById("mw-float-container")) return; // idempotent
    const container = document.createElement("div");
    container.id = "mw-float-container";

    const btn = document.createElement("button");
    btn.id = "mw-float-btn";
    btn.innerHTML = '<span class="mw-btn-logo"><span class="mw-logo-md">M</span><span class="mw-logo-dot">.</span><span class="mw-logo-fy">W</span></span><span class="mw-btn-label">All</span>';
    btn.title = "capture entire conversation and publish on memory.wiki";

    const toggle = document.createElement("button");
    toggle.id = "mw-float-toggle";
    toggle.innerHTML = "&#9662;";
    toggle.title = "choose range";

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
      const logo = '<span class="mw-btn-logo"><span class="mw-logo-md">M</span><span class="mw-logo-dot">.</span><span class="mw-logo-fy">W</span></span>';
      const stateClass = state === "done" ? " mw-btn-status-done" : state === "error" ? " mw-btn-status-error" : "";
      btn.innerHTML = logo + '<span class="mw-btn-label' + stateClass + '">' + status + '</span>';
    };
    const resetFloat = () => {
      btn.innerHTML = '<span class="mw-btn-logo"><span class="mw-logo-md">M</span><span class="mw-logo-dot">.</span><span class="mw-logo-fy">W</span></span><span class="mw-btn-label">All</span>';
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
        // Match only the response wrapper, not every styled descendant.
        // The wildcard [class*='font-claude'] hit individual paragraphs
        // / list items / pre blocks too, so a mini button appeared on
        // every line.
        return ".font-claude-response, [data-test-render-count][data-testid='message']";
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
    // Paused or disabled on this site → the extension goes dormant: clear any
    // injected per-message buttons and don't add more.
    if (!extActive()) { document.querySelectorAll(".mw-mini-btn").forEach((b) => b.remove()); return; }
    const assistantSelector = getAssistantMessageSelector();
    const userSelector = getUserMessageSelector();

    function attachMiniButton(msg, role) {
      if (msg.querySelector(".mw-mini-btn")) return;

      const computedPos = window.getComputedStyle(msg).position;
      if (computedPos === "static") msg.style.position = "relative";

      const miniBtn = document.createElement("button");
      miniBtn.className = "mw-mini-btn";
      miniBtn.title = "send this Q&A to memory.wiki";

      // Symbol + glyph only — no "this" text. The mark is the
      // canonical sparkle inside a dark rounded square; the right
      // glyph swaps (+ → spinner → ✓ → ✕) based on state.
      // Official memory.wiki brand blob (icon-inline-dark.svg).
      const MARK_SVG = '<svg viewBox="-3 -3 45 48" fill="none" aria-hidden><rect x="-3" y="-3" width="45" height="48" rx="5" fill="#09090b"/><g fill="#fafafa"><path d="M36.19,21.04c-1.54,0-2.79,1.25-2.79,2.79s1.25,2.79,2.79,2.79,2.79-1.25,2.79-2.79-1.25-2.79-2.79-2.79Z"/><circle cx="20.11" cy="4.37" r="4.37"/><path d="M6.09,31.53c-1.36.53-1.74,2.06-1.19,3.18.54,1.08,1.79,1.54,2.98,1.09,1.22-.47,1.67-1.69,1.19-3-.39-1.05-1.67-1.78-2.97-1.27Z"/><path d="M31.93,18.82c2.47-2.05,2.41-5.6.47-7.8-1.92-2.16-5.43-2.47-7.7-.32-2.15,2.04-5.57,2.85-8.1.78-1.26-1.03-2.59-1.93-4.38-1.4-1.39.41-2.59,1.52-3.11,3.13-.43,1.31-1.93,1.77-3.24,1.79-2.08.03-3.88,1.36-4.81,2.83-1.2,1.89-1.36,4-.55,5.97,1.08,2.61,3.64,4.2,6.5,3.77,1.85-.28,3.83.15,4.96,1.89.79,1.21,1.1,2.94.65,4.25-.7,2.06-.72,4.22.66,5.94,1.58,1.99,4.03,2.8,6.51,2.11,2.19-.6,3.53-2.47,4.23-4.79.5-1.65,2.55-2.28,4.07-2.36,1.9-.09,3.25-1.65,3.74-3.1.68-1.98-.28-3.55-1.42-4.94-2.11-2.56-.75-5.9,1.51-7.77ZM25.08,26.71c-1.04.64-2.02-.84-3.78-1.5-.57,1.76.47,3.42-.46,4-.46.29-1.19.31-1.56.03-.95-.71.23-2.3-.43-4.05-1.92.7-3.05,2.62-4.08,1.16-.44-.62-.32-1.46.47-1.79.95-.39,1.67-.74,2.71-1.36l-2.86-1.7c-.48-.29-.52-.96-.32-1.38.26-.54.99-.86,1.52-.51l2.61,1.73c.55-1.54-.35-3.26.38-3.92.3-.27,1.04-.31,1.51-.12,1,.41.09,2.34.49,4.02l2.49-1.66c.52-.35,1.23-.14,1.57.33.38.52.34,1.29-.35,1.61-.94.44-1.71.86-2.68,1.55,1.38,1.14,3.27,1.24,3.37,2.34.04.42-.28,1.03-.61,1.23Z"/></g></svg>';
      const PLUS_SVG = '<svg viewBox="0 0 14 14" fill="none" aria-hidden><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
      const SPINNER_SVG = '<svg viewBox="0 0 14 14" fill="none" aria-hidden><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.25"/><path d="M12 7a5 5 0 0 0-5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const CHECK_SVG = '<svg viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const X_SVG = '<svg viewBox="0 0 14 14" fill="none" aria-hidden><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

      const renderMini = (glyph) => {
        miniBtn.innerHTML = '<span class="mw-mini-mark">' + MARK_SVG + '</span><span class="mw-mini-glyph">' + glyph + '</span>';
      };
      const resetMini = () => renderMini(PLUS_SVG);
      resetMini();

      miniBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        miniBtn.classList.remove("mw-done", "mw-error");
        miniBtn.classList.add("mw-loading");
        renderMini(SPINNER_SVG);
        try {
          await preProcessArtifactIframes();
          const { userEl, assistantEl } = findQAPair(msg, role);
          const markdown = formatQAPair(userEl, assistantEl);
          await sendToMdfy(markdown);
          miniBtn.classList.remove("mw-loading");
          miniBtn.classList.add("mw-done");
          renderMini(CHECK_SVG);
          setTimeout(() => { miniBtn.classList.remove("mw-done"); resetMini(); }, 2400);
        } catch (err) {
          console.error("[memory.wiki] capture failed:", err);
          miniBtn.classList.remove("mw-loading");
          miniBtn.classList.add("mw-error");
          renderMini(X_SVG);
          setTimeout(() => { miniBtn.classList.remove("mw-error"); resetMini(); }, 2400);
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
      // `preProcessArtifactIframes().then(...)` without a `.catch()` is
      // the same hang pattern that broke content-page.js: if the chain
      // throws (e.g. iframe.replaceWith on a node React just detached,
      // a stray extractConversation TypeError), sendResponse never
      // fires and the popup sits on "Capturing…" forever. Always send
      // a response, even an error stub.
      preProcessArtifactIframes()
        .then(() => {
          try {
            let messages = extractConversation();
            if (lastN > 0) messages = messages.slice(-(lastN * 2));
            const markdown = formatConversation(messages);
            sendResponse({ markdown, platform });
          } catch (err) {
            console.warn("[memory.wiki] extractConversation threw:", err);
            sendResponse({ markdown: "", platform, error: String(err && err.message || err) });
          }
        })
        .catch((err) => {
          console.warn("[memory.wiki] artifact pre-process failed:", err);
          sendResponse({ markdown: "", platform, error: String(err && err.message || err) });
        });
      return true;
    }

    if (request.action === "get-platform") {
      sendResponse({ platform });
      return true;
    }

    if (request.action === "capture-selection") {
      try {
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
      } catch (err) {
        console.warn("[memory.wiki] captureSelection threw:", err);
        sendResponse({ markdown: null, error: String(err && err.message || err) });
      }
      return true;
    }

    if (request.action === "toggle-float-button") {
      try {
        showFloat = !!request.show;
        refreshExtUI(); // creates/removes the float, respecting paused / site gating
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err && err.message || err) });
      }
      return true;
    }

    if (request.action === "capture-page") {
      // On AI pages: extract conversation (with artifact pre-processing).
      // On other pages: return null so the caller falls through.
      if (platform) {
        preProcessArtifactIframes()
          .then(() => {
            try {
              const messages = extractConversation();
              const markdown = formatConversation(messages);
              sendResponse({ markdown });
            } catch (err) {
              console.warn("[memory.wiki] extractConversation threw:", err);
              sendResponse({ markdown: "", error: String(err && err.message || err) });
            }
          })
          .catch((err) => {
            console.warn("[memory.wiki] artifact pre-process failed:", err);
            sendResponse({ markdown: "", error: String(err && err.message || err) });
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

  // Align memory.wiki all to the right edge of the message content area
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

  // The floating button + per-message buttons + pills are ALL applied by
  // refreshExtUI() once the flags load (below). Nothing renders before we
  // know the paused / disabled-site state, so no capture UI ever flashes on
  // a paused or disabled page.

  // ─── Ambient auto-capture (#2) ───
  // When the user opts in, each AI thread continuously syncs to a SINGLE
  // memory.wiki doc (created once, then updated) as the conversation grows,
  // so memory forms without a per-conversation click. Keyed by the thread
  // URL so re-syncs UPDATE the same doc instead of spawning duplicates, and
  // debounced so we only sync after a response settles (never mid-stream).
  let autoCaptureEnabled = false; // global default (the "capture everything" switch)
  const AUTO_SYNC_SETTLE_MS = 1500; // conversation content stable this long = response done → sync

  // Gating layers. Precedence: paused > site-disabled > per-thread override
  // > global autoCapture. `mwPaused` (local) is the temporary master kill;
  // `disabledSites` (sync) turns the extension off on specific hosts;
  // `threadOverrides` (local) is per-thread capture on/off set via the pill.
  let mwPaused = false;
  let disabledSites = [];
  let threadOverrides = {};
  let showFloat = false;     // showFloatingButton pref, managed via refreshExtUI
  let stateLoaded = false;   // until flags load, render NOTHING (no button flash)
  let pillPos = {};          // { pillId: {left, top} } — user-dragged pill positions
  // Drag-handle glyph (6-dot grip) prefixed on the pills as a "draggable" hint.
  const MW_GRIP = '<span class="mw-grip"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></span>';

  function currentHost() { try { return location.hostname; } catch { return ""; } }
  // extActive is false until the flags are loaded, so no capture UI ever
  // flashes on a paused / disabled page before we know the real state.
  function extActive() { return stateLoaded && !mwPaused && !disabledSites.includes(currentHost()); }
  function shouldCaptureThread() {
    // Pure reflection of the popup: capture only when the global toggle is on
    // (and the extension is active on this site). No per-thread override, so
    // the page pill always matches the popup state.
    return extActive() && autoCaptureEnabled;
  }

  function threadKey() {
    // The conversation's own URL path. The transient new-chat state ("/")
    // has no thread id yet, so skip it — otherwise we'd create a doc for an
    // empty chat. Require a thread-shaped path per platform.
    const p = location.pathname || "/";
    if (p === "/" || p === "") return null;
    if (platform === "chatgpt" && !/\/c\//.test(p)) return null;
    if (platform === "claude" && !/\/chat\//.test(p)) return null;
    if (platform === "gemini" && !/\/app\b/.test(p) && !/\/[a-z0-9]{6,}/i.test(p)) return null;
    return platform + ":" + p;
  }

  function cheapHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h + ":" + s.length;
  }

  function getThreadMap() {
    return new Promise((resolve) => {
      try { chrome.storage.local.get({ "mw-thread-map": {} }, (d) => resolve(d["mw-thread-map"] || {})); }
      catch { resolve({}); }
    });
  }
  function setThreadEntry(key, entry) {
    try {
      chrome.storage.local.get({ "mw-thread-map": {} }, (d) => {
        const map = d["mw-thread-map"] || {};
        map[key] = entry;
        const keys = Object.keys(map);
        if (keys.length > 50) {
          keys.map((k) => [k, map[k]])
            .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
            .slice(50)
            .forEach(([k]) => delete map[k]);
        }
        chrome.storage.local.set({ "mw-thread-map": map });
      });
    } catch { /* noop */ }
  }

  // Event-driven incremental sync. Fired once the conversation content has
  // been STABLE for AUTO_SYNC_SETTLE_MS (= a response finished streaming).
  // Creates the thread's doc on the first exchange, then APPENDS only the new
  // exchanges (delta) — no polling, no whole-thread re-PATCH.
  async function syncThreadIncremental() {
    if (!shouldCaptureThread()) return;
    const key = threadKey();
    if (!key) return;

    let messages;
    try { messages = extractConversation(); } catch { return; }
    if (!messages || messages.length < 2) return; // need at least one full exchange
    const fullMd = formatConversation(messages);
    if (!fullMd || fullMd.trim().length < 40) return;
    const hash = cheapHash(fullMd);

    const map = await getThreadMap();
    const existing = map[key];
    if (existing && existing.hash === hash) return; // nothing new since last sync

    const userId = await getUserId();
    if (!userId) return; // ambient capture requires sign-in; stay silent

    const titleMatch = fullMd.match(/^#\s+(.+)/m);
    const title = (titleMatch ? titleMatch[1].trim() : "captured from " + platformName()).slice(0, 100);

    try {
      if (existing && existing.id) {
        const synced = existing.syncedCount || 0;
        let res;
        if (messages.length > synced && synced > 0) {
          // Append ONLY the new exchanges since last sync (incremental).
          const delta = formatMessages(messages.slice(synced));
          res = await proxyFetch(MDFY_URL + "/api/docs/" + existing.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "append", append: delta, separator: "\n\n---\n\n", title, source: "chrome-auto", userId, editToken: existing.editToken }),
          });
        } else {
          // Count shrank or diverged (regenerated / edited thread) → full re-sync.
          res = await proxyFetch(MDFY_URL + "/api/docs/" + existing.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ markdown: fullMd, title, source: "chrome-auto", userId, editToken: existing.editToken }),
          });
        }
        if (res.ok) {
          setThreadEntry(key, { ...existing, title, hash, syncedCount: messages.length, ts: Date.now() });
        } else if (res.status === 404) {
          setThreadEntry(key, undefined); // doc deleted server-side → re-create next time
        }
      } else {
        // First sync of this thread → create the doc with the full conversation.
        const res = await proxyFetch(MDFY_URL + "/api/docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: fullMd, userId, title, editMode: "account", source: "chrome-auto" }),
        });
        if (res.ok) {
          let parsed = {};
          try { parsed = JSON.parse(res.body); } catch { /* */ }
          if (parsed.id) {
            setThreadEntry(key, { id: parsed.id, editToken: parsed.editToken, title, hash, syncedCount: messages.length, ts: Date.now() });
            try {
              const docUrl = MDFY_URL + "/" + parsed.id;
              chrome.storage.local.get(["mw-recent"], (data) => {
                const prev = Array.isArray(data["mw-recent"]) ? data["mw-recent"] : [];
                const entry = { url: docUrl, title, source: "chrome-auto-" + platformName().toLowerCase(), ts: Date.now() };
                const next = [entry, ...prev.filter((p) => p.url !== docUrl)].slice(0, 5);
                chrome.storage.local.set({ "mw-recent": next });
              });
            } catch { /* noop */ }
            showToast("auto-syncing this thread to memory.wiki", 3500);
          }
        }
      }
    } catch (err) {
      console.warn("[Memory.Wiki] auto-sync failed:", err);
    }
  }

  // Event-driven trigger. Content-based (not raw DOM mutations): the settle
  // timer restarts ONLY when the EXTRACTED conversation actually changes
  // (while a response streams), so page chrome animations can't reset it or
  // starve capture. It fires once the content stops changing = response done.
  let lastActivityHash = null;
  let doneTimer = null;
  function onConversationActivity() {
    if (!shouldCaptureThread()) return;
    let md;
    try { md = formatConversation(extractConversation()); } catch { return; }
    if (!md || md.trim().length < 40) return;
    const h = cheapHash(md);
    if (h === lastActivityHash) return; // content unchanged (just page chrome) — ignore
    lastActivityHash = h;               // content changed (streaming) — restart the settle timer
    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = setTimeout(syncThreadIncremental, AUTO_SYNC_SETTLE_MS);
  }

  // ─── Page status badge for capture (+ quick per-thread toggle) ───
  // Toggling is primarily done in the popup; this badge lets the user SEE,
  // on the page, whether the current thread is being captured — and click to
  // flip just this thread. Reflects shouldCaptureThread() (paused / site /
  // override / global all folded in).
  function updateCapturePill() {
    const pill = document.getElementById("mw-capture-pill");
    if (!pill) return;
    const on = shouldCaptureThread();
    pill.classList.toggle("mw-on", on);
    // Update the label text only — leave the .mw-cap-dot element in place so
    // its recording-pulse animation never restarts on a refresh tick.
    const label = pill.querySelector(".mw-cap-label");
    if (label) label.textContent = on ? "capturing" : "capture";
    pill.title = on
      ? "This thread is syncing to memory.wiki. Click to stop capturing it."
      : "Click to capture this thread to memory.wiki (or toggle globally in the popup).";
  }
  function initCapturePill() {
    // Show the pill ONLY while this thread is actually being captured (so the
    // page indicator matches the popup: auto-capture off ⇒ no pill). It is a
    // live "● capturing" status + a click-to-stop for this thread.
    if (!shouldCaptureThread() || !threadKey()) { removeCapturePill(); return; }
    injectInjectStyles();
    let pill = document.getElementById("mw-capture-pill");
    if (!pill) {
      pill = document.createElement("button");
      pill.id = "mw-capture-pill";
      pill.type = "button";
      // Dot (recording pulse when on) + label, built once so the animation
      // is stable across refreshes.
      pill.innerHTML = MW_GRIP + '<span class="mw-cap-dot"></span><span class="mw-cap-label"></span>';
      pill.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (pill._mwDragged) { pill._mwDragged = false; return; } // was a drag, not a click
        // The pill is a live status indicator; clicking it stops auto-capture.
        // Turn it back on from the popup. Keeps the page in sync with the popup.
        try { chrome.storage.sync.set({ autoCapture: false }); } catch { /* */ }
        showToast("auto-capture stopped", 2000);
      });
      document.body.appendChild(pill);
      makeDraggable(pill);
      applySavedPillPos(pill);
    }
    updateCapturePill();
  }
  function removeCapturePill() {
    const p = document.getElementById("mw-capture-pill");
    if (p) p.remove();
  }

  // ─── Draggable pills ───
  // Both on-page pills (capturing + memory) can be dragged anywhere; the
  // position persists. A drag (pointer moved past a small threshold) does
  // NOT fire the pill's click action — checked via pill._mwDragged.
  function applySavedPillPos(pill) {
    const p = pillPos[pill.id];
    if (!p || typeof p.left !== "number" || typeof p.top !== "number") return;
    const w = pill.offsetWidth || 120, h = pill.offsetHeight || 32;
    const left = Math.max(4, Math.min(p.left, window.innerWidth - w - 4));
    const top = Math.max(4, Math.min(p.top, window.innerHeight - h - 4));
    pill.style.left = left + "px";
    pill.style.top = top + "px";
    pill.style.right = "auto";
    pill.style.bottom = "auto";
  }

  function makeDraggable(pill) {
    let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false, moved = false;
    pill.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      const rect = pill.getBoundingClientRect();
      origLeft = rect.left; origTop = rect.top;
      startX = e.clientX; startY = e.clientY;
      try { pill.setPointerCapture(e.pointerId); } catch { /* */ }
      pill.style.transition = "none";
      pill.style.cursor = "grabbing";
    });
    pill.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      const w = pill.offsetWidth, h = pill.offsetHeight;
      const left = Math.max(4, Math.min(origLeft + dx, window.innerWidth - w - 4));
      const top = Math.max(4, Math.min(origTop + dy, window.innerHeight - h - 4));
      pill.style.left = left + "px";
      pill.style.top = top + "px";
      pill.style.right = "auto";
      pill.style.bottom = "auto";
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      pill.style.cursor = "";
      pill.style.transition = "";
      try { pill.releasePointerCapture(e.pointerId); } catch { /* */ }
      if (moved) {
        pill._mwDragged = true; // suppress the click that follows this drag
        const rect = pill.getBoundingClientRect();
        pillPos[pill.id] = { left: Math.round(rect.left), top: Math.round(rect.top) };
        try { chrome.storage.local.set({ "mw-pill-pos": pillPos }); } catch { /* */ }
      }
    };
    pill.addEventListener("pointerup", end);
    pill.addEventListener("pointercancel", end);
  }

  // ─── Auto-inject relevant memory (#1) ───
  // The extension already runs on the AI page. With auto-inject on, a small
  // "memory" pill near the composer pulls the user's RELEVANT memory into the
  // chat: it runs the ontology-grounded deep search (the same recall MCP
  // agents use, /api/search?deep=1) against what they're typing and inserts
  // the matching memory.wiki URL into the input. The AI then fetches that URL
  // as clean markdown — cross-AI, no plugin. Opt-in; never injects silently.
  let autoInjectEnabled = false;

  function getInputEl() {
    if (platform === "chatgpt")
      return document.querySelector("#prompt-textarea") || document.querySelector("main form textarea");
    if (platform === "claude")
      return document.querySelector('div[contenteditable="true"].ProseMirror') ||
             document.querySelector('div[contenteditable="true"]') ||
             document.querySelector("textarea");
    if (platform === "gemini")
      return document.querySelector('div[contenteditable="true"][role="textbox"]') ||
             document.querySelector('rich-textarea div[contenteditable="true"]') ||
             document.querySelector("textarea");
    return null;
  }

  function readInput(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return el.textContent || "";
  }

  function insertIntoInput(text) {
    const el = getInputEl();
    if (!el) { showToast("couldn't find the chat input", 3000); return false; }
    el.focus();
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const cur = el.value || "";
      el.value = cur ? cur.replace(/\s*$/, "") + "\n\n" + text : text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable (ProseMirror etc.) — execCommand fires the
      // beforeinput/input events React/ProseMirror listen for.
      try {
        const sel = window.getSelection();
        sel.selectAllChildren(el);
        sel.collapseToEnd();
        const prefix = readInput(el).trim() ? "\n\n" : "";
        if (!document.execCommand("insertText", false, prefix + text)) throw new Error("execCommand failed");
      } catch {
        el.textContent = (el.textContent ? el.textContent + "\n\n" : "") + text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }
    return true;
  }

  function injectInjectStyles() {
    if (document.getElementById("mw-inject-style")) return;
    const fontUrl = (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL("fonts/JetBrainsMono-Regular.woff2") : "";
    const PILL_FONT = 'font:600 11px/1 "MW JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em';
    const s = document.createElement("style");
    s.id = "mw-inject-style";
    s.textContent = [
      fontUrl ? '@font-face{font-family:"MW JetBrains Mono";src:url("' + fontUrl + '") format("woff2");font-weight:400 600;font-display:swap}' : '',
      '#mw-inject-pill{position:fixed;right:16px;bottom:92px;z-index:2147483600;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:#141416;color:#e4e4e7;border:1px solid #3a3a40;' + PILL_FONT + ';cursor:grab;box-shadow:0 4px 14px rgba(0,0,0,.3);opacity:.9}',
      '#mw-inject-pill:hover{opacity:1}',
      '#mw-capture-pill{position:fixed;right:16px;bottom:132px;z-index:2147483600;display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:#141416;color:#e4e4e7;border:1px solid #3a3a40;' + PILL_FONT + ';cursor:grab;box-shadow:0 4px 14px rgba(0,0,0,.3);opacity:.9}',
      '#mw-capture-pill:hover{opacity:1}',
      '#mw-capture-pill.mw-on{color:#e4e4e7;border-color:#3a3a40}',
      '#mw-capture-pill .mw-cap-dot{width:8px;height:8px;border-radius:50%;background:#6a6a72;flex-shrink:0}',
      '#mw-capture-pill.mw-on .mw-cap-dot{background:#B5FF1A;animation:mw-rec 1.4s ease-in-out infinite}',
      '@keyframes mw-rec{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(181,255,26,.5)}50%{opacity:.35;box-shadow:0 0 0 5px rgba(181,255,26,0)}}',
      '#mw-capture-pill .mw-grip,#mw-inject-pill .mw-grip{display:inline-flex;align-items:center;color:#5a5a62;margin-right:1px;flex-shrink:0}',
      '#mw-capture-pill .mw-grip svg,#mw-inject-pill .mw-grip svg{width:10px;height:13px;display:block}',
      '#mw-capture-pill:hover .mw-grip,#mw-inject-pill:hover .mw-grip{color:#a1a1aa}',
      '.mw-inject-panel{z-index:2147483601;width:320px;max-height:340px;overflow:auto;background:#141416;color:#e4e4e7;border:1px solid #2a2a2e;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.4);padding:6px;font:13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
      '.mw-inject-head{font-family:"MW JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:.1em;padding:7px 8px}',
      '.mw-inject-empty{padding:12px;color:#a1a1aa;font-size:12px;line-height:1.5}',
      '.mw-inject-row{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:transparent;border:none;color:inherit;padding:8px;border-radius:8px;cursor:pointer}',
      '.mw-inject-row:hover{background:rgba(255,255,255,.06)}',
      '.mw-inject-title{font-size:13px;color:#e4e4e7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px}',
      '.mw-inject-meta{font-size:11px;color:#71717a}',
    ].join("");
    document.head.appendChild(s);
  }

  function closeInjectPanel() {
    const p = document.getElementById("mw-inject-panel");
    if (p) p.remove();
  }

  function positionPanel(panel, anchor) {
    const rect = anchor.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.bottom = (window.innerHeight - rect.top + 8) + "px";
    panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 336)) + "px";
  }

  async function openInjectPanel(anchor) {
    closeInjectPanel();
    // Defense-in-depth: never inject when paused or disabled on this site,
    // even if a stale pill lingers.
    if (!extActive()) { removeAutoInject(); return; }
    const panel = document.createElement("div");
    panel.id = "mw-inject-panel";
    panel.className = "mw-inject-panel";
    const userId = await getUserId();
    if (!userId) {
      panel.innerHTML = '<div class="mw-inject-empty">Sign in at memory.wiki to inject your memory.</div>';
      document.body.appendChild(panel); positionPanel(panel, anchor);
      return;
    }
    panel.innerHTML = '<div class="mw-inject-empty">Searching your memory…</div>';
    document.body.appendChild(panel); positionPanel(panel, anchor);

    // Query = what the user is typing, else their last turn in this thread.
    let query = readInput(getInputEl()).trim();
    if (!query) {
      try {
        const lastUser = extractConversation().filter((m) => m.role === "user").slice(-1)[0];
        query = (lastUser?.content || "").trim();
      } catch { /* */ }
    }
    if (!query) {
      panel.innerHTML = '<div class="mw-inject-empty">Type what you need help with, then tap memory to find relevant context.</div>';
      return;
    }

    let results = [];
    try {
      const res = await proxyFetch(MDFY_URL + "/api/search?q=" + encodeURIComponent(query.slice(0, 400)) + "&deep=1", {
        method: "GET",
        headers: { "x-user-id": userId },
      });
      if (res.ok) { const data = JSON.parse(res.body); results = data.results || []; }
    } catch { /* */ }

    if (!results.length) {
      panel.innerHTML = '<div class="mw-inject-empty">No matching memory found for that.</div>';
      return;
    }
    panel.innerHTML = "";
    const head = document.createElement("div");
    head.className = "mw-inject-head";
    head.textContent = "Insert memory as context";
    panel.appendChild(head);
    results.slice(0, 6).forEach((r) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mw-inject-row";
      const titleEl = document.createElement("span");
      titleEl.className = "mw-inject-title";
      titleEl.textContent = r.title || "Untitled";
      const metaEl = document.createElement("span");
      metaEl.className = "mw-inject-meta";
      const graphOnly = Array.isArray(r.via) && r.via.includes("concept") && !r.via.includes("text") && !r.via.includes("semantic");
      metaEl.textContent = graphOnly && r.viaConcept ? "related via " + r.viaConcept : "";
      row.appendChild(titleEl);
      if (metaEl.textContent) row.appendChild(metaEl);
      row.addEventListener("click", () => {
        insertIntoInput("Use " + MDFY_URL + "/" + r.id + " as context: " + (r.title || "memory.wiki doc") + ".");
        closeInjectPanel();
        showToast("context added — the AI will read it as markdown", 3000);
      });
      panel.appendChild(row);
    });
  }

  function initAutoInject() {
    if (document.getElementById("mw-inject-pill")) return;
    injectInjectStyles();
    const pill = document.createElement("button");
    pill.id = "mw-inject-pill";
    pill.type = "button";
    pill.innerHTML = MW_GRIP + '<span>✦ memory</span>';
    pill.title = "Insert relevant memory.wiki context into this chat";
    pill.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (pill._mwDragged) { pill._mwDragged = false; return; } // was a drag, not a click
      if (document.getElementById("mw-inject-panel")) { closeInjectPanel(); return; }
      openInjectPanel(pill);
    });
    document.body.appendChild(pill);
    makeDraggable(pill);
    applySavedPillPos(pill);
    document.addEventListener("click", (e) => {
      const panel = document.getElementById("mw-inject-panel");
      if (panel && !panel.contains(e.target) && e.target !== pill) closeInjectPanel();
    });
  }

  function removeAutoInject() {
    const pill = document.getElementById("mw-inject-pill");
    if (pill) pill.remove();
    closeInjectPanel();
  }

  // Apply the current state to the page: status pills + injected buttons +
  // (re)schedule sync. Idempotent — safe to call on every observer tick and
  // on every storage change, so the popup's toggles flip the page live.
  function refreshExtUI() {
    if (!extActive()) {
      // Paused or disabled on this site → go fully dormant.
      removeCapturePill();
      removeAutoInject();
      const fc = document.getElementById("mw-float-container");
      if (fc) fc.remove();
      document.querySelectorAll(".mw-mini-btn").forEach((b) => b.remove());
      return;
    }
    initCapturePill();
    if (autoInjectEnabled) initAutoInject(); else removeAutoInject();
    if (showFloat) createFloatingButton();
    else { const fc = document.getElementById("mw-float-container"); if (fc) fc.remove(); }
    addMiniButtons();
    onConversationActivity(); // event-driven incremental capture (no polling)
  }

  // Load all flags — sync: prefs (autoCapture / autoInject / disabled sites),
  // local: paused + per-thread overrides — and react to changes live.
  try {
    chrome.storage.sync.get({ autoCapture: false, autoInject: false, "mw-disabled-sites": [], showFloatingButton: false }, (data) => {
      autoCaptureEnabled = !!(data && data.autoCapture);
      autoInjectEnabled = !!(data && data.autoInject);
      disabledSites = Array.isArray(data && data["mw-disabled-sites"]) ? data["mw-disabled-sites"] : [];
      showFloat = !!(data && data.showFloatingButton);
      chrome.storage.local.get({ "mw-paused": false, "mw-thread-capture": {}, "mw-pill-pos": {} }, (loc) => {
        mwPaused = !!(loc && loc["mw-paused"]);
        threadOverrides = (loc && loc["mw-thread-capture"]) || {};
        pillPos = (loc && loc["mw-pill-pos"]) || {};
        stateLoaded = true; // flags known — now (and only now) render
        refreshExtUI();
      });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        if (changes.autoCapture) autoCaptureEnabled = !!changes.autoCapture.newValue;
        if (changes.autoInject) autoInjectEnabled = !!changes.autoInject.newValue;
        if (changes["mw-disabled-sites"]) disabledSites = Array.isArray(changes["mw-disabled-sites"].newValue) ? changes["mw-disabled-sites"].newValue : [];
        if (changes.showFloatingButton) showFloat = !!changes.showFloatingButton.newValue;
      } else if (area === "local") {
        if (changes["mw-paused"]) mwPaused = !!changes["mw-paused"].newValue;
        if (changes["mw-thread-capture"]) threadOverrides = changes["mw-thread-capture"].newValue || {};
      } else return;
      refreshExtUI();
    });
  } catch { /* storage unavailable — features stay off */ }

  // Re-run mini button injection when new messages appear (MutationObserver)
  // Debounced to avoid performance issues during streaming responses
  let observerTimer;
  const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      measureContentRight();
      refreshExtUI(); // re-applies status pill + inject pill + buttons + reschedules sync (idempotent)
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
    if (doneTimer) clearTimeout(doneTimer);
  });
})();
