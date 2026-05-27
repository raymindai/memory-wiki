# Memory.Wiki

## The fastest way from thought to shared document.

**Markdown URLs that humans write and AI reads.** Capture from any AI tool. Share anywhere with a permanent short URL.

[![Live](https://img.shields.io/badge/memory.wiki-live-orange)](https://memory.wiki)
[![VS Code](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode)
[![MCP](https://img.shields.io/badge/MCP-npm-red)](https://www.npmjs.com/package/memory-wiki-mcp)
[![CLI](https://img.shields.io/badge/CLI-npm-green)](https://www.npmjs.com/package/memory-wiki-cli)

---

## What is this?

**Memory.Wiki** is a document platform with one promise: every document gets a permanent short URL (`memory.wiki/abc123`) that works everywhere — browsers, AI chats, Slack, email, embeds. No login to view. No paywall.

It ships across 7 channels, all driven by the same shared rendering pipeline (markdown-it + highlight.js + KaTeX + Mermaid) so a doc looks identical wherever you open it.

## 7 Channels

| Channel | Status | Install |
|---------|--------|---------|
| [**Web**](https://memory.wiki) | Live | Just open Memory.Wiki |
| [**VS Code**](https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode) | v1.4.0 | Marketplace |
| **Desktop (Mac)** | v2.2.0 | DMG from releases |
| [**CLI**](https://www.npmjs.com/package/memory-wiki-cli) | v1.3.x | `npm install -g memory-wiki-cli` |
| [**MCP Server**](https://www.npmjs.com/package/memory-wiki-mcp) | v1.3.x | `npx memory-wiki-mcp` or hosted `memory.wiki/api/mcp` |
| **Chrome Extension** | v2.x | Web Store |
| **QuickLook (Mac)** | Bundled with Desktop DMG | — |
| **API** | Live | `https://memory.wiki/api/docs` |

## Features

### Editor
- **MD** — WYSIWYG editing on the rendered preview (TipTap / ProseMirror)
- **Source** — CodeMirror 6 with Markdown syntax highlighting
- **Split** — side-by-side MD + Source
- **Floating toolbar** — context-aware formatting on text selection
- **Mermaid visual editor** — drag-and-drop flowchart canvas

### Import (13+ formats)
- Documents — MD, PDF, DOCX, PPTX, XLSX, HTML, RTF
- Data — CSV, JSON, XML
- Academic — LaTeX, reStructuredText
- AI output — auto-detects ChatGPT/Claude/Gemini conversations
- CLI output — auto-detects terminal tables and unicode formatting

### Export
- Download — Markdown, HTML, Plain Text
- Print — PDF via browser print (custom print CSS)
- Clipboard — Raw HTML, Rich Text (Google Docs/Email), Slack mrkdwn
- Share — Short URL, QR Code, Embed code (iframe)

### Rendering
- **Full GFM** — tables, task lists, footnotes, strikethrough, autolinks
- **Math** — KaTeX inline (`$...$`) and display (`$$...$$`)
- **Mermaid** — flowcharts, sequence, gantt, class, state diagrams
- **190+ languages** — syntax highlighting via highlight.js
- **ASCII diagrams** — auto-detect and style box-drawing characters

### Sharing & Access
- Owner-only editing model
- Password protection + expiry dates
- Email allowlist for restricted access
- View count tracking

### Auth
- Google / GitHub OAuth + Email magic link
- Anonymous editing (no login required to create)
- Cloud sync across devices, real-time collaboration (Yjs CRDT)

## CLI

```bash
# Publish a file
Memory.Wiki publish README.md

# Pipe from any command
echo "# Hello" | Memory.Wiki publish
tmux capture-pane -p | Memory.Wiki publish
pbpaste | Memory.Wiki publish

# Manage documents
Memory.Wiki list
Memory.Wiki read abc123
Memory.Wiki update abc123 updated.md
Memory.Wiki search "meeting notes"
Memory.Wiki pull abc123 -o doc.md
```

## MCP Server

Connect any AI tool to memory.wiki:

```json
{
  "mcpServers": {
    "Memory.Wiki": {
      "command": "npx",
      "args": ["memory-wiki-mcp"]
    }
  }
}
```

Or use the hosted endpoint: `https://memory.wiki/api/mcp`

25 tools: create, read, update, delete, list, search, append, prepend, sections, sharing, versions, folders, stats, and more.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web App | Next.js 15 + React 19 + TailwindCSS v4 |
| Editor | TipTap (ProseMirror) |
| Source Editor | CodeMirror 6 |
| Markdown | markdown-it + markdown-it-footnote |
| Math | KaTeX |
| Code Highlighting | highlight.js |
| Diagrams | Mermaid.js |
| Desktop | Electron |
| VS Code | Extension API + WebView |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (Yjs CRDT) |
| Hosting | Vercel |

## Quick Start

```bash
# Run the web app
cd apps/web
npm install
npm run dev    # → http://localhost:3000

# Build Desktop DMG (requires Developer ID cert + notarize creds)
cd apps/desktop
npm run build:dmg

# Publish VS Code extension
cd apps/vscode-extension
npx @vscode/vsce publish
```

## Project Structure

```text
mdcore/
├── apps/
│   ├── web/                  # Next.js 15 (Memory.Wiki)
│   ├── desktop/              # Electron Mac app
│   ├── vscode-extension/     # VS Code extension
│   ├── chrome-extension/     # Chrome extension
│   ├── cli/                  # memory-wiki-cli (npm)
│   └── quicklook/            # macOS QuickLook
├── packages/
│   └── mcp/                  # memory-wiki-mcp (npm)
├── docs/                     # Architecture, roadmap, manifesto
└── .github/workflows/        # CI/CD
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘K | Insert link / Command palette |
| ⌘S | Share / copy URL |
| ⌘⇧C | Copy HTML |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘\\ | Toggle view mode |
| ⌘Enter | Exit block (quote/list/code) |
| Alt+1/2/3 | MD / Split / Source |
| Dbl-click | Edit code/math/diagram/table |

## License

MIT

---

**Memory.Wiki** — *The fastest way from thought to shared document.*

[Memory.Wiki](https://memory.wiki) · [Docs](https://memory.wiki/docs) · [Plugins](https://memory.wiki/plugins) · [GitHub](https://github.com/raymindai/memory-wiki)
