@echo off
echo Starting Hellp Me Backend Server...
echo.

REM Set environment variables
set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/hellpme
set SESSION_SECRET=localsessionsecret123
set JWT_SECRET=localjwtsecret456
set NODE_ENV=development

echo DATABASE_URL is set
echo Starting server on port 5000...
echo.

npx tsx server/index.ts

pause
