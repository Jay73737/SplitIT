@echo off
echo ========================================
echo        SplitMe - Audio Stem Separation
echo ========================================
echo.

REM Get the directory where this script is located
set "DIR=%~dp0"

echo 🎵 Starting SplitMe Application for Windows...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found! Please install Python 3.9+ first.
    echo.
    echo 📥 Download from: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Check if virtual environment exists, create if not
if not exist "%DIR%.venv" (
    echo 📦 Creating virtual environment...
    python -m venv "%DIR%.venv"
    if %errorlevel% neq 0 (
        echo ❌ Failed to create virtual environment
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call "%DIR%.venv\Scripts\activate.bat"
if %errorlevel% neq 0 (
    echo ❌ Failed to activate virtual environment
    pause
    exit /b 1
)

REM Check if requirements are installed
if not exist "%DIR%requirements_installed.flag" (
    echo 📥 Installing Python requirements...
    echo This may take a few minutes on first run...
    python -m pip install --upgrade pip
    pip install -r "%DIR%requirements.txt"
    if %errorlevel% neq 0 (
        echo ❌ Failed to install requirements
        pause
        exit /b 1
    )
    echo. > "%DIR%requirements_installed.flag"
    echo ✅ Requirements installed successfully
)

echo ✅ Python environment ready
echo.

REM Check if Node.js is available for frontend
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Node.js not found - running in API-only mode
    echo 📖 Install Node.js from https://nodejs.org to enable the GUI
    echo.
    echo 🚀 Starting SplitMe API Server...
    echo 🌐 Server will be available at: http://localhost:8000
    echo.
    python "%DIR%main.py"
    pause
    exit /b 0
)

echo ✅ Node.js found
echo.

REM Check if frontend dependencies are installed
if not exist "%DIR%frontend\node_modules" (
    echo 📥 Installing frontend dependencies...
    cd /d "%DIR%frontend"
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install frontend dependencies
        echo 🚀 Starting in API-only mode...
        cd /d "%DIR%"
        python main.py
        pause
        exit /b 0
    )
    cd /d "%DIR%"
)

echo ✅ Frontend dependencies ready
echo.

REM Start backend API server
echo 🚀 Starting backend API server...
start "SplitMe Backend" cmd /c "cd /d %DIR% && .venv\Scripts\activate && python -m uvicorn api.server:app --host 0.0.0.0 --port 8000"

REM Wait for backend to start
echo ⏳ Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

REM Start frontend
echo 🖥️  Starting frontend application...
cd /d "%DIR%frontend"
start "SplitMe Frontend" cmd /c "npm run electron"

cd /d "%DIR%"
echo.
echo ✅ SplitMe is now running!
echo 🌐 Backend API: http://localhost:8000
echo 🖥️  Frontend: Electron app window
echo.
echo Press any key to stop the application...
pause >nul

REM Cleanup
echo 🛑 Shutting down SplitMe...
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq SplitMe Backend" >nul 2>&1
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq SplitMe Frontend" >nul 2>&1
taskkill /f /im "SplitMe*.exe" >nul 2>&1

echo 👋 Goodbye!