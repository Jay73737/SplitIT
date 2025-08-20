# 🪟 SplitMe - Super Easy Windows Installation

## 🚀 One-Command Installation Methods

### Method 1: Chocolatey (Most Popular)
```cmd
# 1. Open PowerShell as Administrator and run:
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. Open Command Prompt as Administrator and run:
choco install python nodejs git ffmpeg -y

# 3. Continue with project setup below
```

### Method 2: Winget (Built into Windows 10/11)
```cmd
# Open Command Prompt as Administrator and run:
winget install Python.Python.3.9 OpenJS.NodeJS Git.Git Gyan.FFmpeg
```

### Method 3: Automated Script
```cmd
# 1. Download windows-auto-setup.bat
# 2. Right-click -> "Run as administrator"
# 3. Wait for completion
```

## 📋 Complete Setup Commands

After installing prerequisites, run these commands:

```cmd
# Clone repository
git clone <your-repo-url>
cd SplitMe

# Setup Python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install fastapi uvicorn

# Setup Frontend
cd frontend
npm install
npm run build
npm run dist
cd ..

# Create directories
mkdir data\audio_cache
echo {} > config.json
```

## 🎯 Running SplitMe

```cmd
# Easy way - just double-click:
SplitMe-Launcher-Windows.bat

# Or run manually:
# Terminal 1:
.venv\Scripts\activate
uvicorn api.server:app --host 0.0.0.0 --port 8000

# Terminal 2:
start frontend\dist\win-unpacked\SplitMe - Stem Splitter.exe
```

## 🔧 Troubleshooting

### Command not found errors:
```cmd
# Restart Command Prompt after installing prerequisites
# Or manually add to PATH:
# Python: C:\Python39\Scripts
# Node: C:\Program Files\nodejs
# Git: C:\Program Files\Git\cmd
```

### Permission errors:
- Run Command Prompt as Administrator
- Add SplitMe folder to Windows Defender exclusions

## ✅ Verification
```cmd
# Check installations:
python --version
node --version
git --version
ffmpeg -version

# Test app:
# Visit http://localhost:8000/api/health (should show {"ok":true})
```

## 🎉 Done!
Your SplitMe app is ready for audio stem separation!