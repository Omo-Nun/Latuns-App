@echo off
setlocal
title Latuns ERP - Rejoin Cluster as Secondary Node
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\rejoin-standby.ps1"
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Script encountered an error.
    pause
)
