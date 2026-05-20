# MdfyQuickLook - macOS QuickLook Extension

A native macOS App Extension (.appex) that provides beautiful Markdown previews when you press Space on a `.md` file in Finder.

## Features

- Full GFM Markdown rendering (via marked.js)
- Code syntax highlighting (via highlight.js)
- KaTeX math equations
- Mermaid diagrams
- Automatic dark/light mode (follows macOS system appearance)
- memory.wiki-identical styling
- "Open in memory.wiki" and "Publish" buttons
- Offline fallback: shows formatted raw markdown if CDN is unavailable

## Requirements

- macOS 13+ (Ventura or later)
- Xcode 15+ (for building)

## Build

### Option A: Xcode (recommended)

1. Open `MdfyQuickLook.xcodeproj` in Xcode
2. Select the **MdfyQuickLook** scheme
3. Product > Build (Cmd+B)
4. Product > Archive for distribution, or just Run to test

### Option B: Command line

```bash
chmod +x build.sh
./build.sh

# Or build and install directly:
./build.sh --install
```

## Install

1. Copy `MdfyQuickLook.app` to `/Applications/`
2. Open it once (this registers the QuickLook extension with macOS)
3. Go to System Settings > Privacy & Security > Extensions > QuickLook
4. Make sure "MdfyQuickLook" is enabled
5. Press Space on any `.md` file in Finder

### Manual install after build:

```bash
cp -R build/MdfyQuickLook.app /Applications/
open /Applications/MdfyQuickLook.app
```

## Architecture

```
MdfyQuickLook/
├── MdfyQuickLook.xcodeproj/     # Xcode project
│   └── project.pbxproj
├── HostApp/                      # Minimal host app (required container)
│   ├── AppDelegate.swift
│   ├── Info.plist
│   └── Assets.xcassets/
├── QuickLookExtension/           # The actual QuickLook preview extension
│   ├── PreviewViewController.swift   # WKWebView-based preview controller
│   └── Info.plist                    # Extension config + supported types
├── Shared/
│   └── template.html             # Reference template from CLI tool
├── build.sh                      # Command-line build script
└── README.md
```

### How it works

1. User presses Space on a `.md` file in Finder
2. macOS loads the QuickLook extension (MdfyQLExtension.appex)
3. `PreviewViewController` reads the markdown file
4. Markdown content is escaped and injected into an HTML template
5. The template is loaded into a WKWebView
6. CDN libraries (marked.js, highlight.js, KaTeX, Mermaid) render the content
7. If CDN is unavailable, a basic inline markdown renderer provides fallback

### Supported UTIs

- `net.daringfireball.markdown` - Standard Markdown files
- `public.text` - General text files (for .md files not recognized as markdown)

## Troubleshooting

**Extension not showing up:**
- Make sure the app is in /Applications
- Open the app at least once
- Check System Settings > Extensions > QuickLook
- Try: `qlmanage -r` to reset QuickLook

**Preview shows loading spinner:**
- The extension needs network access for CDN libraries on first use
- If offline, it falls back to basic markdown rendering

**Build fails with xcodebuild:**
- Run `sudo xcodebuild -license accept` first
- Make sure Xcode Command Line Tools are installed: `xcode-select --install`
