# Key Features

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

Click the **flavor badge** (e.g. `GFM ▾`) in the Source header to convert between flavors.

## CLI Output Support

Paste output from **Claude Code** or any terminal — unicode tables and checkmarks auto-convert:

Before (terminal output):

```
┌──────────┬────────┐
│ Feature  │ Status │
├──────────┼────────┤
│ Auth     │ Done   │
│ Export   │ Done   │
└──────────┴────────┘
```

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
- **CLI** — `npm install -g memory-wiki-cli`
- **Chrome Extension** — Capture from ChatGPT, Claude, Gemini
- **MCP Server** — AI agents create/read/update documents
