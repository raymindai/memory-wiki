// ─── Example documents (source of truth: examples/*.md) ───
// Loaded by index.html before editor.js

window.MDFY_EXAMPLES = {
  welcome: `# Welcome to Memory.Wiki

> **Your AI memory, deployable to any AI.**
> Import anything. Render beautifully. Share instantly.

## Get Started

1. **Type or paste** anything — Markdown, plain text, Claude Code output
2. **Import** files — PDF, Word, PowerPoint, Excel, HTML, CSV, LaTeX, and more
3. **Edit** inline in the Live view, or use Source for raw Markdown
4. **Share** with one click — generates a short URL like \`memory.wiki/abc123\`

## What You Can Do

- **WYSIWYG editing** — click any text in the Live view and start typing
- **AI Tools** — Polish, Summary, TL;DR, Translate, Chat (right panel)
- **Document Outline** — heading structure panel on the right
- **Image Gallery** — upload, manage, and insert images (right panel)
- **Multi-format import** — drag & drop PDF, DOCX, PPTX, XLSX, or 10+ other formats
- **Export anywhere** — download as MD/HTML/TXT, print PDF, copy for Docs/Email/Slack
- **Flavor conversion** — click the flavor badge (GFM ▾) to convert between formats
- **Folders + Trash** — organize with folders, drag to move, soft delete with restore
- **Cross-platform sync** — edit on Web, VS Code, Mac Desktop, or CLI. Same URL everywhere

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘K | Insert link |
| ⌘S | Share (copy URL) |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘⇧C | Copy HTML |
| ⌘\\\\ | Toggle view mode |

## Try It Now

- **Drop a PDF here** — see AI Memory.Wiki turn it into clean Markdown
- **Click +** in the sidebar to start a new doc from a template
- **Sign in** (sidebar bottom) for cloud sync and short URL sharing — free during the beta, no credit card

---

*Powered by **mdcore engine** — Rust + WASM*`,

  syntax: `# Markdown Syntax Guide

## Text Formatting

Regular text, **bold**, *italic*, ***bold italic***, ~~strikethrough~~, and \`inline code\`.

> Blockquotes can contain **formatting** and even
> multiple paragraphs.
>
> > Nested blockquotes work too.

## Headings

> # H1 — Document Title
> ## H2 — Section
> ### H3 — Subsection
> #### H4 — Sub-subsection
> ##### H5 — Minor heading
> ###### H6 — Smallest heading

## Lists

### Unordered
- First item
- Second item
  - Nested item
  - Another nested
    - Even deeper

### Ordered
1. Step one
2. Step two
   1. Sub-step A
   2. Sub-step B

### Task List
- [x] Completed task
- [x] Another done
- [ ] Still to do

## Tables

| Left | Center | Right |
|:-----|:------:|------:|
| L1 | C1 | R1 |
| L2 | C2 | R2 |
| L3 | C3 | R3 |

## Code

\`\`\`typescript
const { html, flavor } = await renderMarkdown(input);
console.log(\`Detected: \${flavor.primary}\`);
\`\`\`

\`\`\`python
import requests

response = requests.post("https://memory.wiki/api/docs", json={
    "markdown": "# Hello World",
})
print(response.json()["id"])  # → "abc123"
\`\`\`

## Math (KaTeX)

Inline: $E = mc^2$ and $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$

$$
\\int_0^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

$$
\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} ax + by \\\\ cx + dy \\end{pmatrix}
$$

## Footnotes

Created by John Gruber[^1]. Most popular flavor: GFM[^2].

[^1]: See [Daring Fireball](https://daringfireball.net/projects/markdown/).
[^2]: [github.github.com/gfm](https://github.github.com/gfm/).

## Description Lists

Markdown
: A lightweight markup language for creating formatted text.

WASM
: WebAssembly — a binary instruction format for a stack-based virtual machine.`,

  diagrams: `# Mermaid Diagrams — All 19 Types

> **Tip:** Double-click any diagram to open the visual editor.

## Flowchart

\`\`\`mermaid
graph LR
    A[Markdown] --> B[mdcore Engine]
    B --> C[WASM]
    B --> D[Native Binary]
    C --> E[Browser]
    D --> F[CLI]
    style B fill:#fb923c,stroke:#ea580c,color:#000
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant User
    participant App
    participant API
    User->>App: Request
    App->>API: Fetch data
    API-->>App: Response
    App-->>User: Render
\`\`\`

## Pie Chart

\`\`\`mermaid
pie title Tech Stack
    "Rust" : 40
    "TypeScript" : 35
    "CSS" : 15
    "Other" : 10
\`\`\`

## Gantt Chart

\`\`\`mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Design :2026-01-01, 10d
    Develop :2026-01-11, 20d
    section Phase 2
    Test :2026-02-01, 7d
    Launch :2026-02-08, 3d
\`\`\`

## Class Diagram

\`\`\`mermaid
classDiagram
    class Engine {
        +render(md) HTML
        +detectFlavor() Flavor
    }
    class Renderer {
        +highlight() void
        +katex() void
    }
    Engine <|-- Renderer
\`\`\`

## State Diagram

\`\`\`mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch
    Loading --> Rendered : success
    Loading --> Error : fail
    Error --> Idle : retry
    Rendered --> [*]
\`\`\`

## ER Diagram

\`\`\`mermaid
erDiagram
    User {
        int id
        string name
    }
    Document {
        int id
        string markdown
    }
    User ||--o{ Document : creates
\`\`\`

## Mindmap

\`\`\`mermaid
mindmap
  root((mdcore))
    Product
      Memory.Wiki
      Chrome Extension
    Engine
      Rust
      WASM
    Features
      GFM
      KaTeX
      Mermaid
\`\`\`

## Timeline

\`\`\`mermaid
timeline
    title mdcore Milestones
    2026 Q1 : Engine v0.1
             : Memory.Wiki launch
    2026 Q2 : npm package
             : CLI tool
    2026 Q3 : API platform
\`\`\`

## User Journey

\`\`\`mermaid
journey
    title First-time User
    section Discover
      Visit site: 5: User
      See demo: 4: User
    section Use
      Paste MD: 5: User
      Share URL: 4: User
\`\`\`

## Quadrant Chart

\`\`\`mermaid
quadrantChart
    title Feature Priority
    x-axis "Low Effort" --> "High Effort"
    y-axis "Low Impact" --> "High Impact"
    Share URL: [0.2, 0.9]
    PDF Export: [0.4, 0.6]
    Canvas Mode: [0.8, 0.7]
    Themes: [0.3, 0.4]
\`\`\`

## Git Graph

\`\`\`mermaid
gitGraph
    commit id: "init"
    branch feature
    commit id: "add engine"
    commit id: "add wasm"
    checkout main
    commit id: "hotfix"
    merge feature
    commit id: "v0.1"
\`\`\`

## XY Chart

\`\`\`mermaid
xychart-beta
    title "Monthly Users"
    x-axis ["Jan", "Feb", "Mar", "Apr", "May"]
    y-axis "Users" 0 --> 500
    bar [120, 200, 350, 280, 450]
    line [100, 180, 300, 250, 400]
\`\`\`


---

*All 19 Mermaid diagram types with visual editors. Double-click to edit.*`,

  ascii: `# ASCII Art Examples

> Click **"Convert to Mermaid"** on any ASCII diagram to transform it into a rendered Mermaid chart.

## Architecture Diagram

\`\`\`
┌──────────────────────────────────────────┐
│              Memory.Wiki                      │
│                                          │
│  ┌─ Input ─────────────────────────────┐ │
│  │ Chrome Extension: AI → capture      │ │
│  │ Paste: Cmd+V                        │ │
│  │ Drop: .md file drag                 │ │
│  └─────────────────────────────────────┘ │
│                    │                      │
│                    ▼                      │
│  ┌─ Engine (mdcore) ───────────────────┐ │
│  │ AI noise removal                    │ │
│  │ Code + Math + Diagram rendering     │ │
│  │ Format detection                    │ │
│  └─────────────────────────────────────┘ │
│                    │                      │
│                    ▼                      │
│  ┌─ Output ────────────────────────────┐ │
│  │ memory.wiki/{id} — shareable URL        │ │
│  │ + "Published with Memory.Wiki" badge    │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
\`\`\`

## Score Card

\`\`\`
┌─────────────────────────────┐
│  Score: 93/100               │
│                              │
│  Quality  ████████░░ 85%     │
│  Style    █████████░ 92%     │
│  Clarity  ██████░░░░ 63%     │
│                              │
│  — Analyzed by mdcore        │
│  Memory.Wiki                     │
└─────────────────────────────┘
\`\`\`

## Comparison Table

\`\`\`
┌──────────────┬─────────┬──────────┐
│   Product    │   ARR   │   Moat   │
├──────────────┼─────────┼──────────┤
│ Carrd        │ $1.5-2M │ Badge    │
├──────────────┼─────────┼──────────┤
│ Plausible    │ $3.1M   │ Anti-GA  │
├──────────────┼─────────┼──────────┤
│ Buttondown   │ $180K+  │ Footer   │
└──────────────┴─────────┴──────────┘
\`\`\`

## Simple Flow

\`\`\`
┌────────┐     ┌────────┐     ┌────────┐
│  Input │────→│ Process│────→│ Output │
└────────┘     └────────┘     └────────┘
\`\`\`

## Free During Beta

Everything is unlocked while we're testing — no credit card required.

\`\`\`
┌─ Beta (everyone) ──────┐
│ Unlimited documents    │
│ Documents never expire │
│ Cloud sync             │
│ Short URL sharing      │
│ AI Memory.Wiki structuring    │
│ All formats supported  │
└────────────────────────┘
\`\`\``,

  import: `# Import & Export Guide

## Import — 13+ Formats

Drop any file onto Memory.Wiki or click **IMPORT** in the sidebar.

| Format | How it works |
|--------|-------------|
| **PDF** | Server-side text extraction (max 4MB) |
| **DOCX** | Word → HTML → Markdown via mammoth |
| **PPTX / XLSX** | Office text extraction via officeparser (max 10MB) |
| **HTML** | Turndown converts to clean Markdown |
| **CSV** | Auto-converted to Markdown table |
| **LaTeX** | Sections, math, formatting → Markdown |
| **RST** | reStructuredText headings, links → Markdown |
| **RTF / JSON / XML / TXT** | Text extraction with format hints |

### AI Memory.Wiki Structuring

After importing, you'll see **"Memory.Wiki this document?"** — click **Memory.Wiki it** to let AI:

- Detect headings from context
- Rebuild lists, tables, code blocks
- Add emphasis and formatting
- Preserve all original content

> Works great for PDF imports where formatting is lost during text extraction.

## Export — Every Destination

Click the **Export** icon in the Live view header.

### Download
- **Markdown (.md)** — raw source
- **HTML (.html)** — styled, self-contained
- **Plain Text (.txt)** — formatting stripped

### Print
- **PDF** — via browser print dialog

### Clipboard
- **Raw HTML** — for web use
- **Rich Text** — paste into Google Docs, Email, Word
- **Slack (mrkdwn)** — formatted for Slack
- **Plain Text** — no formatting`,

  features: `# Key Features

## WYSIWYG Editing

Click anywhere in the **Live** view to start editing. Format with the toolbar or keyboard shortcuts.

> No need to learn Markdown syntax — just type naturally.

## Flavor Detection & Conversion

Memory.Wiki auto-detects your Markdown flavor:

- **GFM** — GitHub Flavored Markdown (tables, task lists, strikethrough)
- **CommonMark** — Standard, maximum compatibility
- **Obsidian** — Wikilinks, callouts, embeds
- **MDX** — Markdown + JSX components
- **Pandoc** — Citations, footnotes, definition lists

Click the **flavor badge** (e.g. \`GFM ▾\`) in the Source header to convert between flavors.

## CLI Output Support

Paste output from **Claude Code** or any terminal — unicode tables and checkmarks auto-convert:

Before (terminal output):

\`\`\`
┌──────────┬────────┐
│ Feature  │ Status │
├──────────┼────────┤
│ Auth     │ Done   │
│ Export   │ Done   │
└──────────┴────────┘
\`\`\`

After (auto-converted):

| Feature | Status |
|---------|--------|
| Auth    | Done   |
| Export  | Done   |

## AI Tools

Click the **AI** button in the header to open the AI panel:

- **Polish** — improve writing quality and clarity
- **Summary** — generate a concise summary at the top
- **TL;DR** — extract key bullet points
- **Translate** — translate to any language
- **Chat** — type a natural language instruction to edit the document

Changes are highlighted in orange and fade after 3 seconds.

## Document Outline

Click the **Outline** button to see your document structure. All headings (H1-H6) are listed with hierarchy. Click any heading to scroll directly to it.

## Image Gallery

Click the **Image** button to open the gallery panel:

- Upload images (WebP auto-conversion, max 10MB per file)
- Click any image to insert at cursor position
- Storage quota: Free 20MB, Pro 1GB

## Narrow View

Toggle **Narrow View** in the panel header to constrain content width for comfortable reading.

## Folders & Organization

- Create folders via **New Folder** at sidebar bottom
- **Right-click** documents to move to folders
- **Trash** section with restore and permanent delete
- **Sort** by newest, oldest, A-Z, Z-A

## Cross-Platform

Your documents sync across all Memory.Wiki channels:

- **Web** — Memory.Wiki
- **VS Code** — Extension with WYSIWYG preview
- **Mac Desktop** — Native app with sidebar
- **CLI** — \`npm install -g memory-wiki-cli\`
- **Chrome Extension** — Capture from ChatGPT, Claude, Gemini
- **MCP Server** — AI agents create/read/update documents`,

  math: `# Math with KaTeX

## Inline Math

The equation $E = mc^2$ changed physics forever.

The quadratic formula: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$

## Display Math

$$\\int_0^\\infty e^{-x} dx = 1$$

$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$$

## Matrix

$$\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\end{bmatrix} = \\begin{bmatrix} ax + by \\\\ cx + dy \\end{bmatrix}$$

## Gaussian Integral

$$\\int_0^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$

## Matrix with Parentheses

$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} \\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} ax + by \\\\ cx + dy \\end{pmatrix}$$`,
};
