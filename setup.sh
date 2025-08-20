#!/bin/bash
echo "========================================"
echo "       SplitMe Setup for Mac/Linux"
echo "========================================"
echo

echo "🔧 Setting up SplitMe for first-time use..."
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found!"
    echo
    echo "Please install Python 3.9+ from: https://www.python.org/downloads/"
    echo "Or use Homebrew: brew install python"
    echo
    exit 1
fi

echo "✅ Python3 found"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js not found"
    echo
    echo "For the full GUI experience, install Node.js from: https://nodejs.org"
    echo "Or use Homebrew: brew install node"
    echo "You can still use SplitMe in API mode without Node.js"
    echo
else
    echo "✅ Node.js found"
fi

echo
echo "🎉 Setup complete! You can now run:"
echo
echo "    ./SplitMe-Launcher.sh"
echo
echo "This will automatically:"
echo "✓ Create a Python virtual environment"
echo "✓ Install all required dependencies"
echo "✓ Start both backend and frontend"
echo