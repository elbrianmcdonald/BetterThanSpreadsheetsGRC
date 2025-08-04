# Quick Fix for CyberRisk App Connection Issues
Write-Host "CyberRisk App - Quick Fix Script" -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

# Step 1: Check if PostgreSQL is running
Write-Host "`nStep 1: Checking PostgreSQL service..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService) {
    Write-Host "PostgreSQL service found: $($pgService.Name) - Status: $($pgService.Status)" -ForegroundColor Cyan
    if ($pgService.Status -ne "Running") {
        Write-Host "Starting PostgreSQL service..." -ForegroundColor Yellow
        Start-Service $pgService.Name -ErrorAction SilentlyContinue
        Start-Sleep 3
        $pgService = Get-Service $pgService.Name
        Write-Host "PostgreSQL service status: $($pgService.Status)" -ForegroundColor Cyan
    }
} else {
    Write-Host "PostgreSQL service not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host "Or run the app without database connection first." -ForegroundColor Yellow
}

# Step 2: Kill any existing CyberRiskApp processes
Write-Host "`nStep 2: Stopping existing CyberRiskApp processes..." -ForegroundColor Yellow
Get-Process -Name "CyberRiskApp" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Step 3: Try to run the app directly (without service)
Write-Host "`nStep 3: Starting CyberRiskApp directly..." -ForegroundColor Yellow
cd "publish\CyberRiskApp"

# Set environment to skip database migration on startup if DB not available
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:SKIP_DB_MIGRATION = "true"

Write-Host "Starting CyberRiskApp on http://localhost:5197..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the application" -ForegroundColor Gray

# Start the application
try {
    .\CyberRiskApp.exe --urls "http://localhost:5197"
} catch {
    Write-Host "Error starting application: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nTroubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Check if port 5197 is already in use: netstat -ano | findstr :5197" -ForegroundColor White
    Write-Host "2. Try a different port: .\CyberRiskApp.exe --urls `"http://localhost:8080`"" -ForegroundColor White
    Write-Host "3. Check the console output above for specific errors" -ForegroundColor White
}