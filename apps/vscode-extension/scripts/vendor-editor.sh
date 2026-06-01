#!/bin/bash
# Copies the built @mdcore/editor renderer into the VSCode extension
# so src/render.ts can re-export it instead of duplicating the
# markdown-it pipeline. Mirrors apps/desktop/scripts/vendor-editor.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EDITOR_DIST="$ROOT/packages/editor/dist"
EXT_DIR="$ROOT/apps/vscode-extension"

if [ ! -d "$EDITOR_DIST" ]; then
  echo "▶ Building @mdcore/editor first"
  (cd "$ROOT/packages/editor" && npm run build)
fi

mkdir -p "$EXT_DIR/vendor-editor"
cp "$EDITOR_DIST/render.js" "$EXT_DIR/vendor-editor/render.cjs"
cp "$EDITOR_DIST/render.js.map" "$EXT_DIR/vendor-editor/render.cjs.map"

echo "✓ Vendored @mdcore/editor → apps/vscode-extension/vendor-editor"
