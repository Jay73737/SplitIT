# 🪟 SplitMe Windows Setup Guide

## Prerequisites

1. **Python 3.9+** - Download from [python.org](https://www.python.org/downloads/)
2. **Node.js 16+** - Download from [nodejs.org](https://nodejs.org/)
3. **Git** - Download from [git-scm.com](https://git-scm.com/)
4. **FFmpeg** - Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

## Initial Setup (One-time)

### 1. Clone the Repository
```cmd
git clone <your-repo-url>
cd SplitMe
```

### 2. Setup Python Environment
```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pip install fastapi uvicorn
```

### 3. Build the Frontend
```cmd
cd frontend
npm install
npm run build
npm run dist
cd ..
```

## Running SplitMe

### Option 1: Easy Launch (Recommended)
Simply double-click `SplitMe-Launcher-Windows.bat`

### Option 2: Manual Launch

**Terminal 1 - Backend Server:**
```cmd
.venv\Scripts\activate
uvicorn api.server:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend App:**
```cmd
start frontend\dist\win-unpacked\SplitMe - Stem Splitter.exe
```

## Troubleshooting

### Port Already in Use
```cmd
# Find and kill process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

### Virtual Environment Issues
```cmd
# Recreate virtual environment
rmdir /s .venv
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Build Issues
```cmd
cd frontend
rmdir /s node_modules
rmdir /s dist
npm install
npm run build
npm run dist
```

## Application Features

Once running, you can:
- 🔍 Search YouTube videos
- ⬇️ Download audio files
- 🎵 Separate stems (vocals, bass, drums, etc.)
- 🎧 Play and export separated tracks

## System Requirements

- **OS**: Windows 10/11
- **RAM**: 8GB+ (16GB recommended for AI processing)
- **Storage**: 2GB+ free space
- **GPU**: CUDA-compatible GPU (optional, speeds up processing)

## Support

If you encounter issues:
1. Check that all prerequisites are installed
2. Ensure Python and Node.js are in your PATH
3. Run the setup commands in order
4. Check Windows Defender/antivirus isn't blocking the app