#!/bin/bash
echo "🚀 Starting SplitMe Application..."

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Start the Python backend
echo "Starting Python backend..."
"$DIR/dist/SplitMe-Backend.app/Contents/MacOS/SplitMe-Backend" &
BACKEND_PID=$!

# Wait a moment for the backend to start
sleep 3

# Start the Electron frontend
echo "Starting Electron frontend..."
"$DIR/frontend/dist/mac-arm64/SplitMe - Stem Splitter.app/Contents/MacOS/SplitMe - Stem Splitter" &
FRONTEND_PID=$!

echo "✅ SplitMe is now running!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Function to cleanup processes when script exits
cleanup() {
    echo "🛑 Shutting down SplitMe..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Goodbye!"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for the frontend to finish
wait $FRONTEND_PID