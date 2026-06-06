@echo off
echo Starting Latuns ERP Node Initialization...

:: Load environment variables from .env if it exists
if exist .env (
    for /f "tokens=1,* delims==" %%A in (.env) do (
        if not "%%B"=="" set "%%A=%%B"
    )
)

:: Start the Next.js production server
echo [1/2] Launching ERP Interface...
start "Latuns ERP Server" cmd /c "npm run start"

:: Give the server a few seconds to boot before the daemon tries to hit it
timeout /t 5 /nobreak >nul

:: Start the background daemon
echo [2/2] Launching Background Daemon...
start "Latuns Background Daemon" cmd /c "node scripts/heartbeat.js"

echo Node Initialization Complete.
echo The ERP interface is available at http://localhost:3000
echo Both the server and daemon are now running in background terminal windows.
pause
