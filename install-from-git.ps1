# Better Than Spreadsheets GRC - Git-based Installer
# Downloads, builds, and installs the application from Git repository

param(
    [string]$GitRepository = "https://github.com/elbrianmcdonald/BetterThanSpreadsheets.git",
    [string]$Branch = "main",
    [string]$InstallPath = "C:\Program Files\Better Than Spreadsheets GRC",
    [string]$ServiceName = "BetterThanSpreadsheetsGRC",
    [string]$DatabaseName = "CyberRiskDB",
    [string]$DatabaseUser = "cyberrisk_user",
    [string]$DatabasePassword = "CyberRisk123!",
    [switch]$Update,
    [switch]$SkipDependencies,
    [switch]$DevMode
)

$ErrorActionPreference = "Continue"

# Ensure running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DevMode) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Use -DevMode for development installation without admin rights" -ForegroundColor Yellow
    exit 1
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Better Than Spreadsheets GRC - Git Installer" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Repository: $GitRepository" -ForegroundColor Gray
Write-Host "Branch: $Branch" -ForegroundColor Gray
Write-Host "Install Path: $InstallPath" -ForegroundColor Gray
Write-Host "Service Name: $ServiceName" -ForegroundColor Gray
Write-Host "Dev Mode: $DevMode" -ForegroundColor Gray
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

# Step 1: Check Prerequisites
Write-Host "STEP 1: Checking Prerequisites" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Check Git
if (-not (Test-Command "git")) {
    Write-Host "ERROR: Git is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/downloads" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK Git is available" -ForegroundColor Green

# Check .NET SDK for building
if (-not (Test-Command "dotnet")) {
    Write-Host "ERROR: .NET SDK is not installed" -ForegroundColor Red
    Write-Host "Please install .NET 8 SDK from: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
    exit 1
}
Write-Host "OK .NET SDK is available" -ForegroundColor Green

# Step 2: Install Dependencies (if not in dev mode)
if (-not $SkipDependencies -and -not $DevMode) {
    Write-Host ""
    Write-Host "STEP 2: Installing Dependencies" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    
    # Install .NET 8 Runtime
    if (-not (Test-DotNetRuntime)) {
        Write-Host "Installing .NET 8 ASP.NET Core Runtime..." -ForegroundColor Yellow
        try {
            $dotnetUrl = "https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-aspnetcore-8.0.18-windows-x64-installer"
            $tempFile = "$env:TEMP\aspnetcore-runtime-8.0.18-win-x64.exe"
            
            Write-Host "  Downloading .NET 8 Runtime..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $dotnetUrl -OutFile $tempFile -UseBasicParsing
            
            Write-Host "  Installing .NET 8 Runtime..." -ForegroundColor Gray
            Start-Process -FilePath $tempFile -ArgumentList "/quiet", "/norestart" -Wait -NoNewWindow
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            Write-Host "OK .NET 8 Runtime installed" -ForegroundColor Green
        } catch {
            Write-Host "WARNING Failed to install .NET 8 Runtime: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "OK .NET 8 Runtime already installed" -ForegroundColor Green
    }
    
    # Install PostgreSQL
    if (-not (Test-PostgreSQL)) {
        Write-Host "Installing PostgreSQL 16..." -ForegroundColor Yellow
        try {
            $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
            $tempFile = "$env:TEMP\postgresql-16.6-1-windows-x64.exe"
            
            Write-Host "  Downloading PostgreSQL (this may take several minutes)..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $pgUrl -OutFile $tempFile -UseBasicParsing
            
            Write-Host "  Installing PostgreSQL..." -ForegroundColor Gray
            $pgArgs = @(
                "--mode", "unattended",
                "--superpassword", "postgres",
                "--servicename", "postgresql",
                "--servicepassword", "postgres",
                "--serverport", "5432"
            )
            
            Start-Process -FilePath $tempFile -ArgumentList $pgArgs -Wait -NoNewWindow
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            Write-Host "OK PostgreSQL installed" -ForegroundColor Green
        } catch {
            Write-Host "WARNING Failed to install PostgreSQL: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "OK PostgreSQL already installed" -ForegroundColor Green
    }
}

# Step 3: Clone or Update Repository
Write-Host ""
Write-Host "STEP 3: Getting Source Code" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

$tempSourceDir = "$env:TEMP\BetterThanSpreadsheetsGRC-Source"

if ($Update -and (Test-Path $tempSourceDir)) {
    Write-Host "Updating existing repository..." -ForegroundColor Yellow
    Set-Location $tempSourceDir
    & git fetch origin
    & git reset --hard "origin/$Branch"
    & git clean -fd
} else {
    if (Test-Path $tempSourceDir) {
        Write-Host "Removing existing source directory..." -ForegroundColor Yellow
        Remove-Item $tempSourceDir -Recurse -Force
    }
    
    Write-Host "Cloning repository..." -ForegroundColor Yellow
    & git clone --branch $Branch --single-branch $GitRepository $tempSourceDir
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR Failed to clone repository" -ForegroundColor Red
        exit 1
    }
    
    Set-Location $tempSourceDir
}

Write-Host "OK Source code ready" -ForegroundColor Green

# Step 4: Build Application
Write-Host ""
Write-Host "STEP 4: Building Application" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Find the project file
$projectFile = Get-ChildItem -Recurse -Filter "*.csproj" | Where-Object { $_.Name -match "CyberRisk|GRC" } | Select-Object -First 1

if (-not $projectFile) {
    Write-Host "ERROR Could not find main project file" -ForegroundColor Red
    exit 1
}

Write-Host "Building project: $($projectFile.Name)" -ForegroundColor Gray
Set-Location $projectFile.Directory

try {
    # Restore packages
    Write-Host "Restoring packages..." -ForegroundColor Yellow
    & dotnet restore
    if ($LASTEXITCODE -ne 0) { throw "Restore failed" }
    
    # Build for production
    Write-Host "Building application..." -ForegroundColor Yellow
    if ($DevMode) {
        # Development build - framework dependent
        & dotnet publish --configuration Release --output "$tempSourceDir\publish"
    } else {
        # Production build - self-contained
        & dotnet publish --configuration Release --runtime win-x64 --self-contained true --output "$tempSourceDir\publish"
    }
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    
    Write-Host "OK Application built successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR Failed to build application: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Install Application
Write-Host ""
Write-Host "STEP 5: Installing Application" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

if ($DevMode) {
    # Development mode - run from temp directory
    Write-Host "Development mode - running from source directory" -ForegroundColor Yellow
    $InstallPath = "$tempSourceDir\publish"
} else {
    # Production mode - install to Program Files
    if (Test-Path $InstallPath) {
        Write-Host "Stopping existing service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        
        Write-Host "Removing existing installation..." -ForegroundColor Yellow
        Remove-Item $InstallPath -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    Write-Host "Installing to: $InstallPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Copy-Item "$tempSourceDir\publish\*" -Destination $InstallPath -Recurse -Force
}

Write-Host "OK Application installed" -ForegroundColor Green

# Step 6: Setup Database
Write-Host ""
Write-Host "STEP 6: Setting up Database" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

if (Test-PostgreSQL) {
    # Find PostgreSQL path
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
        $dbSetupSuccess = $false

        foreach ($pgPassword in $passwords) {
            try {
                $env:PGPASSWORD = $pgPassword
                & "$pgPath\psql.exe" -h localhost -U postgres -c "SELECT version();" 2>$null | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Connected to PostgreSQL" -ForegroundColor Green
                    
                    # Create database and user
                    Write-Host "Creating database: $DatabaseName" -ForegroundColor Yellow
                    & "$pgPath\psql.exe" -h localhost -U postgres -c "DROP DATABASE IF EXISTS $DatabaseName;" 2>$null
                    & "$pgPath\psql.exe" -h localhost -U postgres -c "CREATE DATABASE $DatabaseName;" 2>$null
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

        if ($dbSetupSuccess) {
            Write-Host "OK Database setup completed" -ForegroundColor Green
        } else {
            Write-Host "WARNING Could not setup database automatically" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "WARNING PostgreSQL not found - database setup skipped" -ForegroundColor Yellow
}

# Step 7: Create Production Configuration
Write-Host ""
Write-Host "STEP 7: Creating Configuration" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

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

# Step 8: Run Database Migrations
Write-Host ""
Write-Host "STEP 8: Running Database Migrations" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

try {
    $env:ASPNETCORE_ENVIRONMENT = "Production"
    $env:ConnectionStrings__DefaultConnection = $connectionString
    
    Set-Location $InstallPath
    & dotnet ef database update 2>$null
    
    Write-Host "OK Database migrations completed" -ForegroundColor Green
} catch {
    Write-Host "WARNING Database migration issues - will be handled on first run" -ForegroundColor Yellow
}

# Step 9: Install as Service (if not dev mode)
if (-not $DevMode) {
    Write-Host ""
    Write-Host "STEP 9: Installing Windows Service" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    
    # Find main executable
    $mainExe = Get-ChildItem "$InstallPath\*.exe" | Where-Object { $_.Name -match "CyberRisk|GRC" } | Select-Object -First 1
    
    if ($mainExe) {
        # Remove existing service
        $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($service) {
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            & sc.exe delete $ServiceName | Out-Null
            Start-Sleep -Seconds 2
        }
        
        # Create service
        Write-Host "Creating Windows service: $ServiceName" -ForegroundColor Yellow
        $servicePath = "`"$($mainExe.FullName)`""
        
        & sc.exe create $ServiceName binPath=$servicePath start=auto DisplayName="Better Than Spreadsheets GRC" | Out-Null
        if ($LASTEXITCODE -eq 0) {
            & sc.exe description $ServiceName "Better Than Spreadsheets GRC - Enterprise Risk Management Platform" | Out-Null
            & sc.exe failure $ServiceName reset=86400 actions=restart/5000/restart/5000/restart/5000 | Out-Null
            Write-Host "OK Windows service created" -ForegroundColor Green
        } else {
            Write-Host "WARNING Failed to create Windows service" -ForegroundColor Yellow
        }
    }
}

# Step 10: Cleanup
Write-Host ""
Write-Host "STEP 10: Cleanup" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan

if (-not $DevMode) {
    Write-Host "Cleaning up temporary files..." -ForegroundColor Yellow
    Set-Location $env:TEMP
    Remove-Item $tempSourceDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "OK Cleanup completed" -ForegroundColor Green
} else {
    Write-Host "Development mode - keeping source files at: $tempSourceDir" -ForegroundColor Yellow
}

# Final Summary
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

if ($DevMode) {
    Write-Host "Development Installation Summary:" -ForegroundColor Cyan
    Write-Host "  Source Code: $tempSourceDir" -ForegroundColor White
    Write-Host "  Application: $InstallPath" -ForegroundColor White
    Write-Host ""
    Write-Host "To run the application:" -ForegroundColor Cyan
    Write-Host "  cd `"$InstallPath`"" -ForegroundColor White
    Write-Host "  dotnet CyberRiskApp.dll" -ForegroundColor White
} else {
    Write-Host "Production Installation Summary:" -ForegroundColor Cyan
    Write-Host "  Service: $ServiceName" -ForegroundColor White
    Write-Host "  Install Path: $InstallPath" -ForegroundColor White
    Write-Host "  Database: $DatabaseName" -ForegroundColor White
    Write-Host ""
    Write-Host "To start the service:" -ForegroundColor Cyan
    Write-Host "  Start-Service $ServiceName" -ForegroundColor White
}

Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Cyan
Write-Host "  http://localhost:5197/setup" -ForegroundColor White
Write-Host ""
Write-Host "To update in the future, run:" -ForegroundColor Cyan
Write-Host "  .\install-from-git.ps1 -Update" -ForegroundColor White
Write-Host ""

exit 0