#!/usr/bin/env python3
"""
Quick packaging script for SplitMe application
"""

import os
import subprocess
import sys
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a command and print output"""
    print(f"Running: {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, check=True, text=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}")
        return False

def main():
    """Quick packaging approach"""
    print("Quick packaging for SplitMe...")
    
    # 1. Create a simple PyInstaller command for the Python backend
    print("\n1. Building Python backend...")
    pyinstaller_cmd = """pyinstaller --onedir --windowed --name "SplitMe-Backend" \
        --add-data "src:src" \
        --add-data "api:api" \
        --add-data "assets:assets" \
        --add-data "config:config" \
        --hidden-import torch \
        --hidden-import torchaudio \
        --hidden-import demucs \
        --hidden-import PyQt6 \
        main.py"""
    
    if run_command(pyinstaller_cmd):
        print("✅ Python backend built successfully")
    else:
        print("❌ Python backend build failed")
        return
    
    # 2. Build the Electron frontend
    print("\n2. Building Electron frontend...")
    frontend_dir = Path("frontend")
    
    # Build React app
    if run_command("npm run build", cwd=frontend_dir):
        print("✅ React app built")
    else:
        print("❌ React app build failed")
        return
    
    # Package with Electron
    if run_command("npm run dist", cwd=frontend_dir):
        print("✅ Electron app packaged")
    else:
        print("❌ Electron packaging failed")
        return
    
    print("\n🎉 Packaging complete!")
    print("Backend executable: dist/SplitMe-Backend/")
    print("Frontend executable: frontend/dist/")

if __name__ == "__main__":
    main()