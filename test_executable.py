#!/usr/bin/env python3
"""
Test script to verify the Python backend executable works
"""

import subprocess
import time
import sys

def test_python_backend():
    """Test if the Python backend executable starts properly"""
    print("🧪 Testing Python backend executable...")
    
    try:
        # Try to run the executable with --help to see if it loads
        process = subprocess.Popen(
            ['./dist/SplitMe-Backend.app/Contents/MacOS/SplitMe-Backend'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Give it a moment to start
        time.sleep(2)
        
        # Check if the process is running
        if process.poll() is None:
            print("✅ Python backend started successfully!")
            process.terminate()
            process.wait()
            return True
        else:
            stdout, stderr = process.communicate()
            print("❌ Python backend failed to start")
            if stderr:
                print(f"Error: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"❌ Error testing Python backend: {e}")
        return False

def test_electron_frontend():
    """Test if the Electron frontend executable exists and is properly formed"""
    print("🧪 Testing Electron frontend executable...")
    
    import os
    app_path = './frontend/dist/mac-arm64/SplitMe - Stem Splitter.app'
    executable_path = f'{app_path}/Contents/MacOS/SplitMe - Stem Splitter'
    
    if os.path.exists(app_path):
        print("✅ Electron app bundle exists!")
        
        if os.path.exists(executable_path):
            print("✅ Electron executable exists!")
            
            # Check if it's executable
            if os.access(executable_path, os.X_OK):
                print("✅ Electron executable has correct permissions!")
                return True
            else:
                print("❌ Electron executable is not executable")
                return False
        else:
            print("❌ Electron executable not found")
            return False
    else:
        print("❌ Electron app bundle not found")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing SplitMe executables...\n")
    
    python_ok = test_python_backend()
    print()
    electron_ok = test_electron_frontend()
    print()
    
    if python_ok and electron_ok:
        print("🎉 All tests passed! SplitMe is ready to use.")
        print("Run ./SplitMe-Launcher.sh to start the application.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())