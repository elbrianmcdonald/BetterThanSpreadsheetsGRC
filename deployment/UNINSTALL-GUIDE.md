# CyberRisk Platform Uninstallation Guide

This guide provides instructions for completely removing the CyberRisk Platform from your system.

## Table of Contents
1. [Before You Begin](#before-you-begin)
2. [Docker Deployment Uninstallation](#docker-deployment-uninstallation)
3. [Manual Installation Uninstallation](#manual-installation-uninstallation)
4. [Database Cleanup](#database-cleanup)
5. [Verification](#verification)

## Before You Begin

**WARNING**: These steps will permanently remove the CyberRisk Platform and all associated data. Ensure you have backed up any important data before proceeding.

### Prerequisites
- Administrator access to your system
- PowerShell (for Windows) or Terminal (for Linux/Mac)
- Backup of any data you wish to retain

## Docker Deployment Uninstallation

If you installed the CyberRisk Platform using Docker, follow these steps:

### 1. Stop and Remove Docker Containers

```bash
# Stop all CyberRisk containers
docker-compose -f docker-compose.yml down

# For production deployment
docker-compose -f docker-compose.prod.yml down

# Remove containers with volumes
docker-compose -f docker-compose.yml down -v

# For production deployment with volumes
docker-compose -f docker-compose.prod.yml down -v
```

### 2. Remove Docker Images

```bash
# List CyberRisk related images
docker images | grep cyberrisk

# Remove CyberRisk application image
docker rmi cyberrisk-app

# Remove PostgreSQL image if no longer needed
docker rmi postgres:16

# Remove nginx image if no longer needed
docker rmi nginx:alpine
```

### 3. Clean Docker Volumes

```bash
# List volumes
docker volume ls

# Remove specific CyberRisk volumes
docker volume rm deployment_postgres_data
docker volume rm deployment_app_data
docker volume rm deployment_app_logs

# Or remove all unused volumes (BE CAREFUL - this affects all Docker apps)
docker volume prune
```

### 4. Remove Docker Network

```bash
# Remove CyberRisk network
docker network rm deployment_cyberrisk-network
```

## Manual Installation Uninstallation

If you installed the CyberRisk Platform manually (using Install-CyberRisk-App.ps1), follow these steps:

### 1. Stop the Application

If the application is running:

```powershell
# Find the dotnet process running CyberRisk
Get-Process | Where-Object {$_.ProcessName -eq "dotnet" -and $_.CommandLine -like "*CyberRisk*"} | Stop-Process -Force
```

### 2. Remove Application Files

Default installation path is `C:\CyberRisk`. Remove it:

```powershell
# Remove installation directory (adjust path if you installed elsewhere)
Remove-Item -Path "C:\CyberRisk" -Recurse -Force

# If you cloned from Git to another location, remove that as well
# Example: Remove-Item -Path "C:\Dev\CyberRiskPlatform" -Recurse -Force
```

### 3. Remove Windows Service (if configured)

If you configured the application as a Windows service:

```powershell
# Stop the service
Stop-Service -Name "CyberRiskPlatform" -Force

# Remove the service
sc.exe delete "CyberRiskPlatform"
```

### 4. Clean Temporary Files

```powershell
# Remove installation logs
Remove-Item -Path "$env:TEMP\CyberRisk_*" -Recurse -Force -ErrorAction SilentlyContinue

# Remove any .NET build cache
Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\dotnet\build_cache\CyberRisk*" -Recurse -Force -ErrorAction SilentlyContinue
```

## Database Cleanup

### PostgreSQL Installed Locally

If you have PostgreSQL installed locally and want to remove the CyberRisk database:

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Drop the database (THIS IS PERMANENT!)
DROP DATABASE IF EXISTS "CyberRiskDB";

-- Drop the user
DROP USER IF EXISTS cyberrisk_user;

-- Exit psql
\q
```

### Complete PostgreSQL Removal (Optional)

If PostgreSQL was installed only for CyberRisk and you want to remove it completely:

**Windows:**
1. Open Control Panel > Programs and Features
2. Find PostgreSQL in the list
3. Click Uninstall and follow the wizard
4. Remove PostgreSQL data directory (usually `C:\Program Files\PostgreSQL\`)

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get remove --purge postgresql postgresql-*
sudo rm -rf /var/lib/postgresql/
sudo rm -rf /etc/postgresql/
sudo rm -rf /var/log/postgresql/

# RedHat/CentOS
sudo yum remove postgresql*
sudo rm -rf /var/lib/pgsql/
```

## Additional Cleanup

### 1. Remove Environment Variables

If any environment variables were set:

```powershell
# Remove CyberRisk specific environment variables
[Environment]::SetEnvironmentVariable("CYBERRISK_HOME", $null, "User")
[Environment]::SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", $null, "User")
```

### 2. Remove Firewall Rules

If firewall rules were created:

```powershell
# Remove Windows firewall rules
Remove-NetFirewallRule -DisplayName "CyberRisk Platform*"
```

### 3. Clean Registry (Windows)

If any registry entries were created:

```powershell
# Remove registry entries (if any)
Remove-Item -Path "HKLM:\SOFTWARE\CyberRiskPlatform" -Recurse -ErrorAction SilentlyContinue
Remove-Item -Path "HKCU:\SOFTWARE\CyberRiskPlatform" -Recurse -ErrorAction SilentlyContinue
```

## Verification

After uninstallation, verify that everything has been removed:

```powershell
# Check for remaining files
Test-Path "C:\CyberRisk"
Test-Path "$env:TEMP\CyberRisk_*"

# Check for running processes
Get-Process | Where-Object {$_.ProcessName -like "*cyberrisk*"}

# Check for Docker containers/images
docker ps -a | grep cyberrisk
docker images | grep cyberrisk

# Check for services
Get-Service | Where-Object {$_.Name -like "*cyberrisk*"}

# Check PostgreSQL database (if PostgreSQL still installed)
psql -U postgres -c "\l" | grep -i cyberrisk
```

## Troubleshooting

### Permission Denied Errors
- Ensure you're running PowerShell as Administrator
- Close any applications that might be using the files

### Docker Volumes Won't Delete
- Ensure all containers using the volumes are stopped and removed
- Use `docker system prune -a --volumes` (WARNING: affects all Docker resources)

### Database Won't Drop
- Ensure no active connections to the database
- Force disconnect all users:
  ```sql
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE datname = 'CyberRiskDB' AND pid <> pg_backend_pid();
  ```

## Support

If you encounter issues during uninstallation:
- Check the GitHub repository issues: https://github.com/elbrianmcdonald/BetterThanSpreadsheets/issues
- Review installation logs if available: `$env:TEMP\CyberRisk_*.log`

## Post-Uninstallation

After successful uninstallation:
1. Review and remove any backups you no longer need
2. Update any documentation referencing the CyberRisk Platform
3. Notify users that the platform has been removed
4. Consider removing .NET Runtime and other dependencies if no longer needed by other applications