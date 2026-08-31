@echo off
title Latuns ERP - Rejoin Cluster as Secondary Node
echo ========================================================
echo   LATUNS ERP - AUTOMATED STANDBY NODE RE-INITIALIZATION
echo ========================================================
echo.
echo This script will reset local database replica data and
echo configure this machine to stream updates from the Primary Master.
echo.

set /p PEER_IP="Enter the IP Address of the current Primary Master Node: "
if "%PEER_IP%"=="" (
    echo Error: Primary Node IP address is required.
    pause
    exit /b 1
)

echo Stopping current local containers...
docker-compose down -v

echo Starting node in Standby Replica Mode pointing to %PEER_IP%...
set NODE_ROLE=slave
set PEER_NODE_ADDRESS=%PEER_IP%
docker-compose up -d

echo.
echo ========================================================
echo Standby Node successfully initialized!
echo Streaming replication will synchronize from %PEER_IP%:5433.
echo ========================================================
echo.
pause
