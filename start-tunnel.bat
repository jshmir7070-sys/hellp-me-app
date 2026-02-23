@echo off
echo Stopping all Node processes...
taskkill /IM node.exe /F 2>nul
timeout /t 2 /nobreak >nul

echo Building admin page...
cd admin
call npm run build
cd ..
timeout /t 2 /nobreak >nul

echo Starting backend server...
start "Backend Server" cmd /k "npm run server:dev"
timeout /t 3 /nobreak >nul

echo Starting Expo with Tunnel mode...
echo QR code will appear shortly!
npx expo start --tunnel
