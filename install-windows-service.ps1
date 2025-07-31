# PowerShell script to install CyberRisk Platform as Windows Service
# Run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "CyberRiskPlatform",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceDisplayName = "Cyber Risk Management Platform",
    
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "C:\CyberRiskPlatform",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceAccount = "LocalSystem"
)

Write-Host "Installing CyberRisk Platform as Windows Service" -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Exiting..."
    exit 1
}

# Create installation directory
if (-not (Test-Path $InstallPath)) {
    Write-Host "Creating installation directory: $InstallPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallPath -Force
}

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
$sourceFiles = @(
    "*.dll",
    "*.exe", 
    "*.json",
    "*.xml",
    "web.config",
    "wwwroot",
    "Views",
    "libman.json"
)

foreach ($pattern in $sourceFiles) {
    if (Test-Path $pattern) {
        Copy-Item -Path $pattern -Destination $InstallPath -Recurse -Force
        Write-Host "Copied $pattern" -ForegroundColor Gray
    }
}

# Create Windows Service
$servicePath = Join-Path $InstallPath "CyberRiskApp.exe"

# Remove existing service if it exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Stopping and removing existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force
    sc.exe delete $ServiceName
    Start-Sleep -Seconds 2
}

# Install the service
Write-Host "Installing Windows Service: $ServiceName" -ForegroundColor Yellow
New-Service -Name $ServiceName `
           -BinaryPathName $servicePath `
           -DisplayName $ServiceDisplayName `
           -Description "ASP.NET Core Cyber Risk Management and GRC Platform" `
           -StartupType Automatic `
           -Credential $ServiceAccount

# Configure service recovery options
Write-Host "Configuring service recovery options..." -ForegroundColor Yellow
sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000

# Set service to restart on failure
sc.exe config $ServiceName start= auto

Write-Host "Service installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Service Details:" -ForegroundColor Cyan
Write-Host "  Name: $ServiceName"
Write-Host "  Display Name: $ServiceDisplayName"
Write-Host "  Install Path: $InstallPath"
Write-Host "  Account: $ServiceAccount"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure appsettings.Production.json in $InstallPath"
Write-Host "2. Start the service: Start-Service -Name '$ServiceName'"
Write-Host "3. Check service status: Get-Service -Name '$ServiceName'"
Write-Host "4. Configure firewall rules for ports 5000/5001"
Write-Host "5. Configure DNS to point to this server"