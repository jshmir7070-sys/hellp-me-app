@echo off
echo ========================================
echo  Hellp Me - Fresh Start
echo ========================================
echo.

echo [1/3] Killing existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Cleaning all caches...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
echo Caches cleaned!

echo [3/3] Starting Metro with LAN mode...
echo.
echo IMPORTANT: After Metro starts:
echo 1. Your phone should show a NEW QR code
echo 2. Scan it with Expo Go
echo 3. The app will download a FRESH bundle
echo.

set EXPO_NO_GIT_STATUS=1
npx expo start --clear --lan

pause
