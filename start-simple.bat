@echo off
echo ========================================
echo  Hellp Me - Simple Start
echo ========================================
echo.

echo [1/3] Killing existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Cleaning caches...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
echo Done!

echo [3/3] Starting Metro...
echo.
set EXPO_NO_GIT_STATUS=1
npx expo start --clear

pause
