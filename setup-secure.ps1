# Secure Setup Script for CyberRisk App
# This script handles passwords securely without hardcoding

param(
    [Parameter(Mandatory=$false)]
    [string]$AdminEmail = "admin@cyberrisk.local",
    
    [Parameter(Mandatory=$false)]
    [SecureString]$AdminPassword,
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseServer = "localhost",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseName = "CyberRiskDB",
    
    [Parameter(Mandatory=$false)]
    [string]$DatabaseUser = "cyberrisk_user",
    
    [Parameter(Mandatory=$false)]
    [SecureString]$DatabasePassword,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseEnvironmentVariables,
    
    [Parameter(Mandatory=$false)]
    [switch]$GeneratePasswords
)

function Generate-SecurePassword {
    param([int]$Length = 16)
    
    $chars = @{
        Upper = [char[]]'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        Lower = [char[]]'abcdefghijklmnopqrstuvwxyz'
        Digit = [char[]]'0123456789'
        Special = [char[]]'!@#$%^&*()_-+=[]{}|;:,.<>?'
    }
    
    $password = @(
        $chars.Upper | Get-Random
        $chars.Lower | Get-Random
        $chars.Digit | Get-Random
        $chars.Special | Get-Random
    )
    
    $allChars = $chars.Upper + $chars.Lower + $chars.Digit + $chars.Special
    
    for ($i = 4; $i -lt $Length; $i++) {
        $password += $allChars | Get-Random
    }
    
    return -join ($password | Get-Random -Count $password.Length)
}

function ConvertTo-PlainText {
    param([SecureString]$SecurePassword)
    
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

Write-Host "CyberRisk App Secure Setup" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

# Handle password generation or input
if ($GeneratePasswords) {
    Write-Host "Generating secure passwords..." -ForegroundColor Yellow
    $adminPwd = Generate-SecurePassword -Length 16
    $dbPwd = Generate-SecurePassword -Length 20
    
    $AdminPassword = ConvertTo-SecureString $adminPwd -AsPlainText -Force
    $DatabasePassword = ConvertTo-SecureString $dbPwd -AsPlainText -Force
}
else {
    # Prompt for passwords if not provided
    if (-not $AdminPassword) {
        $AdminPassword = Read-Host "Enter Admin Password" -AsSecureString
    }
    
    if (-not $DatabasePassword) {
        $DatabasePassword = Read-Host "Enter Database Password" -AsSecureString
    }
}

# Convert secure strings to plain text for use
$adminPwdPlain = ConvertTo-PlainText $AdminPassword
$dbPwdPlain = ConvertTo-PlainText $DatabasePassword

# Option 1: Use Environment Variables
if ($UseEnvironmentVariables) {
    Write-Host "Setting environment variables..." -ForegroundColor Yellow
    
    [Environment]::SetEnvironmentVariable("CYBERRISK_ADMIN_EMAIL", $AdminEmail, "Process")
    [Environment]::SetEnvironmentVariable("CYBERRISK_ADMIN_PASSWORD", $adminPwdPlain, "Process")
    [Environment]::SetEnvironmentVariable("CYBERRISK_DB_PASSWORD", $dbPwdPlain, "Process")
    
    # Connection string with environment variable
    $connectionString = "Host=$DatabaseServer;Database=$DatabaseName;Username=$DatabaseUser;Password=$dbPwdPlain"
    [Environment]::SetEnvironmentVariable("CYBERRISK_CONNECTION_STRING", $connectionString, "Process")
}

# Option 2: Use User Secrets (for development)
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Get-Command dotnet -ErrorAction SilentlyContinue) {
    Write-Host "Configuring user secrets..." -ForegroundColor Yellow
    
    Push-Location $projectPath
    
    # Initialize user secrets
    dotnet user-secrets init
    
    # Set secrets
    dotnet user-secrets set "Setup:AdminEmail" $AdminEmail
    dotnet user-secrets set "Setup:AdminPassword" $adminPwdPlain
    dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=$DatabaseServer;Database=$DatabaseName;Username=$DatabaseUser;Password=$dbPwdPlain"
    
    Pop-Location
}

# Option 3: Create secure configuration file
$secureConfigPath = Join-Path $env:ProgramData "CyberRiskApp\config"
New-Item -ItemType Directory -Path $secureConfigPath -Force | Out-Null

$secureConfig = @{
    Setup = @{
        AdminEmail = $AdminEmail
        AdminPasswordHash = (Get-FileHash -InputStream ([System.IO.MemoryStream]::new([System.Text.Encoding]::UTF8.GetBytes($adminPwdPlain))) -Algorithm SHA256).Hash
    }
    Database = @{
        Server = $DatabaseServer
        Name = $DatabaseName
        User = $DatabaseUser
    }
    ConfiguredAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

# Save configuration (without passwords)
$secureConfig | ConvertTo-Json -Depth 3 | Out-File "$secureConfigPath\setup-config.json" -Encoding UTF8

# Save credentials separately with restricted access
$credentialsPath = "$secureConfigPath\credentials.enc"

# Simple encryption using DPAPI (Windows only)
$credentials = @{
    AdminPassword = $adminPwdPlain
    DatabasePassword = $dbPwdPlain
}

$credentialsJson = $credentials | ConvertTo-Json
$credentialsBytes = [System.Text.Encoding]::UTF8.GetBytes($credentialsJson)
$encryptedBytes = [System.Security.Cryptography.ProtectedData]::Protect($credentialsBytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
[System.IO.File]::WriteAllBytes($credentialsPath, $encryptedBytes)

# Set restrictive permissions
$acl = Get-Acl $credentialsPath
$acl.SetAccessRuleProtection($true, $false)
$adminsSid = New-Object System.Security.Principal.SecurityIdentifier("S-1-5-32-544")
$adminsAccount = $adminsSid.Translate([System.Security.Principal.NTAccount])
$permission = $adminsAccount.Value, "FullControl", "Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $credentialsPath $acl

# Option 4: Azure Key Vault (for production)
if ($env:AZURE_KEY_VAULT_NAME) {
    Write-Host "Storing secrets in Azure Key Vault..." -ForegroundColor Yellow
    
    if (Get-Command az -ErrorAction SilentlyContinue) {
        az keyvault secret set --vault-name $env:AZURE_KEY_VAULT_NAME --name "CyberRiskAdminPassword" --value $adminPwdPlain
        az keyvault secret set --vault-name $env:AZURE_KEY_VAULT_NAME --name "CyberRiskDbPassword" --value $dbPwdPlain
    }
}

# Create summary file (no passwords)
$summaryPath = "$secureConfigPath\setup-summary.txt"
@"
CyberRisk App Setup Summary
==========================
Date: $(Get-Date)
Admin Email: $AdminEmail
Database Server: $DatabaseServer
Database Name: $DatabaseName
Database User: $DatabaseUser

Credentials Location:
- Encrypted: $credentialsPath
- User Secrets: Configured (if in development)
- Environment Variables: $(if($UseEnvironmentVariables){"Set"}else{"Not Set"})

Next Steps:
1. Run the application
2. Login with the admin credentials
3. Change the admin password immediately
4. Delete any temporary credential files

Security Notes:
- Passwords are encrypted using Windows DPAPI
- Only Administrators can access the encrypted credentials
- Consider using Azure Key Vault or similar for production
"@ | Out-File $summaryPath -Encoding UTF8

Write-Host "`nSetup completed successfully!" -ForegroundColor Green
Write-Host "Configuration saved to: $secureConfigPath" -ForegroundColor Cyan

if ($GeneratePasswords) {
    Write-Host "`nGenerated Credentials:" -ForegroundColor Yellow
    Write-Host "Admin Password: $adminPwdPlain" -ForegroundColor White
    Write-Host "Database Password: $dbPwdPlain" -ForegroundColor White
    Write-Host "`nIMPORTANT: Save these passwords securely and delete this output!" -ForegroundColor Red
}

Write-Host "`nRun the application and navigate to /Setup to complete configuration" -ForegroundColor Cyan