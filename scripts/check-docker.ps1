# check-docker.ps1 - Verify Docker is installed and running

Write-Host "Checking Docker installation..." -ForegroundColor Cyan

# Check if docker command exists
$dockerPath = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerPath) {
    Write-Host ""
    Write-Host "X Docker is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/"
    Write-Host ""
    Write-Host "After installation, restart your terminal."
    exit 1
}

# Check if docker daemon is running
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "X Docker daemon is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$dockerVersion = docker --version
Write-Host "OK Docker is installed and running" -ForegroundColor Green
Write-Host "   $dockerVersion"
Write-Host ""

# Check if docker compose is available
$composeVersion = docker compose version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK Docker Compose is available" -ForegroundColor Green
    Write-Host "   $composeVersion"
} else {
    Write-Host "X Docker Compose is not available" -ForegroundColor Red
    Write-Host "   Please update Docker Desktop to get Docker Compose"
    exit 1
}

Write-Host ""
Write-Host "Docker is ready! You can now run:" -ForegroundColor Green
Write-Host "  pnpm dev:db    - Start PostgreSQL only" -ForegroundColor Cyan
Write-Host "  pnpm dev:full  - Start PostgreSQL + dev servers" -ForegroundColor Cyan
