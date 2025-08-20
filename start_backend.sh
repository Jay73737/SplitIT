#!/bin/bash
echo "Starting SplitMe Backend Server..."
cd /Users/geet/Desktop/SplitMe-2/SplitMe
uvicorn api.server:app --host 0.0.0.0 --port 8000