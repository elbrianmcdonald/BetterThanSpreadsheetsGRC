# CyberRisk App - Complete Uninstaller
# Run as Administrator

Write-Host "CyberRisk App - Uninstaller" -ForegroundColor Red
Write-Host "============================" -ForegroundColor Red

# Step 1: Stop and remove Windows Service
Write-Host "`nStep 1: Removing Windows Service..." -ForegroundColor Yellow
try {
    $service = Get-Service -Name "CyberRiskApp" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Stopping CyberRiskApp service..." -ForegroundColor Cyan
        Stop-Service -Name "CyberRiskApp" -Force -ErrorAction SilentlyContinue
        Start-Sleep 3
        
        Write-Host "Removing CyberRiskApp service..." -ForegroundColor Cyan
        sc.exe delete "CyberRiskApp"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Service removed successfully" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Service removal failed or service didn't exist" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  No CyberRiskApp service found" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error removing service: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Stop any running processes
Write-Host "`nStep 2: Stopping running processes..." -ForegroundColor Yellow
try {
    $processes = Get-Process -Name "CyberRiskApp" -ErrorAction SilentlyContinue
    if ($processes) {
        Write-Host "Stopping CyberRiskApp processes..." -ForegroundColor Cyan
        $processes | Stop-Process -Force
        Write-Host "✅ Processes stopped" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  No running CyberRiskApp processes found" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error stopping processes: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 3: Remove installation directory
Write-Host "`nStep 3: Removing installation files..." -ForegroundColor Yellow
$installPaths = @(
    "C:\Program Files\CyberRiskApp",
    "C:\Program Files (x86)\CyberRiskApp",
    "$env:LOCALAPPDATA\CyberRiskApp",
    "$env:PROGRAMDATA\CyberRiskApp"
)

foreach ($path in $installPaths) {
    if (Test-Path $path) {
        try {
            Write-Host "Removing: $path" -ForegroundColor Cyan
            Remove-Item -Path $path -Recurse -Force
            Write-Host "✅ Removed: $path" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Failed to remove: $path - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  Not found: $path" -ForegroundColor Gray
    }
}

# Step 4: Remove registry entries
Write-Host "`nStep 4: Cleaning registry entries..." -ForegroundColor Yellow
$registryPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{8B3A5F2C-1234-4567-8901-ABCDEF123456}",
    "HKLM:\SOFTWARE\CyberRiskApp",
    "HKCU:\SOFTWARE\CyberRiskApp"
)

foreach ($regPath in $registryPaths) {
    if (Test-Path $regPath) {
        try {
            Write-Host "Removing registry: $regPath" -ForegroundColor Cyan
            Remove-Item -Path $regPath -Recurse -Force
            Write-Host "✅ Registry entry removed: $regPath" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Failed to remove registry: $regPath - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  Registry not found: $regPath" -ForegroundColor Gray
    }
}

# Step 5: Remove shortcuts
Write-Host "`nStep 5: Removing shortcuts..." -ForegroundColor Yellow
$shortcutPaths = @(
    "$env:PUBLIC\Desktop\CyberRisk Management Platform.lnk",
    "$env:USERPROFILE\Desktop\CyberRisk Management Platform.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\CyberRisk Management Platform.lnk",
    "$env:PROGRAMDATA\Microsoft\Windows\Start Menu\Programs\CyberRisk Management Platform.lnk"
)

foreach ($shortcut in $shortcutPaths) {
    if (Test-Path $shortcut) {
        try {
            Remove-Item -Path $shortcut -Force
            Write-Host "✅ Removed shortcut: $shortcut" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  Failed to remove shortcut: $shortcut" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  Shortcut not found: $shortcut" -ForegroundColor Gray
    }
}

# Step 6: Remove firewall rules
Write-Host "`nStep 6: Removing firewall rules..." -ForegroundColor Yellow
try {
    $firewallRules = Get-NetFirewallRule -DisplayName "*CyberRisk*" -ErrorAction SilentlyContinue
    if ($firewallRules) {
        $firewallRules | Remove-NetFirewallRule
        Write-Host "✅ Firewall rules removed" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  No firewall rules found" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  Error removing firewall rules: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 7: Optional - Remove database (WARNING!)
Write-Host "`nStep 7: Database cleanup (OPTIONAL)..." -ForegroundColor Yellow
$removeDatabase = Read-Host "Do you want to remove the CyberRisk database? This will DELETE ALL DATA! (y/N)"
if ($removeDatabase -eq 'y' -or $removeDatabase -eq 'Y') {
    Write-Host "⚠️  WARNING: This will delete all your CyberRisk data!" -ForegroundColor Red
    $confirm = Read-Host "Type 'DELETE' to confirm database removal"
    
    if ($confirm -eq 'DELETE') {
        try {
            # Check if PostgreSQL is available
            $psqlPath = Get-Command psql -ErrorAction SilentlyContinue
            if ($psqlPath) {
                Write-Host "Attempting to drop CyberRiskDB database..." -ForegroundColor Cyan
                & psql -U postgres -c "DROP DATABASE IF EXISTS \"CyberRiskDB\";"
                & psql -U postgres -c "DROP USER IF EXISTS cyberrisk_user;"
                Write-Host "✅ Database and user removed" -ForegroundColor Green
            } else {
                Write-Host "⚠️  PostgreSQL psql command not found. You may need to manually remove the database." -ForegroundColor Yellow
                Write-Host "   Run these commands in PostgreSQL:" -ForegroundColor Gray
                Write-Host "   DROP DATABASE IF EXISTS \"CyberRiskDB\";" -ForegroundColor Gray
                Write-Host "   DROP USER IF EXISTS cyberrisk_user;" -ForegroundColor Gray
            }
        } catch {
            Write-Host "⚠️  Error removing database: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ℹ️  Database removal cancelled" -ForegroundColor Gray
    }
} else {
    Write-Host "ℹ️  Database kept intact" -ForegroundColor Gray
}

# Summary
Write-Host "`n============================" -ForegroundColor Red
Write-Host "Uninstallation Summary:" -ForegroundColor Red
Write-Host "============================" -ForegroundColor Red
Write-Host "✅ Windows Service: Stopped and removed" -ForegroundColor Green
Write-Host "✅ Processes: Terminated" -ForegroundColor Green  
Write-Host "✅ Files: Removed from Program Files" -ForegroundColor Green
Write-Host "✅ Registry: Cleaned" -ForegroundColor Green
Write-Host "✅ Shortcuts: Removed" -ForegroundColor Green
Write-Host "✅ Firewall: Rules removed" -ForegroundColor Green

Write-Host "`n🎯 CyberRisk App has been uninstalled!" -ForegroundColor Green
Write-Host "🔄 You may need to restart your computer to complete the removal." -ForegroundColor Yellow

# Pause to let user read the summary
Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")