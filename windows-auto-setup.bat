@echo off
echo ========================================
echo    SplitMe Automated Windows Setup
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

echo Step 1: Installing prerequisites with Chocolatey...
echo.

REM Check if Chocolatey is installed
choco --version >nul 2>&1
if %errorLevel% neq 0 (
    echo Installing Chocolatey...
    powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    
    REM Refresh environment variables
    call refreshenv
) else (
    echo Chocolatey already installed!
)

echo.
echo Installing Python, Node.js, Git, and FFmpeg...
choco install python nodejs git ffmpeg -y

echo.
echo Step 2: Refreshing environment variables...
call refreshenv

echo.
echo Step 3: Cloning SplitMe repository...
git clone https://github.com/yourusername/SplitMe.git
cd SplitMe

echo.
echo Step 4: Setting up Python environment...
python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
pip install fastapi uvicorn pyinstaller

echo.
echo Step 5: Setting up frontend...
cd frontend
npm install
npm run build
npm run dist
cd ..

echo.
echo Step 6: Creating required directories...
mkdir data\audio_cache 2>nul
echo {} > config.json

echo.
echo ========================================
echo           Setup Complete!
echo ========================================
echo.
echo To run SplitMe:
echo 1. Double-click: SplitMe-Launcher-Windows.bat
echo 2. Or run: start-splitme.bat
echo.
echo The application is now ready to use!
pause