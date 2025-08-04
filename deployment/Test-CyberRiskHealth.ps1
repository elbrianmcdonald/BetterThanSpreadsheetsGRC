#Requires -Version 5.1

<#
.SYNOPSIS
    Health check and validation script for CyberRisk Platform
.DESCRIPTION
    Comprehensive health monitoring for CyberRisk Platform including database, web service, and system resources
.PARAMETER ConfigFile
    Path to installation configuration JSON file
.PARAMETER AlertThresholds
    Custom alert thresholds (JSON format)
.PARAMETER SendAlerts
    Send email alerts for critical issues
.PARAMETER Silent
    Run in silent mode (no console output)
.EXAMPLE
    .\Test-CyberRiskHealth.ps1
.EXAMPLE
    .\Test-CyberRiskHealth.ps1 -ConfigFile "C:\Program Files\CyberRiskPlatform\installation-info.json" -SendAlerts
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$ConfigFile,
    
    [Parameter()]
    [string]$AlertThresholds,
    
    [Parameter()]
    [switch]$SendAlerts,
    
    [Parameter()]
    [switch]$Silent
)

# Script variables
$ErrorActionPreference = 'Continue'
$script:Config = @{}
$script:Results = @{
    Timestamp = Get-Date
    Status = 'Unknown'
    Checks = @{}
    Alerts = @()
    Summary = @{}
}

# Default thresholds
$script:DefaultThresholds = @{
    DatabaseResponseTime = 5000      # milliseconds
    WebResponseTime = 3000          # milliseconds
    DiskSpacePercent = 85           # percentage
    MemoryUsagePercent = 80         # percentage
    CPUUsagePercent = 85            # percentage
    ServiceDowntime = 300           # seconds
}

# Functions
function Write-HealthLog {
    param(
        [string]$Message,
        [ValidateSet('Info', 'Warning', 'Error', 'Success', 'Critical')]
        [string]$Level = 'Info'
    )
    
    if (-not $Silent) {
        $timestamp = Get-Date -Format 'HH:mm:ss'
        switch ($Level) {
            'Info'     { Write-Host "[$timestamp] $Message" -ForegroundColor White }
            'Warning'  { Write-Host "[$timestamp] WARNING: $Message" -ForegroundColor Yellow }
            'Error'    { Write-Host "[$timestamp] ERROR: $Message" -ForegroundColor Red }
            'Success'  { Write-Host "[$timestamp] SUCCESS: $Message" -ForegroundColor Green }
            'Critical' { 
                Write-Host "[$timestamp] CRITICAL: $Message" -ForegroundColor Red -BackgroundColor Yellow
                $script:Results.Alerts += @{
                    Level = 'Critical'
                    Message = $Message
                    Timestamp = Get-Date
                }
            }
        }
    }
    
    # Add to results
    if ($Level -in @('Warning', 'Error', 'Critical')) {
        $script:Results.Alerts += @{
            Level = $Level
            Message = $Message
            Timestamp = Get-Date
        }
    }
}

function Read-HealthConfiguration {
    # Try to find config file
    $configPaths = @(
        $ConfigFile,
        "C:\Program Files\CyberRiskPlatform\installation-info.json",
        ".\installation-info.json",
        ".\deployment\enterprise-config.json"
    ) | Where-Object { $_ -and (Test-Path $_) }
    
    if ($configPaths) {
        $configPath = $configPaths[0]
        Write-HealthLog "Loading configuration from $configPath" -Level Info
        $script:Config = Get-Content $configPath | ConvertFrom-Json
    }
    else {
        Write-HealthLog "No configuration file found, using defaults" -Level Warning
        $script:Config = @{
            InstallPath = "C:\Program Files\CyberRiskPlatform"
            DatabaseServer = "localhost"
            DatabasePort = 5432
            DatabaseName = "CyberRiskDB"
            ServiceName = "CyberRiskPlatform"
            IISSiteName = "CyberRiskPlatform"
        }
    }
    
    # Load custom thresholds
    if ($AlertThresholds) {
        $customThresholds = $AlertThresholds | ConvertFrom-Json
        foreach ($threshold in $customThresholds.PSObject.Properties) {
            $script:DefaultThresholds[$threshold.Name] = $threshold.Value
        }
    }
}

function Test-DatabaseHealth {
    Write-HealthLog "Checking database connectivity..." -Level Info
    
    $dbResult = @{
        Status = 'Unknown'
        ResponseTime = 0
        ConnectionCount = 0
        Error = $null
    }
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        # Test basic connectivity
        $connectionString = "Host=$($script:Config.DatabaseServer);Port=$($script:Config.DatabasePort);Database=$($script:Config.DatabaseName);Username=postgres;Timeout=10"
        
        # Try to connect using psql if available
        $testQuery = "SELECT 1 as test, NOW() as current_time, COUNT(*) as connection_count FROM pg_stat_activity WHERE state = 'active'"
        
        try {
            $result = & psql -h $script:Config.DatabaseServer -p $script:Config.DatabasePort -d $script:Config.DatabaseName -c $testQuery -t 2>$null
            $stopwatch.Stop()
            
            if ($result) {
                $dbResult.Status = 'Healthy'
                $dbResult.ResponseTime = $stopwatch.ElapsedMilliseconds
                
                # Parse connection count if available
                if ($result -match '\d+') {
                    $dbResult.ConnectionCount = [int]($Matches[0])
                }
                
                Write-HealthLog "Database is healthy (Response: $($dbResult.ResponseTime)ms)" -Level Success
            }
            else {
                $dbResult.Status = 'Unhealthy'
                $dbResult.Error = "No response from database"
                Write-HealthLog "Database check failed: No response" -Level Error
            }
        }
        catch {
            $stopwatch.Stop()
            $dbResult.Status = 'Unhealthy'
            $dbResult.ResponseTime = $stopwatch.ElapsedMilliseconds
            $dbResult.Error = $_.Exception.Message
            Write-HealthLog "Database connection failed: $($_.Exception.Message)" -Level Error
        }
        
        # Check response time threshold
        if ($dbResult.ResponseTime -gt $script:DefaultThresholds.DatabaseResponseTime) {
            Write-HealthLog "Database response time is slow: $($dbResult.ResponseTime)ms (threshold: $($script:DefaultThresholds.DatabaseResponseTime)ms)" -Level Warning
        }
    }
    catch {
        $dbResult.Status = 'Error'
        $dbResult.Error = $_.Exception.Message
        Write-HealthLog "Database health check error: $($_.Exception.Message)" -Level Error
    }
    
    $script:Results.Checks.Database = $dbResult
}

function Test-WebServiceHealth {
    Write-HealthLog "Checking web service health..." -Level Info
    
    $webResult = @{
        Status = 'Unknown'
        ResponseTime = 0
        HTTPStatus = 0
        Error = $null
        ServiceStatus = 'Unknown'
        IISStatus = 'Unknown'
    }
    
    try {
        # Check Windows Service
        if ($script:Config.ServiceName) {
            $service = Get-Service -Name $script:Config.ServiceName -ErrorAction SilentlyContinue
            if ($service) {
                $webResult.ServiceStatus = $service.Status
                if ($service.Status -ne 'Running') {
                    Write-HealthLog "Windows Service '$($script:Config.ServiceName)' is not running: $($service.Status)" -Level Critical
                }
                else {
                    Write-HealthLog "Windows Service is running" -Level Success
                }
            }
        }
        
        # Check IIS Site
        if ($script:Config.IISSiteName) {
            try {
                Import-Module WebAdministration -ErrorAction SilentlyContinue
                $site = Get-Website -Name $script:Config.IISSiteName -ErrorAction SilentlyContinue
                if ($site) {
                    $webResult.IISStatus = $site.State
                    if ($site.State -ne 'Started') {
                        Write-HealthLog "IIS Site '$($script:Config.IISSiteName)' is not started: $($site.State)" -Level Critical
                    }
                    else {
                        Write-HealthLog "IIS Site is running" -Level Success
                    }
                }
            }
            catch {
                Write-HealthLog "Could not check IIS status: $($_.Exception.Message)" -Level Warning
            }
        }
        
        # Test HTTP endpoints
        $endpoints = @(
            'http://localhost/',
            'http://localhost:5000/',
            'http://localhost/health'
        )
        
        foreach ($endpoint in $endpoints) {
            try {
                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                $response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
                $stopwatch.Stop()
                
                $webResult.Status = 'Healthy'
                $webResult.ResponseTime = $stopwatch.ElapsedMilliseconds
                $webResult.HTTPStatus = $response.StatusCode
                
                Write-HealthLog "Web service is healthy at $endpoint (Response: $($webResult.ResponseTime)ms, Status: $($response.StatusCode))" -Level Success
                
                # Check response time threshold
                if ($webResult.ResponseTime -gt $script:DefaultThresholds.WebResponseTime) {
                    Write-HealthLog "Web response time is slow: $($webResult.ResponseTime)ms (threshold: $($script:DefaultThresholds.WebResponseTime)ms)" -Level Warning
                }
                
                break  # Success on first working endpoint
            }
            catch {
                Write-HealthLog "Web service check failed for $endpoint : $($_.Exception.Message)" -Level Warning
                $webResult.Error = $_.Exception.Message
            }
        }
        
        if ($webResult.Status -eq 'Unknown') {
            $webResult.Status = 'Unhealthy'
            Write-HealthLog "All web service endpoints failed" -Level Critical
        }
    }
    catch {
        $webResult.Status = 'Error'
        $webResult.Error = $_.Exception.Message
        Write-HealthLog "Web service health check error: $($_.Exception.Message)" -Level Error
    }
    
    $script:Results.Checks.WebService = $webResult
}

function Test-SystemResources {
    Write-HealthLog "Checking system resources..." -Level Info
    
    $systemResult = @{
        CPU = @{ Usage = 0; Status = 'Unknown' }
        Memory = @{ Usage = 0; Available = 0; Status = 'Unknown' }
        Disk = @{ Usage = 0; Available = 0; Status = 'Unknown' }
        ProcessCount = 0
    }
    
    try {
        # CPU Usage
        $cpu = Get-Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 3
        $cpuUsage = ($cpu.CounterSamples | Measure-Object -Property CookedValue -Average).Average
        $systemResult.CPU.Usage = [math]::Round($cpuUsage, 2)
        
        if ($cpuUsage -gt $script:DefaultThresholds.CPUUsagePercent) {
            $systemResult.CPU.Status = 'Warning'
            Write-HealthLog "High CPU usage: $([math]::Round($cpuUsage, 2))%" -Level Warning
        }
        else {
            $systemResult.CPU.Status = 'Healthy'
            Write-HealthLog "CPU usage: $([math]::Round($cpuUsage, 2))%" -Level Info
        }
        
        # Memory Usage
        $memory = Get-CimInstance -ClassName Win32_OperatingSystem
        $totalMemory = $memory.TotalVisibleMemorySize * 1KB
        $freeMemory = $memory.FreePhysicalMemory * 1KB
        $usedMemory = $totalMemory - $freeMemory
        $memoryUsagePercent = ($usedMemory / $totalMemory) * 100
        
        $systemResult.Memory.Usage = [math]::Round($memoryUsagePercent, 2)
        $systemResult.Memory.Available = [math]::Round($freeMemory / 1GB, 2)
        
        if ($memoryUsagePercent -gt $script:DefaultThresholds.MemoryUsagePercent) {
            $systemResult.Memory.Status = 'Warning'
            Write-HealthLog "High memory usage: $([math]::Round($memoryUsagePercent, 2))% (Available: $([math]::Round($freeMemory / 1GB, 2))GB)" -Level Warning
        }
        else {
            $systemResult.Memory.Status = 'Healthy'
            Write-HealthLog "Memory usage: $([math]::Round($memoryUsagePercent, 2))% (Available: $([math]::Round($freeMemory / 1GB, 2))GB)" -Level Info
        }
        
        # Disk Usage (Install drive)
        $installDrive = Split-Path -Qualifier $script:Config.InstallPath
        if (-not $installDrive) { $installDrive = "C:" }
        
        $disk = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DeviceID -eq $installDrive }
        if ($disk) {
            $diskUsagePercent = (($disk.Size - $disk.FreeSpace) / $disk.Size) * 100
            $systemResult.Disk.Usage = [math]::Round($diskUsagePercent, 2)
            $systemResult.Disk.Available = [math]::Round($disk.FreeSpace / 1GB, 2)
            
            if ($diskUsagePercent -gt $script:DefaultThresholds.DiskSpacePercent) {
                $systemResult.Disk.Status = 'Critical'
                Write-HealthLog "Low disk space on $installDrive : $([math]::Round($diskUsagePercent, 2))% used (Available: $([math]::Round($disk.FreeSpace / 1GB, 2))GB)" -Level Critical
            }
            else {
                $systemResult.Disk.Status = 'Healthy'
                Write-HealthLog "Disk usage on $installDrive : $([math]::Round($diskUsagePercent, 2))% (Available: $([math]::Round($disk.FreeSpace / 1GB, 2))GB)" -Level Info
            }
        }
        
        # Process Count
        $processes = Get-Process | Where-Object { $_.ProcessName -like "*CyberRisk*" -or $_.ProcessName -like "*dotnet*" }
        $systemResult.ProcessCount = $processes.Count
        Write-HealthLog "Related processes running: $($systemResult.ProcessCount)" -Level Info
        
    }
    catch {
        Write-HealthLog "System resource check error: $($_.Exception.Message)" -Level Error
    }
    
    $script:Results.Checks.SystemResources = $systemResult
}

function Test-ApplicationFiles {
    Write-HealthLog "Checking application files..." -Level Info
    
    $fileResult = @{
        Status = 'Unknown'
        InstallPath = $script:Config.InstallPath
        MissingFiles = @()
        ConfigFiles = @{}
        LogFiles = @{}
    }
    
    try {
        # Check installation directory
        if (-not (Test-Path $script:Config.InstallPath)) {
            $fileResult.Status = 'Critical'
            $fileResult.MissingFiles += $script:Config.InstallPath
            Write-HealthLog "Installation directory not found: $($script:Config.InstallPath)" -Level Critical
        }
        else {
            # Check critical files
            $criticalFiles = @(
                "CyberRiskApp.dll",
                "CyberRiskApp.exe",
                "appsettings.json"
            )
            
            foreach ($file in $criticalFiles) {
                $filePath = Join-Path $script:Config.InstallPath $file
                if (-not (Test-Path $filePath)) {
                    $fileResult.MissingFiles += $file
                }
            }
            
            if ($fileResult.MissingFiles.Count -gt 0) {
                $fileResult.Status = 'Critical'
                Write-HealthLog "Missing critical files: $($fileResult.MissingFiles -join ', ')" -Level Critical
            }
            else {
                $fileResult.Status = 'Healthy'
                Write-HealthLog "All critical application files present" -Level Success
            }
            
            # Check configuration files
            $configFiles = @(
                "appsettings.json",
                "appsettings.Production.json",
                "installation-info.json"
            )
            
            foreach ($configFile in $configFiles) {
                $configPath = Join-Path $script:Config.InstallPath $configFile
                if (Test-Path $configPath) {
                    $configInfo = Get-Item $configPath
                    $fileResult.ConfigFiles[$configFile] = @{
                        Exists = $true
                        Size = $configInfo.Length
                        LastModified = $configInfo.LastWriteTime
                    }
                }
                else {
                    $fileResult.ConfigFiles[$configFile] = @{
                        Exists = $false
                    }
                }
            }
            
            # Check log files
            $logPath = Join-Path $script:Config.InstallPath "logs"
            if (Test-Path $logPath) {
                $logFiles = Get-ChildItem $logPath -Filter "*.log" | Sort-Object LastWriteTime -Descending
                foreach ($logFile in $logFiles | Select-Object -First 5) {
                    $fileResult.LogFiles[$logFile.Name] = @{
                        Size = $logFile.Length
                        LastModified = $logFile.LastWriteTime
                    }
                }
            }
        }
    }
    catch {
        $fileResult.Status = 'Error'
        Write-HealthLog "Application files check error: $($_.Exception.Message)" -Level Error
    }
    
    $script:Results.Checks.ApplicationFiles = $fileResult
}

function Test-SecurityConfiguration {
    Write-HealthLog "Checking security configuration..." -Level Info
    
    $securityResult = @{
        Status = 'Unknown'
        HTTPSEnabled = $false
        SecurityHeaders = @{}
        CertificateStatus = 'Unknown'
        FirewallRules = @()
    }
    
    try {
        # Test HTTPS availability
        try {
            $httpsResponse = Invoke-WebRequest -Uri "https://localhost/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $securityResult.HTTPSEnabled = $true
            $securityResult.SecurityHeaders = $httpsResponse.Headers
            Write-HealthLog "HTTPS is enabled and working" -Level Success
        }
        catch {
            $securityResult.HTTPSEnabled = $false
            Write-HealthLog "HTTPS is not available: $($_.Exception.Message)" -Level Warning
        }
        
        # Check certificate status (IIS)
        try {
            Import-Module WebAdministration -ErrorAction SilentlyContinue
            $bindings = Get-WebBinding -Name $script:Config.IISSiteName -Protocol "https" -ErrorAction SilentlyContinue
            if ($bindings) {
                $securityResult.CertificateStatus = 'Configured'
                Write-HealthLog "SSL certificate is configured" -Level Success
            }
            else {
                $securityResult.CertificateStatus = 'Not Configured'
                Write-HealthLog "SSL certificate is not configured" -Level Warning
            }
        }
        catch {
            # Could not check certificate status
        }
        
        # Check Windows Firewall rules
        try {
            $firewallRules = Get-NetFirewallRule | Where-Object { 
                $_.DisplayName -like "*CyberRisk*" -or 
                $_.DisplayName -like "*IIS*" -or
                ($_.LocalPort -in @(80, 443, 5000) -and $_.Direction -eq 'Inbound')
            }
            $securityResult.FirewallRules = $firewallRules | Select-Object DisplayName, Enabled, Direction, Action
            Write-HealthLog "Found $($firewallRules.Count) relevant firewall rules" -Level Info
        }
        catch {
            Write-HealthLog "Could not check firewall rules: $($_.Exception.Message)" -Level Warning
        }
        
        $securityResult.Status = 'Healthy'
    }
    catch {
        $securityResult.Status = 'Error'
        Write-HealthLog "Security configuration check error: $($_.Exception.Message)" -Level Error
    }
    
    $script:Results.Checks.Security = $securityResult
}

function Send-HealthAlert {
    if (-not $SendAlerts -or $script:Results.Alerts.Count -eq 0) {
        return
    }
    
    Write-HealthLog "Sending health alerts..." -Level Info
    
    try {
        # Get SMTP configuration from app settings
        $smtpConfig = @{
            Server = "localhost"
            Port = 587
            EnableSSL = $false
            From = "healthcheck@company.com"
            To = "admin@company.com"
        }
        
        # Try to read SMTP config from app settings
        $appSettingsPath = Join-Path $script:Config.InstallPath "appsettings.Production.json"
        if (Test-Path $appSettingsPath) {
            $appSettings = Get-Content $appSettingsPath | ConvertFrom-Json
            if ($appSettings.EmailSettings) {
                $smtpConfig.Server = $appSettings.EmailSettings.SMTPServer
                $smtpConfig.Port = $appSettings.EmailSettings.SMTPPort
                $smtpConfig.EnableSSL = $appSettings.EmailSettings.EnableSSL
                $smtpConfig.From = $appSettings.EmailSettings.FromAddress
            }
        }
        
        # Create email content
        $subject = "CyberRisk Platform Health Alert - $($script:Results.Alerts.Count) Issues Detected"
        
        $body = @"
CyberRisk Platform Health Check Report
======================================

Timestamp: $($script:Results.Timestamp)
Status: $($script:Results.Status)

ALERTS:
$($script:Results.Alerts | ForEach-Object { "[$($_.Level)] $($_.Message)" } | Out-String)

SUMMARY:
- Database: $($script:Results.Checks.Database.Status)
- Web Service: $($script:Results.Checks.WebService.Status)  
- System Resources: CPU $($script:Results.Checks.SystemResources.CPU.Usage)%, Memory $($script:Results.Checks.SystemResources.Memory.Usage)%, Disk $($script:Results.Checks.SystemResources.Disk.Usage)%
- Application Files: $($script:Results.Checks.ApplicationFiles.Status)
- Security: $($script:Results.Checks.Security.Status)

Please investigate these issues immediately.

This is an automated message from the CyberRisk Platform health monitoring system.
"@
        
        # Send email (simplified - would need proper SMTP configuration)
        Write-HealthLog "Email alert prepared for $($smtpConfig.To)" -Level Info
        
        # In a real implementation, you would send the email here
        # Send-MailMessage -SmtpServer $smtpConfig.Server -From $smtpConfig.From -To $smtpConfig.To -Subject $subject -Body $body
    }
    catch {
        Write-HealthLog "Failed to send health alert: $($_.Exception.Message)" -Level Error
    }
}

function Write-HealthReport {
    Write-HealthLog "Generating health report..." -Level Info
    
    # Determine overall status
    $criticalIssues = $script:Results.Alerts | Where-Object { $_.Level -eq 'Critical' }
    $errorIssues = $script:Results.Alerts | Where-Object { $_.Level -eq 'Error' }
    $warningIssues = $script:Results.Alerts | Where-Object { $_.Level -eq 'Warning' }
    
    if ($criticalIssues.Count -gt 0) {
        $script:Results.Status = 'Critical'
        $statusColor = 'Red'
    }
    elseif ($errorIssues.Count -gt 0) {
        $script:Results.Status = 'Error'
        $statusColor = 'Red'
    }
    elseif ($warningIssues.Count -gt 0) {
        $script:Results.Status = 'Warning'
        $statusColor = 'Yellow'
    }
    else {
        $script:Results.Status = 'Healthy'
        $statusColor = 'Green'
    }
    
    # Summary
    $script:Results.Summary = @{
        TotalChecks = $script:Results.Checks.Count
        CriticalIssues = $criticalIssues.Count
        ErrorIssues = $errorIssues.Count
        WarningIssues = $warningIssues.Count
        OverallStatus = $script:Results.Status
    }
    
    if (-not $Silent) {
        Write-Host "`n" -NoNewline
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "              CyberRisk Platform Health Check Report             " -ForegroundColor Cyan
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Timestamp: $($script:Results.Timestamp)" -ForegroundColor Gray
        Write-Host "Overall Status: " -NoNewline
        Write-Host $script:Results.Status -ForegroundColor $statusColor
        Write-Host ""
        
        # Detailed results
        foreach ($check in $script:Results.Checks.GetEnumerator()) {
            $checkName = $check.Key
            $checkResult = $check.Value
            
            Write-Host "$checkName`: " -NoNewline
            
            $checkStatus = if ($checkResult.Status) { $checkResult.Status } else { 'Unknown' }
            $checkColor = switch ($checkStatus) {
                'Healthy' { 'Green' }
                'Warning' { 'Yellow' }
                'Error' { 'Red' }
                'Critical' { 'Red' }
                'Unhealthy' { 'Red' }
                default { 'Gray' }
            }
            
            Write-Host $checkStatus -ForegroundColor $checkColor
        }
        
        if ($script:Results.Alerts.Count -gt 0) {
            Write-Host ""
            Write-Host "Issues Found:" -ForegroundColor Yellow
            foreach ($alert in $script:Results.Alerts) {
                $alertColor = switch ($alert.Level) {
                    'Critical' { 'Red' }
                    'Error' { 'Red' }
                    'Warning' { 'Yellow' }
                    default { 'Gray' }
                }
                Write-Host "  [$($alert.Level)] $($alert.Message)" -ForegroundColor $alertColor
            }
        }
        
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""
    }
    
    # Save report to file
    $reportPath = Join-Path $script:Config.InstallPath "health-check-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    try {
        $script:Results | ConvertTo-Json -Depth 10 | Set-Content $reportPath
        Write-HealthLog "Health report saved to: $reportPath" -Level Info
    }
    catch {
        Write-HealthLog "Failed to save health report: $($_.Exception.Message)" -Level Warning
    }
    
    # Return exit code based on status
    switch ($script:Results.Status) {
        'Healthy' { exit 0 }
        'Warning' { exit 1 }
        'Error' { exit 2 }
        'Critical' { exit 3 }
        default { exit 4 }
    }
}

# Main health check execution
try {
    if (-not $Silent) {
        Write-Host "CyberRisk Platform Health Check" -ForegroundColor Cyan
        Write-Host "===============================" -ForegroundColor Cyan
    }
    
    # Load configuration
    Read-HealthConfiguration
    
    # Run health checks
    Test-DatabaseHealth
    Test-WebServiceHealth
    Test-SystemResources
    Test-ApplicationFiles
    Test-SecurityConfiguration
    
    # Send alerts if configured
    Send-HealthAlert
    
    # Generate and display report
    Write-HealthReport
}
catch {
    Write-HealthLog "Health check failed with unexpected error: $($_.Exception.Message)" -Level Critical
    Write-HealthLog $_.ScriptStackTrace -Level Error
    exit 5
}