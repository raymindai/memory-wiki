#!/bin/bash
# Copies the built @mdcore/editor artifacts into the VSCode extension.
#
# Two consumers, two locations:
#
#   1. Extension main process (Node, CJS) — src/render.ts re-exports
#      the markdown-it pipeline via `require("../vendor-editor/render.cjs")`.
#      Lives at apps/vscode-extension/vendor-editor/ — outside `media/`
#      because it's a Node module, not a webview asset.
#
#   2. Webview (browser, UMD) — the TipTap editor and renderer run
#      inside the webview iframe. The webview's localResourceRoots is
#      scoped to the `media/` directory, so the UMD bundles must live
#      under `media/vendor-editor/` to be reachable via
#      `panel.webview.asWebviewUri(...)`.
#
# Run on every build (vendor-editor invoked from `compile` / `watch`
# / `package` scripts in package.json).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EDITOR_DIST="$ROOT/packages/editor/dist"
EXT_DIR="$ROOT/apps/vscode-extension"

if [ ! -d "$EDITOR_DIST" ]; then
  echo "▶ Building @mdcore/editor first"
  (cd "$ROOT/packages/editor" && npm run build)
fi

# ── Main process (CJS) — used by src/render.ts via Node require ──
mkdir -p "$EXT_DIR/vendor-editor"
cp "$EDITOR_DIST/render.js" "$EXT_DIR/vendor-editor/render.cjs"
cp "$EDITOR_DIST/render.js.map" "$EXT_DIR/vendor-editor/render.cjs.map"

# ── Webview (UMD) — used by the TipTap preview surface ──
# Self-contained IIFE bundles, ~2.5MB + ~2MB. Attached to window as
# MemoryWikiRender (renderer) and MemoryWikiEditor (TipTap + extensions
# + the Editor class re-exported by tiptap-config.ts).
mkdir -p "$EXT_DIR/media/vendor-editor"
cp "$EDITOR_DIST/render.umd.global.js" "$EXT_DIR/media/vendor-editor/render.umd.js"
cp "$EDITOR_DIST/tiptap-config.umd.global.js" "$EXT_DIR/media/vendor-editor/tiptap-config.umd.js"
# Shared TipTap stylesheet (web parity). preview.ts injects a
# <link> tag pointing at this file via webview.asWebviewUri after
# the existing preview.css link, so editor selectors win on
# conflicts.
cp "$EDITOR_DIST/editor.css" "$EXT_DIR/media/vendor-editor/editor.css"

echo "✓ Vendored @mdcore/editor"
echo "  - $EXT_DIR/vendor-editor/render.cjs (Node)"
echo "  - $EXT_DIR/media/vendor-editor/render.umd.js (webview)"
echo "  - $EXT_DIR/media/vendor-editor/tiptap-config.umd.js (webview)"
echo "  - $EXT_DIR/media/vendor-editor/editor.css (webview)"
