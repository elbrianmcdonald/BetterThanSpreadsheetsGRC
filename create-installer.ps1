# Create Windows Installer Package using WiX Toolset or Inno Setup
# This script creates an installer for CyberRisk App

param(
    [string]$Version = "1.0.0",
    [string]$Publisher = "CyberRisk Solutions",
    [string]$OutputPath = ".\installer"
)

Write-Host "Creating CyberRisk App Installer..." -ForegroundColor Green

# First, check if application is already published
if (-not (Test-Path ".\publish\CyberRiskApp\CyberRiskApp.exe")) {
    Write-Host "Publishing application..." -ForegroundColor Yellow
    & .\publish-simple.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to publish application" -ForegroundColor Red
        exit 1
    }
}

# Create Inno Setup script
$innoScript = @"
#define MyAppName "CyberRisk Management Platform"
#define MyAppVersion "$Version"
#define MyAppPublisher "$Publisher"
#define MyAppURL "https://cyberrisk.local"
#define MyAppExeName "CyberRiskApp.exe"

[Setup]
AppId={{8B3A5F2C-1234-4567-8901-ABCDEF123456}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\CyberRiskApp
DisableProgramGroupPage=yes
;LicenseFile=LICENSE.txt
OutputDir=..\..\installer
OutputBaseFilename=CyberRiskApp-Setup-{#MyAppVersion}
;SetupIconFile=icon.ico
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
Source: "..\publish\CyberRiskApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\setup-database.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\install.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

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
  
  // Check for .NET 8 Runtime
  if not RegKeyExists(HKLM, 'SOFTWARE\dotnet\Setup\InstalledVersions\x64\aspnetcore') then
  begin
    if MsgBox('.NET 8 Runtime is not installed. Would you like to download it now?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://dotnet.microsoft.com/download/dotnet/8.0', '', '', SW_SHOW, ewNoWait, ErrorCode);
      Result := False;
    end;
  end;
  
  // Check for PostgreSQL
  if not FileExists('C:\Program Files\PostgreSQL\16\bin\psql.exe') then
  begin
    if MsgBox('PostgreSQL 16 is not installed. Would you like to download it now?', mbConfirmation, MB_YESNO) = IDYES then
    begin
      ShellExec('open', 'https://www.postgresql.org/download/windows/', '', '', SW_SHOW, ewNoWait, ErrorCode);
      Result := False;
    end;
  end;
end;
"@

# Create output directory
New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null

# Save Inno Setup script
$innoScript | Out-File -FilePath "$OutputPath\CyberRiskApp.iss" -Encoding UTF8

# Create a simple LICENSE.txt if it doesn't exist
if (-not (Test-Path "LICENSE.txt")) {
    @"
CyberRisk Management Platform License Agreement

Copyright (c) 2024 $Publisher

This software is proprietary and confidential.
"@ | Out-File -FilePath "LICENSE.txt" -Encoding UTF8
}

# Create a simple icon if it doesn't exist
if (-not (Test-Path "icon.ico")) {
    Write-Host "Note: No icon.ico found. Using default icon." -ForegroundColor Yellow
}

Write-Host "`nInno Setup script created at: $OutputPath\CyberRiskApp.iss" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Install Inno Setup from: https://jrsoftware.org/isdl.php" -ForegroundColor White
Write-Host "2. Open $OutputPath\CyberRiskApp.iss in Inno Setup Compiler" -ForegroundColor White
Write-Host "3. Compile to create the installer executable" -ForegroundColor White
Write-Host "`nAlternatively, use the command line:" -ForegroundColor Cyan
Write-Host "iscc.exe $OutputPath\CyberRiskApp.iss" -ForegroundColor White