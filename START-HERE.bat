@echo off
title Hellp Me - Metro Bundler
color 0A
echo.
echo ========================================
echo   HELLP ME - Metro Bundler
echo ========================================
echo.
echo [INFO] Starting Metro in INTERACTIVE mode...
echo [INFO] You will see QR code and menu options
echo.
echo INSTRUCTIONS AFTER METRO STARTS:
echo.
echo 1. Look for the QR CODE in this window
echo 2. Open Expo Go app on your phone
echo 3. Tap "Scan QR code"
echo 4. Scan the QR code shown below
echo.
echo OR manually enter the connection URL:
echo    - Open Expo Go
echo    - Tap "Enter URL manually"
echo    - Type the exp:// URL shown below
echo.
echo ========================================
echo.
pause
echo.

cd /d "%~dp0"
npx expo start

pause
