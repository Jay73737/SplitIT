@echo off
echo ========================================
echo  SplitMe Setup with Winget (Windows 10/11)
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Step 1: Installing prerequisites with Winget...
echo.

echo Installing Python 3.9...
winget install Python.Python.3.9 --silent

echo Installing Node.js...
winget install OpenJS.NodeJS --silent

echo Installing Git...
winget install Git.Git --silent

echo Installing FFmpeg...
winget install Gyan.FFmpeg --silent

echo.
echo Step 2: Refreshing PATH (restart Command Prompt after this)...
echo Please close this window and open a new Command Prompt as Administrator

echo.
echo Step 3: Run this in the new Command Prompt:
echo.
echo git clone https://github.com/yourusername/SplitMe.git
echo cd SplitMe
echo python -m venv .venv
echo .venv\Scripts\activate
echo pip install -r requirements.txt
echo pip install fastapi uvicorn pyinstaller
echo cd frontend
echo npm install
echo npm run build
echo npm run dist
echo cd ..
echo mkdir data\audio_cache
echo echo {} ^> config.json

echo.
echo ========================================
echo    Prerequisites Installation Complete!
echo ========================================
pause