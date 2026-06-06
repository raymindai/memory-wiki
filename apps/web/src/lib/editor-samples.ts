/**
 * Sample documents, templates, and first-time-visitor seed data.
 * Extracted from MdEditor.tsx so the editor file focuses on
 * orchestration. The FlyoutMenu component that originally sat
 * between these two blocks (welcome/formatting/diagrams/ascii/
 * import-export/features ↔ templates + AI capture + plugin samples)
 * stays in MdEditor.tsx because it's tied to editor-local hover
 * state.
 */

import type { Folder, Tab } from "@/lib/editor-types";
import { extractTitleFromMd } from "@/lib/editor-types";

// ─── Sample documents for default tabs ───

export const SAMPLE_WELCOME = `# Welcome to memory.wiki

> **The Markdown Hub.** Collect from anywhere. Edit with AI. Publish with a permanent URL.

## Get Started

1. **Type or paste** anything — Markdown, plain text, AI output, code
2. **Import** files — PDF, Word, PowerPoint, Excel, HTML, CSV, LaTeX, and more
3. **Edit** inline in the MD view, or use Source for raw Markdown
4. **Share** with one click — generates a permanent URL like \`memory.wiki/abc123\`

## What You Can Do

- **WYSIWYG editing** — click any text in the MD view and start typing
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
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+K | Insert link |
| Cmd+S | Share (copy URL) |
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Cmd+Shift+C | Copy HTML |
| Cmd+\\\\ | Toggle view mode |

## Available Everywhere

| Channel | How |
|---------|-----|
| Web | You are here — [memory.wiki](https://memory.wiki) |
| VS Code | [Extension](https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode) — Cmd+Shift+M to preview |
| Mac App | Native desktop with sidebar and sync |
| CLI | \`npm install -g memory-wiki-cli\` — pipe anything to a URL |
| Chrome | [Extension](https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold) — capture AI conversations |
| MCP | Connect Claude, Cursor, or any AI tool |
| QuickLook | Press Space on .md files in Finder |

## Try It Now

- **Drop a PDF here** — AI converts it into clean Markdown
- **Click +** in the sidebar to start from a template
- **Sign in** (sidebar bottom) for cloud sync and short URL sharing — free during beta
`;

export const SAMPLE_FORMATTING = `# Markdown Syntax Guide

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
: WebAssembly — a binary instruction format for a stack-based virtual machine.
`;

export const SAMPLE_DIAGRAMS = `# Mermaid Diagrams — All 19 Types

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
      memory.wiki
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
             : memory.wiki launch
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

*All 19 Mermaid diagram types with visual editors. Double-click to edit.*
`;


export const SAMPLE_ASCII = `# ASCII Art Examples

> Click **"Convert to Mermaid"** on any ASCII diagram to transform it into a rendered Mermaid chart.

## Architecture Diagram

\`\`\`
┌──────────────────────────────────────────┐
│              memory.wiki                      │
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
│  │ + "Published with memory.wiki" badge    │ │
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
│  memory.wiki                     │
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
│ AI structuring    │
│ All formats supported  │
└────────────────────────┘
\`\`\`
`;

export const SAMPLE_IMPORT_EXPORT = `# Import & Export Guide

## Import — 13+ Formats

Drop any file onto memory.wiki, use the **IMPORT** button in the sidebar, or paste content directly.

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

### AI Structuring

After importing, you'll see **"Structure this document?"** — click **Structure it** to let AI:

- Detect headings from context
- Rebuild lists, tables, code blocks
- Add emphasis and formatting
- Preserve all original content

> Works great for PDF imports where formatting is lost during text extraction.

### Import via CLI

\`\`\`bash
# Pipe any file content
cat report.md | mw publish
pbpaste | mw publish
\`\`\`

### Import from GitHub

Paste a GitHub URL — repo home, a folder, a single file, or a \`raw.githubusercontent.com/...\` link. memory.wiki fetches every \`.md\` it finds (capped at 80 files / 200 KB each) and creates one doc per file, dropping them into a single bundle so you can open the whole repo as a thinking surface.

Works on:
- \`github.com/owner/repo\` — repo root, recursive
- \`github.com/owner/repo/tree/main/docs\` — single folder
- \`github.com/owner/repo/blob/main/README.md\` — single file
- \`raw.githubusercontent.com/owner/repo/main/path.md\` — raw

### Import an Obsidian vault

Pick **Import Obsidian vault (.zip)** in the sidebar's + menu and upload your vault as a ZIP. memory.wiki walks every \`.md\` file (capped at 80 files / 200 KB each), skips Obsidian's config folders (\`.obsidian/\`, \`.git/\`, macOS resource forks), and imports each note as a draft doc. Re-uploading the same vault deduplicates instead of creating copies — safe to re-run.

> v1 doesn't follow \`[[wikilinks]]\` or rewrite attachments — they come through as plain text. The concept index will still connect notes that share concepts once the ontology refresh catches up.

### Import via Chrome Extension

Click the memory.wiki button on ChatGPT, Claude, or Gemini to capture AI conversations directly.

## Export — Every Destination

Click the **Export** icon in the Live view header (Cmd+Alt+E).

### Download
- **Markdown (.md)** — raw source
- **HTML (.html)** — styled, self-contained
- **Plain Text (.txt)** — formatting stripped

### Print
- **PDF** — via browser print dialog (Cmd+P)

### Clipboard
- **Raw HTML** — for web use
- **Rich Text** — paste into Google Docs, Email, Word with formatting preserved
- **Slack (mrkdwn)** — formatted for Slack channels
- **Plain Text** — no formatting

### Share
- **Permanent URL** — \`memory.wiki/abc123\` — one click to copy
- **Embed** — iframe code for websites
- **QR Code** — for mobile sharing
`;

export const SAMPLE_FEATURES = `# Key Features

## WYSIWYG Editing

Click anywhere in the **MD** view to start editing. Format with the toolbar or keyboard shortcuts.

> No need to learn Markdown syntax — just type naturally.

## Flavor Detection & Conversion

memory.wiki auto-detects your Markdown flavor:

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

## Related in your hub

Under every doc you own, memory.wiki lists **other docs in your hub that share concepts** with the one you're reading — ranked by overlap, with the shared concept labels shown as chips. Built from the auto-extracted concept index, owner-only, and refreshed in the background. No manual wiki maintenance.

## Hub recall + reranker

Open the AI panel in **Hub** mode to chat across your whole hub. Recall fetches candidate chunks via hybrid search (vector + keyword) and a Haiku-based reranker reorders them so the answer cites your most-on-topic passages, not just the lexically nearest ones. Citations link back to the source doc.

## llms.txt + token economy

Every public hub auto-publishes a [\`/llms.txt\`](https://memory.wiki) manifest and a \`/llms-full.txt\` dense bundle so AI agents can discover and ingest your hub the way they do any other site. Append \`?compact\` or \`?digest\` to any \`/raw/\` URL to fetch the same content at a fraction of the token cost — same answer, smaller bill.

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

## Cross-Platform Sync

Your documents sync across all 7 memory.wiki channels:

| Channel | Install | What it does |
|---------|---------|-------------|
| Web | [memory.wiki](https://memory.wiki) | Full editor with AI tools |
| VS Code | \`ext install raymindai.memory-wiki-vscode\` | WYSIWYG preview + sync |
| Mac App | [Download DMG](https://memory.wiki/plugins) | Native sidebar + offline |
| CLI | \`npm install -g memory-wiki-cli\` | Pipe anything to a URL |
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold) | Capture AI conversations |
| MCP | \`npx memory-wiki-mcp\` or hosted at memory.wiki/api/mcp | AI tools integration |
| QuickLook | Bundled with Mac app | Space to preview in Finder |

Same URL, same content, everywhere.
`;

/**
 * Profile-menu flyout row. Renders a hover-target row + an absolutely-
 * positioned submenu that opens to the right. Uses a controlled
 * `open` state with a 120ms close-delay so the cursor can cross the
 * gap between the row and the submenu without dropping hover. The
 * earlier Tailwind `group-hover` version dropped the submenu the
 * moment the cursor left the row's exact bounds — common cause of
 * "hover doesn't work" on nested menus.
 */


export const DOCUMENT_TEMPLATES: { name: string; icon: string; markdown: string }[] = [
  {
    name: "Blank",
    icon: "M4 2h8l4 4v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2z",
    markdown: "# Untitled\n\n",
  },
  {
    name: "Meeting Notes",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
    markdown: `# Meeting Notes

**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
**Attendees:**

---

## Agenda

1.
2.
3.

## Discussion

### Topic 1



### Topic 2



## Action Items

- [ ]
- [ ]
- [ ]

## Next Meeting

**Date:** TBD
`,
  },
  {
    name: "Report",
    icon: "M9 17v-2m3 2v-4m3 4v-6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z",
    markdown: `# Report Title

**Author:**
**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

---

## Executive Summary



## Background



## Findings

### Finding 1



### Finding 2



## Recommendations

1.
2.
3.

## Conclusion

`,
  },
  {
    name: "README",
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    markdown: `# Project Name

> Short description of the project.

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`javascript
import { feature } from 'project-name';

feature();
\`\`\`

## API

### \`feature(options)\`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| \`option1\` | \`string\` | \`""\` | Description |
| \`option2\` | \`boolean\` | \`false\` | Description |

## Contributing

1. Fork the repo
2. Create your feature branch (\`git checkout -b feature/amazing\`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT
`,
  },
  {
    name: "Blog Post",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    markdown: `# Blog Post Title

*Published on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}*

---

Introduction paragraph that hooks the reader.

## The Problem



## The Solution



## How It Works

### Step 1



### Step 2



### Step 3



## Results



## Conclusion



---

*Thanks for reading! Share this post if you found it useful.*
`,
  },
  {
    name: "AI Conversation",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    markdown: `# AI Conversation Summary

**AI:** ChatGPT / Claude / Gemini
**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
**Topic:**

---

## Key Takeaways

1.
2.
3.

## Conversation

### Prompt 1

>

### Response 1



### Prompt 2

>

### Response 2



## Follow-up Questions

- [ ]
- [ ]
`,
  },
];

export const SAMPLE_CHROME_EXT = `# Chrome Extension

> Capture AI conversations from ChatGPT, Claude, and Gemini with one click.

## Install

1. Visit [Chrome Web Store](https://chromewebstore.google.com/detail/mdfycc-%E2%80%94-publish-ai-outpu/nkmkgmebaeaiapjgmmalbeilggfhnold)
2. Click "Add to Chrome"
3. Pin the extension for easy access

## Usage

### Capture from ChatGPT / Claude / Gemini

1. Open any AI conversation
2. Click the **memory.wiki** floating button (bottom-right corner)
3. Conversation is auto-formatted with User/Assistant roles
4. URL is copied to clipboard

### Capture from Any Page

1. Click the memory.wiki icon in the toolbar
2. Select "Capture Page"
3. Page content is converted to Markdown and published

## What Gets Captured

| Source | Format |
|--------|--------|
| ChatGPT | Formatted conversation with roles |
| Claude | Formatted conversation with roles |
| Gemini | Formatted conversation with roles |
| Any webpage | Clean Markdown from page content |
| Selected text | Just the selection |

## Tips

- The floating button only appears on AI chat sites
- All captures are **private by default**
- URLs are permanent — share once, update anytime
`;

export const SAMPLE_VSCODE_EXT = `# VS Code Extension

> WYSIWYG preview, one-click publish, and bidirectional sync.

## Install

\`\`\`bash
ext install raymindai.memory-wiki-vscode
\`\`\`

Or search "memory.wiki" in VS Code Extensions.

## Quick Start

1. Open any \`.md\` file
2. Press **Cmd+Shift+M** to open WYSIWYG preview
3. Press **Cmd+Alt+P** to publish → get a URL
4. Share the URL — recipients see a rendered document

## Features

- **WYSIWYG** — click and type directly in the preview
- **Toolbar** — bold, italic, headings, lists, code, tables
- **Cloud Sync** — push/pull with conflict detection
- **Sidebar** — browse ALL / SYNCED / LOCAL / CLOUD documents
- **AI Tools** — Polish, Summary, TL;DR, Translate, Ask AI
- **Export** — HTML, rich text, Markdown
- **Outline** — document structure panel

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| \`Cmd+Shift+M\` | Open WYSIWYG preview |
| \`Cmd+Alt+P\` | Publish to memory.wiki |
| \`Cmd+Alt+E\` | Export document |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| \`memorywiki.theme\` | \`auto\` | Follows your VS Code theme |
| \`memorywiki.autoSync\` | \`false\` | Auto-push on save |
| \`memorywiki.autoPreview\` | \`true\` | Auto-open preview for .md files |
| \`memorywiki.syncInterval\` | \`30\` | Polling interval (seconds) |
`;

export const SAMPLE_DESKTOP = `# memory.wiki for Mac

> Native desktop app with sidebar, sync, and local rendering.

## Install

1. Download the DMG from [memory.wiki/plugins](https://memory.wiki/plugins)
2. Drag **memory.wiki** to Applications
3. Launch memory.wiki

## Sidebar

| Tab | Contents |
|-----|----------|
| ALL | Everything — local + synced + cloud |
| SYNCED | Local files linked to memory.wiki |
| LOCAL | Unpublished local files |
| CLOUD | Documents on memory.wiki with folders |

## Editing Modes

- **MD** — WYSIWYG editing in rendered preview
- **Split** — Source on left, preview on right
- **Source** — Raw Markdown with CodeMirror

## Publish

Click the orange **Publish** button → URL copied to clipboard.

## Features

- Full rendering engine (same as memory.wiki web)
- KaTeX math, Mermaid diagrams, 190+ language highlighting
- Document outline panel
- Import: PDF, DOCX, PPTX, XLSX, HTML, CSV
- Export: HTML, PDF (print), rich text
- AI tools: Polish, Summarize, Translate, Ask AI
- Dark and light themes
- Offline support
`;

export const SAMPLE_CLI = `# memory.wiki CLI

> Publish Markdown from the terminal. Pipe anything to a URL.

## Install

\`\`\`bash
npm install -g memory-wiki-cli
\`\`\`

## Publish

\`\`\`bash
# Publish a file
mw publish README.md
# → https://memory.wiki/abc123  (copied to clipboard)

# Publish from pipe
echo "# Hello World" | mw publish

# Publish clipboard
pbpaste | mw publish
\`\`\`

## Pipe Anything

\`\`\`bash
claude "explain React hooks" | mw publish
git log --oneline -20 | mw publish
man grep | mw publish
curl -s https://api.example.com/status | mw publish
\`\`\`

## Read in Terminal

\`\`\`bash
memory.wiki read abc123
# → Color-coded headings, bold, code blocks, lists
\`\`\`

## Manage Documents

\`\`\`bash
memory.wiki list                       # List your documents
memory.wiki update abc123 updated.md   # Update
memory.wiki pull abc123 -o doc.md      # Download
memory.wiki delete abc123              # Delete
memory.wiki open abc123                # Open in browser
\`\`\`

## tmux Integration

Add to \`~/.tmux.conf\`:

\`\`\`bash
bind-key M run-shell "tmux capture-pane -p -S -1000 | mw publish"
\`\`\`

## Short Aliases

| Short | Full |
|-------|------|
| \`memory.wiki p\` | \`memory.wiki publish\` |
| \`memory.wiki ls\` | \`memory.wiki list\` |
| \`memory.wiki rm\` | \`memory.wiki delete\` |
| \`memory.wiki cat\` | \`memory.wiki read\` |
`;

export const SAMPLE_MCP = `# MCP Server

> Let AI tools create, read, and manage documents on memory.wiki.

## What is MCP?

MCP (Model Context Protocol) lets AI tools call external APIs. The memory.wiki MCP server gives Claude the ability to publish and manage documents.

## Setup

### Option A: Hosted HTTP MCP (recommended)

For **Claude Web**, **Cursor**, **Windsurf**:

1. Go to Settings → Integrations / MCP
2. Add server URL: \`https://memory.wiki/api/mcp\`
3. Done — 25 tools available

### Option B: Local stdio MCP

For **Claude Code** and **Claude Desktop**:

\`\`\`bash
npx memory-wiki-cli login
\`\`\`

Add to \`.mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "memory.wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
\`\`\`

## Usage Examples

\`\`\`
You: "Publish my meeting notes to memory.wiki"
Claude: → mw_create → https://memory.wiki/abc123

You: "Show me my documents"
Claude: → mw_list → 8 documents found

You: "Make that document private"
Claude: → mw_publish(published: false) → Now private

You: "Update it with this new section"
Claude: → mw_update → Document updated, same URL
\`\`\`

## Available Tools

| Tool | Description |
|------|-------------|
| \`mw_create\` | Create document, get URL |
| \`mw_read\` | Read document content |
| \`mw_update\` | Update document |
| \`mw_list\` | List your documents |
| \`mw_publish\` | Toggle public/private |
| \`mw_delete\` | Delete document |

The hosted HTTP MCP exposes 25 tools including append, sections, versions, folders, and more.
`;

export const SAMPLE_FRESHNESS = `# How memory.wiki keeps your docs, bundles, and hub fresh

> Every memory.wiki URL is what the AI reads when you paste it. Freshness is part of the deal.

## TL;DR

| Layer | What | How fresh | Click anything? |
| --- | --- | --- | --- |
| **Document body** | The markdown you wrote | Always — within ~60 seconds of save | Nothing. Just save. |
| **Bundle graph** | AI-generated themes / insights | Stays until a member doc's content changes | "Re-analyze with AI" in the bundle header |
| **Hub concept index** | Cross-doc "related" map | Auto-extracts in seconds; 30-min cooldown per doc | "Re-analyze (N)" banner when stale |

Body markdown is always fresh. The AI-derived layers occasionally need a nudge.

## Document body — always fresh

Save a doc → \`/raw/{id}\` and \`/d/{id}\` see it within ~60 seconds via the edge cache's stale-while-revalidate. **No action needed.**

## Bundle graph — Re-analyze on demand

The graph is computed once with an LLM pass over member docs and stamped with \`graph_generated_at\`. When a member doc's content (not its permissions) has changed since then, the bundle is stale — click **Re-analyze with AI** in the header.

We don't auto-rebuild because graphs cost real LLM calls and you're usually mid-edit. **You decide when it's worth re-running.**

## Hub concept index — automatic, with two guardrails

Every save fires:

1. **Enqueue** an ontology job (deduped at the DB level)
2. **Fast-path** run inside Vercel's \`after()\` — usually done in seconds
3. **Cron backstop** picks up pending rows if the instance dies

Normal flow: concept changes show up in the hub URL within seconds. Two guardrails can make things look stale temporarily:

- **30-min per-doc cooldown** — back-to-back edits don't re-run the LLM
- **200-char minimum delta** — typo-level edits skip extraction

## The "Re-analyze (N)" banner

When the Hub opens, memory.wiki compares \`concepts_built_at\` (last successful job) against \`docs_touched_at\` (latest doc content change). If stale you see:

> 🟡 Concepts out of date · N docs have changed
> [Re-analyze (N)]

Clicking it:

- **Only re-extracts the N docs that actually changed.** Unchanged docs skip the LLM entirely.
- **Caps at 50 per click.** The rest stay queued; the cron worker drains them.
- **Bypasses the 30-min cooldown** — that's why you clicked.

A Re-analyze click is cheap: at most 50 short LLM calls for the docs that genuinely changed.

## Doc-level Re-analyze

Right-click any doc in the sidebar → **Re-analyze concepts**. Same machinery, scoped to one doc, bypasses cooldown. Use when you've been polishing in tight cycles and want the hub to keep up.

## When clicking is worth it

- You bulk-imported or edited many docs and want the hub's concept map to reflect the new shape *right now*
- The yellow banner appears and you're about to share your hub URL with an AI
- You added a doc on a new topic and want it surfaced as "related" immediately

## When you don't need to click anything

- You edited a doc and shared its URL — the receiving AI sees your edits within ~60s, concept attribution catches up automatically
- You haven't touched anything (just reading) — nothing to refresh
- You're not signed in — no concept index applies

## Why memory.wiki doesn't auto-rebuild more aggressively

**Cost discipline.** Concept extraction is a Haiku call per doc. Auto-rebuilding on every save would burn tokens during noisy editing.

**Predictability.** When something changes in your hub, you chose for it to change. Implicit background rebuilds make "why does my AI see X?" hard to debug.

The trade: body markdown is aggressive-fresh (always, no click). AI-derived metadata is fast-but-not-instant with explicit override available.
`;

export const SAMPLE_QUICKLOOK = `# QuickLook Preview

> Press Space on any .md file in Finder to see a rendered preview.

## Install

1. Install memory.wiki for Mac — QuickLook is bundled automatically
2. Or download MdfyQuickLook separately from [memory.wiki/plugins](https://memory.wiki/plugins)
3. Enable in **System Settings → Extensions → Quick Look**

## Usage

1. Open Finder
2. Select any \`.md\` file
3. Press **Space**
4. See the rendered preview with syntax highlighting, tables, and math

## What You See

- Rendered Markdown with proper typography
- Syntax-highlighted code blocks
- Tables with alignment
- KaTeX math equations
- Dark / light theme (follows system preference)
- "Open on memory.wiki" button

## Supported Files

| Extension | Supported |
|-----------|-----------|
| \`.md\` | Yes |
| \`.markdown\` | Yes |
| \`.mdown\` | Yes |
| \`.mkd\` | Yes |

## Tips

- Works in Finder, Desktop, and Open/Save dialogs
- Preview updates when you press Space again after editing
- Click "Open on memory.wiki" to publish directly from the preview
- No background processes — lightweight QuickLook extension
`;

export const SAMPLE_BUNDLES = `# Bundles, Discoveries, Compile & Concepts

Beyond single docs, memory.wiki lets you cluster related documents into a **Bundle** and treat them as a single thinking surface. The bundle isn't a folder — it actively analyzes its contents, surfaces what they collectively say, and lets you compile new artifacts out of them.

## Bundles: from folder to thinking surface

Select multiple docs in the sidebar, choose **Bundle**, and you get a bundle URL like \`memory.wiki/b/xxxx\`. Open it and the docs render as nodes on a **Knowledge Constellation** — a 3D-style force-directed graph that shows how documents and their concepts interconnect.

Bundle viewer modes:
- **Canvas** — the spatial constellation, drag/zoom/pan, click nodes to inspect
- **List** — sequential reading view with table of contents

## Intent: the North Star of a bundle

A bundle isn't just *what* you collected — it's *why*. At the top of the Discoveries panel you can set the **Intent**:

> *"Decide our SNS launch strategy"*

The intent feeds into every AI prompt — bundle-level analysis weights themes/insights/gaps by relevance to your question, per-doc decomposition labels chunks by their importance to the intent. Without intent, AI gives generic summaries. With intent, it gives you decision-grade output.

## Discoveries: the bundle talks first

Open any bundle and the right panel shows **Discoveries** — what the bundle wants to tell you. Sections that surface automatically once you click "Run discovery":

| Section | What it surfaces |
|---------|------------------|
| 🔥 Tensions | Chunks that contradict each other across docs |
| 💡 Insights | Non-obvious patterns the AI noticed reading them together |
| ❓ Open Questions | Unresolved questions raised in the source material |
| ❓ Gaps | What this collection doesn't cover but should |
| 🔗 Connections | Doc-to-doc relationships ("doc-A frames what doc-B critiques") |
| 🌿 Threads | Concepts that recur across multiple docs |

Click any item → the canvas flies to the relevant chunk and pulses it. Tensions get an **Resolve with AI** button that generates a reconciliation paragraph in place.

## Decompose: split a doc into semantic chunks

Right-click a document node on the canvas → **Decompose into sections**. The AI breaks the document into typed chunks — \`concept\` (cyan), \`claim\` (orange), \`example\` (green), \`definition\` (blue), \`task\` (yellow), \`question\` (purple), \`evidence\` (pink), \`context\` (gray) — each connected by typed relationships (\`supports\`, \`elaborates\`, \`contradicts\`, \`exemplifies\`).

Inside the decomposed view you can:
- **Edit** chunk content inline (verbatim find-and-replace into source doc)
- **Cmd-click** multiple chunks → bulk Copy / Extract → new doc / Branch → new doc / Delete
- **Drag** a chunk onto another to reorder its position in the source doc
- **Add chunk** — append a new chunk that gets re-classified on next analyze

Or use the **sidebar Decompose tab** — same data, vertical list editor for focused doc work without the constellation.

## Compile: synthesis becomes a permanent artifact

From the canvas top toolbar, hit **Memo / FAQ / Brief** to synthesize the entire bundle into a coherent output:

- **Memo** — 1-page decision-ready memo (Headline, TL;DR, Key findings, Tensions, Gaps, Recommendations)
- **FAQ** — 5–10 synthesized questions and answers across docs
- **Brief** — 400-600 word narrative essay tying the bundle together

Click **Save as document** and the result becomes a *compiled entry*: a normal doc that **remembers its source bundle** and intent. Compiled docs get a **\`Compiled — Memo\`** badge in the editor header and a **\`↻ Recompile\`** button — when source docs change, one click regenerates the synthesis with the latest content.

This is the Karpathy-style "compile knowledge once, query forever" loop, applied to your bundle.

## Concepts: the cross-doc index

In the left sidebar, the **Concepts** section shows every concept that appears in your decomposed docs. Concepts in 2+ docs (cross-linked) get an **orange dot**; single-doc concepts get a faded dot.

Click any concept → drawer with all citations across your library:

\`\`\`
AI Memory Ownership — 4 docs, 7 mentions
  ┌─ "memory.wiki V2"           [concept] excerpt…
  ├─ "Bundle Strategy Brief"    [definition] excerpt…
  └─ "Launch Plan"              [concept] excerpt…
\`\`\`

Click any citation → opens the source doc as a tab. This is your personal knowledge graph — it grows automatically as you add and decompose docs. No manual wiki maintenance needed.

The home screen shows compounding stats:

> **64 docs, 47 concepts, 23 cross-linked**
>
> 23 concepts connect multiple docs in your library.

## Workflow recap

1. Drop or write docs → **Library** grows
2. Group related docs into a **Bundle** → set its **Intent**
3. **Run discovery** → AI surfaces tensions, insights, gaps, connections
4. Click chunks to **decompose**, edit, recombine
5. **Compile** Memo / FAQ / Brief → save as a compiled doc
6. **Concepts** auto-index across the library → cross-doc references emerge

The bundle is no longer a folder. It's a thinking partner that reads what you've gathered and tells you what it sees.
`;

// Server-seeded "Sample Bundle: Tour of memory.wiki". The bundle row and its
// 3 member docs are inserted by supabase/migrations/033_example_bundle.sql
// with fixed ids (mw-ex-bundle / mw-ex-fmt / mw-ex-diag / mw-ex-feat),
// so this id can be hardcoded on the client. Listed in EXAMPLE_TABS as a
// kind="bundle" entry so first-time visitors can click it in
// Guides & Examples and immediately see an interactive bundle —
// canvas analysis, member-doc list, the full bundle viewer flow.
export const EXAMPLE_BUNDLE_ID = "mw-ex-bundle";

export const SAMPLE_AI_CAPTURE = `# Capture AI conversations

memory.wiki is built around the idea that the answers you got out of an AI today are worth keeping — and worth deploying back into another AI tomorrow.

## Three ways in

### 1. Paste a share URL

Paste a ChatGPT, Claude, or Gemini share URL directly into the editor. memory.wiki fetches the conversation and converts it into clean markdown — code blocks, headings, and quotes preserved.

\`\`\`
https://chat.openai.com/share/abc-...
https://claude.ai/share/xyz-...
\`\`\`

### 2. Drop a transcript

Copied a chat thread to clipboard? Paste it. memory.wiki auto-detects ChatGPT / Claude / Gemini formats and structures the turns for you (User: / Assistant:) so the result reads like a real document, not a wall of text.

### 3. Capture from where you work

- **\`/memory.wiki capture\`** in Claude Code, Cursor, Codex, or Aider — saves the current conversation segment as a permanent URL.
- **Chrome extension** — one-click capture from any AI web UI.
- **API / MCP** — agents can write into your hub directly.

## Why it matters

Every captured doc lives at a permanent URL like \`memory.wiki/abc123\`. Captures roll up into your hub at \`memory.wiki/hub/<you>\`. That URL is the universal context format — paste it back into any AI and they read your full personal knowledge layer.

> The answer you didn't save is the context the next AI session won't have.
`;

export const EXAMPLE_OWNER = "master@mdfy.app";
export const EXAMPLES_FOLDER_ID = "folder-shared-examples";

export const INITIAL_FOLDERS: Folder[] = [];

export const EXAMPLE_TABS: Tab[] = [
  { id: "tab-welcome", title: extractTitleFromMd(SAMPLE_WELCOME), markdown: SAMPLE_WELCOME, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-ai-capture", title: extractTitleFromMd(SAMPLE_AI_CAPTURE), markdown: SAMPLE_AI_CAPTURE, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-bundles", title: extractTitleFromMd(SAMPLE_BUNDLES), markdown: SAMPLE_BUNDLES, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  // Real interactive bundle, server-seeded (033_example_bundle.sql).
  // Markdown is "" because BundleEmbed fetches member docs by bundleId,
  // not from this tab's local body. readonly:true so the tab persists
  // across sessions like other Guides & Examples entries.
  { id: "tab-ex-bundle", kind: "bundle", bundleId: EXAMPLE_BUNDLE_ID, title: "Sample Bundle: Tour of memory.wiki", markdown: "", readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-import", title: extractTitleFromMd(SAMPLE_IMPORT_EXPORT), markdown: SAMPLE_IMPORT_EXPORT, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-features", title: extractTitleFromMd(SAMPLE_FEATURES), markdown: SAMPLE_FEATURES, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-syntax", title: extractTitleFromMd(SAMPLE_FORMATTING), markdown: SAMPLE_FORMATTING, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-diagrams", title: extractTitleFromMd(SAMPLE_DIAGRAMS), markdown: SAMPLE_DIAGRAMS, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-ascii", title: extractTitleFromMd(SAMPLE_ASCII), markdown: SAMPLE_ASCII, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-chrome-ext", title: extractTitleFromMd(SAMPLE_CHROME_EXT), markdown: SAMPLE_CHROME_EXT, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-vscode-ext", title: extractTitleFromMd(SAMPLE_VSCODE_EXT), markdown: SAMPLE_VSCODE_EXT, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-desktop", title: extractTitleFromMd(SAMPLE_DESKTOP), markdown: SAMPLE_DESKTOP, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-cli", title: extractTitleFromMd(SAMPLE_CLI), markdown: SAMPLE_CLI, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-mcp", title: extractTitleFromMd(SAMPLE_MCP), markdown: SAMPLE_MCP, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-quicklook", title: extractTitleFromMd(SAMPLE_QUICKLOOK), markdown: SAMPLE_QUICKLOOK, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
  { id: "tab-freshness", title: extractTitleFromMd(SAMPLE_FRESHNESS), markdown: SAMPLE_FRESHNESS, readonly: true, permission: "readonly", ownerEmail: EXAMPLE_OWNER },
];

export const INITIAL_TABS: Tab[] = [
  ...EXAMPLE_TABS,
];

// Fast lookup for "is this tab id one of the bundled examples?".
// Used by the activeTabId restore logic to drop stale example-tab
// ids that older sessions left in localStorage.
export const EXAMPLE_TAB_IDS = new Set(EXAMPLE_TABS.map(t => t.id));
