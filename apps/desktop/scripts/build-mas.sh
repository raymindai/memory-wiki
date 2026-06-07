#!/bin/bash
# Builds the Mac App Store .pkg end-to-end.
#
# electron-builder v25 has a long-standing bug where it can't find
# the "3rd Party Mac Developer Installer" identity in the user's
# login keychain even when productbuild itself finds it fine. So
# we let electron-builder do its work (which signs the .app + embeds
# the .provisionprofile) and then run productbuild ourselves to
# wrap the result in a signed .pkg.
#
# Usage:
#   cd apps/desktop && ./scripts/build-mas.sh
#
# Output:
#   apps/desktop/dist/memory.wiki-<version>.pkg

set -uo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
APP=dist/mas-arm64/memory.wiki.app
PKG=dist/memory.wiki-${VERSION}.pkg
INSTALLER_IDENTITY="3rd Party Mac Developer Installer: Hyunsang Cho (W7NL89YGSD)"

echo "▶ Cleaning previous MAS artifacts (preserves DMG + notarized files)"
# Only clear MAS-specific outputs. The full `rm -rf dist` we used to do
# wiped the notarized DMG too — if build-mas.sh ran after build:dmg in
# the same session, the GH Release upload step would 404 on the DMG.
rm -rf dist/mas-arm64
rm -f dist/memory.wiki-*.pkg

echo "▶ Running electron-builder (app sign + .appex embed)"
# Tolerate the productbuild step failing — we wrap it manually below.
npm run build:mas || true

if [ ! -d "$APP" ]; then
  echo "✗ electron-builder failed to produce $APP" >&2
  exit 1
fi

echo "▶ Wrapping in .pkg with $INSTALLER_IDENTITY"
rm -f "$PKG"
productbuild --component "$APP" /Applications --sign "$INSTALLER_IDENTITY" "$PKG"

echo ""
echo "▶ Final verification"
echo "  PKG:     $(ls -la "$PKG" | awk '{print $5}') bytes"
pkgutil --check-signature "$PKG" 2>&1 | grep "Status\|3rd Party" | sed 's/^/  /'
echo "  Bundle:  $(defaults read "$(pwd)/$APP/Contents/Info" CFBundleIdentifier)"
echo "  Version: $(defaults read "$(pwd)/$APP/Contents/Info" CFBundleShortVersionString)"
echo ""
echo "✓ Ready to upload: $PKG"
echo ""
echo "Upload via Transporter.app, or:"
echo "  xcrun altool --upload-app -f \"$PKG\" -t macos \\"
echo "    -u \"\$APPLE_ID\" -p \"\$APPLE_APP_SPECIFIC_PASSWORD\""
