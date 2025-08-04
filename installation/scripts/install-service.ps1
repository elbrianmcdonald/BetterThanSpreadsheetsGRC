# Service Installation Script for Better Than Spreadsheets GRC
# This script installs the application as a Windows service

param(
    [string]$ServiceName = "BetterThanSpreadsheetsGRC",
    [string]$ServiceDisplayName = "Better Than Spreadsheets GRC",
    [string]$InstallPath = "C:\Program Files\Better Than Spreadsheets GRC",
    [string]$DatabaseName = "CyberRiskDB",
    [string]$DatabaseUser = "cyberrisk_user",
    [string]$DatabasePassword = "CyberRisk123!"
)

$ErrorActionPreference = "Continue"

# Ensure running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "Installing Better Than Spreadsheets GRC as Windows Service" -ForegroundColor Cyan
Write-Host ""

# Stop and remove existing service
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

# Find the main executable
$mainExe = Get-ChildItem "$InstallPath\*.exe" | Where-Object { $_.Name -match "CyberRiskApp" } | Select-Object -First 1
if (-not $mainExe) {
    Write-Host "ERROR: Could not find main application executable in $InstallPath" -ForegroundColor Red
    exit 1
}

# Create connection string
$connectionString = "Host=localhost;Database=$DatabaseName;Username=$DatabaseUser;Password=$DatabasePassword"

# Create production configuration
$productionConfig = @{
    "ConnectionStrings" = @{
        "DefaultConnection" = $connectionString
    }
    "Logging" = @{
        "LogLevel" = @{
            "Default" = "Information"
            "Microsoft.AspNetCore" = "Warning"
        }
    }
    "AllowedHosts" = "*"
    "Kestrel" = @{
        "Endpoints" = @{
            "Http" = @{
                "Url" = "http://localhost:5197"
            }
            "Https" = @{
                "Url" = "https://localhost:7212"
            }
        }
    }
} | ConvertTo-Json -Depth 10

$productionConfig | Out-File "$InstallPath\appsettings.Production.json" -Encoding UTF8

# Create service
Write-Host "Creating Windows service: $ServiceName" -ForegroundColor Yellow
$servicePath = "`"$($mainExe.FullName)`""

& sc.exe create $ServiceName binPath=$servicePath start=auto DisplayName="$ServiceDisplayName" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create service" -ForegroundColor Red
    exit 1
}

# Set service description and recovery
& sc.exe description $ServiceName "Better Than Spreadsheets GRC - Enterprise Risk Management Platform" | Out-Null
& sc.exe failure $ServiceName reset=86400 actions=restart/5000/restart/5000/restart/5000 | Out-Null

# Set environment variables for the service
$env:ASPNETCORE_ENVIRONMENT = "Production"

Write-Host "OK Service created successfully" -ForegroundColor Green
Write-Host ""
Write-Host "Service Details:" -ForegroundColor Cyan
Write-Host "  Name: $ServiceName" -ForegroundColor White
Write-Host "  Display Name: $ServiceDisplayName" -ForegroundColor White  
Write-Host "  Executable: $($mainExe.FullName)" -ForegroundColor White
Write-Host "  Auto-start: Yes" -ForegroundColor White
Write-Host ""
Write-Host "To start the service:" -ForegroundColor Cyan
Write-Host "  Start-Service $ServiceName" -ForegroundColor White
Write-Host ""

exit 0