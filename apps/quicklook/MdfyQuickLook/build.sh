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
BUNDLE_ID="cc.memorywiki.quicklook"

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

echo "  [2/5] Building MdfyQuickLook.app + QuickLook extension..."
cd "${SCRIPT_DIR}"

xcodebuild \
    -project MdfyQuickLook.xcodeproj \
    -scheme MdfyQuickLook \
    -configuration Release \
    -derivedDataPath "${DERIVED_DATA}" \
    -arch "$(uname -m)" \
    ONLY_ACTIVE_ARCH=YES \
    DEVELOPMENT_TEAM="${TEAM_ID}" \
    CODE_SIGN_IDENTITY="${SIGN_IDENTITY}" \
    CODE_SIGN_STYLE=Manual \
    OTHER_CODE_SIGN_FLAGS="--options=runtime" \
    2>&1 | tail -5

BUILD_APP="${DERIVED_DATA}/Build/Products/Release/MdfyQuickLook.app"

if [ ! -d "${BUILD_APP}" ]; then
    echo ""
    echo "  Build failed. Try opening MdfyQuickLook.xcodeproj in Xcode instead."
    exit 1
fi

# ─── Copy to build output ───

echo "  [3/5] Copying to build directory..."
cp -R "${BUILD_APP}" "${BUILD_DIR}/MdfyQuickLook.app"

# ─── Re-sign with hardened runtime (required for notarization) ───

echo "  [4/5] Signing with Developer ID + hardened runtime..."

# Sign the QuickLook extension first (nested code must be signed before container)
codesign --force --deep --options runtime \
    --sign "${SIGN_IDENTITY}" \
    --timestamp \
    "${BUILD_DIR}/MdfyQuickLook.app/Contents/PlugIns/MdfyQLExtension.appex"

# Sign the main app
codesign --force --deep --options runtime \
    --sign "${SIGN_IDENTITY}" \
    --timestamp \
    "${BUILD_DIR}/MdfyQuickLook.app"

# Verify
codesign --verify --deep --strict "${BUILD_DIR}/MdfyQuickLook.app"
echo "  Signature verified."

# ─── Create zip for notarization ───

echo "  [5/5] Notarizing with Apple..."
cd "${BUILD_DIR}"
rm -f MdfyQuickLook.zip
ditto -c -k --keepParent MdfyQuickLook.app MdfyQuickLook.zip

# Submit for notarization and wait
xcrun notarytool submit MdfyQuickLook.zip \
    --keychain-profile "notarytool-profile" \
    --team-id "${TEAM_ID}" \
    --wait 2>&1 | tee /tmp/notarize-output.txt

# Check result
if grep -q "status: Accepted" /tmp/notarize-output.txt; then
    echo "  Notarization accepted!"
    # Staple the notarization ticket
    xcrun stapler staple "${BUILD_DIR}/MdfyQuickLook.app"
    # Re-create zip with stapled app
    rm -f MdfyQuickLook.zip
    ditto -c -k --keepParent MdfyQuickLook.app MdfyQuickLook.zip
    echo ""
    echo "  Build + notarize complete!"
    echo "  Output: ${BUILD_DIR}/MdfyQuickLook.zip"
else
    echo ""
    echo "  Notarization may have failed. Check output above."
    echo "  You can still distribute the signed (but un-notarized) app."
    echo "  Output: ${BUILD_DIR}/MdfyQuickLook.zip"
fi

echo ""
echo "  To install:"
echo "    unzip MdfyQuickLook.zip"
echo "    cp -R MdfyQuickLook.app ~/Applications/"
echo "    open ~/Applications/MdfyQuickLook.app"
echo ""

# ─── Optional: install directly ───

if [[ "${1:-}" == "--install" ]]; then
    INSTALL_DIR="${HOME}/Applications"
    mkdir -p "${INSTALL_DIR}"
    echo "  Installing to ~/Applications..."
    rm -rf "${INSTALL_DIR}/MdfyQuickLook.app"
    cp -R "${BUILD_DIR}/MdfyQuickLook.app" "${INSTALL_DIR}/"
    echo "  Opening app to register extension..."
    open "${INSTALL_DIR}/MdfyQuickLook.app"
    echo "  Done! Enable the extension in System Settings > Extensions > Quick Look."
fi
