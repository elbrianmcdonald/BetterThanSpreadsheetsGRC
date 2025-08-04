# CyberRisk App Installation Script
# Run as Administrator

param(
    [string]$InstallPath = "C:\Program Files\CyberRiskApp",
    [string]$ServiceName = "CyberRiskApp",
    [string]$ServiceDisplayName = "CyberRisk Management Platform",
    [string]$DatabaseServer = "localhost",
    [string]$DatabaseName = "CyberRiskDB",
    [string]$DatabaseUser = "cyberrisk_user",
    [SecureString]$DatabasePassword,
    [int]$HttpPort = 5000,
    [int]$HttpsPort = 5001,
    [switch]$SkipDatabaseSetup,
    [switch]$UseWebSetup
)

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "This script must be run as Administrator. Exiting..." -ForegroundColor Red
    exit 1
}

Write-Host "CyberRisk App Installation Script" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Stop service if exists
if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Write-Host "Stopping existing service..." -ForegroundColor Yellow
    Stop-Service -Name $ServiceName -Force
    sc.exe delete $ServiceName
    Start-Sleep -Seconds 2
}

# Create installation directory
Write-Host "Creating installation directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
$sourcePath = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$sourcePath\app\*" -Destination $InstallPath -Recurse -Force

# Create data directories
$dataPath = "$InstallPath\Data"
$logsPath = "$InstallPath\Logs"
$backupsPath = "$InstallPath\Backups"

New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
New-Item -ItemType Directory -Path $backupsPath -Force | Out-Null

# Update configuration
Write-Host "Updating configuration..." -ForegroundColor Yellow
$configPath = "$InstallPath\appsettings.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Handle database password
if ($DatabasePassword) {
    # Convert SecureString to plain text
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DatabasePassword)
    try {
        $dbPwdPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    
    # Update connection string
    $connectionString = "Host=$DatabaseServer;Database=$DatabaseName;Username=$DatabaseUser;Password=$dbPwdPlain;Pooling=true;MinPoolSize=5;MaxPoolSize=50"
    $config.ConnectionStrings.DefaultConnection = $connectionString
}
else {
    # Leave connection string empty for web-based setup
    $config.ConnectionStrings.DefaultConnection = ""
}

# Configure for initial setup if needed
if ($UseWebSetup) {
    $config.Setup = @{
        Unattended = $false
        UseEnvironmentVariables = $true
    }
}

# Update URLs
$config.Kestrel = @{
    EndPoints = @{
        Http = @{
            Url = "http://*:$HttpPort"
        }
        Https = @{
            Url = "https://*:$HttpsPort"
            Certificate = @{
                Path = ""
                Password = ""
            }
        }
    }
}

# Save configuration
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath

# Create Windows service
Write-Host "Creating Windows service..." -ForegroundColor Yellow
$exePath = "$InstallPath\CyberRiskApp.exe"

New-Service -Name $ServiceName `
    -DisplayName $ServiceDisplayName `
    -Description "CyberRisk Management and GRC Platform" `
    -BinaryPathName $exePath `
    -StartupType Automatic

# Configure service recovery options
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000

# Create firewall rules
Write-Host "Creating firewall rules..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "CyberRisk HTTP" -Direction Inbound -Protocol TCP -LocalPort $HttpPort -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "CyberRisk HTTPS" -Direction Inbound -Protocol TCP -LocalPort $HttpsPort -Action Allow -ErrorAction SilentlyContinue

# Create URL reservations
Write-Host "Creating URL reservations..." -ForegroundColor Yellow
netsh http add urlacl url="http://+:$HttpPort/" user="NT AUTHORITY\NETWORK SERVICE"
netsh http add urlacl url="https://+:$HttpsPort/" user="NT AUTHORITY\NETWORK SERVICE"

# Start service
Write-Host "Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName

# Create desktop shortcut
Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:Public\Desktop\CyberRisk App.lnk")
$Shortcut.TargetPath = "http://localhost:$HttpPort"
$Shortcut.IconLocation = "$InstallPath\CyberRiskApp.exe"
$Shortcut.Save()

Write-Host "`nInstallation completed successfully!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host "Application installed to: $InstallPath" -ForegroundColor Cyan
Write-Host "Service name: $ServiceName" -ForegroundColor Cyan
Write-Host "Access URL: http://localhost:$HttpPort" -ForegroundColor Cyan

if ($UseWebSetup) {
    Write-Host "`nNEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. Navigate to http://localhost:$HttpPort/Setup" -ForegroundColor White
    Write-Host "2. Complete the initial setup wizard" -ForegroundColor White
    Write-Host "3. Save the generated admin credentials" -ForegroundColor White
}
elseif (-not $SkipDatabaseSetup) {
    Write-Host "`nIMPORTANT: Run the secure setup script to configure passwords:" -ForegroundColor Yellow
    Write-Host ".\setup-secure.ps1 -GeneratePasswords" -ForegroundColor White
}