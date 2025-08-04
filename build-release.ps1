# Build Release Packages for GitHub
# Run this script to create multiple distribution formats

param(
    [string]$Version = "1.0.0",
    [switch]$CreateTag
)

Write-Host "Building CyberRisk App Release v$Version" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# Clean previous builds
Write-Host "`nCleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Path ".\release" -Recurse -Force -ErrorAction SilentlyContinue

# Create release directory
New-Item -ItemType Directory -Path ".\release" -Force | Out-Null

# 1. Build Framework-Dependent Package (smallest)
Write-Host "`nBuilding framework-dependent package..." -ForegroundColor Yellow
dotnet publish -c Release -o ".\release\framework-dependent" --no-self-contained
if ($LASTEXITCODE -eq 0) {
    Copy-Item "install.ps1", "setup-secure.ps1", "setup-database.ps1" -Destination ".\release\framework-dependent\scripts\" -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path ".\release\framework-dependent\*" -DestinationPath ".\release\CyberRiskApp-v$Version-Framework-Dependent.zip" -Force
    Write-Host "✅ Framework-dependent package created" -ForegroundColor Green
}

# 2. Build Self-Contained Package (Windows x64)
Write-Host "`nBuilding self-contained package..." -ForegroundColor Yellow
dotnet publish -c Release -o ".\release\self-contained" --self-contained -r win-x64
if ($LASTEXITCODE -eq 0) {
    Copy-Item "install.ps1", "setup-secure.ps1", "setup-database.ps1" -Destination ".\release\self-contained\scripts\" -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path ".\release\self-contained\*" -DestinationPath ".\release\CyberRiskApp-v$Version-Self-Contained-Win-x64.zip" -Force
    Write-Host "✅ Self-contained package created" -ForegroundColor Green
}

# 3. Build Single File Package (most portable)
Write-Host "`nBuilding single-file package..." -ForegroundColor Yellow
dotnet publish -c Release -o ".\release\single-file" --self-contained -r win-x64 -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
if ($LASTEXITCODE -eq 0) {
    Copy-Item "install.ps1", "setup-secure.ps1", "setup-database.ps1" -Destination ".\release\single-file\scripts\" -Force -ErrorAction SilentlyContinue
    Compress-Archive -Path ".\release\single-file\*" -DestinationPath ".\release\CyberRiskApp-v$Version-Single-File.zip" -Force
    Write-Host "✅ Single-file package created" -ForegroundColor Green
}

# 4. Create Installer (if Inno Setup is available)
Write-Host "`nChecking for Inno Setup..." -ForegroundColor Yellow
$innoPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (Test-Path $innoPath) {
    Write-Host "Creating Windows installer..." -ForegroundColor Yellow
    
    # Use the self-contained build for installer
    $innoScript = @"
#define MyAppName "CyberRisk Management Platform"
#define MyAppVersion "$Version"
#define MyAppPublisher "CyberRisk Solutions"
#define MyAppURL "https://github.com/YourUsername/CyberRiskPlatform"
#define MyAppExeName "CyberRiskApp.exe"

[Setup]
AppId={{8B3A5F2C-1234-4567-8901-ABCDEF123456}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\CyberRiskApp
DisableProgramGroupPage=yes
OutputDir=release
OutputBaseFilename=CyberRiskApp-Setup-v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "windowsservice"; Description: "Install as Windows Service"; GroupDescription: "Service Installation:"; Flags: checked

[Files]
Source: "release\self-contained\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "http://localhost:5000"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:5000"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\install.ps1"" -InstallPath ""{app}"" -UseWebSetup"; StatusMsg: "Installing service..."; Tasks: windowsservice; Flags: runhidden
Filename: "http://localhost:5000/Setup"; Description: "Complete Initial Setup"; Flags: shellexec postinstall skipifsilent

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop CyberRiskApp"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete CyberRiskApp"; Flags: runhidden

[Code]
function InitializeSetup: Boolean;
begin
  Result := True;
  if not RegKeyExists(HKLM, 'SOFTWARE\PostgreSQL\Installations') then
  begin
    if MsgBox('PostgreSQL is recommended for this application. Install it first?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://www.postgresql.org/download/windows/', '', '', SW_SHOW, ewNoWait, ErrorCode);
    end;
  end;
end;
"@
    
    $innoScript | Out-File -FilePath ".\release\CyberRiskApp.iss" -Encoding UTF8
    & $innoPath ".\release\CyberRiskApp.iss"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Windows installer created" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Inno Setup not found - skipping installer creation" -ForegroundColor Yellow
    Write-Host "   Install from: https://jrsoftware.org/isdl.php" -ForegroundColor Gray
}

# 5. Create Docker support files
Write-Host "`nCreating Docker support..." -ForegroundColor Yellow
$dockerfile = @"
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CyberRiskApp.csproj", "."]
RUN dotnet restore "./CyberRiskApp.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "CyberRiskApp.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CyberRiskApp.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CyberRiskApp.dll"]
"@

$dockerCompose = @"
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:80"
      - "5001:443"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Host=db;Database=CyberRiskDB;Username=cyberrisk_user;Password=\${DB_PASSWORD}
    depends_on:
      - db
    volumes:
      - ./appsettings.Production.json:/app/appsettings.Production.json
      
  db:
    image: postgres:16
    environment:
      - POSTGRES_DB=CyberRiskDB
      - POSTGRES_USER=cyberrisk_user
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
"@

$dockerfile | Out-File -FilePath ".\release\Dockerfile" -Encoding UTF8
$dockerCompose | Out-File -FilePath ".\release\docker-compose.yml" -Encoding UTF8
Copy-Item ".\release\Dockerfile" -Destination "." -Force
Copy-Item ".\release\docker-compose.yml" -Destination "." -Force

# 6. Create Installation Guide
$installGuide = @"
# CyberRisk Management Platform v$Version

## Installation Options

### 1. Windows Installer (Recommended)
- **File**: `CyberRiskApp-Setup-v$Version.exe`
- **Requirements**: Windows 10/11, PostgreSQL 16+
- **Installation**: Run installer → Complete web setup at http://localhost:5000/Setup

### 2. Self-Contained Package
- **File**: `CyberRiskApp-v$Version-Self-Contained-Win-x64.zip`
- **Requirements**: Windows 10/11 x64, PostgreSQL 16+
- **Installation**: Extract → Run `scripts\install.ps1` → Complete web setup

### 3. Framework-Dependent Package
- **File**: `CyberRiskApp-v$Version-Framework-Dependent.zip`
- **Requirements**: .NET 8 Runtime, PostgreSQL 16+
- **Installation**: Extract → Run `scripts\install.ps1` → Complete web setup

### 4. Single File Package (Portable)
- **File**: `CyberRiskApp-v$Version-Single-File.zip`
- **Requirements**: Windows 10/11 x64, PostgreSQL 16+
- **Installation**: Extract → Run `CyberRiskApp.exe` → Navigate to http://localhost:5000/Setup

### 5. Docker
\`\`\`bash
# Set database password
export DB_PASSWORD=your_secure_password

# Run with Docker Compose
docker-compose up -d

# Access at http://localhost:5000
\`\`\`

## Quick Start
1. Install PostgreSQL 16 from https://www.postgresql.org/download/
2. Choose one of the installation options above
3. Complete initial setup at http://localhost:5000/Setup
4. Log in with the credentials provided during setup

## Support
- **Issues**: https://github.com/YourUsername/CyberRiskPlatform/issues
- **Documentation**: https://github.com/YourUsername/CyberRiskPlatform/wiki
"@

$installGuide | Out-File -FilePath ".\release\INSTALLATION.md" -Encoding UTF8

# Create Git tag if requested
if ($CreateTag) {
    Write-Host "`nCreating Git tag..." -ForegroundColor Yellow
    git tag "v$Version"
    Write-Host "✅ Git tag v$Version created" -ForegroundColor Green
    Write-Host "💡 Push with: git push origin v$Version" -ForegroundColor Cyan
}

# Show results
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "Release build completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

Write-Host "`nCreated files:" -ForegroundColor Cyan
Get-ChildItem ".\release" -File | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  * $($_.Name) ($size MB)" -ForegroundColor White
}

Write-Host "`nNext steps for GitHub release:" -ForegroundColor Yellow
Write-Host "1. Create a new release at: https://github.com/YourUsername/CyberRiskPlatform/releases/new" -ForegroundColor White
Write-Host "2. Use tag: v$Version" -ForegroundColor White  
Write-Host "3. Upload all files from the .\release\ directory" -ForegroundColor White
Write-Host "4. Use INSTALLATION.md content for release description" -ForegroundColor White