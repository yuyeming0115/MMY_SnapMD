#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR/MMY_SnapMD"
ICON_FILE="$APP_DIR/src-tauri/icons/icon.icns"
RELEASE_DIR="$ROOT_DIR/releases"

echo "========================================"
echo "   SnapMD macOS 一键打包工具"
echo "========================================"
echo ""

if [ "$(uname -s)" != "Darwin" ]; then
    echo "✗ 当前脚本仅支持在 macOS 上执行"
    exit 1
fi

echo "[1/6] 检查 Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo "✗ 未找到 Node.js，请先安装 Node.js: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js 已安装: $(node --version)"

echo ""
echo "[2/6] 检查 npm..."
if ! command -v npm >/dev/null 2>&1; then
    echo "✗ 未找到 npm"
    exit 1
fi
echo "✓ npm 已安装: $(npm --version)"

echo ""
echo "[3/6] 检查 Rust..."
if ! command -v rustc >/dev/null 2>&1; then
    echo "✗ 未找到 Rust，请先安装: https://www.rust-lang.org/tools/install"
    exit 1
fi
echo "✓ Rust 已安装: $(rustc --version)"

echo ""
echo "[4/6] 检查 Xcode Command Line Tools..."
if ! command -v xcodebuild >/dev/null 2>&1; then
    echo "✗ 未找到 Xcode Command Line Tools，正在触发安装..."
    xcode-select --install || true
    echo "请等待安装完成后重新运行此脚本"
    exit 1
fi
echo "✓ Xcode Command Line Tools 已安装"

if ! command -v ditto >/dev/null 2>&1; then
    echo "✗ 未找到 ditto，无法归档 .app 发布产物"
    exit 1
fi

if [ ! -f "$ICON_FILE" ]; then
    echo "✗ 未找到 macOS 图标文件: $ICON_FILE"
    echo "请先确认 src-tauri/icons 下包含 icon.icns"
    exit 1
fi

echo ""
echo "[5/6] 安装项目依赖..."
cd "$APP_DIR"
npm install
echo "✓ 依赖安装完成"

echo ""
echo "[6/6] 执行 macOS 打包并归档到 releases/..."
cd "$ROOT_DIR"
npm run tauri:build:mac

echo ""
echo "========================================"
echo "   打包成功"
echo "========================================"
echo "Tauri 原始产物:"
echo "  $APP_DIR/src-tauri/target/release/bundle/"
echo "发布归档产物:"
echo "  $RELEASE_DIR"
echo ""

if [ -d "$RELEASE_DIR" ]; then
    read -r -p "是否打开 releases 目录? (y/n): " open_choice
    if [ "$open_choice" = "y" ] || [ "$open_choice" = "Y" ]; then
        open "$RELEASE_DIR"
    fi
fi
