@echo off
echo ========================================
echo  Hellp Me - Backend Server Starter
echo ========================================
echo.

echo [1/3] Checking if port 5000 is in use...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Found process on port 5000: %%a
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 2 /nobreak >nul
)

echo [2/3] Port 5000 is now free!

echo [3/3] Starting backend server on port 5000...
echo Server will auto-reload on file changes (tsx --watch)
echo.

npm run server:dev

pause
