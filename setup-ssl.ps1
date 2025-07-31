# PowerShell script to set up SSL certificate for CyberRisk Platform
# Run as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$DomainName,
    
    [Parameter(Mandatory=$false)]
    [string]$CertificatePassword = "CyberRisk123!"
)

Write-Host "Setting up SSL certificate for domain: $DomainName" -ForegroundColor Green

# Create self-signed certificate (for development/testing)
Write-Host "Creating self-signed certificate..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate -DnsName $DomainName, "localhost" -CertStoreLocation "cert:\LocalMachine\My" -FriendlyName "CyberRisk Platform Certificate" -KeySpec KeyExchange

# Export certificate with private key
$certPath = "C:\temp\cyberrisk-cert.pfx"
$certSecurePassword = ConvertTo-SecureString -String $CertificatePassword -Force -AsPlainText

Write-Host "Exporting certificate to $certPath" -ForegroundColor Yellow
Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $certSecurePassword

# Import to Trusted Root (to avoid browser warnings in development)
Write-Host "Adding certificate to Trusted Root Certification Authorities..." -ForegroundColor Yellow
Import-Certificate -FilePath $certPath -CertStoreLocation "cert:\LocalMachine\Root" -Password $certSecurePassword

Write-Host "Certificate setup complete!" -ForegroundColor Green
Write-Host "Certificate Thumbprint: $($cert.Thumbprint)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update appsettings.Production.json with certificate thumbprint"
Write-Host "2. Configure IIS binding or update Kestrel configuration"
Write-Host "3. Configure DNS to point $DomainName to this server"
Write-Host ""
Write-Host "For production, replace self-signed certificate with CA-issued certificate"