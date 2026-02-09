@echo off
title Hellp Me - Firewall Fix
color 0C
echo.
echo ========================================
echo   Windows Firewall Configuration
echo ========================================
echo.
echo This will allow Metro Bundler (port 8081)
echo through Windows Firewall.
echo.
echo This requires ADMINISTRATOR privileges.
echo Right-click this file and select "Run as administrator"
echo.
pause

echo.
echo Adding firewall rules...
echo.

netsh advfirewall firewall delete rule name="Metro Bundler (Expo)" >nul 2>&1

netsh advfirewall firewall add rule name="Metro Bundler (Expo)" dir=in action=allow protocol=TCP localport=8081
netsh advfirewall firewall add rule name="Metro Bundler (Expo)" dir=out action=allow protocol=TCP localport=8081

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   SUCCESS!
    echo ========================================
    echo.
    echo Firewall rules added successfully.
    echo Port 8081 is now accessible from your phone.
    echo.
) else (
    echo.
    echo ========================================
    echo   ERROR!
    echo ========================================
    echo.
    echo Failed to add firewall rules.
    echo Please run this file as ADMINISTRATOR:
    echo   1. Right-click fix-firewall.bat
    echo   2. Select "Run as administrator"
    echo.
)

pause
