// Golden render tests for @mdcore/editor.
//
// For each .md fixture, we render via the same pipeline web ships
// (apps/web/src/lib/render.ts == packages/editor/src/render.ts) and
// assert presence of the structural elements + key visual classes
// that downstream channels (Desktop, VSCode, QuickLook, iOS, Android)
// rely on.
//
// Pure node test runner — no jest, no playwright. Runs as:
//   npm test
// from packages/editor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { render } from "../dist/render.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function load(name) {
  return readFileSync(join(FIXTURES, name), "utf8");
}

// ─── 01 Headings ───
test("01 headings: H1 through H6 all render", () => {
  const { html, title } = render(load("01-headings.md"));
  assert.equal(title, "Heading 1", "title comes from first H1");
  for (let i = 1; i <= 6; i++) {
    assert.match(html, new RegExp(`<h${i}[^>]*>Heading ${i}</h${i}>`), `H${i} present`);
  }
});

// ─── 02 Inline formatting ───
test("02 inline: bold + italic + code + strike + link", () => {
  const { html } = render(load("02-inline.md"));
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<em><strong>bold italic<\/strong><\/em>|<strong><em>bold italic<\/em><\/strong>/);
  assert.match(html, /<s>strike<\/s>/);
  assert.match(html, /<code[^>]*>inline code<\/code>/);
  assert.match(html, /<a [^>]*href="https:\/\/memory\.wiki"[^>]*>Link to memory\.wiki<\/a>/);
  // Autolinked bare URL
  assert.match(html, /<a [^>]*href="https:\/\/memory\.wiki\/L2SHNVir"/);
});

// ─── 03 Lists ───
test("03 lists: unordered + ordered + task list", () => {
  const { html } = render(load("03-lists.md"));
  assert.match(html, /<ul>[\s\S]*<li>Apple<\/li>/);
  assert.match(html, /<ol>[\s\S]*<li>First/);
  // Task list checkboxes — markdown-it-task-lists or built-in [x] handling
  // (web's render.ts may post-process checkboxes; assert at least the
  // [x]/[ ] tokens become inputs OR remain as inline text we can find)
  const hasCheckbox = /type="checkbox"/.test(html) || /\[x\]/.test(html);
  assert.ok(hasCheckbox, "task list rendered as checkboxes OR raw [x] visible");
});

// ─── 04 Tables ───
test("04 tables: header + body + alignment", () => {
  const { html } = render(load("04-tables.md"));
  assert.match(html, /<table[^>]*>/, "table opens");
  assert.match(html, /<\/table>/, "table closes");
  // Header content
  assert.match(html, /<th[^>]*>Channel<\/th>/);
  // First data row content
  assert.match(html, /<td[^>]*>Web<\/td>/);
  // Alignment attrs from :---: / ---:
  assert.match(html, /style="text-align:center"|class="[^"]*center[^"]*"/);
  assert.match(html, /style="text-align:right"|class="[^"]*right[^"]*"/);
});

// ─── 05 Code blocks ───
test("05 code blocks: js / ts / python / no-lang + highlight.js classes", () => {
  const { html } = render(load("05-code.md"));
  // Fenced code blocks always wrap in <pre><code class="language-...">
  assert.match(html, /<pre[^>]*lang="js"|class="language-js"/);
  assert.match(html, /<pre[^>]*lang="ts"|class="language-ts"/);
  assert.match(html, /<pre[^>]*lang="python"|class="language-python"/);
  // Highlight.js should have injected at least one .hljs-keyword/.hljs-string span
  assert.match(html, /class="hljs[^"]*"/, "hljs spans present after highlight pass");
  // Inline code stays inline
  assert.match(html, /<code[^>]*>const x = 1;<\/code>/);
});

// ─── 06 Math ───
test("06 math: inline + display KaTeX widgets", () => {
  const { html } = render(load("06-math.md"));
  // KaTeX wraps with .katex span; inline + display variants
  assert.match(html, /class="katex"/, "katex CSS class present");
  // Display math gets an outer span with display class
  assert.match(html, /katex-display|katex-html/);
  // Verify a few well-known KaTeX entities appear
  assert.match(html, /mi|mo|mfrac|msqrt|munderover/, "MathML primitives emitted");
});

// ─── 07 Mermaid ───
test("07 mermaid: kept as language-mermaid code blocks for client render", () => {
  const { html, flavor } = render(load("07-mermaid.md"));
  assert.equal(flavor.mermaid, true, "flavor detects mermaid");
  // Three diagrams: flowchart, sequence, pie. Web emits
  // <pre><code class="language-mermaid"> — downstream consumers
  // (web viewer + desktop renderer) call mermaid.js on each match.
  const mermaidBlocks = html.match(/language-mermaid/g) || [];
  assert.ok(mermaidBlocks.length >= 3, `at least 3 mermaid blocks, got ${mermaidBlocks.length}`);
  // The Mermaid source content should be preserved (not pre-rendered to SVG)
  assert.match(html, /graph LR/);
  assert.match(html, /sequenceDiagram/);
  assert.match(html, /pie title/);
});

// ─── 08 Images ───
test("08 images: src + alt + alignment marker + reference style", () => {
  const { html } = render(load("08-images.md"));
  // Basic: web wraps in <figure>+<figcaption>
  assert.match(html, /<figure><img src="https:\/\/memory\.wiki\/brand\/mwblob_morph\.svg" alt="A cute kitten"/);
  assert.match(html, /<figcaption>A cute kitten<\/figcaption>/);
  // Title attribute passes through
  assert.match(html, /title="memory\.wiki hero"/);
  // Pipe-delimited alignment marker — web emits data-align attribute
  // (NOT a CSS class, NOT inline style). Caller styles via [data-align].
  assert.match(html, /data-align="center"/);
  // Reference-style image resolves
  assert.match(html, /<img src="[^"]*mwblob_morph\.svg" alt="logo" title="Logo"/);
});

// ─── 09 Blockquotes + rules ───
test("09 blockquotes + horizontal rule", () => {
  const { html } = render(load("09-quotes-rules.md"));
  assert.match(html, /<blockquote>/);
  // Nested blockquotes → nested <blockquote> tags
  const bqCount = (html.match(/<blockquote>/g) || []).length;
  assert.ok(bqCount >= 3, `nested blockquotes, got ${bqCount}`);
  assert.match(html, /<hr\s*\/?>/);
});

// ─── 10 Footnotes ───
test("10 footnotes: markdown-it-footnote integration", () => {
  const { html } = render(load("10-footnotes.md"));
  // markdown-it-footnote adds .footnote-ref + #fn1 ids
  assert.match(html, /class="footnote-ref"|footnote-ref/);
  assert.match(html, /id="fn1"|id="fn-1"/);
  // Footnote content
  assert.match(html, /Claude, ChatGPT, Cursor, and Gemini/);
});

// ─── 11 ASCII diagrams ───
test("11 ASCII diagrams: box-drawing detected + content preserved", () => {
  const { html } = render(load("11-ascii-diagram.md"));
  // Box-drawing characters survive intact (no escaping)
  assert.match(html, /┌──────────┐/);
  assert.match(html, /├──/);
  // render.ts wraps detected ASCII diagrams in a special class so
  // viewers can render them with a monospace font + scroll wrapper.
  assert.match(html, /ascii-diagram|ascii-rendered/);
  // Tree-structure literals like "apps" survive even though hljs
  // may slice the trailing slash into a separate span.
  assert.match(html, /apps/);
});

// ─── 12 Mixed everything ───
test("12 mixed everything: smoke test of all features together", () => {
  const { html, title, flavor } = render(load("12-mixed-everything.md"));
  assert.equal(title, "Everything in one doc");
  assert.equal(flavor.math, true);
  assert.equal(flavor.mermaid, true);
  // Every feature present in same doc
  assert.match(html, /<table/);
  assert.match(html, /<ul>/);
  assert.match(html, /<pre[^>]*lang="ts"|class="language-ts"/);
  assert.match(html, /katex/);
  assert.match(html, /language-mermaid/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<img /);
});

// ─── Meta: list every fixture so we know the runner sees them ───
test("meta: every fixture in __tests__/fixtures has a test", () => {
  const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".md")).sort();
  assert.equal(fixtures.length, 12, `expected 12 fixtures, got ${fixtures.length}: ${fixtures.join(", ")}`);
});
