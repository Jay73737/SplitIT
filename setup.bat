@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

set "ORIGINAL_DIR=%CD%"

echo Setting up SplitMe - Audio Stem Separation App
echo ==================================================

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first:
    echo         https://nodejs.org/
    goto :cleanup_and_exit
)

echo [OK] Node.js installed
echo.

if not exist "frontend" (
    echo [ERROR] Frontend directory not found
    goto :cleanup_and_exit
)

echo Installing Node.js dependencies for frontend...
cd /d frontend

if not exist "package.json" (
    echo [ERROR] package.json not found in frontend directory
    cd /d "%ORIGINAL_DIR%"
    goto :cleanup_and_exit
)

npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Node.js dependencies
    cd /d "%ORIGINAL_DIR%"
    goto :cleanup_and_exit
)

cd /d "%ORIGINAL_DIR%"

echo [OK] Node.js dependencies installed successfully
echo.
echo Setup complete!
echo.
echo Would you like to launch the app now? (Y/N)
set /p launch="Enter choice: "
if /i "%launch%"=="Y" (
    echo Launching SplitMe...
    cd /d frontend
    start "" npm run electron-dev
    cd /d "%ORIGINAL_DIR%"
    echo App launched! Check for the SplitMe window.
) else (
    echo To run the app later, use: run-app.bat
)
echo.
pause
exit /b 0

:cleanup_and_exit
cd /d "%ORIGINAL_DIR%"
echo.
echo Setup failed. Please fix the errors above and try again.
pause
exit /b 1