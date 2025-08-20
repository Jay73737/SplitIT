@echo off
echo ========================================
echo        SplitMe - Audio Stem Separation
echo ========================================
echo.

echo 🚀 Starting SplitMe PowerShell launcher...
echo.

REM Get the directory where this script is located
set "DIR=%~dp0"

REM Check if PowerShell is available (it should be on Windows 10/11)
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PowerShell not found! 
    echo This is unusual for Windows 10/11
    echo Please run the PowerShell script directly:
    echo    .\SplitMe-Launcher-Windows.ps1
    pause
    exit /b 1
)

echo ✅ PowerShell found - launching advanced launcher...
echo.

REM Launch PowerShell script
powershell -ExecutionPolicy Bypass -File "%DIR%SplitMe-Launcher-Windows.ps1"

REM Check if PowerShell script ran successfully  
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  PowerShell launcher encountered an issue
    echo You can also run it directly with:
    echo    powershell -ExecutionPolicy Bypass -File SplitMe-Launcher-Windows.ps1
    echo.
    pause
)

echo.
echo 👋 SplitMe session ended.