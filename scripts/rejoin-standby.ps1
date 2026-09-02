# Latuns ERP - Automated Standby Node Re-Initialization
$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  LATUNS ERP - AUTOMATED STANDBY NODE RE-INITIALIZATION" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

$envFile = Join-Path $rootDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] .env file not found at $envFile" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Reading PEER_NODE_ADDRESS from .env..." -ForegroundColor Yellow
$envContent = Get-Content $envFile -Raw
$peerMatch = [regex]::Match($envContent, '(?m)^PEER_NODE_ADDRESS=["'']?([^"''\r\n]+)["'']?')

if (-not $peerMatch.Success -or [string]::IsNullOrWhiteSpace($peerMatch.Groups[1].Value)) {
    Write-Host "[ERROR] PEER_NODE_ADDRESS is missing or empty in .env" -ForegroundColor Red
    pause
    exit 1
}

$rawPeer = $peerMatch.Groups[1].Value.Trim()
# Clean IP / hostname: remove http://, https://, and port
$cleanPeer = $rawPeer -replace '^https?://', '' -replace ':\d+$', ''
$cleanPeer = $cleanPeer.Trim()

Write-Host "Target Primary Master IP: $cleanPeer" -ForegroundColor Green

Write-Host "Updating .env to set NODE_ROLE=`"slave`"..." -ForegroundColor Yellow
if ($envContent -match '(?m)^NODE_ROLE=.*') {
    $newEnvContent = $envContent -replace '(?m)^NODE_ROLE=.*', 'NODE_ROLE="slave"'
} else {
    $newEnvContent = $envContent + "`nNODE_ROLE=""slave"""
}
Set-Content -Path $envFile -Value $newEnvContent -NoNewline

Write-Host "Stopping current local containers and resetting replica data volume..." -ForegroundColor Yellow
docker-compose down -v

Write-Host "Starting node in Standby Replica mode (replicating from ${cleanPeer}:5433)..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "Waiting for PostgreSQL standby to initialize from Primary..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Standby Node successfully re-initialized!" -ForegroundColor Green
Write-Host "  Streaming replication is synchronizing from $cleanPeer" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
