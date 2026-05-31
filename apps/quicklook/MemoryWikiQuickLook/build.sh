#!/bin/bash
# =========================================================
# Memory.Wiki QuickLook Extension — Build + Notarize Script
#
# Builds the host app + QuickLook preview extension,
# signs with Developer ID, and notarizes with Apple.
# =========================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
DERIVED_DATA="${BUILD_DIR}/DerivedData"
TEAM_ID="W7NL89YGSD"
SIGN_IDENTITY="Developer ID Application: Hyunsang Cho (${TEAM_ID})"
BUNDLE_ID="wiki.memory.quicklook"

echo ""
echo "  Memory.Wiki QuickLook Extension — Build + Notarize"
echo "  ============================================="
echo ""

# ─── Check prerequisites ───

if ! command -v xcodebuild &> /dev/null; then
    echo "  Error: xcodebuild not found."
    echo "  Please install Xcode from the App Store or run:"
    echo "    xcode-select --install"
    exit 1
fi

# ─── Clean previous build ───

echo "  [1/5] Cleaning previous build..."
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# ─── Build with Developer ID signing ───

echo "  [2/5] Building MemoryWikiQuickLook.app + QuickLook extension..."
cd "${SCRIPT_DIR}"

xcodebuild \
    -project MemoryWikiQuickLook.xcodeproj \
    -scheme MemoryWikiQuickLook \
    -configuration Release \
    -derivedDataPath "${DERIVED_DATA}" \
    -arch "$(uname -m)" \
    ONLY_ACTIVE_ARCH=YES \
    DEVELOPMENT_TEAM="${TEAM_ID}" \
    CODE_SIGN_IDENTITY="${SIGN_IDENTITY}" \
    CODE_SIGN_STYLE=Manual \
    OTHER_CODE_SIGN_FLAGS="--options=runtime" \
    2>&1 | tail -5

BUILD_APP="${DERIVED_DATA}/Build/Products/Release/MemoryWikiQuickLook.app"

if [ ! -d "${BUILD_APP}" ]; then
    echo ""
    echo "  Build failed. Try opening MemoryWikiQuickLook.xcodeproj in Xcode instead."
    exit 1
fi

# ─── Copy to build output ───

echo "  [3/5] Copying to build directory..."
cp -R "${BUILD_APP}" "${BUILD_DIR}/MemoryWikiQuickLook.app"

# ─── Re-sign with hardened runtime (required for notarization) ───

echo "  [4/5] Signing with Developer ID + hardened runtime..."

# Sign the QuickLook extension first (nested code must be signed before
# container). MUST include --entitlements so the sandbox + network
# entitlements from QuickLookExtension/MemoryWikiQLExtension.entitlements
# survive the re-sign. Without that flag macOS PluginKit rejects the
# .appex because App Extensions REQUIRE com.apple.security.app-sandbox.
codesign --force --options runtime \
    --sign "${SIGN_IDENTITY}" \
    --entitlements "${SCRIPT_DIR}/QuickLookExtension/MemoryWikiQLExtension.entitlements" \
    --timestamp \
    "${BUILD_DIR}/MemoryWikiQuickLook.app/Contents/PlugIns/MemoryWikiQLExtension.appex"

# Sign the main app with its own entitlements.
codesign --force --options runtime \
    --sign "${SIGN_IDENTITY}" \
    --entitlements "${SCRIPT_DIR}/HostApp/MemoryWikiQuickLook.entitlements" \
    --timestamp \
    "${BUILD_DIR}/MemoryWikiQuickLook.app"

# Verify
codesign --verify --deep --strict "${BUILD_DIR}/MemoryWikiQuickLook.app"
echo "  Signature verified."

# ─── Create zip for notarization ───

echo "  [5/5] Notarizing with Apple..."
cd "${BUILD_DIR}"
rm -f MemoryWikiQuickLook.zip
ditto -c -k --keepParent MemoryWikiQuickLook.app MemoryWikiQuickLook.zip

# Submit for notarization and wait
xcrun notarytool submit MemoryWikiQuickLook.zip \
    --keychain-profile "notarytool-profile" \
    --team-id "${TEAM_ID}" \
    --wait 2>&1 | tee /tmp/notarize-output.txt

# Check result
if grep -q "status: Accepted" /tmp/notarize-output.txt; then
    echo "  Notarization accepted!"
    # Staple the notarization ticket
    xcrun stapler staple "${BUILD_DIR}/MemoryWikiQuickLook.app"
    # Re-create zip with stapled app
    rm -f MemoryWikiQuickLook.zip
    ditto -c -k --keepParent MemoryWikiQuickLook.app MemoryWikiQuickLook.zip
    echo ""
    echo "  Build + notarize complete!"
    echo "  Output: ${BUILD_DIR}/MemoryWikiQuickLook.zip"
else
    echo ""
    echo "  Notarization may have failed. Check output above."
    echo "  You can still distribute the signed (but un-notarized) app."
    echo "  Output: ${BUILD_DIR}/MemoryWikiQuickLook.zip"
fi

echo ""
echo "  To install:"
echo "    unzip MemoryWikiQuickLook.zip"
echo "    cp -R MemoryWikiQuickLook.app ~/Applications/"
echo "    open ~/Applications/MemoryWikiQuickLook.app"
echo ""

# ─── Optional: install directly ───

if [[ "${1:-}" == "--install" ]]; then
    INSTALL_DIR="${HOME}/Applications"
    mkdir -p "${INSTALL_DIR}"
    echo "  Installing to ~/Applications..."
    rm -rf "${INSTALL_DIR}/MemoryWikiQuickLook.app"
    cp -R "${BUILD_DIR}/MemoryWikiQuickLook.app" "${INSTALL_DIR}/"
    echo "  Opening app to register extension..."
    open "${INSTALL_DIR}/MemoryWikiQuickLook.app"
    echo "  Done! Enable the extension in System Settings > Extensions > Quick Look."
fi
