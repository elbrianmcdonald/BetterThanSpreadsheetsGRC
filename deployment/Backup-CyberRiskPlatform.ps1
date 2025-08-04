#Requires -Version 5.1

<#
.SYNOPSIS
    Backup script for CyberRisk Platform
.DESCRIPTION
    Comprehensive backup solution for CyberRisk Platform including database, application files, and configuration
.PARAMETER BackupPath
    Destination path for backups (default: C:\Backups\CyberRiskPlatform)
.PARAMETER ConfigFile
    Path to installation configuration JSON file
.PARAMETER BackupType
    Type of backup: Full, Database, Files (default: Full)
.PARAMETER RetentionDays
    Number of days to retain backups (default: 30)
.PARAMETER Compress
    Compress backup files (default: true)
.EXAMPLE
    .\Backup-CyberRiskPlatform.ps1
.EXAMPLE
    .\Backup-CyberRiskPlatform.ps1 -BackupType Database -BackupPath "D:\Backups"
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$BackupPath = "C:\Backups\CyberRiskPlatform",
    
    [Parameter()]
    [string]$ConfigFile,
    
    [Parameter()]
    [ValidateSet('Full', 'Database', 'Files')]
    [string]$BackupType = 'Full',
    
    [Parameter()]
    [int]$RetentionDays = 30,
    
    [Parameter()]
    [bool]$Compress = $true
)

# Script variables
$ErrorActionPreference = 'Stop'
$script:Config = @{}
$script:BackupSession = @{
    StartTime = Get-Date
    BackupId = (Get-Date -Format 'yyyyMMdd_HHmmss')
    TotalSize = 0
    Results = @{}
}

# Functions
function Write-BackupLog {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Warning', 'Error', 'Success')]
        [string]$Level = 'Info'
    )
    
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to console with color
    switch ($Level) {
        'Info'    { Write-Host $logMessage -ForegroundColor White }
        'Warning' { Write-Host $logMessage -ForegroundColor Yellow }
        'Error'   { Write-Host $logMessage -ForegroundColor Red }
        'Success' { Write-Host $logMessage -ForegroundColor Green }
    }
    
    # Write to log file
    $logPath = Join-Path $BackupPath "backup-$($script:BackupSession.BackupId).log"
    Add-Content -Path $logPath -Value $logMessage -ErrorAction SilentlyContinue
}

function Initialize-BackupEnvironment {
    Write-BackupLog "Initializing backup environment..." -Level Info
    
    # Create backup directory
    if (-not (Test-Path $BackupPath)) {
        New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
        Write-BackupLog "Created backup directory: $BackupPath" -Level Info
    }
    
    # Create session directory
    $sessionPath = Join-Path $BackupPath $script:BackupSession.BackupId
    New-Item -ItemType Directory -Path $sessionPath -Force | Out-Null
    $script:BackupSession.SessionPath = $sessionPath
    
    Write-BackupLog "Backup session: $($script:BackupSession.BackupId)" -Level Info
    Write-BackupLog "Session path: $sessionPath" -Level Info
}

function Read-BackupConfiguration {
    # Try to find config file
    $configPaths = @(
        $ConfigFile,
        "C:\Program Files\CyberRiskPlatform\installation-info.json",
        ".\installation-info.json"
    ) | Where-Object { $_ -and (Test-Path $_) }
    
    if ($configPaths) {
        $configPath = $configPaths[0]
        Write-BackupLog "Loading configuration from $configPath" -Level Info
        $script:Config = Get-Content $configPath | ConvertFrom-Json
    }
    else {
        Write-BackupLog "No configuration file found, using defaults" -Level Warning
        $script:Config = @{
            InstallPath = "C:\Program Files\CyberRiskPlatform"
            DatabaseServer = "localhost"
            DatabasePort = 5432
            DatabaseName = "CyberRiskDB"
            DatabaseUser = "cyberrisk_user"
        }
    }
}

function Backup-Database {
    if ($BackupType -notin @('Full', 'Database')) {
        return
    }
    
    Write-BackupLog "Starting database backup..." -Level Info
    
    $dbResult = @{
        Status = 'Unknown'
        FilePath = ''
        Size = 0
        Error = $null
    }
    
    try {
        # Get database password
        $dbPassword = $null
        $credentialPath = Join-Path $script:Config.InstallPath "db.credential"
        
        if (Test-Path $credentialPath) {
            try {
                $encryptedPassword = Get-Content $credentialPath
                $securePassword = ConvertTo-SecureString $encryptedPassword
                $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
            }
            catch {
                Write-BackupLog "Could not read stored database password, prompting for password" -Level Warning
                $securePassword = Read-Host "Enter database password" -AsSecureString
                $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
            }
        }
        else {
            $securePassword = Read-Host "Enter database password for user '$($script:Config.DatabaseUser)'" -AsSecureString
            $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
        }
        
        # Create database backup
        $backupFileName = "database_$($script:BackupSession.BackupId).sql"
        $backupFilePath = Join-Path $script:BackupSession.SessionPath $backupFileName
        
        # Set PGPASSWORD environment variable
        $env:PGPASSWORD = $dbPassword
        
        try {
            # Run pg_dump
            $pgDumpArgs = @(
                "-h", $script:Config.DatabaseServer
                "-p", $script:Config.DatabasePort
                "-U", $script:Config.DatabaseUser
                "-d", $script:Config.DatabaseName
                "--verbose"
                "--no-password"
                "--format=custom"
                "--file=$backupFilePath"
            )
            
            Write-BackupLog "Running pg_dump with arguments: $($pgDumpArgs -join ' ')" -Level Info
            
            $process = Start-Process -FilePath "pg_dump" -ArgumentList $pgDumpArgs -Wait -PassThru -NoNewWindow -RedirectStandardError "$backupFilePath.log"
            
            if ($process.ExitCode -eq 0) {
                $backupFile = Get-Item $backupFilePath
                $dbResult.Status = 'Success'
                $dbResult.FilePath = $backupFilePath
                $dbResult.Size = $backupFile.Length
                $script:BackupSession.TotalSize += $backupFile.Length
                
                Write-BackupLog "Database backup completed successfully" -Level Success
                Write-BackupLog "Backup file: $backupFilePath ($([math]::Round($backupFile.Length / 1MB, 2)) MB)" -Level Info
            }
            else {
                $dbResult.Status = 'Failed'
                $errorLog = Get-Content "$backupFilePath.log" -ErrorAction SilentlyContinue
                $dbResult.Error = "pg_dump failed with exit code $($process.ExitCode). Error: $($errorLog -join '; ')"
                Write-BackupLog $dbResult.Error -Level Error
            }
        }
        finally {
            # Clear password from environment
            $env:PGPASSWORD = $null
        }
        
        # Compress backup if requested
        if ($Compress -and $dbResult.Status -eq 'Success') {
            Write-BackupLog "Compressing database backup..." -Level Info
            
            $compressedPath = "$backupFilePath.zip"
            Compress-Archive -Path $backupFilePath -DestinationPath $compressedPath -Force
            
            if (Test-Path $compressedPath) {
                Remove-Item $backupFilePath
                $compressedFile = Get-Item $compressedPath
                $dbResult.FilePath = $compressedPath
                $dbResult.Size = $compressedFile.Length
                Write-BackupLog "Database backup compressed: $([math]::Round($compressedFile.Length / 1MB, 2)) MB" -Level Success
            }
        }
    }
    catch {
        $dbResult.Status = 'Error'
        $dbResult.Error = $_.Exception.Message
        Write-BackupLog "Database backup failed: $($_.Exception.Message)" -Level Error
    }
    
    $script:BackupSession.Results.Database = $dbResult
}

function Backup-ApplicationFiles {
    if ($BackupType -notin @('Full', 'Files')) {
        return
    }
    
    Write-BackupLog "Starting application files backup..." -Level Info
    
    $filesResult = @{
        Status = 'Unknown'
        FilePath = ''
        Size = 0
        FileCount = 0
        Error = $null
    }
    
    try {
        $appBackupPath = Join-Path $script:BackupSession.SessionPath "application_files"
        New-Item -ItemType Directory -Path $appBackupPath -Force | Out-Null
        
        # Files and directories to backup
        $itemsToBackup = @(
            @{ Source = $script:Config.InstallPath; Destination = "application"; Exclude = @("logs", "temp", "wwwroot\uploads") }
        )
        
        # Add additional paths if they exist
        $additionalPaths = @(
            @{ Source = "C:\inetpub\logs\LogFiles"; Destination = "iis_logs"; Exclude = @() },
            @{ Source = "$env:ProgramData\CyberRiskPlatform"; Destination = "programdata"; Exclude = @() }
        )
        
        foreach ($path in $additionalPaths) {
            if (Test-Path $path.Source) {
                $itemsToBackup += $path
            }
        }
        
        $totalFiles = 0
        
        foreach ($item in $itemsToBackup) {
            if (Test-Path $item.Source) {
                Write-BackupLog "Backing up: $($item.Source) -> $($item.Destination)" -Level Info
                
                $destPath = Join-Path $appBackupPath $item.Destination
                
                # Copy files with exclusions
                $robocopyArgs = @(
                    "`"$($item.Source)`""
                    "`"$destPath`""
                    "/E"  # Copy subdirectories including empty ones
                    "/R:3"  # Retry 3 times
                    "/W:10"  # Wait 10 seconds between retries
                    "/MT:4"  # Multi-threaded (4 threads)
                    "/LOG+:$destPath.log"
                )
                
                # Add exclusions
                if ($item.Exclude.Count -gt 0) {
                    $robocopyArgs += "/XD"
                    $robocopyArgs += $item.Exclude
                }
                
                $robocopyResult = & robocopy @robocopyArgs
                $robocopyExitCode = $LASTEXITCODE
                
                # Robocopy exit codes: 0-7 are success, 8+ are errors
                if ($robocopyExitCode -lt 8) {
                    $copiedFiles = Get-ChildItem $destPath -Recurse -File -ErrorAction SilentlyContinue
                    $totalFiles += $copiedFiles.Count
                    Write-BackupLog "Copied $($copiedFiles.Count) files from $($item.Source)" -Level Success
                }
                else {
                    Write-BackupLog "Robocopy failed for $($item.Source) with exit code $robocopyExitCode" -Level Warning
                }
            }
        }
        
        # Calculate total size
        $allFiles = Get-ChildItem $appBackupPath -Recurse -File -ErrorAction SilentlyContinue
        $totalSize = ($allFiles | Measure-Object -Property Length -Sum).Sum
        
        $filesResult.Status = 'Success'
        $filesResult.FilePath = $appBackupPath
        $filesResult.Size = $totalSize
        $filesResult.FileCount = $totalFiles
        $script:BackupSession.TotalSize += $totalSize
        
        Write-BackupLog "Application files backup completed: $totalFiles files, $([math]::Round($totalSize / 1MB, 2)) MB" -Level Success
        
        # Compress files backup if requested
        if ($Compress) {
            Write-BackupLog "Compressing application files backup..." -Level Info
            
            $compressedPath = "$appBackupPath.zip"
            Compress-Archive -Path "$appBackupPath\*" -DestinationPath $compressedPath -Force
            
            if (Test-Path $compressedPath) {
                Remove-Item $appBackupPath -Recurse -Force
                $compressedFile = Get-Item $compressedPath
                $filesResult.FilePath = $compressedPath
                $filesResult.Size = $compressedFile.Length
                Write-BackupLog "Application files backup compressed: $([math]::Round($compressedFile.Length / 1MB, 2)) MB" -Level Success
            }
        }
    }
    catch {
        $filesResult.Status = 'Error'
        $filesResult.Error = $_.Exception.Message
        Write-BackupLog "Application files backup failed: $($_.Exception.Message)" -Level Error
    }
    
    $script:BackupSession.Results.ApplicationFiles = $filesResult
}

function Remove-OldBackups {
    Write-BackupLog "Cleaning up old backups (retention: $RetentionDays days)..." -Level Info
    
    try {
        $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
        $oldBackups = Get-ChildItem $BackupPath -Directory | Where-Object { 
            $_.Name -match '\d{8}_\d{6}' -and $_.CreationTime -lt $cutoffDate 
        }
        
        $removedCount = 0
        $reclaimedSpace = 0
        
        foreach ($oldBackup in $oldBackups) {
            try {
                $backupSize = (Get-ChildItem $oldBackup.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
                Remove-Item $oldBackup.FullName -Recurse -Force
                $removedCount++
                $reclaimedSpace += $backupSize
                Write-BackupLog "Removed old backup: $($oldBackup.Name)" -Level Info
            }
            catch {
                Write-BackupLog "Failed to remove old backup $($oldBackup.Name): $($_.Exception.Message)" -Level Warning
            }
        }
        
        if ($removedCount -gt 0) {
            Write-BackupLog "Removed $removedCount old backups, reclaimed $([math]::Round($reclaimedSpace / 1MB, 2)) MB" -Level Success
        }
        else {
            Write-BackupLog "No old backups to remove" -Level Info
        }
    }
    catch {
        Write-BackupLog "Backup cleanup failed: $($_.Exception.Message)" -Level Warning
    }
}

function Write-BackupSummary {
    $endTime = Get-Date
    $duration = $endTime - $script:BackupSession.StartTime
    
    Write-Host "`n" -NoNewline
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "                CyberRisk Platform Backup Summary                " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup ID: $($script:BackupSession.BackupId)" -ForegroundColor Yellow
    Write-Host "Backup Type: $BackupType" -ForegroundColor Yellow
    Write-Host "Start Time: $($script:BackupSession.StartTime)" -ForegroundColor Gray
    Write-Host "End Time: $endTime" -ForegroundColor Gray
    Write-Host "Duration: $($duration.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
    Write-Host "Total Size: $([math]::Round($script:BackupSession.TotalSize / 1MB, 2)) MB" -ForegroundColor Yellow
    Write-Host ""
    
    # Show results for each component
    foreach ($result in $script:BackupSession.Results.GetEnumerator()) {
        $componentName = $result.Key
        $componentResult = $result.Value
        
        Write-Host "$componentName`: " -NoNewline
        
        $statusColor = switch ($componentResult.Status) {
            'Success' { 'Green' }
            'Failed' { 'Red' }
            'Error' { 'Red' }
            default { 'Yellow' }
        }
        
        Write-Host $componentResult.Status -ForegroundColor $statusColor
        
        if ($componentResult.Status -eq 'Success') {
            Write-Host "  Path: $($componentResult.FilePath)" -ForegroundColor Gray
            Write-Host "  Size: $([math]::Round($componentResult.Size / 1MB, 2)) MB" -ForegroundColor Gray
            if ($componentResult.FileCount) {
                Write-Host "  Files: $($componentResult.FileCount)" -ForegroundColor Gray
            }
        }
        elseif ($componentResult.Error) {
            Write-Host "  Error: $($componentResult.Error)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "Backup Location: $($script:BackupSession.SessionPath)" -ForegroundColor Cyan
    Write-Host ""
    
    # Save backup manifest
    $manifest = @{
        BackupId = $script:BackupSession.BackupId
        BackupType = $BackupType
        StartTime = $script:BackupSession.StartTime
        EndTime = $endTime
        Duration = $duration.TotalSeconds
        TotalSize = $script:BackupSession.TotalSize
        Results = $script:BackupSession.Results
        Configuration = $script:Config
    }
    
    $manifestPath = Join-Path $script:BackupSession.SessionPath "backup-manifest.json"
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath
    Write-BackupLog "Backup manifest saved: $manifestPath" -Level Info
    
    # Determine exit code
    $hasErrors = $script:BackupSession.Results.Values | Where-Object { $_.Status -in @('Error', 'Failed') }
    if ($hasErrors) {
        Write-BackupLog "Backup completed with errors" -Level Warning
        exit 1
    }
    else {
        Write-BackupLog "Backup completed successfully" -Level Success
        exit 0
    }
}

# Main backup execution
try {
    Write-Host "CyberRisk Platform Backup" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Write-Host "Backup Type: $BackupType" -ForegroundColor Yellow
    Write-Host "Backup Path: $BackupPath" -ForegroundColor Yellow
    Write-Host ""
    
    # Initialize
    Initialize-BackupEnvironment
    Read-BackupConfiguration
    
    # Perform backups based on type
    Backup-Database
    Backup-ApplicationFiles
    
    # Cleanup old backups
    Remove-OldBackups
    
    # Show summary
    Write-BackupSummary
}
catch {
    Write-BackupLog "Backup failed with unexpected error: $($_.Exception.Message)" -Level Error
    Write-BackupLog $_.ScriptStackTrace -Level Error
    exit 2
}