@echo off
echo 🎵 Setting up SplitMe - Audio Stem Separation App
echo ==================================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first:
    echo    https://nodejs.org/
    pause
    exit /b 1
)

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python first:
    echo    https://python.org/
    pause
    exit /b 1
)

echo ✅ Node.js installed
echo ✅ Python installed
echo.

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt

if %errorlevel% neq 0 (
    echo ❌ Failed to install Python dependencies
    pause
    exit /b 1
)

echo ✅ Python dependencies installed successfully

REM Check if frontend directory exists
if not exist "frontend" (
    echo ❌ Frontend directory not found
    pause
    exit /b 1
)

REM Navigate to frontend directory and install npm dependencies
echo 📦 Installing Node.js dependencies for frontend...
cd frontend

npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo ✅ Node.js dependencies installed successfully
echo.
echo 🚀 Setup complete! You can now run:
echo    Python version: python main.py
echo    Electron version: cd frontend ^&^& npm run electron-dev

pause