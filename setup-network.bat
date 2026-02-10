@echo off
title Hellp Me - Network Setup
color 0D
cls
echo.
echo ========================================
echo   Network Configuration
echo ========================================
echo.
echo Detecting your PC's IP address...
echo.

REM Get WiFi IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address" ^| findstr /V "127.0.0.1"') do (
    set IP=%%a
    goto :found
)

:found
REM Remove leading spaces
set IP=%IP: =%

echo.
echo ========================================
echo   Detected IP: %IP%
echo ========================================
echo.
echo This IP will be used for:
echo - Backend API: http://%IP%:5000
echo - Metro Bundler: http://%IP%:8081
echo.
echo Your phone must be on the same WiFi network!
echo.
pause

echo.
echo Updating .env file...

REM Backup current .env
copy .env .env.backup >nul 2>&1

REM Update EXPO_PUBLIC_DOMAIN in .env
powershell -Command "(Get-Content .env) -replace 'EXPO_PUBLIC_DOMAIN=.*', 'EXPO_PUBLIC_DOMAIN=%IP%:5000' | Set-Content .env"

echo Done!
echo.
echo ========================================
echo   Configuration Updated
echo ========================================
echo.
echo Backend Server: http://%IP%:5000
echo Metro Bundler: http://%IP%:8081
echo.
echo Next steps:
echo 1. Restart the backend server (if running)
echo 2. Run FINAL-START.bat to start Metro
echo 3. Scan QR code with Expo Go
echo.
echo The app will now connect to: http://%IP%:5000
echo.
pause
