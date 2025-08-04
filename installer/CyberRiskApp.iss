#define MyAppName "Better Than Spreadsheets GRC"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "CyberRisk Solutions"
#define MyAppURL ""
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
OutputBaseFilename=BetterThanSpreadsheetsGRC-Setup-{#MyAppVersion}
;SetupIconFile=icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "windowsservice"; Description: "Install as Windows Service"; GroupDescription: "Service Installation"

[Files]
Source: "..\publish\CyberRiskApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\setup-database.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\install.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "http://localhost:5197"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:5197"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\install.ps1"" -InstallPath ""{app}"" -UseWebSetup"; StatusMsg: "Installing service..."; Tasks: windowsservice; Flags: runhidden
Filename: "http://localhost:5197/Setup"; Description: "Complete Initial Setup"; Flags: shellexec postinstall skipifsilent

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop CyberRiskApp"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete CyberRiskApp"; Flags: runhidden

[Code]
function InitializeSetup: Boolean;
var
  ErrorCode: Integer;
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
