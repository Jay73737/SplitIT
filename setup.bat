@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

set "ORIGINAL_DIR=%CD%"

echo Setting up SplitMe - Audio Stem Separation App
echo ==================================================

node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first:
    echo         https://nodejs.org/
    goto :cleanup_and_exit
)

python --version >nul 2>&1
if !errorlevel! neq 0 (
    py --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Python is not installed. Please install Python first:
        echo         https://python.org/
        goto :cleanup_and_exit
    ) else (
        set "PYTHON_CMD=py"
    )
) else (
    set "PYTHON_CMD=python"
)

echo [OK] Node.js installed
echo [OK] Python installed
echo.

if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found in current directory
    goto :cleanup_and_exit
)

echo Installing Python dependencies...
pip install -r requirements.txt

if !errorlevel! neq 0 (
    echo [ERROR] Failed to install Python dependencies
    goto :cleanup_and_exit
)

echo [OK] Python dependencies installed successfully

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

if !errorlevel! neq 0 (
    echo [ERROR] Failed to install Node.js dependencies
    cd /d "%ORIGINAL_DIR%"
    goto :cleanup_and_exit
)

cd /d "%ORIGINAL_DIR%"

echo [OK] Node.js dependencies installed successfully
echo.
echo Setup complete! You can now run:
echo   Python version: %PYTHON_CMD% main.py
echo   Electron version: cd frontend ^&^& npm run electron-dev
echo.
pause
exit /b 0

:cleanup_and_exit
cd /d "%ORIGINAL_DIR%"
echo.
echo Setup failed. Please fix the errors above and try again.
pause
exit /b 1