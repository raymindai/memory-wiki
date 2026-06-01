#!/usr/bin/env bash
# Post-build notarize + staple for the DMG.
#
# electron-builder 25.1.8's `notarize` config only accepts `true | { teamId }`
# and requires APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD env vars. We use a
# keychain profile instead (set up once with `xcrun notarytool store-credentials`)
# so the build doesn't depend on shell state. Hence `notarize: false` in the
# electron-builder config + this manual step.
#
# Keychain profile name: mdfy-notarize (Apple ID + app-specific password + W7NL89YGSD).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../dist"
PROFILE="${NOTARIZE_PROFILE:-mdfy-notarize}"

DMG=$(/bin/ls -1 "$DIST_DIR"/*.dmg 2>/dev/null | /usr/bin/head -1)
if [ -z "$DMG" ]; then
  echo "[notarize] No DMG found in $DIST_DIR — skipping."
  exit 0
fi

echo "[notarize] Submitting $DMG via keychain profile $PROFILE …"
/usr/bin/xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait

echo "[notarize] Stapling ticket onto $DMG …"
/usr/bin/xcrun stapler staple "$DMG"

echo "[notarize] Validating …"
/usr/bin/xcrun stapler validate "$DMG"

echo "[notarize] Done: $DMG"
