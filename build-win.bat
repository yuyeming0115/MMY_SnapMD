@echo off
chcp 65001 >nul
REM SnapMD Windows Portable Build Script

echo ========================================
echo    SnapMD Windows Portable Build Tool
echo ========================================
echo.

REM Check Node.js
echo [1/5] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo OK: Node.js found
node --version

REM Check npm
echo.
echo [2/5] Checking npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found
    pause
    exit /b 1
)
echo OK: npm found
npm --version

REM Check Rust
echo.
echo [3/5] Checking Rust...
where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Rust not found
    echo Please install Rust from https://www.rust-lang.org/tools/install
    pause
    exit /b 1
)
echo OK: Rust found
rustc --version

REM Install dependencies
echo.
echo [4/5] Installing dependencies...
cd /d "%~dp0MMY_SnapMD"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo OK: Dependencies installed

REM Build portable exe with Tauri
echo.
echo [5/5] Building portable exe with Tauri...
echo This may take several minutes, please wait...
cd /d "%~dp0"
call npm run tauri:build:portable
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

REM Success
echo.
echo ========================================
echo    Portable Build Successful!
echo ========================================
echo.
echo Output location:
echo   %~dp0releases\
echo.

REM Open output directory
set "output_path=%~dp0releases"
if exist "%output_path%" (
    echo Open output directory? (Y/N)
    set /p open=
    if /i "%open%"=="Y" (
        start "" "%output_path%"
    )
)

pause
