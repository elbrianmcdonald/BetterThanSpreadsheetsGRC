# 🚀 Better Than Spreadsheets GRC - Git-based Installer

Deploy and install the application directly from Git repository using PowerShell.

## Quick Start

### Prerequisites

- **Git** - Download from [git-scm.com](https://git-scm.com/downloads)
- **.NET 8 SDK** - Download from [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Administrator Rights** - Required for service installation
- **Internet Connection** - For cloning repository and downloading dependencies

### Installation

**Easy Install:**
```cmd
install-git.bat
```

**PowerShell Install:**
```powershell
.\install-from-git.ps1
```

**Custom Repository:**
```powershell
.\install-from-git.ps1 -GitRepository "https://github.com/yourorg/your-repo.git"
```

## Installation Features

### 🔄 Git-Based Deployment
- Clones repository from Git
- Builds from source code
- Always gets latest version
- Easy updates with `-Update` flag

### ⚡ Automatic Dependencies
- Downloads and installs .NET 8 Runtime
- Downloads and installs PostgreSQL 16
- Sets up database and user accounts
- Configures production environment

### 🛠️ Build Process
- Restores NuGet packages
- Builds application from source
- Creates self-contained executable
- Configures production settings

### 🚀 Service Installation  
- Installs as Windows Service
- Configures automatic startup
- Sets up service recovery
- Creates desktop shortcuts

## Usage Options

### Production Installation
```powershell
# Full production install
.\install-from-git.ps1

# Custom installation path
.\install-from-git.ps1 -InstallPath "D:\MyApps\GRC"

# Custom database settings
.\install-from-git.ps1 -DatabaseName "MyGRCDB" -DatabaseUser "myuser"
```

### Development Mode
```powershell
# Development install (no service, no admin required)
.\install-from-git.ps1 -DevMode

# Skip dependency installation
.\install-from-git.ps1 -SkipDependencies

# Use specific branch
.\install-from-git.ps1 -Branch "development"
```

### Updates
```powershell
# Update existing installation
.\install-from-git.ps1 -Update

# Force fresh install
.\install-from-git.ps1 -Update -Force
```

## Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-GitRepository` | Git repository URL | Your repo URL |
| `-Branch` | Git branch to use | `main` |
| `-InstallPath` | Installation directory | `C:\Program Files\Better Than Spreadsheets GRC` |
| `-ServiceName` | Windows service name | `BetterThanSpreadsheetsGRC` |
| `-DatabaseName` | PostgreSQL database name | `CyberRiskDB` |
| `-DatabaseUser` | Database username | `cyberrisk_user` |
| `-DatabasePassword` | Database password | `CyberRisk123!` |
| `-Update` | Update existing installation | `false` |
| `-SkipDependencies` | Skip .NET/PostgreSQL install | `false` |
| `-DevMode` | Development mode (no service) | `false` |

## Advantages Over MSI Installer

### ✅ Always Current
- Gets latest code from repository
- No need to rebuild installers
- Instant access to bug fixes and features

### ✅ Easy Updates
- Single command to update: `-Update`
- Preserves configuration and data
- Minimal downtime during updates

### ✅ Flexible Deployment
- Can target different branches (dev, staging, prod)
- Custom repository URLs
- Development mode for testing

### ✅ Transparent Process
- Full visibility into build process
- Can modify source before building
- Easy troubleshooting

### ✅ Smaller Distribution
- No large installer files to distribute
- Just share the PowerShell script
- Reduces bandwidth and storage

## Installation Process

1. **Prerequisites Check** - Verifies Git and .NET SDK
2. **Dependency Installation** - Installs .NET Runtime and PostgreSQL
3. **Repository Clone** - Downloads source code from Git
4. **Build Application** - Compiles from source
5. **Install Files** - Copies to Program Files
6. **Database Setup** - Creates database and user
7. **Configuration** - Creates production config
8. **Database Migrations** - Applies database schema
9. **Service Installation** - Registers Windows service
10. **Cleanup** - Removes temporary files

## Troubleshooting

### Git Issues
```powershell
# Check Git installation
git --version

# Configure Git (if needed)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Build Issues
```powershell
# Check .NET SDK
dotnet --version

# Manual build test
dotnet restore
dotnet build
```

### Database Issues
```powershell
# Test PostgreSQL connection
psql -h localhost -U postgres -c "SELECT version();"

# Check PostgreSQL service
Get-Service postgresql*
```

### Service Issues
```powershell
# Check service status
Get-Service BetterThanSpreadsheetsGRC

# View service logs
Get-EventLog -LogName Application -Source BetterThanSpreadsheetsGRC -Newest 10
```

## Development Workflow

### Development Install
```powershell
# Install in development mode
.\install-from-git.ps1 -DevMode -Branch "development"

# Run from command line
cd "C:\Temp\BetterThanSpreadsheetsGRC-Source\publish"
dotnet CyberRiskApp.dll
```

### Testing Updates
```powershell
# Test update process
.\install-from-git.ps1 -Update -DevMode

# Test different branches
.\install-from-git.ps1 -Branch "feature/new-feature" -DevMode
```

## Security Considerations

- Repository access requires appropriate permissions
- PowerShell execution policy may need adjustment
- Database passwords are configurable
- Service runs with system privileges
- HTTPS endpoints configured by default

## Examples

### Corporate Deployment
```powershell
# Deploy from corporate repository
.\install-from-git.ps1 `
  -GitRepository "https://git.company.com/security/grc-platform.git" `
  -Branch "production" `
  -InstallPath "C:\Applications\GRC" `
  -DatabaseName "CorporateGRC"
```

### Development Setup
```powershell
# Quick development setup
.\install-from-git.ps1 -DevMode -SkipDependencies -Branch "develop"
```

### Update Production
```powershell
# Update production installation
.\install-from-git.ps1 -Update
```

---

**Better Than Spreadsheets GRC** - Git-Powered Deployment 🎯