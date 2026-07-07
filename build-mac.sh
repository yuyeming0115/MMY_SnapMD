#!/bin/bash

# SnapMD macOS 一键打包脚本

echo "========================================"
echo "   SnapMD macOS 打包工具"
echo "========================================"
echo ""

# 检查 Node.js
echo "[1/5] 检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "✗ 未找到 Node.js，请先安装 Node.js (https://nodejs.org/)"
    read -p "按任意键退出..."
    exit 1
fi
echo "✓ Node.js 已安装: $(node --version)"

# 检查 npm
echo ""
echo "[2/5] 检查 npm..."
if ! command -v npm &> /dev/null; then
    echo "✗ 未找到 npm"
    read -p "按任意键退出..."
    exit 1
fi
echo "✓ npm 已安装: $(npm --version)"

# 检查 Rust (Tauri 需要)
echo ""
echo "[3/5] 检查 Rust..."
if ! command -v rustc &> /dev/null; then
    echo "✗ 未找到 Rust，正在安装..."
    echo "请访问 https://www.rust-lang.org/tools/install 安装 Rust"
    read -p "按任意键退出..."
    exit 1
fi
echo "✓ Rust 已安装: $(rustc --version)"

# 检查 Xcode Command Line Tools (macOS 需要)
echo ""
echo "[3.5/5] 检查 Xcode Command Line Tools..."
if ! command -v xcodebuild &> /dev/null; then
    echo "✗ 未找到 Xcode Command Line Tools"
    echo "正在安装..."
    xcode-select --install
    echo "请等待安装完成后重新运行此脚本"
    read -p "按任意键退出..."
    exit 1
fi
echo "✓ Xcode Command Line Tools 已安装"

# 安装依赖
echo ""
echo "[4/5] 安装项目依赖..."
cd "$(dirname "$0")/MMY_SnapMD" || exit 1
npm install
if [ $? -ne 0 ]; then
    echo "✗ 依赖安装失败"
    read -p "按任意键退出..."
    exit 1
fi
echo "✓ 依赖安装完成"

# 执行 Tauri 打包
echo ""
echo "[5/5] 开始 Tauri 打包..."
echo "这可能需要几分钟，请耐心等待..."
npm run tauri build
if [ $? -ne 0 ]; then
    echo "✗ 打包失败"
    read -p "按任意键退出..."
    exit 1
fi

# 打包成功
echo ""
echo "========================================"
echo "   打包成功！"
echo "========================================"
echo ""
echo "输出文件位置:"
echo "  $(dirname "$0")/MMY_SnapMD/src-tauri/target/release/bundle/"
echo ""
echo "包含以下文件:"
echo "  - .app 应用程序"
echo "  - .dmg 磁盘镜像 (如果配置了)"
echo ""

# 打开输出目录
output_path="$(dirname "$0")/MMY_SnapMD/src-tauri/target/release/bundle"
if [ -d "$output_path" ]; then
    read -p "是否打开输出目录? (y/n): " open
    if [ "$open" = "y" ] || [ "$open" = "Y" ]; then
        open "$output_path"
    fi
fi

read -p "按任意键退出..."
