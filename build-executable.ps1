# Build Better Than Spreadsheets GRC as self-contained executable

param(
    [string]$OutputDir = ".\dist",
    [string]$Configuration = "Release",
    [switch]$SingleFile,
    [switch]$SelfContained = $true
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Building Better Than Spreadsheets GRC Executable" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Get project file
$projectFile = Get-ChildItem "*.csproj" | Select-Object -First 1
if (-not $projectFile) {
    Write-Host "ERROR: No .csproj file found" -ForegroundColor Red
    exit 1
}

Write-Host "Project: $($projectFile.Name)" -ForegroundColor Gray
Write-Host "Output: $OutputDir" -ForegroundColor Gray
Write-Host "Configuration: $Configuration" -ForegroundColor Gray
Write-Host "Self-contained: $SelfContained" -ForegroundColor Gray
Write-Host "Single file: $SingleFile" -ForegroundColor Gray
Write-Host ""

# Clean output directory
if (Test-Path $OutputDir) {
    Write-Host "Cleaning output directory..." -ForegroundColor Yellow
    Remove-Item $OutputDir -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Build arguments
$publishArgs = @(
    "publish",
    $projectFile.FullName,
    "--configuration", $Configuration,
    "--output", $OutputDir,
    "--runtime", "win-x64"
)

if ($SelfContained) {
    $publishArgs += "--self-contained", "true"
} else {
    $publishArgs += "--self-contained", "false"
}

if ($SingleFile) {
    $publishArgs += "-p:PublishSingleFile=true"
    $publishArgs += "-p:IncludeNativeLibrariesForSelfExtract=true"
}

# Additional optimizations
$publishArgs += "-p:PublishTrimmed=false"  # Keep full framework for compatibility
$publishArgs += "-p:PublishReadyToRun=true"  # Improve startup time

Write-Host "Building application..." -ForegroundColor Yellow
Write-Host "Command: dotnet $($publishArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

try {
    & dotnet @publishArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "OK Build completed successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Create version info
$version = "1.0.0"
$buildDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

$versionInfo = @{
    Version = $version
    BuildDate = $buildDate
    Configuration = $Configuration
    Runtime = "win-x64"
    SelfContained = $SelfContained
    SingleFile = $SingleFile
} | ConvertTo-Json -Depth 2

$versionInfo | Out-File "$OutputDir\version.json" -Encoding UTF8

# Copy additional files
Write-Host ""
Write-Host "Copying additional files..." -ForegroundColor Yellow

$additionalFiles = @(
    "appsettings.json",
    "appsettings.Production.json"
)

foreach ($file in $additionalFiles) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $OutputDir -Force
        Write-Host "  Copied: $file" -ForegroundColor Gray
    }
}

# Get executable info
$exeFiles = Get-ChildItem "$OutputDir\*.exe"
if ($exeFiles) {
    $mainExe = $exeFiles[0]
    $exeSize = [math]::Round($mainExe.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "Executable created:" -ForegroundColor Green
    Write-Host "  Name: $($mainExe.Name)" -ForegroundColor White
    Write-Host "  Size: $exeSize MB" -ForegroundColor White
    Write-Host "  Path: $($mainExe.FullName)" -ForegroundColor White
} else {
    Write-Host "WARNING: No executable (.exe) file found in output" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host "Ready for installer creation" -ForegroundColor Cyan
Write-Host ""

exit 0