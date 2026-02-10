@echo off
setlocal enabledelayedexpansion
title Fix IP Address
color 0E

echo.
echo ========================================
echo   IP Address Detection and Fix
echo ========================================
echo.

REM Get all IPv4 addresses
echo Detecting available IP addresses...
echo.
set count=0
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set /a count+=1
    set "ip!count!=%%a"
    set "ip!count!=!ip%count%: =!"
    echo [!count!] !ip%count%!
)

if %count%==0 (
    echo ERROR: No IP addresses found!
    pause
    exit /b 1
)

echo.
echo ========================================
echo.

REM Use first non-localhost IP
set SELECTED_IP=!ip1!

echo Selected IP: %SELECTED_IP%
echo.
echo Updating .env file...

REM Create backup
copy .env .env.backup >nul 2>&1

REM Update the .env file using PowerShell
powershell -Command "$content = Get-Content .env; $content = $content -replace 'EXPO_PUBLIC_DOMAIN=.*', 'EXPO_PUBLIC_DOMAIN=%SELECTED_IP%:5000'; $content | Set-Content .env"

echo.
echo ========================================
echo   SUCCESS!
echo ========================================
echo.
echo .env file updated:
echo   EXPO_PUBLIC_DOMAIN=%SELECTED_IP%:5000
echo.
echo Backup saved as: .env.backup
echo.
echo Next steps:
echo   1. Restart backend server (close and rerun)
echo   2. Restart Metro (run FINAL-START.bat)
echo   3. Scan QR code again
echo.
pause
