@echo off
echo Starting SplitMe Application...

REM Get the directory where this script is located
set "DIR=%~dp0"

REM Activate virtual environment and start backend API
echo Starting Backend API Server...
start "SplitMe Backend" cmd /k "cd /d %DIR% && .venv\Scripts\activate && uvicorn api.server:app --host 0.0.0.0 --port 8000"

REM Wait a moment for the backend to start
echo Waiting for backend to initialize...
timeout /t 5 /nobreak >nul

REM Start the Electron frontend
echo Starting Electron frontend...
start "SplitMe Frontend" "%DIR%frontend\dist\win-unpacked\SplitMe - Stem Splitter.exe"

echo SplitMe is now running!
echo Backend API: http://localhost:8000
echo Frontend: Electron app window
echo.
echo Press any key to exit and close both applications...
pause >nul

REM Cleanup - kill the processes when this script exits
echo Shutting down...
taskkill /f /im "uvicorn.exe" >nul 2>&1
taskkill /f /im "python.exe" >nul 2>&1
taskkill /f /im "SplitMe - Stem Splitter.exe" >nul 2>&1

echo Goodbye!