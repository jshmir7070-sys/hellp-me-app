@echo off
title Hellp Me - Expo Metro
color 0B
cls
echo.
echo ========================================
echo   HELLP ME - Expo Metro Bundler
echo ========================================
echo.
echo Starting Expo on port 8081...
echo QR code will appear below.
echo.
echo Expo Go URL: exp://192.168.219.101:8081
echo.
echo ========================================
echo.

cd /d "%~dp0"
npx expo start --clear

pause
