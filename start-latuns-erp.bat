@echo off
echo Starting Latuns Office ERP...

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

REM Start the Next.js development server
echo Starting the development server...
start "Latuns ERP Server" cmd /c "npm run dev"

REM Wait a few seconds for the server to spin up
echo Waiting for server to initialize...
timeout /t 5 /nobreak >nul

REM Open the application in the default web browser
echo Opening in browser...
start http://localhost:3000

echo Done! The server window will remain open in the background.
exit
