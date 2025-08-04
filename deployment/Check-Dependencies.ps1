# Diagnostic script to check .NET installations

Write-Host "=== .NET Dependency Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check dotnet command
Write-Host "1. Checking dotnet command:" -ForegroundColor Yellow
try {
    $dotnetPath = Get-Command dotnet -ErrorAction Stop
    Write-Host "   Found at: $($dotnetPath.Source)" -ForegroundColor Green
} catch {
    Write-Host "   dotnet command not found in PATH!" -ForegroundColor Red
}

# Check dotnet version
Write-Host ""
Write-Host "2. Checking dotnet version:" -ForegroundColor Yellow
try {
    $version = & dotnet --version 2>&1
    Write-Host "   Version: $version" -ForegroundColor Green
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Check installed SDKs
Write-Host ""
Write-Host "3. Installed SDKs:" -ForegroundColor Yellow
try {
    $sdks = & dotnet --list-sdks 2>&1
    if ($sdks) {
        $sdks | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host "   No SDKs found" -ForegroundColor Red
    }
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Check installed Runtimes
Write-Host ""
Write-Host "4. Installed Runtimes:" -ForegroundColor Yellow
try {
    $runtimes = & dotnet --list-runtimes 2>&1
    if ($runtimes) {
        $runtimes | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host "   No runtimes found" -ForegroundColor Red
    }
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Specific ASP.NET Core check
Write-Host ""
Write-Host "5. ASP.NET Core Runtime Check:" -ForegroundColor Yellow
try {
    $runtimes = & dotnet --list-runtimes 2>&1
    $aspNetCore = $runtimes | Where-Object { $_ -match 'Microsoft\.AspNetCore\.App 8\.' }
    
    if ($aspNetCore) {
        Write-Host "   FOUND ASP.NET Core Runtime:" -ForegroundColor Green
        $aspNetCore | ForEach-Object { Write-Host "   $_" -ForegroundColor Green }
    } else {
        Write-Host "   NOT FOUND - ASP.NET Core Runtime 8.x missing!" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Looking for pattern: Microsoft.AspNetCore.App 8." -ForegroundColor Yellow
        Write-Host "   In output:" -ForegroundColor Yellow
        $runtimes | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

# Check PATH environment variable
Write-Host ""
Write-Host "6. Checking PATH for dotnet:" -ForegroundColor Yellow
$pathDirs = $env:PATH -split ';' | Where-Object { $_ -like '*dotnet*' }
if ($pathDirs) {
    $pathDirs | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   No dotnet directories in PATH" -ForegroundColor Red
}

# Check common installation locations
Write-Host ""
Write-Host "7. Checking common installation locations:" -ForegroundColor Yellow
$locations = @(
    "C:\Program Files\dotnet",
    "C:\Program Files (x86)\dotnet",
    "$env:ProgramFiles\dotnet",
    "${env:ProgramFiles(x86)}\dotnet"
)

foreach ($loc in $locations) {
    if (Test-Path $loc) {
        Write-Host "   Found: $loc" -ForegroundColor Green
        
        # Check shared folder
        $sharedPath = Join-Path $loc "shared"
        if (Test-Path $sharedPath) {
            $folders = Get-ChildItem $sharedPath -Directory
            foreach ($folder in $folders) {
                Write-Host "     - $($folder.Name)" -ForegroundColor Gray
                if ($folder.Name -eq "Microsoft.AspNetCore.App") {
                    $versions = Get-ChildItem $folder.FullName -Directory
                    foreach ($ver in $versions) {
                        Write-Host "       * $($ver.Name)" -ForegroundColor Cyan
                    }
                }
            }
        }
    }
}

Write-Host ""
Write-Host "=== End of Diagnostic ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")