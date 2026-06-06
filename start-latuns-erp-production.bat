@echo off
echo Starting Latuns Office ERP (Production Mode)...

REM Navigate to the directory where this script is located
cd /d "%~dp0"

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if the build folder exists, if not, build the app
if not exist ".next" (
    echo First time setup: Building the application for production...
    echo This may take a couple of minutes...
    call npm run build
) else (
    echo Note: If you have made recent code changes, you may need to run "npm run build" manually first.
)

REM Start the Next.js production server
echo Starting the production server...
start "Latuns ERP Production Server" cmd /c "npm start"

REM Wait a few seconds for the server to spin up
echo Waiting for server to initialize...
timeout /t 5 /nobreak >nul

REM Open the application in the default web browser
echo Opening in browser...
start http://localhost:3000

echo Done! The server window will remain open in the background.
exit
