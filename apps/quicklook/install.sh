#!/bin/bash
set -euo pipefail

# ================================================================
# Memory.Wiki QuickLook — Build & Install Script
# ================================================================
#
# Builds the mdfy-quicklook CLI tool and installs it to /usr/local/bin.
# The CLI can generate HTML previews of Markdown files.
#
# For the full QuickLook Extension (.appex), use Xcode.
# See README.md for details.
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/mdfy-quicklook"
BUILD_DIR="$PROJECT_DIR/.build/release"
INSTALL_DIR="/usr/local/bin"
TOOL_NAME="mdfy-quicklook"

echo ""
echo "  Memory.Wiki QuickLook — Build & Install"
echo "  ================================="
echo ""

# Check Swift is available
if ! command -v swift &>/dev/null; then
    echo "  Error: Swift is not installed."
    echo "  Install Xcode or Xcode Command Line Tools:"
    echo "    xcode-select --install"
    echo ""
    exit 1
fi

SWIFT_VERSION=$(swift --version 2>&1 | head -n1)
echo "  Swift: $SWIFT_VERSION"
echo ""

# Build
echo "  Building $TOOL_NAME (release)..."
cd "$PROJECT_DIR"
swift build -c release 2>&1 | sed 's/^/    /'

if [ ! -f "$BUILD_DIR/$TOOL_NAME" ]; then
    echo ""
    echo "  Error: Build failed. Binary not found at $BUILD_DIR/$TOOL_NAME"
    exit 1
fi

echo "  Build successful."
echo ""

# Copy template and CSS alongside binary
echo "  Bundling resources..."
cp "$PROJECT_DIR/Sources/PreviewExtension/template.html" "$BUILD_DIR/template.html"
cp "$PROJECT_DIR/Resources/preview.css" "$BUILD_DIR/preview.css"
echo "  Resources copied to $BUILD_DIR/"
echo ""

# Install
echo "  Installing to $INSTALL_DIR/$TOOL_NAME..."
if [ -w "$INSTALL_DIR" ]; then
    cp "$BUILD_DIR/$TOOL_NAME" "$INSTALL_DIR/$TOOL_NAME"
    # Also install resources to a known location
    RESOURCE_DIR="$HOME/.memory.wiki/quicklook"
    mkdir -p "$RESOURCE_DIR"
    cp "$BUILD_DIR/template.html" "$RESOURCE_DIR/template.html"
    cp "$BUILD_DIR/preview.css" "$RESOURCE_DIR/preview.css"
else
    echo "  Need sudo for $INSTALL_DIR..."
    sudo cp "$BUILD_DIR/$TOOL_NAME" "$INSTALL_DIR/$TOOL_NAME"
    RESOURCE_DIR="$HOME/.memory.wiki/quicklook"
    mkdir -p "$RESOURCE_DIR"
    cp "$BUILD_DIR/template.html" "$RESOURCE_DIR/template.html"
    cp "$BUILD_DIR/preview.css" "$RESOURCE_DIR/preview.css"
fi

echo ""
echo "  Done! Installed:"
echo "    Binary:    $INSTALL_DIR/$TOOL_NAME"
echo "    Resources: $HOME/.memory.wiki/quicklook/"
echo ""
echo "  Usage:"
echo "    $TOOL_NAME README.md               # HTML to stdout"
echo "    $TOOL_NAME README.md --open         # Open in browser"
echo "    $TOOL_NAME README.md -o preview.html # Write to file"
echo ""
echo "  For QuickLook integration, see README.md"
echo ""
