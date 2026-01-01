# kill-all.ps1 - Emergency shutdown for Aigentflow
# Usage: .\scripts\kill-all.ps1

Write-Host "Aigentflow Emergency Shutdown" -ForegroundColor Red
Write-Host "==============================" -ForegroundColor Red

# Find and kill Node.js processes running our apps
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "aigentflow|vite|nest|turbo"
}

if ($nodeProcesses) {
    Write-Host "`nFound $($nodeProcesses.Count) Node.js process(es) to terminate:" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        Write-Host "  PID $($proc.Id): $($proc.ProcessName)" -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Terminated." -ForegroundColor Green
} else {
    Write-Host "`nNo matching Node.js processes found." -ForegroundColor Gray
}

# Kill any orphaned Vite dev server processes
$viteProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "vite" -or $_.CommandLine -match "vite"
}

if ($viteProcesses) {
    Write-Host "`nFound $($viteProcesses.Count) Vite process(es):" -ForegroundColor Yellow
    foreach ($proc in $viteProcesses) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Terminated." -ForegroundColor Green
}

# Kill Turbo processes
$turboProcesses = Get-Process -Name "turbo" -ErrorAction SilentlyContinue

if ($turboProcesses) {
    Write-Host "`nFound $($turboProcesses.Count) Turbo process(es):" -ForegroundColor Yellow
    foreach ($proc in $turboProcesses) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Terminated." -ForegroundColor Green
}

# Release port 3001 (API) and 5173 (Vite)
$portsToFree = @(3001, 5173)
foreach ($port in $portsToFree) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "`nFreeing port $port..." -ForegroundColor Yellow
        foreach ($conn in $connections) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "`nAll Aigentflow processes terminated." -ForegroundColor Green
Write-Host "You can now restart with: pnpm dev" -ForegroundColor Cyan
