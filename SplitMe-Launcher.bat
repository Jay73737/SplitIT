@echo off
echo Starting SplitMe Application...

REM Get the directory where this script is located
set "DIR=%~dp0"

REM Start the Python backend
echo Starting Python backend...
start "SplitMe Backend" "%DIR%dist\SplitMe-Backend\SplitMe-Backend.exe"

REM Wait a moment for the backend to start
timeout /t 3 /nobreak >nul

REM Start the Electron frontend
echo Starting Electron frontend...
start "SplitMe Frontend" "%DIR%frontend\dist\win-unpacked\SplitMe - Stem Splitter.exe"

echo SplitMe is now running!
echo Press any key to exit and close both applications...
pause >nul

REM Cleanup - kill the processes when this script exits
taskkill /f /im "SplitMe-Backend.exe" >nul 2>&1
taskkill /f /im "SplitMe - Stem Splitter.exe" >nul 2>&1

echo Goodbye!