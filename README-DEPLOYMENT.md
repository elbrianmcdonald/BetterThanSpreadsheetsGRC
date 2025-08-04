# CyberRisk App Deployment Guide

## Quick Start

### Option 1: Simple Package (No Installer)

1. **Build the package:**
   ```powershell
   .\publish-windows.ps1
   ```

2. **Copy files to target server:**
   - Copy the `publish\CyberRiskApp-Package` folder to your server
   - Run `install.ps1` as Administrator

3. **Set up database:**
   ```powershell
   .\setup-database.ps1
   ```

4. **Run migrations:**
   ```powershell
   cd C:\Program Files\CyberRiskApp
   .\CyberRiskApp.exe ef database update
   ```

### Option 2: Windows Installer

1. **Create installer:**
   ```powershell
   .\create-installer.ps1
   ```

2. **Compile with Inno Setup:**
   - Install [Inno Setup](https://jrsoftware.org/isdl.php)
   - Open `installer\CyberRiskApp.iss`
   - Compile (F9)

3. **Run installer:**
   - Run `CyberRiskApp-Setup-1.0.0.exe` as Administrator
   - Follow the wizard

## Deployment Methods

### 1. IIS Deployment

**Prerequisites:**
- IIS with ASP.NET Core Hosting Bundle
- .NET 8 Runtime

**Steps:**
```powershell
# Publish for IIS
dotnet publish -c Release -o C:\inetpub\CyberRiskApp

# Create IIS Site
# - Application Pool: No Managed Code
# - .NET CLR Version: No Managed Code
# - Pipeline Mode: Integrated
```

**web.config:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="aspNetCore" path="*" verb="*" modules="AspNetCoreModuleV2" resourceType="Unspecified" />
    </handlers>
    <aspNetCore processPath="dotnet" arguments=".\CyberRiskApp.dll" stdoutLogEnabled="true" stdoutLogFile=".\logs\stdout" hostingModel="inprocess" />
  </system.webServer>
</configuration>
```

### 2. Windows Service

**Using NSSM (Non-Sucking Service Manager):**
```powershell
# Download NSSM
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile nssm.zip
Expand-Archive nssm.zip

# Install service
.\nssm.exe install CyberRiskApp "C:\Program Files\CyberRiskApp\CyberRiskApp.exe"
.\nssm.exe set CyberRiskApp AppParameters "--urls http://*:5000;https://*:5001"
.\nssm.exe set CyberRiskApp AppDirectory "C:\Program Files\CyberRiskApp"
.\nssm.exe set CyberRiskApp Start SERVICE_AUTO_START
```

### 3. Docker Deployment

**Dockerfile:**
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CyberRiskApp.csproj", "."]
RUN dotnet restore "CyberRiskApp.csproj"
COPY . .
RUN dotnet build "CyberRiskApp.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CyberRiskApp.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CyberRiskApp.dll"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:80"
      - "5001:443"
    environment:
      - ConnectionStrings__DefaultConnection=Host=db;Database=CyberRiskDB;Username=cyberrisk_user;Password=CyberRisk123!
    depends_on:
      - db
  
  db:
    image: postgres:16
    environment:
      - POSTGRES_DB=CyberRiskDB
      - POSTGRES_USER=cyberrisk_user
      - POSTGRES_PASSWORD=CyberRisk123!
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 4. Linux Deployment

**Install on Ubuntu/Debian:**
```bash
# Install .NET 8
wget https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
sudo apt-get update
sudo apt-get install -y aspnetcore-runtime-8.0

# Publish app
dotnet publish -c Release -r linux-x64 --self-contained false -o /opt/cyberriskapp

# Create systemd service
sudo nano /etc/systemd/system/cyberriskapp.service
```

**systemd service file:**
```ini
[Unit]
Description=CyberRisk Management Platform
After=network.target

[Service]
Type=notify
WorkingDirectory=/opt/cyberriskapp
ExecStart=/usr/bin/dotnet /opt/cyberriskapp/CyberRiskApp.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=cyberriskapp
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://+:5000

[Install]
WantedBy=multi-user.target
```

## Configuration

### Production Settings

**appsettings.Production.json:**
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=db.server.com;Database=CyberRiskDB;Username=cyberrisk_user;Password=StrongPassword123!"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "cyberrisk.company.com;*.company.com",
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://+:80"
      },
      "Https": {
        "Url": "https://+:443",
        "Certificate": {
          "Path": "/etc/ssl/certs/cyberrisk.pfx",
          "Password": "CertPassword123!"
        }
      }
    }
  }
}
```

### SSL Certificate

**Generate self-signed certificate:**
```powershell
New-SelfSignedCertificate -DnsName "cyberrisk.company.com" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(5)
$cert = Get-ChildItem -Path cert:\LocalMachine\My | Where-Object {$_.Subject -match "cyberrisk.company.com"}
$pwd = ConvertTo-SecureString -String "CertPassword123!" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "cyberrisk.pfx" -Password $pwd
```

## Post-Deployment

### 1. Run Database Migrations
```powershell
cd "C:\Program Files\CyberRiskApp"
.\CyberRiskApp.exe ef database update
```

### 2. Create Admin User
Access the application and use the default admin credentials:
- Email: admin@cyberrisk.local
- Password: Admin123!

**Important:** Change the password immediately!

### 3. Configure Domain
1. Login as admin
2. Go to Domain Management
3. Add your production domain

### 4. Set Up Backups
Configure automated database backups in the application or using PostgreSQL tools.

## Troubleshooting

### Service Won't Start
- Check Event Viewer for errors
- Verify PostgreSQL is running
- Check connection string in appsettings.json
- Ensure ports are not in use

### Database Connection Failed
- Verify PostgreSQL is installed and running
- Check firewall rules for port 5432
- Test connection: `psql -U cyberrisk_user -d CyberRiskDB -h localhost`

### HTTPS Not Working
- Verify certificate is installed
- Check certificate path in configuration
- Ensure ports 443/5001 are open in firewall

## Security Checklist

- [ ] Change default admin password
- [ ] Configure HTTPS with valid certificate
- [ ] Set up firewall rules
- [ ] Enable HSTS in Domain Management
- [ ] Configure secure connection string
- [ ] Set up regular backups
- [ ] Review and update appsettings.Production.json
- [ ] Remove development settings
- [ ] Configure logging to secure location
- [ ] Set up monitoring and alerts