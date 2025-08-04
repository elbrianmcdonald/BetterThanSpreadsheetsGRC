# CyberRisk App Installation Options

## 🔐 Secure Password Handling in Installers

The CyberRisk app now supports multiple installation methods, all with secure password handling:

### 1. Windows Installer with Web Setup (Recommended)

**Process Flow:**
```
Installer.exe → Install Files → Create Service → Open Web Setup → User Configures Passwords
```

**Steps:**
1. Run the installer (`CyberRiskApp-Setup-1.0.0.exe`)
2. Installer copies files and creates Windows service
3. Automatically opens browser to `/Setup`
4. User completes setup wizard with secure password generation
5. Passwords are never stored in installer or logs

**Command:**
```powershell
# Create installer with web setup
.\create-installer.ps1
# Compile with Inno Setup
# Run the generated .exe
```

### 2. Manual Installation with Secure Setup

**Process Flow:**
```
Extract Files → Run Secure Setup → Configure Service → Complete Web Setup
```

**Steps:**
```powershell
# Option A: Generate all passwords
.\setup-secure.ps1 -GeneratePasswords
.\install.ps1 -UseWebSetup

# Option B: Prompt for passwords
.\setup-secure.ps1
.\install.ps1 -SkipDatabaseSetup
```

### 3. Automated/Silent Installation

**For CI/CD or unattended installations:**

```powershell
# Set environment variables
$env:CYBERRISK_ADMIN_EMAIL = "admin@company.com"
$env:CYBERRISK_ADMIN_PASSWORD = [System.Environment]::GetEnvironmentVariable("ADMIN_PWD", "User")
$env:CYBERRISK_DB_PASSWORD = [System.Environment]::GetEnvironmentVariable("DB_PWD", "User")

# Run installation
.\install.ps1 -DatabasePassword (ConvertTo-SecureString $env:CYBERRISK_DB_PASSWORD -AsPlainText -Force)

# Start application (will auto-configure on first run)
Start-Service CyberRiskApp
```

### 4. Docker Installation

**docker-compose.yml with secrets:**
```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - CYBERRISK_ADMIN_EMAIL=admin@company.com
      - ConnectionStrings__DefaultConnection=Host=db;Database=CyberRiskDB;Username=cyberrisk_user;Password=${DB_PASSWORD}
    secrets:
      - admin_password
      - db_password
    ports:
      - "5000:80"

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
      - POSTGRES_USER=cyberrisk_user
      - POSTGRES_DB=CyberRiskDB
    secrets:
      - db_password

secrets:
  admin_password:
    external: true
  db_password:
    external: true
```

## 🛡️ Security Features by Installation Method

| Method | Password Generation | Storage | Best For |
|--------|-------------------|---------|----------|
| Windows Installer + Web Setup | ✅ Automatic | Memory only | End users |
| Manual + Secure Script | ✅ Optional | Encrypted file | IT admins |
| Environment Variables | ❌ Manual | Env vars | CI/CD |
| Docker Secrets | ❌ Manual | Docker secrets | Containers |
| Azure Key Vault | ❌ Manual | Cloud KMS | Production |

## 📋 Installation Script Parameters

### install.ps1
```powershell
.\install.ps1 `
    -InstallPath "C:\Program Files\CyberRiskApp" `
    -ServiceName "CyberRiskApp" `
    -DatabaseServer "localhost" `
    -DatabaseName "CyberRiskDB" `
    -DatabaseUser "cyberrisk_user" `
    -DatabasePassword $securePassword `
    -HttpPort 5000 `
    -HttpsPort 5001 `
    -UseWebSetup  # Opens web setup after installation
    -SkipDatabaseSetup  # Skip DB config for later
```

### setup-secure.ps1
```powershell
.\setup-secure.ps1 `
    -AdminEmail "admin@company.com" `
    -AdminPassword $secureAdminPwd `
    -DatabasePassword $secureDbPwd `
    -GeneratePasswords  # Auto-generate secure passwords
    -UseEnvironmentVariables  # Store in env vars
```

## 🔑 Password Storage Locations

Depending on installation method, passwords are stored in:

1. **Encrypted File** (Windows DPAPI):
   ```
   C:\ProgramData\CyberRiskApp\config\credentials.enc
   ```

2. **User Secrets** (Development):
   ```
   %APPDATA%\Microsoft\UserSecrets\[app-id]\secrets.json
   ```

3. **Environment Variables**:
   ```
   CYBERRISK_ADMIN_PASSWORD
   CYBERRISK_DB_PASSWORD
   CYBERRISK_CONNECTION_STRING
   ```

4. **Azure Key Vault** (Production):
   ```
   https://[vault-name].vault.azure.net/secrets/CyberRiskAdminPassword
   ```

## 🚀 Quick Start Examples

### Example 1: Developer Setup
```powershell
# Clone repository
git clone [repository]
cd CyberRiskApp

# Run with web setup
dotnet run
# Navigate to http://localhost:5197/Setup
```

### Example 2: Production Deployment
```powershell
# Build installer
.\publish-windows.ps1
.\create-installer.ps1

# Deploy installer to server
# Run installer - it will prompt for setup via web
```

### Example 3: Automated Deployment
```powershell
# Store secrets in Key Vault
az keyvault secret set --vault-name MyVault --name CyberRiskAdminPwd --value (Generate-SecurePassword)

# Deploy with installer
msiexec /i CyberRiskApp.msi /quiet VAULT_NAME=MyVault
```

## ⚠️ Important Security Notes

1. **Never hardcode passwords** in scripts or config files
2. **Always use HTTPS** in production (`Force HTTPS` in Domain Management)
3. **Change default passwords** immediately after setup
4. **Enable audit logging** for all password-related operations
5. **Use Key Vault** or similar for production deployments
6. **Implement password rotation** policies
7. **Monitor failed login attempts**

## 🔧 Troubleshooting

**Issue: "No password provided"**
- Solution: Run `.\setup-secure.ps1 -GeneratePasswords` first

**Issue: "Cannot decrypt credentials"**
- Solution: Ensure running as same user/system that encrypted them

**Issue: "Setup page not loading"**
- Solution: Check service is running: `Get-Service CyberRiskApp`

**Issue: "Database connection failed"**
- Solution: Verify PostgreSQL is running and credentials are correct