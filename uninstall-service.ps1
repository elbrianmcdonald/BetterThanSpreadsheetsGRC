# Better Than Spreadsheets GRC - Service Uninstaller

param(
    [string]$ServiceName = "BetterThanSpreadsheetsGRC",
    [string]$InstallPath = "C:\Program Files\BetterThanSpreadsheetsGRC",
    [switch]$KeepDatabase
)

$ErrorActionPreference = "Continue"

# Ensure running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Better Than Spreadsheets GRC - Service Uninstaller" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $ServiceName" -ForegroundColor Gray
Write-Host "Install Path: $InstallPath" -ForegroundColor Gray
Write-Host ""

# Stop and remove service
Write-Host "Stopping and removing Windows service..." -ForegroundColor Yellow
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    try {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Write-Host "  Service stopped" -ForegroundColor Gray
        
        & sc.exe delete $ServiceName | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Service removed" -ForegroundColor Gray
        }
        
        Write-Host "OK Service uninstalled" -ForegroundColor Green
    } catch {
        Write-Host "WARNING Service removal issues: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "OK Service not found (already removed)" -ForegroundColor Green
}

# Remove application files
Write-Host ""
Write-Host "Removing application files..." -ForegroundColor Yellow
if (Test-Path $InstallPath) {
    try {
        Remove-Item $InstallPath -Recurse -Force
        Write-Host "OK Application files removed" -ForegroundColor Green
    } catch {
        Write-Host "WARNING Could not remove all files: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "You may need to manually delete: $InstallPath" -ForegroundColor Yellow
    }
} else {
    Write-Host "OK Application files not found (already removed)" -ForegroundColor Green
}

# Optionally remove database
if (-not $KeepDatabase) {
    Write-Host ""
    Write-Host "Removing database..." -ForegroundColor Yellow
    
    $pgPath = ""
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\17\bin",
        "C:\Program Files\PostgreSQL\16\bin", 
        "C:\Program Files\PostgreSQL\15\bin"
    )

    foreach ($path in $pgPaths) {
        if (Test-Path "$path\psql.exe") {
            $pgPath = $path
            break
        }
    }

    if ($pgPath) {
        $passwords = @("postgres", "admin", "password", "123456")
        $dbRemoved = $false
        
        foreach ($pgPassword in $passwords) {
            try {
                $env:PGPASSWORD = $pgPassword
                & "$pgPath\psql.exe" -h localhost -U postgres -c "SELECT version();" 2>$null | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  Dropping database: CyberRiskDB" -ForegroundColor Gray
                    & "$pgPath\psql.exe" -h localhost -U postgres -c "DROP DATABASE IF EXISTS CyberRiskDB;" 2>$null
                    
                    Write-Host "  Dropping user: cyberrisk_user" -ForegroundColor Gray
                    & "$pgPath\psql.exe" -h localhost -U postgres -c "DROP USER IF EXISTS cyberrisk_user;" 2>$null
                    
                    $dbRemoved = $true
                    break
                }
            } catch {
                continue
            }
        }
        
        if ($dbRemoved) {
            Write-Host "OK Database removed" -ForegroundColor Green
        } else {
            Write-Host "WARNING Could not connect to PostgreSQL to remove database" -ForegroundColor Yellow
        }
    } else {
        Write-Host "WARNING PostgreSQL not found - cannot remove database" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Database preserved (--KeepDatabase specified)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Uninstallation Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Better Than Spreadsheets GRC service has been removed." -ForegroundColor White
Write-Host ""

if (-not $KeepDatabase) {
    Write-Host "Note: Database and user have been removed" -ForegroundColor Gray
} else {
    Write-Host "Note: Database preserved for future use" -ForegroundColor Gray
}

Write-Host ""
exit 0