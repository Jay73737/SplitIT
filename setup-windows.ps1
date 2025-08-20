# SplitMe Windows Setup Script
# This script prepares Windows for running SplitMe

# Set execution policy for current session if needed
if ((Get-ExecutionPolicy) -eq 'Restricted') {
    Write-Host "🔧 Adjusting PowerShell execution policy..." -ForegroundColor Yellow
    try {
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
        Write-Host "✅ Execution policy updated" -ForegroundColor Green
    } catch {
        Write-Warning "⚠️  Could not change execution policy. You may need to run as Administrator."
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       SplitMe Setup for Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 Checking system requirements for SplitMe..." -ForegroundColor Green
Write-Host ""

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check PowerShell version
$PSVersionMajor = $PSVersionTable.PSVersion.Major
if ($PSVersionMajor -ge 5) {
    Write-Host "✅ PowerShell version: $($PSVersionTable.PSVersion)" -ForegroundColor Green
} else {
    Write-Host "⚠️  PowerShell version $($PSVersionTable.PSVersion) detected" -ForegroundColor Yellow
    Write-Host "   Recommended: PowerShell 5.0 or later" -ForegroundColor Cyan
}

# Check Python installation
if (Test-Command "python") {
    $PythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $PythonVersion" -ForegroundColor Green
    
    # Check Python version
    $VersionMatch = $PythonVersion -match "Python (\d+)\.(\d+)"
    if ($VersionMatch) {
        $Major = [int]$Matches[1]
        $Minor = [int]$Matches[2]
        if ($Major -eq 3 -and $Minor -ge 9) {
            Write-Host "✅ Python version is compatible" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Python $Major.$Minor detected - recommended: Python 3.9+" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ Python not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 Python 3.9+ is required. Install from:" -ForegroundColor Cyan
    Write-Host "   https://www.python.org/downloads/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Important: Check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "Would you like to open the Python download page? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process "https://www.python.org/downloads/"
    }
    
    Write-Host "❌ Setup cannot continue without Python" -ForegroundColor Red
    exit 1
}

# Check pip
if (Test-Command "pip") {
    Write-Host "✅ pip package manager found" -ForegroundColor Green
} else {
    Write-Host "⚠️  pip not found - it should come with Python" -ForegroundColor Yellow
}

# Check Node.js (optional)
if (Test-Command "node") {
    $NodeVersion = node --version 2>&1
    Write-Host "✅ Node.js found: $NodeVersion" -ForegroundColor Green
    
    if (Test-Command "npm") {
        $NpmVersion = npm --version 2>&1
        Write-Host "✅ npm found: v$NpmVersion" -ForegroundColor Green
    } else {
        Write-Host "⚠️  npm not found - should come with Node.js" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Node.js not found" -ForegroundColor Yellow
    Write-Host "   Node.js enables the graphical interface" -ForegroundColor Cyan
    Write-Host "   Without it, SplitMe runs in API-only mode" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📥 Optional: Install Node.js from https://nodejs.org" -ForegroundColor Cyan
    
    $response = Read-Host "Would you like to install Node.js for the full GUI experience? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Start-Process "https://nodejs.org/"
        Write-Host "📖 After installing Node.js, run this setup again" -ForegroundColor Cyan
    }
}

# Check available memory
$Memory = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
$MemoryGB = [math]::Round($Memory.Sum / 1GB, 1)
if ($MemoryGB -ge 4) {
    Write-Host "✅ System memory: $MemoryGB GB" -ForegroundColor Green
} else {
    Write-Host "⚠️  System memory: $MemoryGB GB (4GB+ recommended)" -ForegroundColor Yellow
}

# Check disk space
$Disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
$FreeSpaceGB = [math]::Round($Disk.FreeSpace / 1GB, 1)
if ($FreeSpaceGB -ge 2) {
    Write-Host "✅ Available disk space: $FreeSpaceGB GB" -ForegroundColor Green
} else {
    Write-Host "⚠️  Available disk space: $FreeSpaceGB GB (2GB+ recommended)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup analysis complete!" -ForegroundColor Green -BackgroundColor DarkGreen
Write-Host ""

if (Test-Command "python") {
    Write-Host "✅ Your system is ready to run SplitMe!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Run: .\SplitMe-Launcher-Windows.ps1" -ForegroundColor White
    Write-Host "   2. The launcher will automatically handle all dependencies" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Advanced options:" -ForegroundColor Yellow
    Write-Host "   • API-only mode: .\SplitMe-Launcher-Windows.ps1 -ApiOnly" -ForegroundColor White
    Write-Host "   • Verbose output: .\SplitMe-Launcher-Windows.ps1 -Verbose" -ForegroundColor White
} else {
    Write-Host "⚠️  Please install Python first, then run this setup again" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")