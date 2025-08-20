#!/bin/bash
echo "========================================"
echo "       SplitMe - Audio Stem Separation"
echo "========================================"
echo

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "🎵 Starting SplitMe Application for Mac..."
echo

# Check if Mac executables exist
if [ -f "$DIR/dist/SplitMe-Backend.app/Contents/MacOS/SplitMe-Backend" ] && [ -f "$DIR/frontend/dist/mac-arm64/SplitMe - Stem Splitter.app/Contents/MacOS/SplitMe - Stem Splitter" ]; then
    echo "✅ Mac executables found - using optimized binaries"
    echo
    
    # Start the compiled backend
    echo "🚀 Starting backend..."
    "$DIR/dist/SplitMe-Backend.app/Contents/MacOS/SplitMe-Backend" &
    BACKEND_PID=$!
    
    # Wait a moment for the backend to start
    sleep 3
    
    # Start the compiled frontend
    echo "🖥️  Starting frontend..."
    "$DIR/frontend/dist/mac-arm64/SplitMe - Stem Splitter.app/Contents/MacOS/SplitMe - Stem Splitter" &
    FRONTEND_PID=$!
    
else
    echo "⚠️  Mac executables not found - running from source"
    echo
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        echo "❌ Python3 not found! Please install Python 3.9+"
        exit 1
    fi
    
    echo "✅ Python3 found"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "$DIR/.venv" ]; then
        echo "📦 Creating virtual environment..."
        python3 -m venv "$DIR/.venv"
    fi
    
    # Activate virtual environment
    echo "🔧 Activating virtual environment..."
    source "$DIR/.venv/bin/activate"
    
    # Install requirements if needed
    if [ ! -f "$DIR/requirements_installed.flag" ]; then
        echo "📥 Installing Python requirements..."
        pip install --upgrade pip
        pip install -r "$DIR/requirements.txt"
        touch "$DIR/requirements_installed.flag"
        echo "✅ Requirements installed"
    fi
    
    echo "✅ Python environment ready"
    echo
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo "⚠️  Node.js not found - running in API-only mode"
        echo "📖 Install Node.js from https://nodejs.org to enable the GUI"
        echo
        echo "🚀 Starting SplitMe API Server..."
        echo "🌐 Server will be available at: http://localhost:8000"
        python3 "$DIR/main.py"
        exit 0
    fi
    
    echo "✅ Node.js found"
    
    # Install frontend dependencies if needed
    if [ ! -d "$DIR/frontend/node_modules" ]; then
        echo "📥 Installing frontend dependencies..."
        cd "$DIR/frontend"
        npm install
        cd "$DIR"
    fi
    
    echo "✅ Frontend dependencies ready"
    echo
    
    # Start backend API server
    echo "🚀 Starting backend API server..."
    source "$DIR/.venv/bin/activate"
    python3 -m uvicorn api.server:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    echo "⏳ Waiting for backend to initialize..."
    sleep 3
    
    # Start frontend
    echo "🖥️  Starting frontend application..."
    cd "$DIR/frontend"
    npm run electron &
    FRONTEND_PID=$!
    cd "$DIR"
fi

echo
echo "✅ SplitMe is now running!"
echo "🌐 Backend: Running"
echo "🖥️  Frontend: Running"
echo

# Function to cleanup processes when script exits
cleanup() {
    echo
    echo "🛑 Shutting down SplitMe..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "👋 Goodbye!"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for user to press Ctrl+C
echo "Press Ctrl+C to stop the application..."
wait