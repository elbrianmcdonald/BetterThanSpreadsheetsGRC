# 🚀 Better Than Spreadsheets GRC - Service Installer

Complete Windows Service installer with automatic dependency installation.

## Quick Installation

**Run as Administrator:**
```cmd
install-service.bat
```

This will automatically:
- ✅ Install .NET 8 Runtime (if needed)
- ✅ Install PostgreSQL 16 (if needed)
- ✅ Setup database and user accounts
- ✅ Build and publish the application
- ✅ Install as Windows Service
- ✅ Configure automatic startup
- ✅ Start the service

## Access Application

After installation, access at:
**http://localhost:5197/setup**

## Service Details

- **Service Name**: `BetterThanSpreadsheetsGRC`
- **Display Name**: `Better Than Spreadsheets GRC`
- **Install Path**: `C:\Program Files\BetterThanSpreadsheetsGRC`
- **Database**: `CyberRiskDB`
- **Database User**: `cyberrisk_user`

## Service Management

```powershell
# Check service status
Get-Service BetterThanSpreadsheetsGRC

# Start service
Start-Service BetterThanSpreadsheetsGRC

# Stop service
Stop-Service BetterThanSpreadsheetsGRC

# Restart service
Restart-Service BetterThanSpreadsheetsGRC
```

## Advanced Installation Options

```powershell
# Custom installation path
.\install-service.ps1 -InstallPath "D:\MyApps\GRC"

# Custom service name
.\install-service.ps1 -ServiceName "MyGRCService"

# Skip dependency installation (if already installed)
.\install-service.ps1 -SkipDependencies

# Force reinstall dependencies
.\install-service.ps1 -Force

# Custom database settings
.\install-service.ps1 -DatabaseName "MyGRCDB" -DatabaseUser "myuser" -DatabasePassword "MyPassword123!"
```

## Uninstallation

```cmd
# Uninstall service and remove all files
powershell -ExecutionPolicy Bypass -File "uninstall-service.ps1"

# Keep database when uninstalling
powershell -ExecutionPolicy Bypass -File "uninstall-service.ps1" -KeepDatabase
```

## Troubleshooting

### Service Won't Start
1. Check Event Viewer: `Windows Logs > Application`
2. Verify database connection:
   ```powershell
   psql -h localhost -U cyberrisk_user -d CyberRiskDB
   ```
3. Check configuration: `C:\Program Files\BetterThanSpreadsheetsGRC\appsettings.Production.json`

### Permission Issues
- Always run installer as Administrator
- Check Windows Services permissions
- Verify PostgreSQL service is running

### Port Conflicts
If ports 5197/7212 are in use:
1. Edit `appsettings.Production.json`
2. Change Kestrel endpoints
3. Restart service

### Database Issues
```powershell
# Test PostgreSQL connection
psql -h localhost -U postgres -c "SELECT version();"

# Check database exists
psql -h localhost -U postgres -c "\l"

# Manually create database
psql -h localhost -U postgres -c "CREATE DATABASE CyberRiskDB;"
```

## What Gets Installed

### Dependencies
- **.NET 8 ASP.NET Core Runtime** (if not present)
- **PostgreSQL 16** (if not present)
  - Default superuser password: `postgres`
  - Service runs automatically

### Database Setup
- **Database**: `CyberRiskDB`
- **User**: `cyberrisk_user` / `CyberRisk123!`
- **Permissions**: Full access to CyberRiskDB
- **Migrations**: Automatically applied

### Application Files
- **Location**: `C:\Program Files\BetterThanSpreadsheetsGRC`
- **Configuration**: Production-optimized settings
- **Service**: Auto-start Windows Service
- **Logging**: Windows Event Log integration

## Security Notes

- Database user has minimal required permissions
- Service runs with standard service account
- HTTPS configured with self-signed certificate
- Production logging enabled

## System Requirements

- **OS**: Windows 10/11 or Windows Server 2019+
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space
- **Network**: Internet connection for dependency downloads
- **Permissions**: Administrator rights required for installation

---

**Better Than Spreadsheets GRC** - Enterprise GRC Platform 🎯