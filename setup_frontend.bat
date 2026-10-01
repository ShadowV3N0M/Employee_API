@echo off
cd /d "d:\Sagar\Python\employee_api"

echo ========================================================
echo   Setting up and Starting Frontend on Port 5173
echo ========================================================

echo [1/4] Fixing folder permissions...
icacls "frontend" /grant Everyone:(OI)(CI)F /c /q >nul 2>&1
attrib -r -s -h "frontend\*.*" /s /d >nul 2>&1

echo [2/4] Removing stray binaries...
del /f /q /a "frontend\node.exe" "frontend\npm" "frontend\npm.cmd" "frontend\npm.ps1" "frontend\npx" "frontend\npx.cmd" "frontend\npx.ps1" "frontend\corepack" "frontend\corepack.cmd" "frontend\install_tools.bat" "frontend\nodevars.bat" >nul 2>&1
rmdir /s /q "frontend\node_modules" >nul 2>&1

echo [3/4] Installing dependencies with npm...
cd /d "d:\Sagar\Python\employee_api\frontend"
call npm install

echo.
echo ========================================================
echo   Launching Vite Frontend (http://localhost:5173)
echo ========================================================
call npm run dev -- --host 0.0.0.0 --port 5173
