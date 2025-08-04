# Create Windows Installer for Better Than Spreadsheets GRC

param(
    [switch]$BuildExecutable = $true,
    [switch]$DownloadDependencies = $true,
    [switch]$CreateInstaller = $true,
    [string]$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Better Than Spreadsheets GRC - Installer Creator" -ForegroundColor Cyan  
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build executable
if ($BuildExecutable) {
    Write-Host "STEP 1: Building Executable" -ForegroundColor Cyan
    Write-Host "============================" -ForegroundColor Cyan
    
    try {
        & .\build-executable.ps1 -SelfContained -OutputDir ".\dist"
        Write-Host "OK Executable built successfully" -ForegroundColor Green
    } catch {
        Write-Host "ERROR Failed to build executable: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Download dependencies
if ($DownloadDependencies) {
    Write-Host ""
    Write-Host "STEP 2: Downloading Dependencies" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    
    # Create dependencies directory
    $depsDir = ".\dependencies"
    if (-not (Test-Path $depsDir)) {
        New-Item -ItemType Directory -Path $depsDir -Force | Out-Null
    }
    
    Write-Host "Downloading .NET 8 Runtime..." -ForegroundColor Yellow
    try {
        $dotnetUrl = "https://download.microsoft.com/download/8/3/0/830d1e08-08a2-4e90-9e74-8a3b7e7c17d1/aspnetcore-runtime-8.0.18-win-x64.exe"
        $dotnetFile = "$depsDir\aspnetcore-runtime-8.0.18-win-x64.exe"
        
        if (-not (Test-Path $dotnetFile)) {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $dotnetUrl -OutFile $dotnetFile -UseBasicParsing
            Write-Host "  Downloaded: aspnetcore-runtime-8.0.18-win-x64.exe" -ForegroundColor Gray
        } else {
            Write-Host "  Already exists: aspnetcore-runtime-8.0.18-win-x64.exe" -ForegroundColor Gray
        }
    } catch {
        Write-Host "WARNING Failed to download .NET Runtime: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host "Downloading PostgreSQL..." -ForegroundColor Yellow
    try {
        $pgUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64.exe"
        $pgFile = "$depsDir\postgresql-16.6-1-windows-x64.exe"
        
        if (-not (Test-Path $pgFile)) {
            Write-Host "  This may take several minutes..." -ForegroundColor Gray
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $pgUrl -OutFile $pgFile -UseBasicParsing
            Write-Host "  Downloaded: postgresql-16.6-1-windows-x64.exe" -ForegroundColor Gray
        } else {
            Write-Host "  Already exists: postgresql-16.6-1-windows-x64.exe" -ForegroundColor Gray
        }
    } catch {
        Write-Host "WARNING Failed to download PostgreSQL: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Write-Host "OK Dependencies ready" -ForegroundColor Green
}

# Step 3: Create installer icon and license
Write-Host ""
Write-Host "STEP 3: Preparing Installer Assets" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Create simple app icon if it doesn't exist
$iconFile = "app-icon.ico"
if (-not (Test-Path $iconFile)) {
    Write-Host "Creating default application icon..." -ForegroundColor Yellow
    # You can replace this with a proper icon creation or copy an existing icon
    Copy-Item "$env:SystemRoot\System32\imageres.dll" $iconFile -ErrorAction SilentlyContinue
    Write-Host "  Using default Windows icon" -ForegroundColor Gray
}

# Create LICENSE.txt if it doesn't exist
$licenseFile = "LICENSE.txt"
if (-not (Test-Path $licenseFile)) {
    Write-Host "Creating license file..." -ForegroundColor Yellow
    $licenseContent = @"
Better Than Spreadsheets GRC - End User License Agreement

Copyright (c) 2025 Better Than Spreadsheets GRC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@
    $licenseContent | Out-File $licenseFile -Encoding UTF8
    Write-Host "  Created: LICENSE.txt" -ForegroundColor Gray
}

Write-Host "OK Installer assets ready" -ForegroundColor Green

# Step 4: Create installer with Inno Setup
if ($CreateInstaller) {
    Write-Host ""
    Write-Host "STEP 4: Creating Windows Installer" -ForegroundColor Cyan
    Write-Host "===================================" -ForegroundColor Cyan
    
    # Check if Inno Setup is installed
    if (-not (Test-Path $InnoSetupPath)) {
        Write-Host "WARNING Inno Setup not found at: $InnoSetupPath" -ForegroundColor Yellow
        Write-Host "Please install Inno Setup from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
        Write-Host "Or specify the correct path with -InnoSetupPath parameter" -ForegroundColor Yellow
        
        # Try alternative paths
        $altPaths = @(
            "C:\Program Files\Inno Setup 6\ISCC.exe",
            "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
            "C:\Program Files\Inno Setup 5\ISCC.exe"
        )
        
        foreach ($altPath in $altPaths) {
            if (Test-Path $altPath) {
                Write-Host "Found Inno Setup at: $altPath" -ForegroundColor Green
                $InnoSetupPath = $altPath
                break
            }
        }
        
        if (-not (Test-Path $InnoSetupPath)) {
            Write-Host "ERROR Inno Setup not found. Skipping installer creation." -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "Using Inno Setup: $InnoSetupPath" -ForegroundColor Gray
    Write-Host "Compiling installer..." -ForegroundColor Yellow
    
    # Create installer output directory
    $installerOutputDir = ".\installer-output"
    if (-not (Test-Path $installerOutputDir)) {
        New-Item -ItemType Directory -Path $installerOutputDir -Force | Out-Null
    }
    
    try {
        & $InnoSetupPath "installer.iss"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Installer created successfully" -ForegroundColor Green
            
            # Find the created installer
            $installerFile = Get-ChildItem $installerOutputDir -Filter "*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($installerFile) {
                $installerSize = [math]::Round($installerFile.Length / 1MB, 2)
                Write-Host ""
                Write-Host "Installer Details:" -ForegroundColor Green
                Write-Host "  Name: $($installerFile.Name)" -ForegroundColor White
                Write-Host "  Size: $installerSize MB" -ForegroundColor White
                Write-Host "  Path: $($installerFile.FullName)" -ForegroundColor White
            }
        } else {
            throw "Inno Setup compilation failed with exit code $LASTEXITCODE"
        }
    } catch {
        Write-Host "ERROR Failed to create installer: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Installer Creation Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Components created:" -ForegroundColor Cyan
if ($BuildExecutable) { Write-Host "  ✓ Application executable (dist/)" -ForegroundColor White }
if ($DownloadDependencies) { Write-Host "  ✓ Dependency installers (dependencies/)" -ForegroundColor White }
if ($CreateInstaller) { Write-Host "  ✓ Windows installer (installer-output/)" -ForegroundColor White }
Write-Host ""
Write-Host "The installer includes:" -ForegroundColor Cyan
Write-Host "  • Better Than Spreadsheets GRC Application" -ForegroundColor White
Write-Host "  • .NET 8 Runtime (automatic installation)" -ForegroundColor White
Write-Host "  • PostgreSQL 16 (automatic installation)" -ForegroundColor White
Write-Host "  • Windows Service configuration" -ForegroundColor White
Write-Host "  • Database setup and configuration" -ForegroundColor White
Write-Host ""

exit 0