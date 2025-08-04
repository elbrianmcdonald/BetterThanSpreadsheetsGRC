# Simple Build Script for CyberRisk App Installer
# This script creates an installer without unicode characters

param(
    [string]$Version = "1.0.0"
)

Write-Host "Building CyberRisk App Installer v$Version" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Step 1: Build the application
Write-Host "`nStep 1: Building application..." -ForegroundColor Yellow
& .\publish-simple.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build application" -ForegroundColor Red
    exit 1
}

Write-Host "Application built successfully!" -ForegroundColor Green

# Step 2: Create installer configuration
Write-Host "`nStep 2: Creating installer configuration..." -ForegroundColor Yellow
& .\create-installer.ps1 -Version $Version

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create installer configuration" -ForegroundColor Red
    exit 1
}

Write-Host "Installer configuration created!" -ForegroundColor Green

# Step 3: Check for Inno Setup and compile
Write-Host "`nStep 3: Compiling installer..." -ForegroundColor Yellow
$innoPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if (Test-Path $innoPath) {
    & $innoPath /Q "installer\CyberRiskApp.iss"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Installer compiled successfully!" -ForegroundColor Green
        
        # Show results
        Write-Host "`n==========================================" -ForegroundColor Green
        Write-Host "SUCCESS: Installer created!" -ForegroundColor Green
        Write-Host "==========================================" -ForegroundColor Green
        
        $installerFile = Get-ChildItem "installer\CyberRiskApp-Setup-*.exe" | Select-Object -First 1
        if ($installerFile) {
            $size = [math]::Round($installerFile.Length / 1MB, 2)
            Write-Host "`nInstaller Details:" -ForegroundColor Cyan
            Write-Host "  File: $($installerFile.Name)" -ForegroundColor White
            Write-Host "  Size: $size MB" -ForegroundColor White
            Write-Host "  Path: $($installerFile.FullName)" -ForegroundColor Gray
        }
        
        Write-Host "`nNext Steps:" -ForegroundColor Yellow
        Write-Host "1. Test the installer by running it as Administrator" -ForegroundColor White
        Write-Host "2. The installer will set up the service and open setup page" -ForegroundColor White
        Write-Host "3. Complete configuration at http://localhost:5000/Setup" -ForegroundColor White
        
    } else {
        Write-Host "ERROR: Failed to compile installer" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "WARNING: Inno Setup not found at default location" -ForegroundColor Yellow
    Write-Host "`nPlease install Inno Setup from:" -ForegroundColor Yellow
    Write-Host "https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "`nThen manually compile the installer:" -ForegroundColor Yellow
    Write-Host "1. Open Inno Setup Compiler" -ForegroundColor White
    Write-Host "2. Open file: installer\CyberRiskApp.iss" -ForegroundColor White
    Write-Host "3. Press F9 to compile" -ForegroundColor White
    exit 1
}

Write-Host "`nBuild completed successfully!" -ForegroundColor Green