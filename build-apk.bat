@echo off
echo ========================================
echo  Hellp Me - APK Builder (EAS Cloud)
echo ========================================
echo.

echo This will:
echo 1. Configure EAS project (if needed)
echo 2. Build a development APK in the cloud
echo 3. Give you a download link for your phone
echo.
echo Requirements:
echo - Expo account (free)
echo - ~10-15 minutes build time
echo.

pause

echo.
echo [1/2] Configuring EAS project...
npx eas init

echo.
echo [2/2] Starting cloud build...
echo The build link will appear below.
echo Open it on your phone to download and install.
echo.
npx eas build --profile development --platform android

pause
