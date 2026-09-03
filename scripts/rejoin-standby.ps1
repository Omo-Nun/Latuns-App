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

# ============================================================
# PRE-FLIGHT CHECK: Verify Primary Master is reachable
# This prevents destroying the local data volume when the
# primary is unreachable (which would leave us with an empty DB).
# ============================================================
Write-Host ""
Write-Host "Pre-flight: Verifying Primary Master is reachable at ${cleanPeer}:5433..." -ForegroundColor Yellow

$maxRetries = 3
$reachable = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpClient.BeginConnect($cleanPeer, 5433, $null, $null)
        $waitResult = $asyncResult.AsyncWaitHandle.WaitOne(3000) # 3 second timeout
        
        if ($waitResult -and $tcpClient.Connected) {
            $tcpClient.Close()
            $reachable = $true
            Write-Host "Primary Master is reachable on attempt $i." -ForegroundColor Green
            break
        } else {
            $tcpClient.Close()
            Write-Host "Attempt $i/$maxRetries: Connection timed out." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Attempt $i/$maxRetries: Connection failed - $_" -ForegroundColor Yellow
    }
    
    if ($i -lt $maxRetries) {
        Write-Host "Retrying in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

if (-not $reachable) {
    Write-Host "" -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "  [ABORT] Cannot reach Primary Master at ${cleanPeer}:5433" -ForegroundColor Red
    Write-Host "  Rejoin aborted to prevent data loss." -ForegroundColor Red
    Write-Host "  Fix network connectivity first, then retry." -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host ""
    pause
    exit 1
}

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
