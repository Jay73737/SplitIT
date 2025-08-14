#!/bin/bash

echo "🎵 Setting up SplitMe - Audio Stem Separation App"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python is not installed. Please install Python first:"
    echo "   https://python.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ Python version: $(python3 --version 2>/dev/null || python --version)"
echo ""

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt 2>/dev/null || pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✅ Python dependencies installed successfully"
else
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

# Navigate to frontend directory
if [ -d "frontend" ]; then
    echo "📦 Installing Node.js dependencies for frontend..."
    cd frontend
    
    # Install npm dependencies
    npm install
    
    if [ $? -eq 0 ]; then
        echo "✅ Node.js dependencies installed successfully"
        echo ""
        echo "🚀 Setup complete! You can now run:"
        echo "   Python version: python main.py"
        echo "   Electron version: cd frontend && npm run electron-dev"
    else
        echo "❌ Failed to install Node.js dependencies"
        exit 1
    fi
else
    echo "❌ Frontend directory not found"
    exit 1
fi