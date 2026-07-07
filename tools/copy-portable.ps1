param(
    [string]$RootDir = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$appDir = Join-Path $RootDir "MMY_SnapMD"
$packageJsonPath = Join-Path $appDir "package.json"
$sourceExe = Join-Path $appDir "src-tauri\target\release\snapmd.exe"
$releaseDir = Join-Path $RootDir "releases"

if (-not (Test-Path $packageJsonPath)) {
    Write-Error "package.json not found: $packageJsonPath"
    exit 1
}

if (-not (Test-Path $sourceExe)) {
    Write-Error "Build output not found: $sourceExe"
    exit 1
}

$package = Get-Content -Path $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$version = $package.version
$targetExe = Join-Path $releaseDir "SnapMD-$version-x64.exe"

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -Path $sourceExe -Destination $targetExe -Force

Write-Host "Portable exe generated:" -ForegroundColor Green
Write-Host "  $targetExe" -ForegroundColor White
