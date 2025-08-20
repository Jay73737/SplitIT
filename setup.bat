@echo off
echo ========================================
echo       SplitMe Setup for Windows
echo ========================================
echo.

echo 🔧 Running comprehensive system check...
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PowerShell not found! This is unusual for Windows 10/11
    echo Please install PowerShell or use Windows 10/11
    pause
    exit /b 1
)

echo ✅ PowerShell found - launching detailed setup...
echo.

REM Launch PowerShell setup script
powershell -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"

if %errorlevel% neq 0 (
    echo.
    echo ⚠️  Setup encountered an issue
    pause
)

echo.
echo 📖 After setup completes, run SplitMe with:
echo    SplitMe-Launcher-Windows.bat
echo or
echo    .\SplitMe-Launcher-Windows.ps1