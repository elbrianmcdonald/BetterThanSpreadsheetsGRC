# 🚀 Better Than Spreadsheets GRC - Quick Install Guide

## One-Line Installation

Open **PowerShell as Administrator** and run:

```powershell
iwr -useb https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1 | iex
```

That's it! This will automatically:
- ✅ Clone the repository from GitHub
- ✅ Install .NET 8 Runtime (if needed)
- ✅ Install PostgreSQL 16 (if needed)
- ✅ Build the application
- ✅ Set up the database
- ✅ Install as Windows Service
- ✅ Start the service

## Access the Application

After installation, open your browser to:
**http://localhost:5197/setup**

## Alternative Installation Methods

### Download and Run Script
```powershell
# Download the installer
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1" -OutFile "install-btsgrc.ps1"

# Run it
.\install-btsgrc.ps1
```

### Clone and Install
```powershell
# Clone the repository
git clone https://github.com/elbrianmcdonald/BetterThanSpreadsheets.git
cd BetterThanSpreadsheets

# Run the installer
.\install-from-git.ps1
```

### Development Mode
```powershell
# Install without admin rights (no service)
iwr -useb https://raw.githubusercontent.com/elbrianmcdonald/BetterThanSpreadsheets/main/install-from-git.ps1 | iex -DevMode
```

## Update Existing Installation

```powershell
# Update to latest version
.\install-from-git.ps1 -Update
```

## Customization Options

```powershell
# Custom database name
.\install-from-git.ps1 -DatabaseName "MyGRCDB"

# Custom installation path
.\install-from-git.ps1 -InstallPath "D:\Apps\BetterThanSpreadsheetsGRC"

# Use specific branch
.\install-from-git.ps1 -Branch "development"

# Skip dependency installation
.\install-from-git.ps1 -SkipDependencies
```

## Requirements

- **Windows 10/11** or Windows Server 2019+
- **Administrator rights** (for service installation)
- **Internet connection**
- **Git** (will prompt to install if missing)
- **.NET 8 SDK** (will prompt to install if missing)

## Troubleshooting

### PowerShell Execution Policy
If you get an execution policy error:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
```

### Missing Git
Install Git from: https://git-scm.com/downloads

### Missing .NET SDK
Install .NET 8 SDK from: https://dotnet.microsoft.com/download/dotnet/8.0

### Database Connection Issues
Default PostgreSQL credentials:
- Host: `localhost`
- Port: `5432`
- Database: `CyberRiskDB`
- Username: `cyberrisk_user`
- Password: `CyberRisk123!`

## Uninstall

```powershell
# Stop and remove service
Stop-Service BetterThanSpreadsheetsGRC
sc.exe delete BetterThanSpreadsheetsGRC

# Remove files
Remove-Item "C:\Program Files\Better Than Spreadsheets GRC" -Recurse -Force

# Optional: Remove database
psql -U postgres -c "DROP DATABASE CyberRiskDB;"
psql -U postgres -c "DROP USER cyberrisk_user;"
```

---

**Repository**: https://github.com/elbrianmcdonald/BetterThanSpreadsheets