# Simple publish script for CyberRisk App
Write-Host "CyberRisk App - Simple Publisher" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check current directory
if (-not (Test-Path "CyberRiskApp.csproj")) {
    Write-Host "ERROR: Please run from the project directory containing CyberRiskApp.csproj" -ForegroundColor Red
    exit 1
}

# Clean previous builds
Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
if (Test-Path ".\publish") {
    Remove-Item -Path ".\publish" -Recurse -Force
}

# Create output directory
$outputPath = ".\publish\CyberRiskApp"
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

# Simple publish command that should work with .NET 8 or 9
Write-Host "`nPublishing application..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan

# Try framework-dependent first (smaller, requires .NET runtime on target)
$publishCmd = "dotnet publish -c Release -o `"$outputPath`" --no-self-contained"
Write-Host "Command: $publishCmd" -ForegroundColor Gray
Invoke-Expression $publishCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nFramework-dependent publish failed, trying self-contained..." -ForegroundColor Yellow
    # Try self-contained (larger, includes .NET runtime)
    $publishCmd = "dotnet publish -c Release -o `"$outputPath`" --self-contained -r win-x64"
    Write-Host "Command: $publishCmd" -ForegroundColor Gray
    Invoke-Expression $publishCmd
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nPublish successful!" -ForegroundColor Green
    
    # Copy additional files
    Write-Host "Copying configuration and scripts..." -ForegroundColor Yellow
    
    # Copy configs
    Copy-Item "appsettings*.json" -Destination $outputPath -Force
    
    # Create scripts directory
    $scriptsPath = "$outputPath\scripts"
    New-Item -ItemType Directory -Path $scriptsPath -Force | Out-Null
    
    # Copy installation scripts
    @("install.ps1", "setup-secure.ps1", "setup-database.ps1") | ForEach-Object {
        if (Test-Path $_) {
            Copy-Item $_ -Destination $scriptsPath -Force
        }
    }
    
    # Create a simple run.bat
    @"
@echo off
echo Starting CyberRisk App...
CyberRiskApp.exe
pause
"@ | Out-File -FilePath "$outputPath\run.bat" -Encoding ASCII
    
    # Show results
    Write-Host "`n================================" -ForegroundColor Green
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Output location: $outputPath" -ForegroundColor Cyan
    
    # List main files
    Write-Host "`nMain files:" -ForegroundColor Yellow
    Get-ChildItem $outputPath -Filter "*.exe" | ForEach-Object {
        Write-Host "  - $($_.Name) ($([math]::Round($_.Length / 1MB, 2)) MB)" -ForegroundColor White
    }
    
    $totalSize = (Get-ChildItem $outputPath -Recurse | Measure-Object -Property Length -Sum).Sum
    Write-Host "`nTotal size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Cyan
    
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Test locally: cd publish\CyberRiskApp && .\run.bat" -ForegroundColor White
    Write-Host "2. Create installer: Run create-installer.ps1" -ForegroundColor White
    Write-Host "3. Deploy: Copy the publish folder to target server" -ForegroundColor White
} else {
    Write-Host "`nERROR: Publish failed!" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. You have .NET SDK installed (dotnet --version)" -ForegroundColor White
    Write-Host "2. The project file exists and is valid" -ForegroundColor White
    Write-Host "3. Try running: dotnet restore" -ForegroundColor White
}