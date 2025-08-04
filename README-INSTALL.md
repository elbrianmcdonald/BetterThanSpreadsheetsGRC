# 🚀 Better Than Spreadsheets GRC - Installation Guide

## Quick Installation

### Option 1: Automatic Installation (Recommended)

1. **Run the installer** (as Administrator for best results):
   ```cmd
   install.bat
   ```

2. **Start the application**:
   ```cmd
   dotnet run
   ```

3. **Open in browser**: http://localhost:5197/setup

### Option 2: Manual Dependency Installation

If you prefer to install dependencies manually:

```powershell
# Install dependencies only
.\install-dependencies.ps1

# Or with options
.\install-dependencies.ps1 -SkipPostgreSQL  # Skip PostgreSQL installation
.\install-dependencies.ps1 -SkipDotNet      # Skip .NET installation
.\install-dependencies.ps1 -Force           # Force reinstall even if already installed
```

## What Gets Installed

### Dependencies
- **.NET 8 ASP.NET Core Runtime** - Required to run the application
- **PostgreSQL 16** - Database server with default credentials:
  - Host: `localhost`
  - Port: `5432`
  - Username: `postgres`
  - Password: `postgres`

### Database Setup
- Creates database: `CyberRiskDB`
- Creates user: `cyberrisk_user` / `CyberRisk123!`
- Runs Entity Framework migrations

## Post-Installation

### Development Mode
```cmd
# Run the application
dotnet run

# Access at: http://localhost:5197/setup
```

### Production Mode (Windows Service)
```powershell
# Install as Windows Service
.\scripts\install.ps1

# Service will run automatically
# Access at: http://localhost:5197/setup
```

## Troubleshooting

### .NET Runtime Issues
If .NET installation fails:
1. Download manually: https://dotnet.microsoft.com/download/dotnet/8.0
2. Install the ASP.NET Core Runtime 8.0.x (x64)

### PostgreSQL Issues
If PostgreSQL installation fails:
1. Download manually: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Set superuser password to `postgres`

### Database Connection Issues
```powershell
# Test PostgreSQL connection
psql -h localhost -U postgres -c "SELECT version();"

# If connection fails, check:
# 1. PostgreSQL service is running
# 2. Port 5432 is not blocked
# 3. Password is correct
```

### Permission Issues
Run PowerShell as Administrator:
```powershell
# Allow script execution
Set-ExecutionPolicy Bypass -Scope Process -Force

# Run installer
.\install-dependencies.ps1
```

## System Requirements

- **OS**: Windows 10/11 or Windows Server 2019+
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space
- **Network**: Internet connection for dependency downloads

## Manual Installation Steps

If the automatic installer doesn't work:

1. **Install .NET 8 Runtime**:
   - Download from https://dotnet.microsoft.com/download/dotnet/8.0
   - Install ASP.NET Core Runtime 8.0.x (x64)

2. **Install PostgreSQL**:
   - Download from https://www.postgresql.org/download/windows/
   - Use default settings with password `postgres`

3. **Setup Database**:
   ```powershell
   .\setup-database.ps1
   ```

4. **Run Application**:
   ```cmd
   dotnet run
   ```

## Configuration

After installation, configure the application at:
**http://localhost:5197/setup**

This setup wizard will guide you through:
- Creating admin user
- Basic configuration
- SSL certificate setup (optional)

---

**Better Than Spreadsheets GRC** - Enterprise GRC Platform 🎯