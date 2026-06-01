// Markdown → HTML renderer used by every non-editing surface in the web app
// (DocumentViewer falls through to TipTap, but everything else — embed page,
// BundleViewer, BundleEmbed — calls render() here and pipes into
// dangerouslySetInnerHTML).
//
// Why markdown-it (and not the previous Rust→WASM/comrak pipeline):
// the editor's Live tab is built on TipTap, which already drives a
// markdown-it instance via tiptap-markdown. Running viewers through the
// SAME parser eliminates a class of "looks different here than in the
// editor" bugs and lets us delete the parallel WASM render path.
//
// Configuration parity with TipTap (see TiptapLiveEditor.tsx ~line 950 +
// the post-mount renderer-rule patches):
//   - html: true                (allow inline HTML the editor accepted)
//   - linkify: true             (auto-link bare URLs)
//   - typographer: false        (don't smart-quote — disruptive in code-heavy docs)
//   - breaks: false             (single newlines are not <br>)
//   - markdown-it-footnote      (footnote support, matches editor)
//   - thead/tbody renderer rules nooped (TipTap's table model rejects them)
//
// Post-processing on top of the bare markdown-it HTML mirrors what the
// old postprocess.ts did for the WASM pipeline: ASCII diagram detection,
// highlight.js syntax highlighting, KaTeX math rendering (now via raw
// $..$ / $$..$$ regex since markdown-it doesn't emit comrak's
// <span data-math-style> wrappers), image alt-text alignment markers,
// scrollable table wrapper, accessible checkboxes. Mermaid blocks stay
// as <pre lang="mermaid"> for the consumer's DOM-based render pass.

import MarkdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import hljs from "highlight.js";
import katex from "katex";

// ─── markdown-it instance (lazy singleton, expensive to build) ─────────

let _md: MarkdownIt | null = null;

function getMd(): MarkdownIt {
  if (_md) return _md;
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: false,
    typographer: false,
  });
  md.use(markdownItFootnote);
  // Match TipTap's runtime patch: drop thead/tbody wrappers so the DOM
  // shape matches the editor's table output.
  const noop = () => "";
  md.renderer.rules.thead_open = noop;
  md.renderer.rules.thead_close = noop;
  md.renderer.rules.tbody_open = noop;
  md.renderer.rules.tbody_close = noop;
  _md = md;
  return md;
}

// ─── Public API ────────────────────────────────────────────────────────

export interface FlavorInfo {
  primary: "gfm" | "obsidian" | "mdx" | "pandoc" | "commonmark";
  math: boolean;
  mermaid: boolean;
  wikilinks: boolean;
  jsx: boolean;
  frontmatter: "yaml" | "toml" | "json" | null;
  confidence: number;
}

export interface RenderResult {
  html: string;
  title: string | undefined;
  flavor: FlavorInfo;
}

/**
 * Render markdown to fully post-processed HTML.
 * Drop the result into dangerouslySetInnerHTML — runs highlight.js, KaTeX,
 * and Mermaid container prep already. The caller still owns running
 * mermaid.render() against `<pre lang="mermaid">` blocks (kept out of this
 * module to avoid pulling Mermaid into every consumer's bundle).
 */
export function render(markdown: string): RenderResult {
  const { frontmatter, body } = extractFrontmatter(markdown);
  let html = getMd().render(body);
  html = postProcess(html);
  return {
    html,
    title: extractTitle(body),
    flavor: detectFlavor(body, frontmatter),
  };
}

/**
 * First-H1 title extractor. Mirrors MdEditor's extractTitleFromMd —
 * the doc's title invariant is "first H1 text", not the YAML frontmatter
 * field, so the editor and viewer agree on what to show in chrome.
 */
export function extractTitle(markdown: string): string | undefined {
  const { body } = extractFrontmatter(markdown);
  const m = body.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : undefined;
}

/**
 * Lightweight flavor heuristic. Used by the editor's flavor badge
 * (replaces the Rust crate's flavor.rs detector — same surface, JS
 * implementation). Confidence is fixed at 1.0; the badge is decorative,
 * not a security boundary.
 */
export function detectFlavor(
  markdown: string,
  frontmatter: string | null = null
): FlavorInfo {
  const { body } = frontmatter == null ? extractFrontmatter(markdown) : { body: markdown };
  const fmKind: FlavorInfo["frontmatter"] = frontmatter
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

  let primary: FlavorInfo["primary"] = "commonmark";
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

// ─── Internal helpers ──────────────────────────────────────────────────

function extractFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (m) return { frontmatter: m[1], body: m[2] };
  const tomlM = markdown.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n([\s\S]*)$/);
  if (tomlM) return { frontmatter: tomlM[1], body: tomlM[2] };
  return { frontmatter: null, body: markdown };
}

// Simple result cache — viewers re-call render() on theme switches and
// realtime updates. If the markdown didn't change, return the prior HTML.
let _prevInput = "";
let _prevHtml = "";

function postProcess(html: string): string {
  if (html === _prevInput) return _prevHtml;
  let result = html;
  result = styleAsciiDiagrams(result);
  result = highlightCode(result);
  result = processKatex(result);
  // Make checkboxes interactive (markdown-it adds disabled by default for
  // GFM task list items)
  result = result.replace(/ disabled=""/g, "").replace(/ disabled(?=[\s>])/g, "");
  // HTML align attr → inline style (Tailwind resets neutralise the attr)
  result = result.replace(
    / align="(left|center|right)"/g,
    ' style="text-align:$1"'
  );
  // Wrap tables for horizontal scroll on narrow viewports
  result = result.replace(
    /<table([\s\S]*?)<\/table>/g,
    '<div class="table-wrapper"><table$1</table></div>'
  );
  result = processImages(result);
  _prevInput = html;
  _prevHtml = result;
  return result;
}

function processImages(html: string): string {
  let result = html.replace(
    /<img\s+([^>]*?)alt="([^"]*)"([^>]*?)>/g,
    (_match, before: string, alt: string, after: string) => {
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
        before.match(/style="([^"]*)"/)?.[1] || after.match(/style="([^"]*)"/)?.[1] || "";
      const fullStyle = (existingStyle + style).trim();
      const cleanBefore = before.replace(/style="[^"]*"/, "");
      const cleanAfter = after.replace(/style="[^"]*"/, "");
      const styleAttr = fullStyle ? ` style="${fullStyle}"` : "";
      return `<img ${cleanBefore}alt="${cleanAlt}"${cleanAfter}${dataAttrs}${styleAttr}>`;
    }
  );
  result = result.replace(
    /<p>(<img\s+[^>]*alt="([^"]*)"[^>]*>)<\/p>/g,
    (_match, imgTag: string, alt: string) => {
      const cleanAlt = alt.split("|")[0].trim();
      if (cleanAlt && cleanAlt.length > 0 && !/^\S+\.\w{2,4}$/.test(cleanAlt)) {
        return `<figure>${imgTag}<figcaption>${cleanAlt}</figcaption></figure>`;
      }
      return _match;
    }
  );
  return result;
}

// markdown-it default output for fenced code: <pre><code class="language-X">...</code></pre>
// (No <pre lang="X"> — that was comrak's github_pre_lang format.) The regex
// accepts both shapes so a future switch to a different parser is cheap.
function highlightCode(html: string): string {
  return html.replace(
    /<pre([^>]*)><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
    (match, preAttrs: string, codeAttrs: string, code: string) => {
      const preLangMatch = preAttrs.match(/lang="([\w-]+)"/);
      const codeLangMatch = codeAttrs.match(/language-([\w-]+)/);
      const rawLang = preLangMatch?.[1] || codeLangMatch?.[1] || null;
      const lang = rawLang === "text" ? null : rawLang;
      // Mermaid stays raw — consumer's DOM pass swaps it for an SVG.
      if (lang === "mermaid") return match;
      // Math fenced as ```math is rare here (we handle $..$/$$..$$), keep raw.
      if (lang === "math") return match;
      const decoded = decodeHtmlEntities(code);
      try {
        const highlighted =
          lang && hljs.getLanguage(lang)
            ? hljs.highlight(decoded, { language: lang }).value
            : hljs.highlightAuto(decoded).value;
        const sourcepos = preAttrs.match(/data-sourcepos="[^"]+"/)?.[0] || "";
        const codeHeader = `<div class="code-header" style="display:flex;justify-content:space-between;align-items:center;padding:6px 12px;font-size:10px;font-family:ui-monospace,monospace;color:var(--text-faint);border-bottom:1px solid var(--border-dim)">${lang ? `<span style="text-transform:uppercase;letter-spacing:0.5px">${lang}</span>` : "<span></span>"}<button class="code-copy-btn" onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})" style="padding:2px 8px;background:var(--code-copy-bg);color:var(--code-copy-color);border:1px solid var(--code-copy-border);border-radius:4px;cursor:pointer;font-size:10px;font-family:ui-monospace,monospace">Copy</button></div>`;
        return `<pre ${sourcepos}${lang ? ` lang="${lang}"` : ""} style="position:relative">${codeHeader}<code class="hljs${lang ? ` language-${lang}` : ""}">${highlighted}</code></pre>`;
      } catch {
        return match;
      }
    }
  );
}

// KaTeX rendering on the HTML output. Skips <pre>...</pre> regions so
// dollar signs inside fenced code never get treated as math. We don't try
// to skip inline <code>...</code> — math inside backticks is extremely
// unusual and the cost of false negatives there is just one literal
// "$x$" showing instead of a rendered widget.
function processKatex(html: string): string {
  // Split into [text, <pre>...</pre>, text, ...] alternating.
  const parts = html.split(/(<pre[\s\S]*?<\/pre>)/g);
  return parts
    .map((part, idx) => (idx % 2 === 1 ? part : renderMathInTextPart(part)))
    .join("");
}

function renderMathInTextPart(s: string): string {
  // Display: $$...$$ — multi-line allowed, non-greedy.
  let r = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
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
  // Inline: $X$ — X starts non-space, ends non-space, no inner $ or newline.
  // Negative lookbehind/lookahead on word chars avoid matching "$5.00" mid-sentence.
  r = r.replace(/(?<![\w$])\$([^\s$][^\n$]*?[^\s$])\$(?![\w])/g, (m, tex: string) => {
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
  // Single-character inline math: $x$
  r = r.replace(/(?<![\w$])\$([^\s$\d])\$(?![\w])/g, (m, tex: string) => {
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

// ─── ASCII diagram detection ───────────────────────────────────────────
// Ported from postprocess.ts unchanged — the heuristics already handled
// markdown-it-shaped <pre><code> blocks just fine (the regex accepts
// optional code-header divs too, for re-entrancy after highlightCode runs).

function styleAsciiDiagrams(html: string): string {
  const boxCharsRegex = /[┌┐└┘│─├┤┬┴┼╌═║╔╗╚╝╠╣╦╩╬┊┈]/g;
  const MIN_BOX_CHARS = 5;
  return html.replace(
    /<pre([^>]*)>(?:<div class="code-header"[\s\S]*?<\/div>)?<code([^>]*)>([\s\S]*?)<\/code><\/pre>/g,
    (match, preAttrs: string, codeAttrs: string, content: string) => {
      if (/lang="mermaid"/.test(preAttrs) || /language-mermaid/.test(codeAttrs))
        return match;
      const decoded = decodeHtmlEntities(content);
      if ((decoded.match(boxCharsRegex) || []).length < MIN_BOX_CHARS) return match;
      const sourcepos = preAttrs.match(/data-sourcepos="[^"]+"/)?.[0] || "";
      return wrapAsciiDiagram(content, sourcepos);
    }
  );
}

function wrapAsciiDiagram(content: string, sourcepos: string): string {
  const decoded = decodeHtmlEntities(content);
  const htmlTable = asciiTableToHtml(decoded);
  if (htmlTable) return `<div ${sourcepos}>${htmlTable}</div>`;
  return `<div class="ascii-diagram ascii-rendered" data-original-code="${encodeURIComponent(decodeHtmlEntities(content))}" ${sourcepos}><pre style="margin:0;border:none;background:transparent;overflow-x:auto"><code style="display:block;padding:1.5rem;font-family:ui-monospace,'JetBrains Mono','Fira Code',monospace;font-size:0.8125rem;line-height:1.5;color:var(--text-secondary);white-space:pre">${content}</code></pre></div>`;
}

function asciiTableToHtml(text: string): string | null {
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
  let html = '<table data-sourcepos="">';
  html += "<thead><tr>";
  header.forEach((cell) => {
    html += `<th style="text-align:left">${cell}</th>`;
  });
  html += "</tr></thead><tbody>";
  body.forEach((row) => {
    html += "<tr>";
    row.forEach((cell) => {
      html += `<td>${cell}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}
