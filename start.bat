@echo off
REM ── MindBloom Startup Script (Windows) ───────────────────────────────────────
REM Run this from the MindBloom-RunReady folder: start.bat

echo.
echo Starting MindBloom...
echo.

REM ── Backend ──
echo Starting Backend (FastAPI)...
cd backend

REM Create venv if needed
if not exist "venv" (
    echo   Creating virtual environment...
    python -m venv venv
)

REM Activate and install
call venv\Scripts\activate.bat
echo   Installing backend dependencies...
pip install -r requirements.txt -q

REM Check .env
if not exist ".env" (
    copy .env.example .env
    echo.
    echo   No backend\.env found - created from .env.example
    echo   Please open backend\.env and add your GROQ_API_KEY, then re-run.
    echo.
    pause
    exit /b 1
)

REM Start backend in new window
start "MindBloom Backend" cmd /k "venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
echo   Backend starting at http://localhost:8000

cd ..

REM ── Frontend ──
echo.
echo Starting Frontend (React + Vite)...
cd frontend

if not exist "node_modules" (
    echo   Installing frontend dependencies...
    npm install
)

echo.
echo ================================================
echo   MindBloom is starting!
echo   Open your browser at: http://localhost:5173
echo   Close this window to stop the frontend.
echo ================================================
echo.

npm run dev
