@echo off
title Hellp Me - Complete Startup
color 0A
cls

echo.
echo ========================================
echo   HELLP ME - Complete Startup
echo ========================================
echo.
echo This will:
echo   1. Configure network (detect IP)
echo   2. Start backend server
echo   3. Start Metro bundler
echo   4. Show QR code for Expo Go
echo.
pause

REM Step 1: Get PC IP
echo.
echo [1/4] Detecting PC IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address" ^| findstr /V "127.0.0.1"') do (
    set IP=%%a
    goto :found
)

:found
set IP=%IP: =%
echo Found IP: %IP%

REM Step 2: Update .env
echo.
echo [2/4] Updating .env configuration...
powershell -Command "(Get-Content .env) -replace 'EXPO_PUBLIC_DOMAIN=.*', 'EXPO_PUBLIC_DOMAIN=%IP%:5000' | Set-Content .env"
echo Configuration updated!

REM Step 3: Kill existing processes
echo.
echo [3/4] Cleaning up existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

REM Clean caches
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
echo Cleanup done!

REM Step 4: Start backend server in new window
echo.
echo [4/4] Starting services...
echo.
echo Starting backend server in new window...
start "Hellp Me - Backend Server" cmd /k "npm run server:dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Backend Server Started
echo ========================================
echo   URL: http://%IP%:5000
echo ========================================
echo.
echo Starting Metro Bundler...
echo.
echo ========================================
echo   IMPORTANT - QR CODE
echo ========================================
echo.
echo 1. Wait for QR code to appear below
echo 2. Open Expo Go on your phone
echo 3. Scan the QR code
echo 4. App will connect to: http://%IP%:5000
echo.
echo Make sure your phone is on the SAME WiFi!
echo.
echo ========================================
echo.

set EXPO_NO_GIT_STATUS=1
npx expo start --clear --offline

pause
