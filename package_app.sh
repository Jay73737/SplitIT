#!/bin/bash

# SplitMe Application Packaging Script
# This script packages the entire SplitMe application into executable formats

set -e  # Exit on any error

echo "🚀 Starting SplitMe application packaging..."

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the project root."
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required dependencies
echo "🔍 Checking dependencies..."

if ! command_exists python3; then
    echo "❌ Python3 is required but not installed"
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is required but not installed"
    exit 1
fi

echo "✅ All dependencies found"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist build __pycache__ *.spec
rm -rf frontend/dist frontend/build

# Install Python dependencies if needed
if [ ! -f "requirements_installed.flag" ]; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    pip install pyinstaller
    touch requirements_installed.flag
fi

# Build the application using our Python script
echo "🏗️  Building application..."
python3 build_app.py

echo ""
echo "🎉 Packaging complete!"
echo "📁 Find your executable in the dist/ and frontend/dist/ directories"
echo "🚀 Use the launcher script to run the complete application"

# Make the launcher executable
if [ -f "SplitMe-Launcher.sh" ]; then
    chmod +x SplitMe-Launcher.sh
    echo "💡 Run ./SplitMe-Launcher.sh to start the application"
fi