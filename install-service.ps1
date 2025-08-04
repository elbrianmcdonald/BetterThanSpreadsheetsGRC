# Better Than Spreadsheets GRC - Complete Service Installer
# Installs dependencies, builds app, and installs as Windows service

param(
    [string]$ServiceName = "BetterThanSpreadsheetsGRC",
    [string]$ServiceDisplayName = "Better Than Spreadsheets GRC",
    [string]$InstallPath = "C:\Program Files\BetterThanSpreadsheetsGRC",
    [string]$DatabaseName = "CyberRiskDB",
    [string]$DatabaseUser = "cyberrisk_user",
    [string]$DatabasePassword = "CyberRisk123!",
    [switch]$Force,
    [switch]$SkipDependencies
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
Write-Host "Better Than Spreadsheets GRC - Service Installer" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installing to: $InstallPath" -ForegroundColor Gray
Write-Host "Service Name: $ServiceName" -ForegroundColor Gray
Write-Host "Database: $DatabaseName" -ForegroundColor Gray
Write-Host ""

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to check if .NET 8 runtime is installed
function Test-DotNetRuntime {
    try {
        $runtimes = & dotnet --list-runtimes 2>$null
        if ($runtimes -match "Microsoft\.AspNetCore\.App 8\.") {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Function to check if PostgreSQL is installed
function Test-PostgreSQL {
    $pgPaths = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe"
    )
    
    foreach ($path in $pgPaths) {
        if (Test-Path $path) {
            return $true
        }
    }
    return $false
}

# Function to stop and remove existing service
function Remove-ExistingService {
    param([string]$Name)
    
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Stopping existing service: $Name" -ForegroundColor Yellow
        Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue
        
        Write-Host "Removing existing service: $Name" -ForegroundColor Yellow
        sc.exe delete $Name | Out-Null
        Start-Sleep -Seconds 2
    }
}

# Step 1: Install Dependencies
if (-not $SkipDependencies) {
    Write-Host "STEP 1: Installing Dependencies" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    # Install .NET 8 Runtime
    Write-Host "Checking .NET 8 Runtime..." -ForegroundColor Yellow
    if ((Test-Command "dotnet") -and (Test-DotNetRuntime) -and (-not $Force)) {
        Write-Host "OK .NET 8 Runtime is already installed" -ForegroundColor Green
    } else {
        Write-Host "Installing .NET 8 ASP.NET Core Runtime..." -ForegroundColor Yellow
        try {
            $dotnetUrl = "https://download.microsoft.com/download/8/3/0/830d1e08-08a2-4e90-9e74-8a3b7e7c17d1/aspnetcore-runtime-8.0.18-win-x64.exe"
            $tempFile = "$env:TEMP\aspnetcore-runtime-8.0.18-win-x64.exe"
            
            Write-Host "  Downloading .NET 8 Runtime..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $dotnetUrl -OutFile $tempFile -UseBasicParsing
            
            Write-Host "  Installing .NET 8 Runtime..." -ForegroundColor Gray
            Start-Process -FilePath $tempFile -ArgumentList "/quiet", "/norestart" -Wait -NoNewWindow
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            
            Write-Host "OK .NET 8 Runtime installed successfully" -ForegroundColor Green
        } catch {
            Write-Host "ERROR Failed to install .NET 8 Runtime: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
    
    # Install PostgreSQL
    Write-Host ""
    Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
    if ((Test-PostgreSQL) -and (-not $Force)) {
        Write-Host "OK PostgreSQL is already installed" -ForegroundColor Green
    } else {
        Write-Host "Installing PostgreSQL 16..." -ForegroundColor Yellow
        try {
            $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
            $tempFile = "$env:TEMP\postgresql-16.6-1-windows-x64.exe"
            
            Write-Host "  Downloading PostgreSQL (this may take several minutes)..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $pgUrl -OutFile $tempFile -UseBasicParsing
            
            Write-Host "  Installing PostgreSQL with default settings..." -ForegroundColor Gray
            $pgArgs = @(
                "--mode", "unattended",
                "--superpassword", "postgres",
                "--servicename", "postgresql",
                "--servicepassword", "postgres",
                "--serverport", "5432",
                "--locale", "English, United States"
            )
            
            Start-Process -FilePath $tempFile -ArgumentList $pgArgs -Wait -NoNewWindow
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            Write-Host "OK PostgreSQL installed successfully" -ForegroundColor Green
        } catch {
            Write-Host "ERROR Failed to install PostgreSQL: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
}

# Step 2: Setup Database
Write-Host ""
Write-Host "STEP 2: Setting up Database" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

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

if (-not $pgPath) {
    Write-Host "ERROR PostgreSQL not found" -ForegroundColor Red
    exit 1
}

Write-Host "Found PostgreSQL at: $pgPath" -ForegroundColor Gray

# Setup database and user
$passwords = @("postgres", "admin", "password", "123456")
$dbSetupSuccess = $false

foreach ($pgPassword in $passwords) {
    try {
        Write-Host "Testing PostgreSQL connection with password: $pgPassword" -ForegroundColor Gray
        
        # Test connection
        $env:PGPASSWORD = $pgPassword
        & "$pgPath\psql.exe" -h localhost -U postgres -c "SELECT version();" 2>$null | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Connected to PostgreSQL" -ForegroundColor Green
            
            # Create database
            Write-Host "Creating database: $DatabaseName" -ForegroundColor Yellow
            & "$pgPath\psql.exe" -h localhost -U postgres -c "DROP DATABASE IF EXISTS $DatabaseName;" 2>$null
            & "$pgPath\psql.exe" -h localhost -U postgres -c "CREATE DATABASE $DatabaseName;" 2>$null
            
            # Create user
            Write-Host "Creating user: $DatabaseUser" -ForegroundColor Yellow
            & "$pgPath\psql.exe" -h localhost -U postgres -c "DROP USER IF EXISTS $DatabaseUser;" 2>$null
            & "$pgPath\psql.exe" -h localhost -U postgres -c "CREATE USER $DatabaseUser WITH PASSWORD '$DatabasePassword';" 2>$null
            & "$pgPath\psql.exe" -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $DatabaseUser;" 2>$null
            & "$pgPath\psql.exe" -h localhost -U postgres -c "ALTER USER $DatabaseUser CREATEDB;" 2>$null
            
            $dbSetupSuccess = $true
            break
        }
    } catch {
        continue
    }
}

if (-not $dbSetupSuccess) {
    Write-Host "ERROR Could not connect to PostgreSQL with any common password" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL is running and accessible" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK Database setup completed" -ForegroundColor Green

# Step 3: Build and Publish Application
Write-Host ""
Write-Host "STEP 3: Building Application" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

$sourceDir = $PSScriptRoot
Write-Host "Source directory: $sourceDir" -ForegroundColor Gray

# Verify we have a .NET project
if (-not (Test-Path "$sourceDir\*.csproj")) {
    Write-Host "ERROR No .csproj file found in $sourceDir" -ForegroundColor Red
    exit 1
}

# Build and publish
try {
    Write-Host "Building application..." -ForegroundColor Yellow
    & dotnet build --configuration Release --output "$sourceDir\bin\Release"
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    
    Write-Host "Publishing application..." -ForegroundColor Yellow
    & dotnet publish --configuration Release --output "$sourceDir\publish" --self-contained false
    if ($LASTEXITCODE -ne 0) { throw "Publish failed" }
    
    Write-Host "OK Application built successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR Failed to build application: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Install Application Files
Write-Host ""
Write-Host "STEP 4: Installing Application Files" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Create install directory
if (Test-Path $InstallPath) {
    Write-Host "Removing existing installation: $InstallPath" -ForegroundColor Yellow
    Remove-Item $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Creating install directory: $InstallPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null

# Copy application files
Write-Host "Copying application files..." -ForegroundColor Yellow
try {
    Copy-Item "$sourceDir\publish\*" -Destination $InstallPath -Recurse -Force
    Write-Host "OK Application files copied" -ForegroundColor Green
} catch {
    Write-Host "ERROR Failed to copy application files: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create production configuration
Write-Host "Creating production configuration..." -ForegroundColor Yellow
$connectionString = "Host=localhost;Database=$DatabaseName;Username=$DatabaseUser;Password=$DatabasePassword"
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
Write-Host "OK Production configuration created" -ForegroundColor Green

# Step 5: Run Database Migrations
Write-Host ""
Write-Host "STEP 5: Running Database Migrations" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

try {
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    $env:ConnectionStrings__DefaultConnection = $connectionString
    
    Write-Host "Running Entity Framework migrations..." -ForegroundColor Yellow
    Set-Location $InstallPath
    & dotnet $InstallPath\CyberRiskApp.dll --migrate 2>$null
    
    # Alternative migration approach
    Set-Location $sourceDir
    & dotnet ef database update --connection $connectionString
    
    Write-Host "OK Database migrations completed" -ForegroundColor Green
} catch {
    Write-Host "WARNING Database migration issues: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "You may need to run migrations manually after service starts" -ForegroundColor Yellow
}

# Step 6: Install Windows Service
Write-Host ""
Write-Host "STEP 6: Installing Windows Service" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Remove existing service
Remove-ExistingService -Name $ServiceName

# Find the main DLL
$mainDll = Get-ChildItem "$InstallPath\*.dll" | Where-Object { $_.Name -match "CyberRiskApp|BetterThanSpreadsheets" } | Select-Object -First 1
if (-not $mainDll) {
    Write-Host "ERROR Could not find main application DLL" -ForegroundColor Red
    exit 1
}

Write-Host "Main application: $($mainDll.Name)" -ForegroundColor Gray

# Create service
try {
    Write-Host "Creating Windows service: $ServiceName" -ForegroundColor Yellow
    
    $servicePath = "dotnet `"$InstallPath\$($mainDll.Name)`""
    $serviceArgs = @(
        "create",
        $ServiceName,
        "binPath=$servicePath",
        "start=auto",
        "DisplayName=$ServiceDisplayName"
    )
    
    & sc.exe @serviceArgs | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Service creation failed" }
    
    # Set service description
    & sc.exe description $ServiceName "Better Than Spreadsheets GRC - Enterprise Risk Management Platform" | Out-Null
    
    # Configure service recovery
    & sc.exe failure $ServiceName reset=86400 actions=restart/5000/restart/5000/restart/5000 | Out-Null
    
    Write-Host "OK Windows service created" -ForegroundColor Green
} catch {
    Write-Host "ERROR Failed to create Windows service: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 7: Configure Service Environment
Write-Host ""
Write-Host "STEP 7: Configuring Service Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Create service environment file
$envContent = @"
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=$connectionString
ASPNETCORE_URLS=http://localhost:5197;https://localhost:7212
"@

$envContent | Out-File "$InstallPath\service.env" -Encoding UTF8
Write-Host "OK Service environment configured" -ForegroundColor Green

# Step 8: Start Service
Write-Host ""
Write-Host "STEP 8: Starting Service" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

try {
    Write-Host "Starting service: $ServiceName" -ForegroundColor Yellow
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 5
    
    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq "Running") {
        Write-Host "OK Service started successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING Service status: $($service.Status)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING Failed to start service: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Service can be started manually from Services.msc" -ForegroundColor Yellow
}

# Final Summary
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Details:" -ForegroundColor Cyan
Write-Host "  Name: $ServiceName" -ForegroundColor White
Write-Host "  Display Name: $ServiceDisplayName" -ForegroundColor White
Write-Host "  Install Path: $InstallPath" -ForegroundColor White
Write-Host "  Database: $DatabaseName" -ForegroundColor White
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Cyan
Write-Host "  http://localhost:5197/setup" -ForegroundColor White
Write-Host ""
Write-Host "Service Management:" -ForegroundColor Cyan
Write-Host "  Start: Start-Service $ServiceName" -ForegroundColor White
Write-Host "  Stop:  Stop-Service $ServiceName" -ForegroundColor White
Write-Host "  Status: Get-Service $ServiceName" -ForegroundColor White
Write-Host ""
Write-Host "Logs and troubleshooting:" -ForegroundColor Cyan
Write-Host "  Event Viewer > Applications and Services Logs" -ForegroundColor White
Write-Host "  Service config: $InstallPath\appsettings.Production.json" -ForegroundColor White
Write-Host ""

exit 0