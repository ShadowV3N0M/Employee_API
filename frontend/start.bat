@echo off
cd /d "%~dp0"
echo ======================================================================
echo   Starting StaffPortal Frontend on http://localhost:5173
echo   Note: Ensure Backend API is running on http://localhost:8000
echo   (Tip: Run start.bat in the root folder to start both together)
echo ======================================================================
call npm run dev -- --host 0.0.0.0 --port 5173
