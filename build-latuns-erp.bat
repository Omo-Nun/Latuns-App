@echo off
echo Building Latuns Office ERP for production...
echo This process will compile the application and may take a few minutes.

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

echo.
echo Running "npm run build"...
echo.

call npm run build

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed. Please check the errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [SUCCESS] Build completed successfully!
echo You can now use the production start script to run the application.
pause
exit
