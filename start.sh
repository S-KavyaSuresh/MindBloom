#!/bin/bash
# ── MindBloom Startup Script ──────────────────────────────────────────────────
# Run this from the MindBloom-RunReady folder: bash start.sh

echo ""
echo "🌸 Starting MindBloom..."
echo ""

# ── Backend ──
echo "▶ Starting Backend (FastAPI)..."
cd backend

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "  Creating virtual environment..."
  python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo "  Installing backend dependencies..."
pip install -r requirements.txt -q

# Check .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo ""
  echo "  ⚠️  No backend/.env found — created one from .env.example"
  echo "  Please open backend/.env and add your GROQ_API_KEY, then re-run this script."
  echo ""
  exit 1
fi

# Start backend in background
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "  ✅ Backend running at http://localhost:8000 (PID: $BACKEND_PID)"

cd ..

# ── Frontend ──
echo ""
echo "▶ Starting Frontend (React + Vite)..."
cd frontend

# Install node_modules if needed
if [ ! -d "node_modules" ]; then
  echo "  Installing frontend dependencies (npm install)..."
  npm install
fi

echo "  ✅ Frontend starting at http://localhost:5173"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌸 MindBloom is running!"
echo "  Open your browser at: http://localhost:5173"
echo "  Press Ctrl+C to stop."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev

# Cleanup backend when frontend exits
kill $BACKEND_PID 2>/dev/null
