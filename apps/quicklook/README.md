# memory.wiki QuickLook

A macOS QuickLook preview generator for Markdown files, styled to match [memory.wiki](https://memory.wiki).

Press **Space** in Finder to preview any `.md` file with full rendering: syntax highlighting, KaTeX math, Mermaid diagrams, GFM tables, and task lists.

## What You Get

- GFM Markdown rendering (via marked.js)
- Code syntax highlighting (via highlight.js)
- Math equations (via KaTeX)
- Mermaid diagrams
- Automatic dark/light mode (follows macOS system appearance)
- "Open in memory.wiki" button for one-click publishing
- Copy buttons on code blocks
- Identical styling to memory.wiki

## Quick Start (CLI Tool)

The fastest way to use this is as a CLI tool that generates beautiful HTML previews.

### Build & Install

```bash
cd apps/quicklook
chmod +x install.sh
./install.sh
```

### Usage

```bash
# Print rendered HTML to stdout
memory-wiki-quicklook README.md

# Open preview in your default browser
memory-wiki-quicklook README.md --open

# Save to a file
memory-wiki-quicklook README.md -o preview.html
```

### Requirements

- macOS 13+ (Ventura or later)
- Swift 5.9+ (included with Xcode 15+ or Command Line Tools)

## QuickLook Extension (.appex)

For native Finder Space-bar preview, you need a QuickLook App Extension. This requires Xcode to build.

### Option A: Build with Xcode

1. Open Xcode and create a new project
2. Choose **App** template, then add a **QuickLook Preview Extension** target
3. Copy the rendering logic from `Sources/PreviewExtension/PreviewProvider.swift`
4. Copy `template.html` and `preview.css` into the extension's bundle resources
5. Set supported content types in the extension's `Info.plist`:

```xml
<key>QLSupportedContentTypes</key>
<array>
    <string>net.daringfireball.markdown</string>
    <string>public.markdown</string>
</array>
```

6. Build and run. The extension will be registered automatically.

### Option B: Use with Existing QuickLook Plugins

If you already have a QuickLook Markdown plugin installed (like [qlmarkdown](https://github.com/toland/qlmarkdown)), you can use the memory.wiki HTML template + CSS as a custom style:

1. Generate a preview with the CLI tool
2. Use the output HTML as a template for your plugin's rendering

### Option C: Automator Quick Action

Create a Finder Quick Action that previews Markdown files:

1. Open Automator, choose **Quick Action**
2. Set "Workflow receives current **files or folders** in **Finder**"
3. Add a **Run Shell Script** action:
   ```bash
   for f in "$@"; do
       memory-wiki-quicklook "$f" --open
   done
   ```
4. Save as "Preview with memory.wiki"
5. Now right-click any `.md` file in Finder and select **Quick Actions > Preview with memory.wiki**

## Architecture

```
User presses Space on .md file
  -> QuickLook Extension loads the file
  -> Swift reads the Markdown content
  -> Content injected into template.html
  -> WKWebView renders the HTML:
       1. marked.js parses Markdown to HTML
       2. highlight.js highlights code blocks
       3. KaTeX renders math equations
       4. Mermaid renders diagrams
  -> Beautiful preview displayed in Finder
```

The rendering pipeline matches memory.wiki exactly because it uses the same client-side libraries and CSS variables.

## File Structure

```
apps/quicklook/
├── memory-wiki-quicklook/
│   ├── Package.swift              # Swift package manifest
│   ├── Sources/
│   │   └── PreviewExtension/
│   │       ├── PreviewProvider.swift   # CLI tool + extension provider
│   │       └── template.html          # HTML template with JS renderers
│   └── Resources/
│       └── preview.css            # memory.wiki rendering styles
├── install.sh                     # Build & install script
└── README.md                      # This file
```

## Development

### Edit Styles

The rendering styles live in `Resources/preview.css` and are injected into the HTML template at build time. These are a direct port of the `.mdcore-rendered` styles from `apps/web/src/app/globals.css`.

To update after changing memory.wiki styles:

1. Edit `Resources/preview.css` to match the updated `globals.css`
2. Rebuild with `./install.sh`

### Edit Template

The HTML template at `Sources/PreviewExtension/template.html` includes:

- CDN links for marked.js, highlight.js, KaTeX, and Mermaid
- Rendering script that processes the injected Markdown
- Top bar with memory.wiki branding and action buttons
- Placeholder `{{MARKDOWN_CONTENT}}` replaced at runtime

### Test Locally

```bash
cd apps/quicklook/memory-wiki-quicklook
swift build
.build/debug/memory-wiki-quicklook ../../docs/MANIFESTO.md --open
```
