# CyberRisk Platform - Installation Guide

## Quick Start Installation

### Step 1: Install Dependencies First

**Before running the installer, manually install these required components:**

#### 📦 Required Dependencies

1. **📦 .NET 8.0 ASP.NET Core Runtime**
   - **Download:** https://dotnet.microsoft.com/download/dotnet/8.0
   - **Choose:** "ASP.NET Core Runtime 8.0.x - Windows x64"
   - **Direct Link:** https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-aspnetcore-8.0.8-windows-x64-installer

2. **📦 Git for Windows**  
   - **Download:** https://git-scm.com/download/windows
   - **Choose:** "64-bit Git for Windows Setup"
   - **Direct Link:** https://github.com/git-for-windows/git/releases/latest

#### 📦 Required for Application to Work

3. **📦 PostgreSQL Database Server**
   - **Download:** https://www.postgresql.org/download/windows/
   - **Choose:** "Windows x86-64, Latest Version"
   - **Direct Link:** https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - **Note:** The application REQUIRES PostgreSQL to store data. Install this before running the application.

---

### Step 2: Run the Installer

1. **Download this repository** or navigate to the deployment folder

2. **Right-click** on `Install-CyberRisk.bat`

3. **Select** "Run as administrator"

4. **Follow the prompts** - enter your administrator email when requested

---

## What the Installer Does

✅ **Checks for required dependencies**  
✅ **Downloads latest source code from GitHub**  
✅ **Builds the application**  
✅ **Creates configuration files**  
✅ **Provides clear next steps**

---

## After Installation

### 🔧 Database Setup

1. **Create PostgreSQL Database:**
   ```sql
   CREATE DATABASE CyberRiskDB;
   CREATE USER cyberrisk_user WITH PASSWORD 'YourSecurePassword123!';
   GRANT ALL PRIVILEGES ON DATABASE CyberRiskDB TO cyberrisk_user;
   ```

2. **Update Connection String:**
   - Edit: `C:\CyberRisk\appsettings.Production.json`
   - Update the password in the ConnectionStrings section

3. **Run Migrations:**
   ```cmd
   cd "C:\CyberRisk"
   set ASPNETCORE_ENVIRONMENT=Production
   dotnet ef database update
   ```

### 🚀 Start the Application

```cmd
cd "C:\CyberRisk"
set ASPNETCORE_ENVIRONMENT=Production
dotnet run
```

### 🌐 Access the Application

- **URL:** http://localhost:5000
- **Login:** Use the email address you provided during installation
- **Password:** Set when you first login

---

## Troubleshooting

### Common Issues

**❌ "dotnet command not found"**
- Install .NET 8.0 Runtime from the link above
- Restart your command prompt after installation

**❌ "git command not found"**  
- Install Git for Windows from the link above
- Make sure "Add Git to PATH" was selected during installation

**❌ "Access denied" errors**
- Make sure you ran the installer as Administrator
- Check that your antivirus isn't blocking the installation

**❌ Database connection errors**
- Make sure PostgreSQL is installed and running
- Verify the connection string in appsettings.Production.json
- Check that the database and user exist

### Getting Help

- **Installation Logs:** Check your temp directory for `CyberRisk_Install_*.log` files
- **Application Logs:** Look in `C:\CyberRisk\logs\` folder
- **Health Check:** Visit http://localhost:5000/health after starting the app

---

## Advanced Options

### Custom Installation Path

```cmd
powershell.exe -ExecutionPolicy Bypass -File "Install-CyberRisk-App.ps1" -AdminEmail "admin@company.com" -InstallPath "D:\MyApps\CyberRisk"
```

### Production Deployment

For production environments, consider:
- Setting up IIS hosting
- Configuring SSL certificates  
- Setting up automated backups
- Implementing monitoring and alerting

See the full `README.md` for enterprise deployment options.

---

## File Structure After Installation

```
C:\CyberRisk\
├── CyberRiskApp.dll          # Main application
├── appsettings.json          # Default settings
├── appsettings.Production.json # Production settings
├── installation-info.json    # Installation details
├── logs\                     # Application logs
├── wwwroot\                  # Web assets
└── publish\                  # Published application files
```

---

**🎉 That's it! Your CyberRisk Platform should now be installed and ready to use.**