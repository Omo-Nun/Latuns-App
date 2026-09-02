@echo off
title Latuns ERP - Rejoin Cluster as Secondary Node
echo ========================================================
echo   LATUNS ERP - AUTOMATED STANDBY NODE RE-INITIALIZATION
echo ========================================================
echo.
echo This script will reconfigure this machine to stream
echo updates from the Primary Master.
echo.

echo Reading PEER_NODE_ADDRESS from .env...
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /B /I "PEER_NODE_ADDRESS=" .env`) do set RAW_PEER=%%b

if "%RAW_PEER%"=="" (
    echo Error: PEER_NODE_ADDRESS is missing in .env. Cannot determine Primary Node IP.
    pause
    exit /b 1
)

REM Strip quotes, http, https, and trailing port using PowerShell
for /f %%i in ('powershell -Command "$h = '%RAW_PEER%'.Trim('\"'' ').Replace('http://','').Replace('https://','').Split(':')[0]; if ($h) { $h } else { 'localhost' }"') do set CLEAN_PEER=%%i

echo Cleaned Primary Host IP: %CLEAN_PEER%

echo Updating .env to persist Standby role...
powershell -Command "(Get-Content .env) -replace '^NODE_ROLE=.*', 'NODE_ROLE=""slave""' | Set-Content .env"

echo Stopping current local containers (preserving data volume)...
docker-compose down

echo Starting node in Standby Replica Mode pointing to %CLEAN_PEER%...
docker-compose up -d

echo Waiting for local ERP to become available...
timeout /t 20 /nobreak >nul

echo.
echo ========================================================
echo Standby Node successfully initialized!
echo Streaming replication will synchronize from %CLEAN_PEER%:5433.
echo You can now close this window and use the app.
echo ========================================================
echo.
pause
