# CyberRisk Platform - Windows Deployment Guide

## Overview
This guide covers deploying the CyberRisk Platform on Windows Server or Windows Desktop with DNS binding.

## Prerequisites
- Windows Server 2016+ or Windows 10/11
- .NET 8.0 Runtime (ASP.NET Core)
- PostgreSQL 12+ database
- Administrator privileges
- PowerShell 5.1+ (for setup scripts)

## Deployment Options

### Option 1: IIS Hosting (Recommended for Production)

1. **Install Prerequisites:**
   ```powershell
   # Install IIS with ASP.NET Core Module
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-CommonHttpFeatures
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpErrors
   Enable-WindowsOptionalFeature -Online -FeatureName IIS-HttpLogging
   
   # Download and install ASP.NET Core Module for IIS
   # https://dotnet.microsoft.com/en-us/download/dotnet/8.0
   ```

2. **Build and Publish Application:**
   ```bash
   dotnet publish -c Release -o C:\inetpub\wwwroot\cyberrisk
   ```

3. **Configure IIS Site:**
   - Create new site in IIS Manager
   - Point to `C:\inetpub\wwwroot\cyberrisk`
   - Set Application Pool to "No Managed Code"
   - Configure bindings (see DNS Configuration below)

### Option 2: Windows Service (Alternative)

1. **Build Application:**
   ```bash
   dotnet publish -c Release --self-contained true -r win-x64
   ```

2. **Install as Service:**
   ```powershell
   # Run as Administrator
   .\install-windows-service.ps1 -ServiceName "CyberRiskPlatform" -InstallPath "C:\CyberRiskPlatform"
   ```

## SSL Certificate Setup

### Development/Testing (Self-Signed Certificate)
```powershell
# Run as Administrator
.\setup-ssl.ps1 -DomainName "cyberrisk.yourdomain.com"
```

### Production (CA-Issued Certificate)
1. Purchase SSL certificate from trusted CA
2. Install certificate in Local Machine Personal store
3. Update `appsettings.Production.json` with certificate thumbprint:
   ```json
   {
     "Kestrel": {
       "Endpoints": {
         "Https": {
           "Certificate": {
             "Subject": "CN=cyberrisk.yourdomain.com",
             "Store": "My",
             "Location": "LocalMachine"
           }
         }
       }
     }
   }
   ```

## DNS Configuration

### Internal DNS (Active Directory)
1. Open DNS Manager on domain controller
2. Create A record: `cyberrisk` → `[server-ip]`
3. Create CNAME (optional): `cyberrisk.yourdomain.com` → `cyberrisk`

### External DNS (Public Domain)
1. Log into your domain registrar/DNS provider
2. Create A record: `cyberrisk` → `[public-ip]`
3. Configure port forwarding on firewall: `80/443` → `[server-ip]:5000/5001`

### Windows Hosts File (Testing)
```
# C:\Windows\System32\drivers\etc\hosts
192.168.1.100  cyberrisk.yourdomain.com
```

## Port Configuration

### Firewall Rules
```powershell
# Allow HTTP/HTTPS traffic
New-NetFirewallRule -DisplayName "CyberRisk HTTP" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
New-NetFirewallRule -DisplayName "CyberRisk HTTPS" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow

# For IIS (standard ports)
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow  
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### URL Binding Examples

**IIS Site Bindings:**
- HTTP: `*:80:cyberrisk.yourdomain.com`
- HTTPS: `*:443:cyberrisk.yourdomain.com` (with SSL certificate)

**Kestrel Configuration:**
```json
{
  "Kestrel": {
    "Endpoints": {
      "Http": {
        "Url": "http://*:5000"
      },
      "Https": {
        "Url": "https://*:5001"
      }
    }
  }
}
```

## Database Configuration

1. **Update Connection String:**
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=[db-server];Database=CyberRiskDB;Username=cyberrisk_user;Password=[secure-password];SSL Mode=Require"
     }
   }
   ```

2. **Run Database Migrations:**
   ```bash
   dotnet ef database update --environment Production
   ```

## Security Hardening

### Application-Level
- Update default passwords in database
- Configure HTTPS-only cookies
- Review Content Security Policy in web.config
- Enable request size limits for file uploads

### Server-Level  
- Keep Windows Server updated
- Configure Windows Defender/antivirus exclusions
- Implement network segmentation
- Regular backup strategy
- Monitor application logs

## Monitoring and Maintenance

### Log Locations
- **IIS Logs:** `C:\inetpub\logs\LogFiles\W3SVC1\`
- **Application Logs:** Windows Event Viewer → Application logs
- **ASP.NET Core Logs:** Configure in `appsettings.Production.json`

### Health Checks
- Application URL: `https://cyberrisk.yourdomain.com/`
- Database connectivity test
- SSL certificate expiration monitoring

## Troubleshooting

### Common Issues
1. **502.5 Process Failure:** Check .NET runtime installation
2. **SSL Certificate Errors:** Verify certificate installation and thumbprint
3. **Database Connection:** Check PostgreSQL service and connection string
4. **DNS Resolution:** Use `nslookup` to verify DNS records

### Useful Commands
```powershell
# Check service status
Get-Service -Name "CyberRiskPlatform"

# View recent application logs  
Get-EventLog -LogName Application -Source "CyberRiskPlatform" -Newest 50

# Test DNS resolution
nslookup cyberrisk.yourdomain.com

# Test port connectivity
Test-NetConnection -ComputerName cyberrisk.yourdomain.com -Port 443
```

## Support

For deployment issues:
1. Check application logs
2. Verify all configuration files are correct
3. Test database connectivity
4. Confirm firewall/DNS settings
5. Review this deployment guide