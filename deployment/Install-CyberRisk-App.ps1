#Requires -RunAsAdministrator

<#
.SYNOPSIS
    CyberRisk Platform Application Installer
.DESCRIPTION
    Installs the CyberRisk Platform application after dependencies are manually installed
.PARAMETER AdminEmail
    Administrator email for initial setup (required)
.PARAMETER InstallPath
    Installation directory (default: C:\CyberRisk)
.EXAMPLE
    .\Install-CyberRisk-App.ps1 -AdminEmail "admin@company.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$AdminEmail,
    
    [Parameter()]
    [string]$InstallPath = "C:\CyberRisk"
)

$ErrorActionPreference = 'Stop'
$script:LogFile = "$env:TEMP\CyberRisk_Install_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    
    $timestamp = Get-Date -Format 'HH:mm:ss'
    $logEntry = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        'ERROR' { Write-Host $logEntry -ForegroundColor Red }
        'WARN' { Write-Host $logEntry -ForegroundColor Yellow }
        'SUCCESS' { Write-Host $logEntry -ForegroundColor Green }
        default { Write-Host $logEntry -ForegroundColor White }
    }
    
    Add-Content -Path $script:LogFile -Value $logEntry -ErrorAction SilentlyContinue
}

function Test-Dependencies {
    Write-Log "Checking required dependencies..."
    $missing = @()
    
    # Check .NET 8 and ASP.NET Core Runtime
    try {
        # Check if dotnet command exists
        $dotnetCmd = Get-Command dotnet -ErrorAction SilentlyContinue
        if (-not $dotnetCmd) {
            $missing += ".NET 8.0 Runtime"
            Write-Log ".NET Runtime: Not found" -Level ERROR
        } else {
            # Check for .NET Core Runtime 8.x
            $runtimes = & dotnet --list-runtimes 2>$null
            $netCoreRuntime = $runtimes | Where-Object { $_ -match 'Microsoft\.NETCore\.App 8\.' }
            
            if ($netCoreRuntime) {
                Write-Log ".NET Core Runtime 8.0: Found" -Level SUCCESS
            } else {
                $missing += ".NET 8.0 Runtime"
                Write-Log ".NET Core Runtime 8.0: Missing" -Level ERROR
            }
            
            # Check for ASP.NET Core Runtime 8.x
            $aspNetCoreRuntime = $runtimes | Where-Object { $_ -match 'Microsoft\.AspNetCore\.App 8\.' }
            
            if ($aspNetCoreRuntime) {
                Write-Log "ASP.NET Core Runtime 8.0: Found" -Level SUCCESS
            } else {
                Write-Log "ASP.NET Core Runtime 8.0: Missing" -Level ERROR
                $missing += "ASP.NET Core Runtime 8.0"
            }
        }
    } catch {
        $missing += ".NET 8.0 Runtime"
        Write-Log "Error checking .NET: $_" -Level ERROR
    }
    
    # Check Git
    try {
        $gitVersion = & git --version 2>$null
        if ($gitVersion) {
            Write-Log "Git: Found ($gitVersion)" -Level SUCCESS
        } else {
            $missing += "Git"
        }
    } catch {
        $missing += "Git"
    }
    
    # Check PostgreSQL client (helpful for database management)
    try {
        $psqlVersion = & psql --version 2>$null
        if ($psqlVersion) {
            Write-Log "PostgreSQL Client: Found ($psqlVersion)" -Level SUCCESS
        } else {
            Write-Log "PostgreSQL Client: Not found (needed for database setup)" -Level WARN
        }
    } catch {
        Write-Log "PostgreSQL Client: Not found (needed for database setup)" -Level WARN
    }
    
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "MISSING DEPENDENCIES DETECTED!" -ForegroundColor Red
        Write-Host "================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install the following before running this installer:" -ForegroundColor Yellow
        Write-Host ""
        
        foreach ($dep in $missing) {
            Write-Host "X $dep" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "DOWNLOAD LINKS:" -ForegroundColor Cyan
        Write-Host "===============" -ForegroundColor Cyan
        Write-Host ""
        
        if ($missing -contains ".NET 8.0 Runtime") {
            Write-Host ".NET 8.0 ASP.NET Core Runtime:" -ForegroundColor Yellow
            Write-Host "   https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor White
            Write-Host "   Choose: ASP.NET Core Runtime 8.0.x - Windows x64" -ForegroundColor Gray
            Write-Host ""
        }
        
        if ($missing -contains "ASP.NET Core Runtime 8.0") {
            Write-Host "ASP.NET Core Runtime 8.0 (REQUIRED):" -ForegroundColor Red
            Write-Host "   https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor White
            Write-Host "   Choose: ASP.NET Core Runtime 8.0.x - Windows x64" -ForegroundColor Gray
            Write-Host "   NOTE: You have .NET Runtime but need ASP.NET Core Runtime!" -ForegroundColor Red
            Write-Host ""
        }
        
        if ($missing -contains "Git") {
            Write-Host "Git for Windows:" -ForegroundColor Yellow
            Write-Host "   https://git-scm.com/download/windows" -ForegroundColor White
            Write-Host "   Choose: 64-bit Git for Windows Setup" -ForegroundColor Gray
            Write-Host ""
        }
        
        Write-Host "REQUIRED FOR APPLICATION:" -ForegroundColor Red
        Write-Host "PostgreSQL Database Server (includes psql client):" -ForegroundColor Yellow
        Write-Host "   https://www.postgresql.org/download/windows/" -ForegroundColor White
        Write-Host "   Choose: Windows x86-64, Latest Version" -ForegroundColor Gray
        Write-Host "   NOTE: Application will NOT work without PostgreSQL!" -ForegroundColor Red
        Write-Host ""
        
        Write-Host "After installing dependencies, run this script again." -ForegroundColor Green
        Write-Host ""
        
        throw "Dependencies missing. Please install them first."
    }
    
    Write-Log "All required dependencies found!" -Level SUCCESS
}

function New-InstallDirectory {
    Write-Log "Creating installation directory: $InstallPath"
    
    if (Test-Path $InstallPath) {
        Write-Log "Directory already exists: $InstallPath"
        
        # Check if it contains existing installation
        $existingFiles = Get-ChildItem $InstallPath -Filter "*.csproj" -File -ErrorAction SilentlyContinue
        if ($existingFiles) {
            Write-Host ""
            Write-Host "WARNING: Existing installation found at $InstallPath" -ForegroundColor Yellow
            $response = Read-Host "Do you want to clean and reinstall? (Y/N)"
            
            if ($response -eq 'Y' -or $response -eq 'y') {
                Write-Log "Cleaning existing installation..."
                Get-ChildItem $InstallPath -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
                Write-Log "Cleaned installation directory" -Level SUCCESS
            } else {
                throw "Installation cancelled by user"
            }
        }
    } else {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        Write-Log "Created directory: $InstallPath" -Level SUCCESS
    }
    
    # Test write permissions
    $testFile = Join-Path $InstallPath "test.tmp"
    try {
        "test" | Out-File $testFile
        Remove-Item $testFile
        Write-Log "Directory permissions: OK" -Level SUCCESS
    } catch {
        throw "Cannot write to installation directory: $InstallPath"
    }
}

function Get-ApplicationSource {
    Write-Log "Downloading CyberRisk Platform source code..."
    
    $tempPath = "$env:TEMP\CyberRisk_$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    Write-Log "Cloning from GitHub..."
    $process = Start-Process -FilePath 'git' -ArgumentList @('clone', 'https://github.com/elbrianmcdonald/BetterThanSpreadsheets.git', $tempPath) -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -ne 0) {
        throw "Failed to clone repository"
    }
    
    Write-Log "Repository cloned to: $tempPath"
    Write-Log "Exploring repository structure..."
    
    # First, let's see what's in the root
    $rootItems = Get-ChildItem $tempPath -Directory
    Write-Log "Root directories found: $($rootItems.Name -join ', ')"
    
    # Look for possible application paths
    $possiblePaths = @(
        "CyberRiskApp\CyberRiskApp\CyberRiskApp",
        "CyberRiskApp\CyberRiskApp",
        "CyberRiskApp",
        "."
    )
    
    $appPath = $null
    foreach ($path in $possiblePaths) {
        $testPath = Join-Path $tempPath $path
        Write-Log "Checking path: $testPath"
        
        if (Test-Path $testPath) {
            # Check if it contains a .csproj file
            $csprojFiles = Get-ChildItem $testPath -Filter "*.csproj" -File -ErrorAction SilentlyContinue
            if ($csprojFiles) {
                Write-Log "Found .csproj file(s) at: $testPath"
                $appPath = $testPath
                break
            }
        }
    }
    
    if (-not $appPath) {
        # Last resort - search for any .csproj file
        Write-Log "Searching for .csproj files in entire repository..."
        $csprojFiles = Get-ChildItem $tempPath -Filter "*.csproj" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($csprojFiles) {
            $appPath = $csprojFiles.DirectoryName
            Write-Log "Found .csproj at: $appPath"
        }
    }
    
    if (-not $appPath) {
        Write-Log "Repository structure:" -Level ERROR
        Get-ChildItem $tempPath -Recurse -Directory | Select-Object -First 20 | ForEach-Object {
            Write-Log "  $($_.FullName.Replace($tempPath, ''))" -Level ERROR
        }
        throw "Application source not found in repository. Could not find any .csproj files."
    }
    
    Write-Log "Source code found at: $appPath" -Level SUCCESS
    return @{ TempPath = $tempPath; AppPath = $appPath }
}

function Install-Application {
    param($SourcePath)
    
    Write-Log "Installing application from: $SourcePath"
    
    # First check what we're copying
    $csprojFile = Get-ChildItem $SourcePath -Filter "*.csproj" -File | Select-Object -First 1
    if ($csprojFile) {
        Write-Log "Found project file: $($csprojFile.Name)"
    } else {
        Write-Log "WARNING: No .csproj file found in source path!" -Level WARN
    }
    
    # List key files in source
    Write-Log "Key files in source:"
    @("*.csproj", "*.cs", "appsettings.json", "Program.cs") | ForEach-Object {
        $files = Get-ChildItem $SourcePath -Filter $_ -File -ErrorAction SilentlyContinue
        if ($files) {
            Write-Log "  Found: $($files.Name -join ', ')"
        }
    }
    
    # Copy all files from source to destination
    Write-Log "Copying files to $InstallPath..."
    
    # Use robocopy for better file copying
    $robocopyArgs = @(
        "`"$SourcePath`"",
        "`"$InstallPath`"",
        "/E",  # Copy subdirectories including empty ones
        "/XD", "bin", "obj", ".vs", ".git", "logs", "deployment",  # Exclude directories
        "/XF", "*.user", "*.suo", ".gitignore", ".gitattributes"  # Exclude files
    )
    
    $robocopyCmd = "robocopy $($robocopyArgs -join ' ')"
    Write-Log "Executing: $robocopyCmd"
    
    $result = & robocopy @robocopyArgs
    $exitCode = $LASTEXITCODE
    
    # Robocopy exit codes: 0-7 are success, 8+ are errors
    if ($exitCode -ge 8) {
        throw "Failed to copy files. Robocopy exit code: $exitCode"
    }
    
    # Verify the copy worked
    $destCsproj = Get-ChildItem $InstallPath -Filter "*.csproj" -File -ErrorAction SilentlyContinue
    if (-not $destCsproj) {
        Write-Log "ERROR: No .csproj file found in destination!" -Level ERROR
        Write-Log "Destination contents:" -Level ERROR
        Get-ChildItem $InstallPath | ForEach-Object {
            Write-Log "  $($_.Name)" -Level ERROR
        }
        throw "Installation failed: Project file not copied correctly"
    }
    
    Write-Log "Application files copied successfully" -Level SUCCESS
    Write-Log "Project file: $($destCsproj.Name) is now in $InstallPath"
}

function Build-Application {
    Write-Log "Building CyberRisk Platform..."
    
    Push-Location $InstallPath
    try {
        # Restore packages
        Write-Log "Restoring NuGet packages..."
        $process = Start-Process -FilePath 'dotnet' -ArgumentList 'restore' -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -ne 0) { throw "Package restore failed" }
        
        # Build
        Write-Log "Building application..."
        $process = Start-Process -FilePath 'dotnet' -ArgumentList @('build', '--configuration', 'Release') -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -ne 0) { throw "Build failed" }
        
        # Publish
        Write-Log "Publishing application..."
        $process = Start-Process -FilePath 'dotnet' -ArgumentList @('publish', '--configuration', 'Release', '--output', 'publish') -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -ne 0) { throw "Publish failed" }
        
        Write-Log "Application built successfully!" -Level SUCCESS
    }
    finally {
        Pop-Location
    }
}

function New-Configuration {
    Write-Log "Creating application configuration..."
    
    # Create appsettings.Production.json
    $settings = @{
        ConnectionStrings = @{
            DefaultConnection = "Host=localhost;Port=5432;Database=CyberRiskDB;Username=cyberrisk_user;Password=CHANGE_THIS_PASSWORD"
        }
        Logging = @{
            LogLevel = @{
                Default = "Information"
                "Microsoft.AspNetCore" = "Warning"
            }
        }
        AllowedHosts = "*"
        AdminSetup = @{
            AdminEmail = $AdminEmail
            RequirePasswordChange = $true
        }
    }
    
    $settingsPath = Join-Path $InstallPath "appsettings.Production.json"
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
    
    # Create installation info
    $installInfo = @{
        InstallDate = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        Version = "1.0.0"
        InstallPath = $InstallPath
        AdminEmail = $AdminEmail
    }
    
    $infoPath = Join-Path $InstallPath "installation-info.json"
    $installInfo | ConvertTo-Json -Depth 10 | Set-Content $infoPath -Encoding UTF8
    
    Write-Log "Configuration files created" -Level SUCCESS
}

function Show-NextSteps {
    Write-Host ""
    Write-Host "INSTALLATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installation Location: $InstallPath" -ForegroundColor Cyan
    Write-Host "Admin Email: $AdminEmail" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "==========" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. SET UP POSTGRESQL DATABASE:" -ForegroundColor White
    Write-Host "   - Install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "   - Create database: CyberRiskDB" -ForegroundColor Gray
    Write-Host "   - Create user: cyberrisk_user" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. UPDATE DATABASE CONNECTION:" -ForegroundColor White
    Write-Host "   - Edit: $InstallPath\appsettings.Production.json" -ForegroundColor Gray
    Write-Host "   - Update the password in ConnectionStrings > DefaultConnection" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. RUN DATABASE MIGRATIONS:" -ForegroundColor White
    Write-Host "   cd `"$InstallPath`"" -ForegroundColor Gray
    Write-Host "   set ASPNETCORE_ENVIRONMENT=Production" -ForegroundColor Gray
    Write-Host "   dotnet ef database update" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. START THE APPLICATION:" -ForegroundColor White
    Write-Host "   cd `"$InstallPath`"" -ForegroundColor Gray
    Write-Host "   set ASPNETCORE_ENVIRONMENT=Production" -ForegroundColor Gray  
    Write-Host "   dotnet run" -ForegroundColor Gray
    Write-Host ""
    Write-Host "5. ACCESS THE APPLICATION:" -ForegroundColor White
    Write-Host "   - Open browser to: http://localhost:5000" -ForegroundColor Gray
    Write-Host "   - Login with: $AdminEmail" -ForegroundColor Gray
    Write-Host "   - Set your password when prompted" -ForegroundColor Gray
    Write-Host ""
    Write-Host "HELPFUL COMMANDS:" -ForegroundColor Yellow
    Write-Host "   - Health Check: curl http://localhost:5000/health" -ForegroundColor Gray
    Write-Host "   - View Logs: Get-Content `"$InstallPath\logs\*.log`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Installation log: $script:LogFile" -ForegroundColor Cyan
    Write-Host ""
}

# Main installation
try {
    Write-Host "CyberRisk Platform Application Installer" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check dependencies first
    Test-Dependencies
    
    # Proceed with installation
    New-InstallDirectory
    $source = Get-ApplicationSource
    
    try {
        Install-Application -SourcePath $source.AppPath
        Build-Application
        New-Configuration
        Show-NextSteps
    }
    finally {
        # Cleanup
        if (Test-Path $source.TempPath) {
            Remove-Item $source.TempPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "Press any key to exit..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    
} catch {
    Write-Host ""
    Write-Host "INSTALLATION FAILED!" -ForegroundColor Red
    Write-Host "====================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check log file: $script:LogFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        Read-Host "Press Enter to exit"
    }
    
    exit 1
}