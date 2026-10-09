@echo off
cd /d "%~dp0"
echo ========================================================
echo   Starting employee_frontend on http://localhost:5173
echo ========================================================
echo [1/2] Installing dependencies (including react-router-dom)...
call npm install
echo.
echo [2/2] Launching Vite development server...
call npm run dev -- --host 0.0.0.0 --port 5173
