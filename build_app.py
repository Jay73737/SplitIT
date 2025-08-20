#!/usr/bin/env python3
"""
Build script for SplitMe application packaging
"""

import os
import subprocess
import sys
import shutil
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a command and handle errors"""
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, check=True, capture_output=True, text=True)
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(f"stdout: {e.stdout}")
        print(f"stderr: {e.stderr}")
        return False

def create_pyinstaller_spec():
    """Create a PyInstaller spec file for the Python backend"""
    spec_content = """
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('src', 'src'),
        ('api', 'api'),
        ('assets', 'assets'),
        ('config', 'config'),
        ('requirements.txt', '.'),
    ],
    hiddenimports=[
        'torch',
        'torchaudio', 
        'demucs',
        'PyQt6',
        'PyQt6.QtWidgets',
        'PyQt6.QtGui',
        'PyQt6.QtCore',
        'numpy',
        'scipy',
        'soundfile',
        'librosa',
        'pydub',
        'psutil',
        'requests'
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SplitMe-Backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='SplitMe-Backend'
)
"""
    
    with open('splitme.spec', 'w') as f:
        f.write(spec_content)

def build_python_backend():
    """Build the Python backend using PyInstaller"""
    print("Building Python backend...")
    
    # Create spec file
    create_pyinstaller_spec()
    
    # Run PyInstaller
    cmd = "pyinstaller --clean splitme.spec"
    return run_command(cmd)

def build_electron_frontend():
    """Build the Electron frontend"""
    print("Building Electron frontend...")
    
    # Change to frontend directory
    frontend_dir = Path("frontend")
    
    # Install dependencies if needed
    if not (frontend_dir / "node_modules").exists():
        print("Installing npm dependencies...")
        if not run_command("npm install", cwd=frontend_dir):
            return False
    
    # Build the React app
    print("Building React app...")
    if not run_command("npm run build", cwd=frontend_dir):
        return False
    
    # Package with Electron Builder
    print("Packaging with Electron Builder...")
    return run_command("npm run dist", cwd=frontend_dir)

def create_launcher_script():
    """Create a launcher script that starts both backend and frontend"""
    if sys.platform == "win32":
        launcher_content = """@echo off
echo Starting SplitMe...
start "Backend" "%~dp0backend\\SplitMe-Backend\\SplitMe-Backend.exe"
timeout /t 2 /nobreak >nul
start "Frontend" "%~dp0SplitMe - Stem Splitter.exe"
"""
        with open("SplitMe-Launcher.bat", "w") as f:
            f.write(launcher_content)
    else:
        launcher_content = """#!/bin/bash
echo "Starting SplitMe..."
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
"$DIR/backend/SplitMe-Backend/SplitMe-Backend" &
sleep 2
"$DIR/SplitMe - Stem Splitter.app/Contents/MacOS/SplitMe - Stem Splitter" &
wait
"""
        with open("SplitMe-Launcher.sh", "w") as f:
            f.write(launcher_content)
        os.chmod("SplitMe-Launcher.sh", 0o755)

def main():
    """Main build process"""
    print("Starting SplitMe application build process...")
    
    # Ensure we're in the right directory
    if not Path("main.py").exists():
        print("Error: main.py not found. Please run this script from the project root.")
        sys.exit(1)
    
    # Clean previous builds
    for dir_name in ["dist", "build", "__pycache__"]:
        if Path(dir_name).exists():
            print(f"Cleaning {dir_name}...")
            shutil.rmtree(dir_name)
    
    # Build Python backend
    if not build_python_backend():
        print("Failed to build Python backend")
        sys.exit(1)
    
    # Build Electron frontend  
    if not build_electron_frontend():
        print("Failed to build Electron frontend")
        sys.exit(1)
    
    # Create launcher script
    create_launcher_script()
    
    print("\\n=== Build Complete! ===")
    print("Executables created:")
    print(f"- Backend: dist/SplitMe-Backend/")
    print(f"- Frontend: frontend/dist/")
    print(f"- Launcher: SplitMe-Launcher.{'bat' if sys.platform == 'win32' else 'sh'}")
    print("\\nTo run the application, use the launcher script.")

if __name__ == "__main__":
    main()