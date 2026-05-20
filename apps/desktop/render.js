// Markdown → HTML renderer for the Electron main process.
// Vendored from apps/web/src/lib/render.ts as plain CommonJS so it
// drops into main.js's IPC handler without a build step. Same
// markdown-it configuration as the web app and the VS Code extension
// (Phase 1 = web, Phase 2 = vsce, Phase 3 = this) — a doc previewed
// in the desktop app paints identically to the Memory.Wiki viewer it
// will publish to.
//
// Config parity with TipTap's tiptap-markdown instance:
//   - html: true, linkify: true, breaks: false, typographer: false
//   - markdown-it-footnote
//   - thead/tbody renderer rules nooped
//
// Post-process layer mirrors the previous WASM/comrak postprocess.ts:
// highlight.js syntax highlighting, KaTeX math widgets (raw $..$/$$..$$
// regex now that comrak's <span data-math-style> wrappers are gone),
// ASCII diagram detection, image alt-text alignment markers, scrollable
// table wrapper. Mermaid stays as <pre lang="mermaid"> for the renderer
// process to swap into an SVG (same contract as the previous engine).

const MarkdownIt = require("markdown-it");
const markdownItFootnote = require("markdown-it-footnote");
const hljs = require("highlight.js");
const katex = require("katex");

let _md = null;

function getMd() {
  if (_md) return _md;
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
  });
  md.use(markdownItFootnote);
  const noop = () => "";
  md.renderer.rules.thead_open = noop;
  md.renderer.rules.thead_close = noop;
  md.renderer.rules.tbody_open = noop;
  md.renderer.rules.tbody_close = noop;
  _md = md;
  return md;
}

function render(markdown) {
  const { frontmatter, body } = extractFrontmatter(markdown || "");
  let html = getMd().render(body);
  html = postProcess(html);
  return {
    html,
    title: extractTitle(body),
    flavor: detectFlavor(body, frontmatter),
  };
}

function extractTitle(markdown) {
  const { body } = extractFrontmatter(markdown);
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : undefined;
}

function detectFlavor(markdown, frontmatter = null) {
  const { body } = frontmatter == null ? extractFrontmatter(markdown) : { body: markdown };
  const fmKind = frontmatter
    ? frontmatter.trim().startsWith("{")
      ? "json"
      : frontmatter.trim().startsWith("+++")
        ? "toml"
        : "yaml"
    : null;

  const math =
    /\$\$[\s\S]+?\$\$/.test(body) || /(?<![\w$])\$[^\s$][^\n$]*?\$(?![\w$])/.test(body);
  const mermaid = /```mermaid/.test(body);
  const wikilinks = /\[\[[\w][^\]]*\]\]/.test(body);
  const jsx = /<[A-Z][\w]*[\s/>]/.test(body);
  const hasTaskList = /^\s*[-*]\s+\[[xX ]\]/m.test(body);
  const hasStrike = /~~[^~\n]+~~/.test(body);
  const hasTable = /^\|.+\|\s*\n\|[\s|:-]+\|/m.test(body);

  let primary = "commonmark";
  if (jsx) primary = "mdx";
  else if (wikilinks) primary = "obsidian";
  else if (hasTaskList || hasStrike || hasTable) primary = "gfm";

  return {
    primary,
    math,
    mermaid,
    wikilinks,
    jsx,
    frontmatter: fmKind,
    confidence: 1,
  };
}

function extractFrontmatter(markdown) {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (m) return { frontmatter: m[1], body: m[2] };
  const tomlM = markdown.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n([\s\S]*)$/);
  if (tomlM) return { frontmatter: tomlM[1], body: tomlM[2] };
  return { frontmatter: null, body: markdown };
}

let _prevInput = "";
let _prevHtml = "";

function postProcess(html) {
  if (html === _prevInput) return _prevHtml;
  let result = html;
  result = styleAsciiDiagrams(result);
  result = highlightCode(result);
  result = processKatex(result);
  result = result.replace(/ disabled=""/g, "").replace(/ disabled(?=[\s>])/g, "");
  result = result.replace(
    / align="(left|center|right)"/g,
    ' style="text-align:$1"'
  );
  result = result.replace(
    /<table([\s\S]*?)<\/table>/g,
    '<div class="table-wrapper"><table$1</table></div>'
  );
  result = processImages(result);
  _prevInput = html;
  _prevHtml = result;
  return result;
}

function processImages(html) {
  let result = html.replace(
    /<img\s+([^>]*?)alt="([^"]*)"([^>]*?)>/g,
    (_match, before, alt, after) => {
      const parts = alt.split("|").map((s) => s.trim());
      const cleanAlt = parts[0];
      let dataAttrs = "";
      let style = "";
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].toLowerCase();
        if (p === "center" || p === "left" || p === "right") dataAttrs += ` data-align="${p}"`;
        else if (p === "small" || p === "medium" || p === "large") dataAttrs += ` data-size="${p}"`;
        else if (/^\d+%$/.test(p)) style += `max-width:${p};`;
      }
      const existingStyle =
        (before.match(/style="([^"]*)"/) || [])[1] || (after.match(/style="([^"]*)"/) || [])[1] || "";
      const fullStyle = (existingStyle + style).trim();
      const cleanBefore = before.replace(/style="[^"]*"/, "");
      const cleanAfter = after.replace(/style="[^"]*"/, "");
      const styleAttr = fullStyle ? ` style="${fullStyle}"` : "";
      return `<img ${cleanBefore}alt="${cleanAlt}"${cleanAfter}${dataAttrs}${styleAttr}>`;
    }
  );
  result = result.replace(
    /<p>(<img\s+[^>]*alt="([^"]*)"[^>]*>)<\/p>/g,
    (_match, imgTag, alt) => {
      const cleanAlt = alt.split("|")[0].trim();
      if (cleanAlt && cleanAlt.length > 0 && !/^\S+\.\w{2,4}$/.test(cleanAlt)) {
        return `<figure>${imgTag}<figcaption>${cleanAlt}</figcaption></figure>`;
      }
      return _match;
    }
  );
  return result;
}

function highlightCode(html) {
  return html.replace(
    /<pre([^>]*)><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
    (match, preAttrs, codeAttrs, code) => {
      const preLangMatch = preAttrs.match(/lang="([\w-]+)"/);
      const codeLangMatch = codeAttrs.match(/language-([\w-]+)/);
      const rawLang = (preLangMatch && preLangMatch[1]) || (codeLangMatch && codeLangMatch[1]) || null;
      const lang = rawLang === "text" ? null : rawLang;
      if (lang === "mermaid") return match;
      if (lang === "math") return match;
      const decoded = decodeHtmlEntities(code);
      try {
        const highlighted =
          lang && hljs.getLanguage(lang)
            ? hljs.highlight(decoded, { language: lang }).value
            : hljs.highlightAuto(decoded).value;
        const sourcepos = (preAttrs.match(/data-sourcepos="[^"]+"/) || [])[0] || "";
        const codeHeader = `<div class="code-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;font-size:10px;font-family:ui-monospace,monospace;color:var(--text-faint);border-bottom:1px solid var(--border-dim)">${lang ? `<span style="text-transform:uppercase;letter-spacing:0.5px">${lang}</span>` : "<span></span>"}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})" style="padding:2px 8px;background:var(--code-copy-bg);color:var(--code-copy-color);border:1px solid var(--code-copy-border);border-radius:4px;cursor:pointer;font-size:10px;font-family:ui-monospace,monospace">Copy</button></div>`;
        return `<pre ${sourcepos}${lang ? ` lang="${lang}"` : ""} style="position:relative">${codeHeader}<code class="hljs${lang ? ` language-${lang}` : ""}">${highlighted}</code></pre>`;
      } catch {
        return match;
      }
    }
  );
}

function processKatex(html) {
  const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : renderMathInTextPart(part)))
    .join("");
}

function renderMathInTextPart(s) {
  let r = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    const src = tex.trim();
    try {
      const rendered = katex.renderToString(decodeHtmlEntities(src), {
        displayMode: true,
        throwOnError: false,
        strict: false,
        trust: false,
      });
      return `<div class="math-rendered" data-math-src="${encodeURIComponent(src)}" data-math-mode="display" style="cursor:pointer">${rendered}</div>`;
    } catch {
      return `<code class="math-error">${tex}</code>`;
    }
  });
  r = r.replace(/(?<![\w$])\$([^\s$][^\n$]*?[^\s$])\$(?![\w])/g, (m, tex) => {
    if (/^\d+(?:[.,]\d+)?$/.test(tex)) return m;
    try {
      const rendered = katex.renderToString(decodeHtmlEntities(tex), {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: false,
      });
      return `<span class="math-rendered" data-math-src="${encodeURIComponent(tex)}" data-math-mode="inline" style="cursor:pointer">${rendered}</span>`;
    } catch {
      return `<code class="math-error">${tex}</code>`;
    }
  });
  r = r.replace(/(?<![\w$])\$([^\s$\d])\$(?![\w])/g, (m, tex) => {
    try {
      const rendered = katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
        strict: false,
        trust: false,
      });
      return `<span class="math-rendered" data-math-src="${encodeURIComponent(tex)}" data-math-mode="inline" style="cursor:pointer">${rendered}</span>`;
    } catch {
      return m;
    }
  });
  return r;
}

function styleAsciiDiagrams(html) {
  const boxCharsRegex = /[┌┐└┘│─├┤┬┴┼╌═║╔╗╚╝╠╣╦╩╬┊┈]/g;
  const MIN_BOX_CHARS = 5;
  return html.replace(
    /<pre([^>]*)>(?:<div class="code-header"[\s\S]*?<\/div>)?<code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
    (match, preAttrs, codeAttrs, content) => {
      if (/lang="mermaid"/.test(preAttrs) || /language-mermaid/.test(codeAttrs)) return match;
      const decoded = decodeHtmlEntities(content);
      if ((decoded.match(boxCharsRegex) || []).length < MIN_BOX_CHARS) return match;
      const sourcepos = (preAttrs.match(/data-sourcepos="[^"]+"/) || [])[0] || "";
      return wrapAsciiDiagram(content, sourcepos);
    }
  );
}

function wrapAsciiDiagram(content, sourcepos) {
  const decoded = decodeHtmlEntities(content);
  const htmlTable = asciiTableToHtml(decoded);
  if (htmlTable) return `<div ${sourcepos}>${htmlTable}</div>`;
  return `<div class="ascii-diagram ascii-rendered" data-original-code="${encodeURIComponent(decodeHtmlEntities(content))}" ${sourcepos}><pre style="margin:0;border:none;background:transparent;overflow-x:auto"><code style="display:block;padding:1.5rem;font-family:ui-monospace,'JetBrains Mono','Fira Code',monospace;font-size:0.8125rem;line-height:1.5;color:var(--text-secondary);white-space:pre">${content}</code></pre></div>`;
}

function asciiTableToHtml(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 3) return null;
  const hasTableChars = lines.some((l) => /[┬┼┴]/.test(l));
  if (!hasTableChars) return null;
  const dataLines = lines.filter((l) => {
    const pipes = (l.match(/│/g) || []).length;
    return pipes >= 2 && !/^[│├┤┌┐└┘─┬┴┼═╔╗╚╝╠╣╦╩╬\s]+$/.test(l);
  });
  if (dataLines.length < 2) return null;
  const pipeCounts = dataLines.map((l) => (l.match(/│/g) || []).length);
  const allSame = pipeCounts.every((c) => c === pipeCounts[0]);
  if (!allSame) return null;
  const hasNestedBoxes = dataLines.some((l) => /│.*┌/.test(l) || /│.*└/.test(l));
  if (hasNestedBoxes) return null;
  const sepLines = lines.filter((l) => /^[│├┤┌┐└┘─┬┴┼═╔╗╚╝╠╣╦╩╬\s]+$/.test(l));
  if (sepLines.length === 0) return null;
  const rows = dataLines.map((line) =>
    line.split("│").slice(1, -1).map((cell) => cell.trim())
  );
  if (rows.length === 0 || rows[0].length === 0) return null;
  const [header, ...body] = rows;
  let out = '<table data-sourcepos="">';
  out += "<thead><tr>";
  header.forEach((cell) => {
    out += `<th style="text-align:left">${cell}</th>`;
  });
  out += "</tr></thead><tbody>";
  body.forEach((row) => {
    out += "<tr>";
    row.forEach((cell) => {
      out += `<td>${cell}</td>`;
    });
    out += "</tr>";
  });
  out += "</tbody></table>";
  return out;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

module.exports = { render, extractTitle, detectFlavor };
