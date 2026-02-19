@echo off
echo Starting Hellp Me Backend Server...
echo.

REM Set environment variables (must match .env file)
set DATABASE_URL=postgresql://postgres:jsh%%21%%2115988@localhost:5432/hellpme
set SESSION_SECRET=NVi+Xvin30/E8Tmiqm6ga5zFEx7iGgL4IHUjh1OZ+hA=
set JWT_SECRET=ENVCAdhnEo6a9REO7k9glWgrogDNB3nTcPJeG/wREBM=
set NODE_ENV=development

echo DATABASE_URL is set
echo Starting server on port 5000...
echo.

npx tsx server/index.ts

pause
