@echo off
title Latuns ERP - Windows Firewall Configuration
echo ========================================================
echo   LATUNS ERP - CLUSTER FIREWALL SETUP
echo ========================================================
echo.
echo This script opens ports 5433 (Database), 3000 (Web App), and
echo 8384/22000 (Syncthing) for cluster network communication.
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Right-click this script and select 'Run as administrator' to apply firewall rules automatically.
    echo.
    pause
    exit /b 1
)

echo Adding Windows Firewall rules...

netsh advfirewall firewall add rule name="Latuns ERP Web Server (Port 3000)" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
netsh advfirewall firewall add rule name="Latuns ERP Postgres Cluster (Port 5433)" dir=in action=allow protocol=TCP localport=5433 >nul 2>&1
netsh advfirewall firewall add rule name="Latuns ERP Syncthing Web (Port 8384)" dir=in action=allow protocol=TCP localport=8384 >nul 2>&1
netsh advfirewall firewall add rule name="Latuns ERP Syncthing Transfer (Port 22000)" dir=in action=allow protocol=TCP localport=22000 >nul 2>&1

echo.
echo ========================================================
echo [SUCCESS] Windows Firewall rules configured successfully!
echo Latuns ERP cluster nodes can now communicate across local network.
echo ========================================================
echo.
pause
