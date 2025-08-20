# SplitMe PowerShell Launcher for Windows
# Requires PowerShell 5.0+ (Windows 10/11 have this by default)

param(
    [switch]$ApiOnly = $false,
    [switch]$Verbose = $false
)

# Set execution policy for current session if needed
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Write-Host "⚠️  Setting PowerShell execution policy for this session..." -ForegroundColor Yellow
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
}

# Enable verbose output if requested
if ($Verbose) { $VerbosePreference = "Continue" }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       SplitMe - Audio Stem Separation" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Verbose "Script directory: $ScriptDir"

Write-Host "🎵 Starting SplitMe Application for Windows..." -ForegroundColor Green
Write-Host ""

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Function to create and activate virtual environment
function Initialize-PythonEnvironment {
    $VenvPath = Join-Path $ScriptDir ".venv"
    $RequirementsFlag = Join-Path $ScriptDir "requirements_installed.flag"
    
    # Create virtual environment if it doesn't exist
    if (!(Test-Path $VenvPath)) {
        Write-Host "📦 Creating Python virtual environment..." -ForegroundColor Yellow
        python -m venv $VenvPath
        if ($LASTEXITCODE -ne 0) {
            Write-Error "❌ Failed to create virtual environment"
            return $false
        }
        Write-Host "✅ Virtual environment created" -ForegroundColor Green
    }
    
    # Activate virtual environment
    $ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
    if (Test-Path $ActivateScript) {
        Write-Host "🔧 Activating virtual environment..." -ForegroundColor Yellow
        & $ActivateScript
        Write-Verbose "Virtual environment activated"
    } else {
        Write-Warning "⚠️  Could not find virtual environment activation script"
        return $false
    }
    
    # Install requirements if needed
    if (!(Test-Path $RequirementsFlag)) {
        Write-Host "📥 Installing Python requirements..." -ForegroundColor Yellow
        Write-Host "⏳ This may take a few minutes on first run..." -ForegroundColor Cyan
        
        python -m pip install --upgrade pip --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "⚠️  Failed to upgrade pip"
        }
        
        $RequirementsPath = Join-Path $ScriptDir "requirements.txt"
        python -m pip install -r $RequirementsPath
        if ($LASTEXITCODE -eq 0) {
            New-Item -Path $RequirementsFlag -ItemType File | Out-Null
            Write-Host "✅ Requirements installed successfully" -ForegroundColor Green
        } else {
            Write-Error "❌ Failed to install requirements"
            return $false
        }
    } else {
        Write-Host "✅ Python requirements already installed" -ForegroundColor Green
    }
    
    return $true
}

# Function to setup frontend dependencies
function Initialize-FrontendEnvironment {
    $FrontendPath = Join-Path $ScriptDir "frontend"
    $NodeModulesPath = Join-Path $FrontendPath "node_modules"
    
    if (!(Test-Path $NodeModulesPath)) {
        Write-Host "📥 Installing frontend dependencies..." -ForegroundColor Yellow
        Push-Location $FrontendPath
        try {
            npm install
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
                return $true
            } else {
                Write-Warning "⚠️  Failed to install frontend dependencies"
                return $false
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Host "✅ Frontend dependencies already installed" -ForegroundColor Green
        return $true
    }
}

# Function to start backend server
function Start-Backend {
    Write-Host "🚀 Starting backend API server..." -ForegroundColor Green
    
    try {
        # Start backend in a background job
        $BackendJob = Start-Job -ScriptBlock {
            param($ScriptDir)
            try {
                Set-Location $ScriptDir
                Write-Output "Backend: Setting location to $ScriptDir"
                
                # Activate virtual environment and start server
                $ActivateScript = Join-Path $ScriptDir ".venv\Scripts\Activate.ps1"
                if (Test-Path $ActivateScript) {
                    Write-Output "Backend: Activating virtual environment"
                    & $ActivateScript
                }
                
                Write-Output "Backend: Starting uvicorn server"
                & "$ScriptDir\.venv\Scripts\python.exe" -m uvicorn api.server:app --host 0.0.0.0 --port 8000
            } catch {
                Write-Output "Backend Error: $($_.Exception.Message)"
                throw
            }
        } -ArgumentList $ScriptDir -Name "SplitMe-Backend"
        
        if ($BackendJob) {
            Write-Host "✅ Backend server job started (ID: $($BackendJob.Id))" -ForegroundColor Green
            Write-Verbose "Backend job state: $($BackendJob.State)"
            return $BackendJob
        } else {
            Write-Error "❌ Failed to create backend job"
            return $null
        }
    } catch {
        Write-Error "❌ Exception starting backend: $($_.Exception.Message)"
        return $null
    }
}

# Function to start frontend application
function Start-Frontend {
    Write-Host "🖥️  Starting frontend application..." -ForegroundColor Green
    
    $FrontendPath = Join-Path $ScriptDir "frontend"
    $FrontendJob = Start-Job -ScriptBlock {
        param($FrontendPath)
        Set-Location $FrontendPath
        npm run electron
    } -ArgumentList $FrontendPath -Name "SplitMe-Frontend"
    
    if ($FrontendJob) {
        Write-Host "✅ Frontend application started (Job ID: $($FrontendJob.Id))" -ForegroundColor Green
        return $FrontendJob
    } else {
        Write-Error "❌ Failed to start frontend application"
        return $null
    }
}

# Function to cleanup background jobs
function Stop-SplitMeServices {
    Write-Host ""
    Write-Host "🛑 Shutting down SplitMe services..." -ForegroundColor Yellow
    
    # Stop background jobs
    Get-Job -Name "SplitMe-*" | Stop-Job
    Get-Job -Name "SplitMe-*" | Remove-Job -Force
    
    # Kill any remaining processes
    Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*electron*" } | Stop-Process -Force
    Get-Process -Name "SplitMe*" -ErrorAction SilentlyContinue | Stop-Process -Force
    
    Write-Host "👋 SplitMe services stopped. Goodbye!" -ForegroundColor Green
}

# Register cleanup function to run on exit
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    Stop-SplitMeServices
}

# Main execution starts here
try {
    # Check if Python is installed
    if (!(Test-Command "python")) {
        Write-Host "❌ Python not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "📥 Please install Python 3.9+ from: https://www.python.org/downloads/" -ForegroundColor Cyan
        Write-Host "💡 Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Press any key to open Python download page..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Start-Process "https://www.python.org/downloads/"
        exit 1
    }

    $PythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $PythonVersion" -ForegroundColor Green

    # Initialize Python environment
    if (!(Initialize-PythonEnvironment)) {
        exit 1
    }
    
    Write-Host "✅ Python environment ready" -ForegroundColor Green
    Write-Host ""

    # Check for Node.js (optional for GUI)
    $HasNodeJS = Test-Command "node"
    $UseGUI = $HasNodeJS -and !$ApiOnly
    
    if (!$HasNodeJS) {
        Write-Host "⚠️  Node.js not found - running in API-only mode" -ForegroundColor Yellow
        Write-Host "📖 Install Node.js from https://nodejs.org to enable the GUI" -ForegroundColor Cyan
        Write-Host ""
    } elseif ($ApiOnly) {
        Write-Host "🌐 API-only mode requested" -ForegroundColor Cyan
        Write-Host ""
    } else {
        $NodeVersion = node --version 2>&1
        Write-Host "✅ Node.js found: $NodeVersion" -ForegroundColor Green
        
        # Initialize frontend environment
        if (Initialize-FrontendEnvironment) {
            Write-Host "✅ Frontend environment ready" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Frontend setup failed - falling back to API-only mode" -ForegroundColor Yellow
            $UseGUI = $false
        }
        Write-Host ""
    }

    # Start backend server
    $BackendJob = Start-Backend
    if (!$BackendJob) {
        exit 1
    }

    # Wait for backend to initialize
    Write-Host "⏳ Waiting for backend to initialize..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3

    # Test backend health
    try {
        $Response = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ Backend health check passed" -ForegroundColor Green
    } catch {
        Write-Warning "⚠️  Backend health check failed, but continuing..."
    }

    if ($UseGUI) {
        # Start frontend application
        $FrontendJob = Start-Frontend
        if ($FrontendJob) {
            Write-Host ""
            Write-Host "✅ SplitMe is now running!" -ForegroundColor Green -BackgroundColor DarkGreen
            Write-Host "🌐 Backend API: http://localhost:8000" -ForegroundColor Cyan
            Write-Host "🖥️  Frontend: Electron app window" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "💡 The application will run until you close this window or press Ctrl+C" -ForegroundColor Yellow
            
            # Wait for either job to complete or user interrupt
            do {
                Start-Sleep -Seconds 2
                $BackendRunning = (Get-Job -Name "SplitMe-Backend" -ErrorAction SilentlyContinue).State -eq "Running"
                $FrontendRunning = (Get-Job -Name "SplitMe-Frontend" -ErrorAction SilentlyContinue).State -eq "Running"
            } while ($BackendRunning -and $FrontendRunning)
        }
    } else {
        Write-Host ""
        Write-Host "✅ SplitMe API Server is running!" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host "🌐 Open your browser to: http://localhost:8000" -ForegroundColor Cyan
        Write-Host "📖 API documentation: http://localhost:8000/docs" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "💡 Press Ctrl+C to stop the server" -ForegroundColor Yellow
        
        # Wait for backend job or user interrupt
        do {
            Start-Sleep -Seconds 2
            $BackendRunning = (Get-Job -Name "SplitMe-Backend" -ErrorAction SilentlyContinue).State -eq "Running"
        } while ($BackendRunning)
    }

} catch {
    Write-Error "❌ An error occurred: $($_.Exception.Message)"
    Write-Verbose $_.Exception.StackTrace
} finally {
    Stop-SplitMeServices
}