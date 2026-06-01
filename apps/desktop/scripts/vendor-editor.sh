#!/bin/bash
# Copies the built @mdcore/editor artifacts into apps/desktop so the
# Electron main process (CJS) and the renderer (browser script) can
# both consume them without npm workspace linking. Run on every
# desktop build (prestart, prebuild, etc).
#
# Why vendoring instead of npm workspace: electron-builder's resolver
# does not always follow workspace symlinks into nested node_modules,
# and even when it does the deps it pulls (markdown-it, katex, ...)
# can double up if both packages declare them. A copied snapshot is
# bulletproof and matches the iOS/Android approach.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EDITOR_DIST="$ROOT/packages/editor/dist"
DESKTOP_DIR="$ROOT/apps/desktop"

if [ ! -d "$EDITOR_DIST" ]; then
  echo "▶ Building @mdcore/editor first"
  (cd "$ROOT/packages/editor" && npm run build)
fi

mkdir -p "$DESKTOP_DIR/vendor-editor"
mkdir -p "$DESKTOP_DIR/renderer/vendor-editor"

# Main process (CJS) — copy render.js + its source map
cp "$EDITOR_DIST/render.js" "$DESKTOP_DIR/vendor-editor/render.cjs"
cp "$EDITOR_DIST/render.js.map" "$DESKTOP_DIR/vendor-editor/render.cjs.map"

# Renderer process (browser script) — self-contained UMD bundle so
# the renderer can call window.MemoryWikiRender.render(md) directly.
cp "$EDITOR_DIST/render.umd.global.js" "$DESKTOP_DIR/renderer/vendor-editor/render.umd.js"

# TipTap editor config UMD — renderer mounts the editor via
# window.MemoryWikiEditor.buildExtensions(...). Includes the full
# TipTap + ProseMirror + tiptap-markdown stack (~2MB).
cp "$EDITOR_DIST/tiptap-config.umd.global.js" "$DESKTOP_DIR/renderer/vendor-editor/tiptap-config.umd.js"

echo "✓ Vendored @mdcore/editor → apps/desktop/{vendor-editor,renderer/vendor-editor}"
