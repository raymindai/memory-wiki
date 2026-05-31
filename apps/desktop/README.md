# memory.wiki for Mac

Native macOS app wrapping memory.wiki with file integration and offline support.

## Quick Start

```bash
npm install
npm start
```

## Build

```bash
# Build .dmg (universal: Intel + Apple Silicon)
npm run build

# Build .dmg for current architecture only
npm run build:dmg
```

Output: `dist/memory-wiki-{version}-universal.dmg`

## What It Does

memory.wiki for Mac loads the memory.wiki web app inside a native Electron shell, adding:

- Native macOS title bar with traffic lights
- File associations (md, txt, pdf, docx, pptx, xlsx, html, csv, json)
- Open files via Finder double-click, drag & drop, or Cmd+O
- Save editor content to local .md files (Cmd+Shift+S)
- Dashboard with recent files on launch
- Offline detection with retry
- Dark/Light mode follows system preference
- Single instance (prevents duplicate windows)
- Right-click any sidebar doc for **Copy URL** / **Copy for AI** / **Open in Browser** (Copy for AI puts the canonical `Use https://memory.wiki/<id> as my context.` sentence on the clipboard)

## Architecture

```
main.js           Electron main process (window, menu, IPC, file I/O)
preload.js        Context bridge (mwDesktop API)
mime-types.js     MIME type detection for file imports
renderer/
  dashboard.html  Landing screen (New/Open/Recent/Drop)
  offline.html    Offline fallback with retry
  logo-dark.svg   Brand logo (dark theme)
  logo-light.svg  Brand logo (light theme)
assets/
  icon.png        App icon (1024x1024)
build/
  entitlements.mac.plist         macOS entitlements
  entitlements.mac.inherit.plist Child process entitlements
```

## How File Opening Works

- **Text files** (.md, .txt): Read content, encode as base64, load `memory.wiki/#md={base64}`
- **Binary files** (.pdf, .docx, etc.): Load memory.wiki, then inject a synthetic drag-drop event with the file data

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New | Cmd+N |
| Open | Cmd+O |
| Save to Local | Cmd+Shift+S |
| Close | Cmd+W |
| Reload | Cmd+R |
| Zoom In/Out | Cmd+/Cmd- |
| Full Screen | Ctrl+Cmd+F |
