#!/bin/bash
# Simple script to start the Electron app with auto-backend startup

echo "🚀 Starting SplitMe with auto-backend..."
echo "This will:"
echo "1. ✅ Start the React dev server (port 3000)"
echo "2. ✅ Auto-start the Python backend server (port 5050)"  
echo "3. ✅ Start the Electron app"
echo "4. ✅ Auto-shutdown everything when app closes"
echo ""

# Make sure we're in the frontend directory
cd "$(dirname "$0")"

# Use the automated electron-dev script that handles React + Electron
npm run electron-dev