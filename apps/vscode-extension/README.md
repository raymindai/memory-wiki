# Memory.Wiki -- Markdown Publisher for VS Code

**Write Markdown in VS Code. Publish as a beautiful web document. Share a permanent URL.**

![Memory.Wiki WYSIWYG Preview](https://memory.wiki/images/plugin-vscode.webp)

Memory.Wiki turns your Markdown files into shareable, beautifully rendered documents with a permanent URL -- directly from VS Code. No copy-pasting into Google Docs. No screenshots. No "can you open this .md file?" conversations.

Powered by a Rust + WASM rendering engine with GFM, KaTeX math, Mermaid diagrams, and 190+ language syntax highlighting. The same engine that powers [Memory.Wiki](https://memory.wiki), the Chrome extension, and the Mac desktop app.

---

## Table of Contents

- [Why Memory.Wiki?](#why-mdfy)
- [Features](#features)
- [Getting Started](#getting-started)
- [Commands](#commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Settings](#settings)
- [AI Tools](#ai-tools)
- [How Sync Works](#how-sync-works)
- [Use Cases](#use-cases)
- [Memory.Wiki Ecosystem](#mw-ecosystem)
- [FAQ](#faq)

---

## Why Memory.Wiki?

VS Code's built-in Markdown preview is read-only and local. Memory.Wiki gives you:

| | Built-in Preview | Memory.Wiki Preview |
|--|-----------------|--------------|
| Edit in preview | No | Yes -- click and type directly |
| Share with others | No | Yes -- one-click URL |
| Math equations | No | Yes -- KaTeX inline and display |
| Mermaid diagrams | No | Yes -- flowcharts, sequences, gantt |
| Cloud sync | No | Yes -- push/pull with conflict detection |
| AI tools | No | Yes -- polish, summarize, translate |
| Code highlighting | Basic | 190+ languages with theme support |

---

## Features

### WYSIWYG Preview

Press **Cmd+Shift+M** to open the Memory.Wiki preview panel. Unlike the built-in preview, you can **edit directly in the rendered view**.

- Click any text to edit it in place
- Formatting toolbar appears on selection: bold, italic, headings, lists, links, code, tables
- Changes sync back to your `.md` source file in real time
- Toggle between **Live** (rendered) and **Source** (raw Markdown) views
- Dark and light themes -- automatically follows your VS Code color theme

### Rich Rendering

Every Markdown feature you need, rendered correctly:

**GFM (GitHub Flavored Markdown)**
- Tables with alignment
- Task lists with checkboxes
- Strikethrough, autolinks, footnotes
- Definition lists

**Math (KaTeX)**
- Inline math: `$E = mc^2$` renders as formatted equation
- Display math blocks: `$$\int_0^\infty e^{-x} dx = 1$$`
- Automatic detection -- no special syntax needed beyond `$`

**Diagrams (Mermaid)**
- Flowcharts, sequence diagrams, gantt charts
- Class diagrams, state diagrams, pie charts
- Dark theme matching your VS Code colors
- ASCII diagrams with "Convert to Mermaid" option

**Code Blocks**
- 190+ languages with automatic detection
- Syntax highlighting that matches your theme
- Copy button on each code block
- Line numbers for long blocks

### Document Outline

Click the **Outline** button in the preview toolbar to open a document structure panel. It lists all headings (H1-H6) with indentation matching their hierarchy. Click any heading to scroll directly to it in the preview, with a brief highlight animation. The outline updates automatically as you edit.

### One-Click Publish

Turn any `.md` file into a shareable URL in one click.

1. Open a `.md` file
2. **Cmd+Alt+P** or right-click > **Publish to Memory.Wiki**
3. URL is generated: `memory.wiki/abc123`
4. URL is copied to clipboard -- paste it anywhere

**No account required** for basic publishing. The recipient sees a beautifully rendered document in their browser -- they don't need VS Code, Markdown knowledge, or an account.

### Cloud Sync

Keep your local files in sync with the published version.

- **Auto-push on save** -- your published document updates when you save locally (configurable)
- **Pull remote changes** -- if someone edits on Memory.Wiki, pull the changes to your local file
- **Conflict detection** -- when both sides change, VS Code's diff editor opens with three merge options: pull, push, or view diff
- **Offline queue** -- if you save while offline, changes are queued and pushed when you reconnect
- **Status bar indicator** -- always shows the current state: synced, pushing, pulling, or conflict

### Sidebar

Browse all your documents in one place.

Click the Memory.Wiki icon in the Activity Bar to open the sidebar:

- **Local files** -- all `.md` files in your workspace with sync status
- **Synced documents** -- locally edited files that are published to Memory.Wiki
- **Cloud documents** -- documents on Memory.Wiki that you can pull locally
- **Cloud folders** -- organized with expand/collapse
- **Search** -- filter across all document types
- **File path** -- hover to see full path, click to open
- **Right-click menu** -- publish, sync, open in browser, unsync

### Export

Export your rendered document in multiple formats:

- **HTML** -- self-contained HTML file with all styles embedded
- **Rich text** -- paste into Google Docs, Word, or email with formatting preserved
- **Markdown** -- copy raw Markdown to clipboard

Keyboard shortcut: **Cmd+Alt+E**

---

## Getting Started

### Quick Start (no account needed)

1. Install this extension from the Marketplace
2. Open any `.md` file
3. Press **Cmd+Shift+M** to preview
4. Press **Cmd+Alt+P** to publish and get a URL

### With Account (for sync and AI)

1. Open Command Palette (**Cmd+Shift+P**)
2. Run **memory.wiki: Login to Memory.Wiki**
3. Browser opens for Google or GitHub OAuth
4. You're authenticated -- sync and AI features are now available

---

## Commands

All commands are available via Command Palette (**Cmd+Shift+P**, type "Memory.Wiki"):

| Command | Description |
|---------|-------------|
| **memory.wiki: Preview (WYSIWYG)** | Open live preview with inline editing |
| **memory.wiki: Publish to Memory.Wiki** | Publish and get a shareable URL |
| **memory.wiki: Push to Memory.Wiki** | Push local changes to cloud |
| **memory.wiki: Pull from Memory.Wiki** | Pull latest version from cloud |
| **memory.wiki: Export** | Export to HTML or rich text |
| **memory.wiki: Login to Memory.Wiki** | Authenticate for account features |
| **memory.wiki: Sync Status** | Show current sync state |
| **memory.wiki: AI Polish** | Improve writing quality and clarity |
| **memory.wiki: AI Summary** | Generate a concise summary |
| **memory.wiki: AI TL;DR** | Extract key bullet points |
| **memory.wiki: AI Translate** | Translate to a specified language |
| **memory.wiki: Ask AI to Edit** | Describe changes in natural language |

All commands are also available in the right-click context menu when editing a Markdown file.

---

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Cmd+Shift+M` | Open WYSIWYG preview |
| `Cmd+Alt+P` | Publish to Memory.Wiki |
| `Cmd+Alt+E` | Export document |

---

## Settings

Configure via VS Code Settings (Cmd+,) under "Memory.Wiki":

| Setting | Default | Description |
|---------|---------|-------------|
| `memorywiki.theme` | `auto` | Preview theme. `auto` follows VS Code's color theme. Options: `auto`, `dark`, `light` |
| `memorywiki.autoSync` | `false` | Automatically push changes on file save |
| `memorywiki.autoPreview` | `true` | Automatically open Memory.Wiki preview when opening a .md file |
| `memorywiki.syncInterval` | `30` | Polling interval for remote changes (seconds, 10-300) |
| `memorywiki.apiBaseUrl` | `https://memory.wiki` | API endpoint (for self-hosted instances) |

---

## AI Tools

Five AI-powered tools to enhance your documents, available both as commands and in a dedicated side panel. Requires login.

### AI Side Panel

Click the **AI** button in the preview toolbar to open the AI panel alongside your document. The panel provides:

- **Quick actions** -- Polish, Summary, TL;DR, and Translate in a 2x2 grid
- **Chat input** -- describe changes in natural language, AI edits your document directly
- **Undo** -- revert the last AI change with one click
- **Diff highlighting** -- changed blocks are briefly highlighted in orange after AI edits

The AI panel, Outline panel, and Image panel are mutually exclusive -- opening one closes the others.

### AI Polish

Rewrites your document for clarity, grammar, and professional tone while preserving the original meaning and structure.

```
Before: "the system is kinda slow when lots of users connect at same time"
After:  "The system experiences performance degradation under high concurrent user load"
```

### AI Summary

Generates a concise summary of your document, capturing the key points and conclusions.

### AI TL;DR

Extracts the essential takeaways as bullet points. Useful for long documents, meeting notes, or research papers.

### AI Translate

Translates your document to any language. A prompt asks for the target language, then the entire document is translated while preserving Markdown formatting, code blocks, and technical terms.

### Ask AI to Edit

Describe what you want to change in natural language:

```
"Add a table comparing React vs Vue vs Svelte"
"Convert the bullet points in section 3 to a numbered list"
"Add error handling examples to all the code blocks"
```

The AI modifies your document based on the instruction. The change is applied directly to your Markdown source -- undo with Cmd+Z if needed.

---

## How Sync Works

### The .memorywiki.json sidecar

When you publish a file, a `.memorywiki.json` is created next to your `.md` file:

```json
{
  "docId": "abc123",
  "editToken": "...",
  "lastSyncedAt": "2026-04-21T12:00:00Z",
  "lastSyncedHash": "a1b2c3..."
}
```

This file tracks sync state. Add it to `.gitignore` if you don't want it in version control.

### Sync flow

```
Local save --> auto-push (if enabled) --> Memory.Wiki updated
                                              |
Someone edits on Memory.Wiki                      |
                                              v
Polling detects change --> pull notification --> accept or diff
```

### Conflict resolution

When both local and remote have changed:

1. VS Code notification appears: "Document has remote changes"
2. Three options:
   - **Pull** -- overwrite local with remote
   - **Push** -- overwrite remote with local
   - **Diff** -- open VS Code's diff editor to merge manually

---

## Use Cases

### Share technical documentation

Write your README, API docs, or architecture decisions in VS Code. Publish to Memory.Wiki. Share the URL with your team. They see a beautifully rendered document -- no `.md` file viewer needed.

### Capture and refine AI output

Use the [Chrome extension](https://memory.wiki/plugins) to capture an AI conversation. Pull it into VS Code for editing. Push refined version back. The URL stays the same.

### Publish from CI/CD

Use the [CLI](https://www.npmjs.com/package/memory-wiki-cli) in your pipeline to auto-publish documentation on every commit. Edit locally in VS Code when needed.

### Cross-AI knowledge base

Publish a document from VS Code. Paste the URL into any AI conversation. Claude, ChatGPT, and Gemini can all read Memory.Wiki URLs. For programmatic access from Claude Web, Cursor, or Windsurf, point them at the [hosted MCP](https://memory.wiki/docs/mcp) at `https://memory.wiki/api/mcp` — or install the [local stdio MCP](https://www.npmjs.com/package/memory-wiki-mcp) for Claude Desktop.

### Meeting notes to shareable document

Take notes in Markdown during a meeting. When done, Cmd+Alt+P to publish. Share the URL in Slack. Recipients see formatted notes with tables, checklists, and code blocks -- not raw Markdown.

---

## Memory.Wiki Ecosystem

Memory.Wiki is a cross-platform document publishing system. All platforms share the same rendering engine and the same document URLs.

| Platform | What it does | Install |
|----------|-------------|---------|
| **[Web Editor](https://memory.wiki)** | Full editor with WYSIWYG, image gallery, AI tools | [Memory.Wiki](https://memory.wiki) |
| **VS Code** | Preview, publish, sync from your editor | You are here |
| **[Mac Desktop](https://memory.wiki/plugins)** | Native app with sidebar, file import (PDF, DOCX, PPTX) | [Download DMG](https://github.com/raymindai/memory-wiki/releases) |
| **[Chrome Extension](https://memory.wiki/plugins)** | Capture from ChatGPT, Claude, Gemini, GitHub | [Download](https://memory.wiki/plugins) |
| **[CLI](https://www.npmjs.com/package/memory-wiki-cli)** | `Memory.Wiki publish`, pipe support, tmux capture | `npm i -g memory-wiki-cli` |
| **[Hosted MCP](https://memory.wiki/docs/mcp)** | AI agents (Claude Web, Cursor) — 25 tools | URL: `https://memory.wiki/api/mcp` |
| **[Local MCP](https://www.npmjs.com/package/memory-wiki-mcp)** | AI agents (Claude Desktop, Code) — 6 core tools | `npx memory-wiki-mcp` |
| **[QuickLook](https://memory.wiki/plugins)** | Press Space on .md in Finder for rendered preview | [Download](https://github.com/raymindai/memory-wiki/releases) |
| **tmux** | Capture pane output and publish | [Install guide](https://github.com/raymindai/memory-wiki/tree/main/apps/tmux) |

### The URL is the bridge

Every Memory.Wiki document has a permanent short URL (`memory.wiki/abc123`). This URL:

- Renders beautifully in any browser
- Is readable by any AI -- paste `memory.wiki/abc123` into Claude or ChatGPT and they can read the full content
- Can be embedded in websites via iframe (`memory.wiki/embed/abc123`)
- Updates in place when you push changes

---

## FAQ

**Q: Do I need an account to publish?**
A: No. You can publish without logging in. The document gets a permanent URL and an edit token (stored locally). Login is needed for cloud sync, document listing, and AI tools.

**Q: Is my Markdown sent to a server?**
A: Rendering happens entirely in your browser via WASM. When you publish, the Markdown is stored on Memory.Wiki (Supabase PostgreSQL). Documents can be private or public.

**Q: Can I use this with private/internal documents?**
A: Yes. Published documents are public by default but can be made private (draft) from the web editor. Documents can also be password-protected or restricted to specific email addresses.

**Q: What happens if I uninstall the extension?**
A: Your local `.md` files are unchanged. Published documents remain on Memory.Wiki. The `.memorywiki.json` sidecar files can be deleted.

**Q: Does it work with existing Markdown extensions?**
A: Yes. Memory.Wiki adds its own preview panel and does not interfere with the built-in Markdown preview or other extensions.

**Q: How is this different from GitHub Gists?**
A: Memory.Wiki renders Markdown with KaTeX math, Mermaid diagrams, and full GFM. It has WYSIWYG editing, AI tools, bidirectional sync, and works across 9 platforms. Gists are static text files.

**Q: Can AI read my published documents?**
A: Yes. Paste any Memory.Wiki URL into Claude or ChatGPT and they can read the full document content. This makes Memory.Wiki a cross-AI knowledge sharing layer.

---

## Requirements

- VS Code 1.80 or later
- macOS, Windows, or Linux

## Links

- [Memory.Wiki](https://memory.wiki) -- Web editor
- [Plugins page](https://memory.wiki/plugins) -- All platforms and downloads
- [API Documentation](https://memory.wiki/docs) -- REST API reference
- [GitHub](https://github.com/raymindai/memory-wiki) -- Source code
- [Issues](https://github.com/raymindai/memory-wiki/issues) -- Bug reports and feature requests

---

**Free during beta.** No login required to publish. Built by a solo founder with Claude as pair programmer.
