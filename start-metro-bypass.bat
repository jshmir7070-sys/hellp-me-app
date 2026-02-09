@echo off
echo ========================================
echo  Metro Bundler - Validation Bypass Mode
echo ========================================
echo.

echo [1/4] Killing existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Setting bypass environment variables...
set EXPO_NO_GIT_STATUS=1
set EXPO_NO_TELEMETRY=1
set EXPO_NO_DOCTOR=1
set CI=1

echo [3/4] Clearing cache...
if exist .expo rd /s /q .expo
if exist node_modules\.cache rd /s /q node_modules\.cache

echo [4/4] Starting Metro with React Native CLI...
echo This bypasses Expo CLI validation completely!
echo.

:: Use React Native CLI directly instead of Expo CLI
npx react-native start --reset-cache --port 8081

pause
