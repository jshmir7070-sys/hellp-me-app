@echo off
title Hellp Me - Final Solution
color 0E
cls
echo.
echo ========================================
echo   HELLP ME - Expo Go Mode
echo ========================================
echo.
echo [FIXED] expo-dev-client removed
echo [FIXED] Invalid projectId removed
echo [FIXED] All Colors imports added
echo.
echo This will work with Expo Go app!
echo.
echo ========================================
echo.
pause

echo.
echo [1/4] Killing all Node processes...
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force" 2>nul
timeout /t 2 /nobreak >nul
echo Done!

echo.
echo [2/4] Cleaning all caches...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
if exist android\.gradle rd /s /q android\.gradle
echo Done!

echo.
echo [3/4] Starting Metro Bundler...
echo.

set EXPO_NO_GIT_STATUS=1
set EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

echo ========================================
echo   IMPORTANT!
echo ========================================
echo.
echo 1. Wait for QR code to appear below
echo 2. Open Expo Go app on your phone
echo 3. Tap "Scan QR code"
echo 4. Point camera at the QR code
echo 5. App will load automatically
echo.
echo ========================================
echo.

npx expo start --clear --offline

pause
