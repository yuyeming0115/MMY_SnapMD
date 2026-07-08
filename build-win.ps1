# SnapMD Windows 一键打包脚本
# 使用 PowerShell 运行

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SnapMD Windows 便携版打包工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
Write-Host "[1/5] 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 Node.js，请先安装 Node.js (https://nodejs.org/)" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查 npm
Write-Host ""
Write-Host "[2/5] 检查 npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✓ npm 已安装: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 npm" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 检查 Rust (Tauri 需要)
Write-Host ""
Write-Host "[3/5] 检查 Rust..." -ForegroundColor Yellow
try {
    $rustVersion = rustc --version
    Write-Host "✓ Rust 已安装: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ 未找到 Rust，正在安装..." -ForegroundColor Yellow
    Write-Host "请访问 https://www.rust-lang.org/tools/install 安装 Rust" -ForegroundColor Yellow
    Read-Host "按任意键退出"
    exit 1
}

# 安装依赖
Write-Host ""
Write-Host "[4/5] 安装项目依赖..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\MMY_SnapMD"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 依赖安装失败" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}
Write-Host "✓ 依赖安装完成" -ForegroundColor Green

# 执行 Tauri 打包（必须在含 package.json 的应用目录内运行）
Write-Host ""
Write-Host "[5/5] 开始 Tauri 打包 (msi + nsis)..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Yellow
Set-Location -Path "$PSScriptRoot\MMY_SnapMD"
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 打包失败" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 复制安装包到 releases/ 归档
$bundleDir = "$PSScriptRoot\MMY_SnapMD\src-tauri\target\release\bundle"
if (-not (Test-Path "$PSScriptRoot\releases")) { New-Item -ItemType Directory -Path "$PSScriptRoot\releases" | Out-Null }
Copy-Item "$bundleDir\msi\*.msi" -Destination "$PSScriptRoot\releases\" -Force
Copy-Item "$bundleDir\nsis\*.exe" -Destination "$PSScriptRoot\releases\" -Force

# 打包成功
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   打包成功！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "输出文件位置:" -ForegroundColor Cyan
Write-Host "  $PSScriptRoot\releases\" -ForegroundColor White
Write-Host ""
Write-Host "包含以下文件:" -ForegroundColor Cyan
Write-Host "  - SnapMD 闪阅_版本号_x64_zh-CN.msi（Windows 安装包）" -ForegroundColor White
Write-Host "  - SnapMD 闪阅_版本号_x64-setup.exe（Windows 安装器）" -ForegroundColor White
Write-Host ""

# 打开输出目录
$outputPath = "$PSScriptRoot\releases"
if (Test-Path $outputPath) {
    Write-Host "是否打开输出目录? (Y/N)" -ForegroundColor Yellow
    $open = Read-Host
    if ($open -eq 'Y' -or $open -eq 'y') {
        Invoke-Item $outputPath
    }
}

Read-Host "按任意键退出"
