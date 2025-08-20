@echo off
echo ========================================
echo       SplitMe Setup for Windows
echo ========================================
echo.

echo 🔧 Setting up SplitMe for first-time use...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found!
    echo.
    echo Please install Python 3.9+ from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)

echo ✅ Python found

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Node.js not found
    echo.
    echo For the full GUI experience, install Node.js from: https://nodejs.org
    echo You can still use SplitMe in API mode without Node.js
    echo.
)

echo ✅ Node.js found

echo.
echo 🎉 Setup complete! You can now run:
echo.
echo    SplitMe-Launcher-Windows.bat
echo.
echo This will automatically:
echo ✓ Create a Python virtual environment
echo ✓ Install all required dependencies
echo ✓ Start both backend and frontend
echo.
pause