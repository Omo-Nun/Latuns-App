@echo off
title Latuns ERP - Production Server
echo ========================================================
echo   LATUNS ERP - DOCKER PRODUCTION ENVIRONMENT
echo ========================================================
echo.
echo Starting Latuns Office ERP (Production Mode)...

REM Navigate to the directory where this script is located
cd /d "%~dp0"

REM Check if docker is installed
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in your PATH.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo Starting Docker containers (app, database, syncthing)...
echo This will build the application image if needed.
docker-compose up -d --build

echo Starting Demotion Watcher in the background...
start /min "Latuns Demotion Watcher" cmd /c "node scripts\host-demotion-watcher.js"

echo.
echo ========================================================
echo Server successfully started via Docker!
echo Database is running on port 5433
echo Web App is running on port 3000
echo Syncthing is running on port 8384
echo.
echo Opening in browser...
start http://localhost:3000
echo ========================================================
echo You can safely close this window.
pause
