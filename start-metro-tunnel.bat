@echo off
echo ========================================
echo  Hellp Me - Metro Bundler (Tunnel Mode)
echo ========================================
echo.

echo [1/4] Killing existing Node processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Cleaning cache directories...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
echo Cache cleaned!

echo [3/4] Starting Metro Bundler with Tunnel...
echo This will create a QR code for remote access.
echo Scan the QR code with Expo Go app on your phone.
echo.

set EXPO_NO_GIT_STATUS=1
npx expo start --clear --tunnel

pause
