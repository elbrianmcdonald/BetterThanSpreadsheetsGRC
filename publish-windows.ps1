# PowerShell script to publish CyberRisk app for Windows
# Run this script from the project directory

Write-Host "Publishing CyberRisk App..." -ForegroundColor Green

# Clean previous builds
Write-Host "Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Path ".\bin\Release" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\obj\Release" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\publish" -Recurse -Force -ErrorAction SilentlyContinue

# Check if we're in the right directory
if (-not (Test-Path "CyberRiskApp.csproj")) {
    Write-Host "ERROR: CyberRiskApp.csproj not found. Please run this script from the project directory." -ForegroundColor Red
    exit 1
}

# Publish for Windows x64 (self-contained)
Write-Host "Publishing self-contained Windows x64 package..." -ForegroundColor Yellow
$publishResult = dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\publish\win-x64 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Publish failed!" -ForegroundColor Red
    Write-Host $publishResult -ForegroundColor Red
    
    # Try simpler publish command
    Write-Host "Trying simpler publish command..." -ForegroundColor Yellow
    dotnet publish -c Release -o .\publish\win-x64 --self-contained true -r win-x64
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Simple publish also failed. Please check your .NET SDK installation." -ForegroundColor Red
        Write-Host "Run 'dotnet --version' to check your .NET version" -ForegroundColor Yellow
        exit 1
    }
}

# Check if publish succeeded
if (Test-Path ".\publish\win-x64\CyberRiskApp.exe") {
    Write-Host "Publish successful!" -ForegroundColor Green
    
    # Copy configuration files
    Write-Host "Copying configuration files..." -ForegroundColor Yellow
    Copy-Item "appsettings.json" -Destination ".\publish\win-x64\" -Force
    if (Test-Path "appsettings.Production.json") {
        Copy-Item "appsettings.Production.json" -Destination ".\publish\win-x64\" -Force
    }
} else {
    Write-Host "ERROR: Published executable not found!" -ForegroundColor Red
    exit 1
}

# Create deployment folder structure
$deploymentPath = ".\publish\CyberRiskApp-Package"
New-Item -ItemType Directory -Path $deploymentPath -Force | Out-Null
New-Item -ItemType Directory -Path "$deploymentPath\app" -Force | Out-Null
New-Item -ItemType Directory -Path "$deploymentPath\database" -Force | Out-Null
New-Item -ItemType Directory -Path "$deploymentPath\docs" -Force | Out-Null
New-Item -ItemType Directory -Path "$deploymentPath\scripts" -Force | Out-Null

# Copy published files
Write-Host "Creating deployment package..." -ForegroundColor Yellow
if (Test-Path ".\publish\win-x64") {
    Copy-Item ".\publish\win-x64\*" -Destination "$deploymentPath\app\" -Recurse -Force
    
    # Copy installation scripts
    if (Test-Path ".\install.ps1") {
        Copy-Item ".\install.ps1" -Destination "$deploymentPath\scripts\" -Force
    }
    if (Test-Path ".\setup-secure.ps1") {
        Copy-Item ".\setup-secure.ps1" -Destination "$deploymentPath\scripts\" -Force
    }
    if (Test-Path ".\setup-database.ps1") {
        Copy-Item ".\setup-database.ps1" -Destination "$deploymentPath\scripts\" -Force
    }
    if (Test-Path ".\README-DEPLOYMENT.md") {
        Copy-Item ".\README-DEPLOYMENT.md" -Destination "$deploymentPath\docs\" -Force
    }
    
    Write-Host "Package created successfully at: $deploymentPath" -ForegroundColor Green
    $size = (Get-ChildItem $deploymentPath -Recurse | Where-Object {!$_.PSIsContainer} | Measure-Object -Property Length -Sum).Sum
    if ($size) {
        Write-Host "Total size: $([math]::Round($size / 1MB, 2)) MB" -ForegroundColor Cyan
    }
} else {
    Write-Host "ERROR: No published files found!" -ForegroundColor Red
    exit 1
}