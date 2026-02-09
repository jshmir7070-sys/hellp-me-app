@echo off
title Hellp Me - USB Connection Mode
color 0B
echo.
echo ========================================
echo   HELLP ME - USB Connection Mode
echo ========================================
echo.
echo This method works WITHOUT WiFi or QR codes!
echo.
echo STEP 1: Connect your phone via USB cable
echo STEP 2: Enable USB Debugging on your phone
echo         (Settings -^> Developer Options -^> USB Debugging)
echo.
echo ========================================
echo.
pause

echo.
echo [1/4] Checking ADB connection...
adb devices
echo.

echo [2/4] Setting up port forwarding...
adb reverse tcp:8081 tcp:8081
echo Port forwarding enabled!
echo.

echo [3/4] Cleaning cache...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache
echo.

echo [4/4] Starting Metro...
echo.
echo ========================================
echo   CONNECTION INFO
echo ========================================
echo.
echo On your phone:
echo   1. Open Expo Go app
echo   2. Tap "Enter URL manually"
echo   3. Type: exp://localhost:8081
echo   4. Tap "Connect"
echo.
echo ========================================
echo.

set EXPO_NO_GIT_STATUS=1
npx expo start --localhost

pause
