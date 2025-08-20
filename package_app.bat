@echo off
REM SplitMe Application Packaging Script for Windows
REM This script packages the entire SplitMe application into executable formats

echo Starting SplitMe application packaging...

REM Check if we're in the right directory
if not exist "main.py" (
    echo Error: main.py not found. Please run this script from the project root.
    pause
    exit /b 1
)

REM Check required dependencies
echo Checking dependencies...

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python is required but not installed
    pause
    exit /b 1
)

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is required but not installed
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo npm is required but not installed
    pause
    exit /b 1
)

echo All dependencies found

REM Clean previous builds
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build
if exist __pycache__ rmdir /s /q __pycache__
if exist *.spec del *.spec
if exist frontend\dist rmdir /s /q frontend\dist
if exist frontend\build rmdir /s /q frontend\build

REM Install Python dependencies if needed
if not exist "requirements_installed.flag" (
    echo Installing Python dependencies...
    pip install -r requirements.txt
    pip install pyinstaller
    echo. > requirements_installed.flag
)

REM Build the application using our Python script
echo Building application...
python build_app.py

echo.
echo Packaging complete!
echo Find your executable in the dist\ and frontend\dist\ directories
echo Use the launcher script to run the complete application

if exist "SplitMe-Launcher.bat" (
    echo Run SplitMe-Launcher.bat to start the application
)

pause