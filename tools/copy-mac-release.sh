#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/MMY_SnapMD"
BUNDLE_DIR="$APP_DIR/src-tauri/target/release/bundle"
RELEASE_DIR="$ROOT_DIR/releases"

if [ "$(uname -s)" != "Darwin" ]; then
    echo "ERROR: tools/copy-mac-release.sh 只能在 macOS 上运行" >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: 未找到 Node.js，无法读取版本号" >&2
    exit 1
fi

if ! command -v ditto >/dev/null 2>&1; then
    echo "ERROR: 未找到 ditto，无法压缩 .app 目录" >&2
    exit 1
fi

if [ ! -d "$BUNDLE_DIR" ]; then
    echo "ERROR: 未找到 bundle 目录: $BUNDLE_DIR" >&2
    exit 1
fi

VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$APP_DIR/package.json")"

case "$(uname -m)" in
    arm64|aarch64)
        ARCH_LABEL="arm64"
        ;;
    x86_64)
        ARCH_LABEL="x64"
        ;;
    *)
        ARCH_LABEL="$(uname -m)"
        ;;
esac

APP_BUNDLE="$(find "$BUNDLE_DIR" -maxdepth 3 -type d -name "*.app" | head -n 1)"
DMG_FILE="$(find "$BUNDLE_DIR" -maxdepth 3 -type f -name "*.dmg" | head -n 1)"

if [ -z "$APP_BUNDLE" ] && [ -z "$DMG_FILE" ]; then
    echo "ERROR: 未找到 macOS 打包产物（.app 或 .dmg）" >&2
    exit 1
fi

mkdir -p "$RELEASE_DIR"

if [ -n "$APP_BUNDLE" ]; then
    APP_ZIP="$RELEASE_DIR/SnapMD-$VERSION-macos-$ARCH_LABEL.app.zip"
    rm -f "$APP_ZIP"
    ditto -c -k --sequesterRsrc --keepParent "$APP_BUNDLE" "$APP_ZIP"
    echo "Archived app bundle:"
    echo "  $APP_ZIP"
fi

if [ -n "$DMG_FILE" ]; then
    DMG_TARGET="$RELEASE_DIR/SnapMD-$VERSION-macos-$ARCH_LABEL.dmg"
    cp -f "$DMG_FILE" "$DMG_TARGET"
    echo "Copied dmg bundle:"
    echo "  $DMG_TARGET"
fi
