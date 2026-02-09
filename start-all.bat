@echo off
echo ========================================
echo  Hellp Me - Start All Services
echo ========================================
echo.

echo This will open TWO windows:
echo  1. Backend Server (Port 5000)
echo  2. Metro Bundler (Port 8081)
echo.

echo [1/3] Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process on port 5000: %%a
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8081') do (
    echo Killing process on port 8081: %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/3] Clearing Metro cache...
if exist .expo rd /s /q .expo >nul 2>&1
if exist node_modules\.cache rd /s /q node_modules\.cache >nul 2>&1

echo [3/3] Starting services...
echo.

start "Hellp Me - Backend Server" cmd /k "npm run server:dev"
timeout /t 3 /nobreak >nul

start "Hellp Me - Metro Bundler" cmd /k "npx expo start --clear"

echo.
echo ========================================
echo  Both services are starting!
echo ========================================
echo  Backend: http://localhost:5000
echo  Metro:   http://localhost:8081
echo ========================================
echo.
echo Close this window anytime.
timeout /t 5 /nobreak >nul
