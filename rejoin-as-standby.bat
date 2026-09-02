@echo off
title Latuns ERP - Rejoin Cluster as Secondary Node
echo ========================================================
echo   LATUNS ERP - AUTOMATED STANDBY NODE RE-INITIALIZATION
echo ========================================================
echo.
echo This script will reset local database replica data and
echo configure this machine to stream updates from the Primary Master.
echo.

echo Reading PEER_NODE_ADDRESS from .env...
for /f "tokens=2 delims==" %%a in ('findstr /B /I "PEER_NODE_ADDRESS=" .env') do set PEER_IP=%%~a

if "%PEER_IP%"=="" (
    echo Error: PEER_NODE_ADDRESS is missing in .env. Cannot determine Primary Node IP.
    exit /b 1
)

echo Updating .env to persist Standby Role...
powershell -Command "(Get-Content .env) -replace '^NODE_ROLE=.*', 'NODE_ROLE=\"slave\"' | Set-Content .env"

echo Stopping current local containers...
docker-compose down -v

echo Starting node in Standby Replica Mode pointing to %PEER_IP%...
docker-compose up -d

echo.
echo ========================================================
echo Standby Node successfully initialized!
echo Streaming replication will synchronize from %PEER_IP%:5433.
echo ========================================================
echo.
