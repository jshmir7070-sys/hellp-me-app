@echo off
title Hellp Me - Admin Panel Dev
color 0E
cls
echo.
echo ========================================
echo   HELLP ME - Admin Panel (Dev Mode)
echo ========================================
echo.
echo Starting Vite dev server on port 5173...
echo.
echo Admin URL: http://localhost:5173/admin
echo.
echo Login:
echo   Email: jshmir7070@gmail.com
echo   Password: jsh!!15988
echo.
echo ========================================
echo.

cd /d "%~dp0\admin"
npm run dev

pause
