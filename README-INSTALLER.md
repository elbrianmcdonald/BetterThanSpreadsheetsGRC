# 🚀 Better Than Spreadsheets GRC - Windows Installer

Professional Windows installer with automatic dependency installation and service configuration.

## Quick Start

### Build the Installer

**Requirements:**
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) 
- Internet connection (for downloading dependencies)
- Visual Studio or .NET SDK 8.0

**Build:**
```cmd
build-installer.bat
```

This creates a complete Windows installer in `installer-output/`

### What Gets Built

1. **Self-contained executable** - No .NET installation required on target
2. **Dependency installers** - .NET 8 Runtime and PostgreSQL 16
3. **Windows installer** - Professional MSI-style installer
4. **Service configuration** - Automatic Windows Service setup

## Manual Build Process

```powershell
# 1. Build executable
.\build-executable.ps1 -SelfContained -OutputDir ".\dist"

# 2. Create installer
.\create-installer.ps1
```

## Installer Features

### Installation Options

- **Full Installation** - App + Dependencies + Service
- **Compact Installation** - App + Service only  
- **Custom Installation** - Choose components

### Components

✅ **Application** - Core GRC platform  
✅ **Dependencies** - .NET 8 + PostgreSQL (optional)  
✅ **Windows Service** - Auto-start service installation  
✅ **Desktop Shortcut** - Quick access link  

### Automatic Setup

- **Database Creation** - CyberRiskDB with proper permissions
- **User Account** - cyberrisk_user/CyberRisk123!
- **Service Installation** - BetterThanSpreadsheetsGRC service
- **Configuration** - Production-ready settings
- **SSL Certificate** - Self-signed certificate setup

## Installation Process

1. **Dependency Check** - Installs .NET 8 if needed
2. **PostgreSQL Setup** - Installs PostgreSQL 16 if needed
3. **Database Creation** - Creates database and user
4. **File Installation** - Copies application files
5. **Service Installation** - Registers Windows service
6. **Configuration** - Sets up production config
7. **Service Start** - Starts the service automatically

## Installer Customization

### Custom Paths

```powershell
# Custom installation directory
.\create-installer.ps1 -InstallPath "D:\MyApps\GRC"

# Skip dependency downloads (if already available)
.\create-installer.ps1 -DownloadDependencies:$false

# Build only (no installer creation)
.\create-installer.ps1 -CreateInstaller:$false
```

### Inno Setup Script

The `installer.iss` file contains:
- Component definitions
- Installation tasks
- Registry entries  
- Service installation scripts
- Uninstallation procedures

## Distribution

### Installer File

- **Name**: `BetterThanSpreadsheetsGRC-Setup-1.0.0.exe`
- **Size**: ~150-200MB (includes dependencies)
- **Requirements**: Windows 10/11, 64-bit
- **Permissions**: Administrator required

### Installation Directories

- **Application**: `C:\Program Files\Better Than Spreadsheets GRC`
- **Database**: PostgreSQL default location
- **Service**: Windows Service Manager
- **Shortcuts**: Start Menu + Desktop (optional)

## Post-Installation

### Access Application

**URL**: http://localhost:5197/setup

### Service Management

```cmd
# Check service status
sc query BetterThanSpreadsheetsGRC

# Start/stop service
net start BetterThanSpreadsheetsGRC
net stop BetterThanSpreadsheetsGRC
```

### Database Access

- **Host**: localhost:5432
- **Database**: CyberRiskDB
- **User**: cyberrisk_user
- **Password**: CyberRisk123!

## Troubleshooting

### Build Issues

```powershell
# Clean build
Remove-Item dist -Recurse -Force
Remove-Item dependencies -Recurse -Force
.\build-installer.bat
```

### Inno Setup Not Found

1. Download from https://jrsoftware.org/isinfo.php
2. Install to default location
3. Or specify custom path:
   ```powershell
   .\create-installer.ps1 -InnoSetupPath "C:\MyPath\ISCC.exe"
   ```

### Dependency Download Failures

- Check internet connection
- Verify URLs in `create-installer.ps1`
- Download manually to `dependencies/` folder

### Large File Size

To reduce installer size:
- Use framework-dependent build: `-SelfContained:$false`
- Skip dependencies: `-DownloadDependencies:$false`
- Use compact installation option

## Advanced Configuration

### Custom Database Settings

Edit `installer.iss`:
```pascal
[Run]
; Custom database setup
Filename: "powershell.exe"; Parameters: "-File setup-database.ps1 -DatabaseName MyDB"
```

### Service Configuration

Edit `install-service.ps1` for custom:
- Service names
- Installation paths  
- Database connections
- Port configurations

### SSL Certificate

The installer includes self-signed SSL setup. For production:
1. Replace certificate files
2. Update `appsettings.Production.json`
3. Configure Kestrel endpoints

## Files Created

```
installer-output/
├── BetterThanSpreadsheetsGRC-Setup-1.0.0.exe  # Main installer
├── BetterThanSpreadsheetsGRC-Setup-1.0.0.pdb  # Debug symbols
└── Output.txt                                  # Build log

dist/
├── CyberRiskApp.exe                           # Main executable  
├── appsettings.json                           # Configuration
├── version.json                               # Build info
└── [runtime files]                           # .NET runtime

dependencies/
├── aspnetcore-runtime-8.0.18-win-x64.exe    # .NET Runtime
└── postgresql-16.6-1-windows-x64.exe        # PostgreSQL
```

---

**Better Than Spreadsheets GRC** - Enterprise GRC Platform 🎯