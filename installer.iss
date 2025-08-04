[Setup]
AppName=Better Than Spreadsheets GRC
AppVersion=1.0.0
AppPublisher=Better Than Spreadsheets GRC
AppPublisherURL=https://github.com/yourusername/better-than-spreadsheets-grc
AppSupportURL=https://github.com/yourusername/better-than-spreadsheets-grc/issues
AppUpdatesURL=https://github.com/yourusername/better-than-spreadsheets-grc/releases
DefaultDirName={autopf}\Better Than Spreadsheets GRC
DefaultGroupName=Better Than Spreadsheets GRC
AllowNoIcons=yes
LicenseFile=LICENSE.txt
OutputDir=.\installer-output
OutputBaseFilename=BetterThanSpreadsheetsGRC-Setup-1.0.0
; SetupIconFile=app-icon.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0.17763
UninstallDisplayIcon={app}\CyberRiskApp.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Types]
Name: "full"; Description: "Full installation (includes dependencies)"
Name: "compact"; Description: "Compact installation (application only)"
Name: "custom"; Description: "Custom installation"; Flags: iscustom

[Components]
Name: "app"; Description: "Better Than Spreadsheets GRC Application"; Types: full compact custom; Flags: fixed
Name: "dependencies"; Description: "Install Dependencies (.NET 8 + PostgreSQL)"; Types: full
Name: "service"; Description: "Install as Windows Service"; Types: full compact
Name: "desktop"; Description: "Desktop Shortcut"; Types: full

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked; OnlyBelowVersion: 6.1
Name: "startservice"; Description: "Start service after installation"; Components: service; Flags: unchecked

[Files]
; Main application files
Source: "installation\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Components: app

; Dependency installers
Source: "installation\dependencies\aspnetcore-runtime-8.0.18-win-x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Components: dependencies; Check: FileExists(ExpandConstant('{src}\installation\dependencies\aspnetcore-runtime-8.0.18-win-x64.exe'))
Source: "installation\dependencies\postgresql-16.6-1-windows-x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Components: dependencies; Check: FileExists(ExpandConstant('{src}\installation\dependencies\postgresql-16.6-1-windows-x64.exe'))

; Configuration templates
Source: "installation\config\appsettings.Production.json"; DestDir: "{app}"; DestName: "appsettings.Production.json"; Flags: onlyifdoesntexist; Components: app

; Documentation
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion; Components: app; Check: FileExists(ExpandConstant('{src}\README.md'))
Source: "LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion; Components: app; Check: FileExists(ExpandConstant('{src}\LICENSE.txt'))

; Service installation scripts  
Source: "installation\scripts\install-service.ps1"; DestDir: "{app}"; Flags: ignoreversion; Components: service
Source: "installation\scripts\uninstall-service.ps1"; DestDir: "{app}"; Flags: ignoreversion; Components: service
Source: "installation\scripts\setup-database.ps1"; DestDir: "{app}"; Flags: ignoreversion; Components: service

[Registry]
Root: HKLM; Subkey: "Software\Better Than Spreadsheets GRC"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\Better Than Spreadsheets GRC"; ValueType: string; ValueName: "Version"; ValueData: "1.0.0"; Flags: uninsdeletekey

[Icons]
Name: "{group}\Better Than Spreadsheets GRC"; Filename: "http://localhost:5197"; Components: app
Name: "{group}\Better Than Spreadsheets GRC (Service Manager)"; Filename: "services.msc"; Parameters: "/s"; IconFilename: "{sys}\services.exe"; Components: service
Name: "{group}\Uninstall Better Than Spreadsheets GRC"; Filename: "{uninstallexe}"; Components: app
Name: "{autodesktop}\Better Than Spreadsheets GRC"; Filename: "http://localhost:5197"; Tasks: desktopicon
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\Better Than Spreadsheets GRC"; Filename: "http://localhost:5197"; Tasks: quicklaunchicon

[Run]
; Install .NET 8 Runtime
Filename: "{tmp}\aspnetcore-runtime-8.0.18-win-x64.exe"; Parameters: "/quiet /norestart"; StatusMsg: "Installing .NET 8 Runtime..."; Components: dependencies; Flags: waituntilterminated; Check: FileExists(ExpandConstant('{tmp}\aspnetcore-runtime-8.0.18-win-x64.exe'))

; Install PostgreSQL
Filename: "{tmp}\postgresql-16.6-1-windows-x64.exe"; Parameters: "--mode unattended --superpassword postgres --servicename postgresql --servicepassword postgres --serverport 5432"; StatusMsg: "Installing PostgreSQL..."; Components: dependencies; Flags: waituntilterminated; Check: FileExists(ExpandConstant('{tmp}\postgresql-16.6-1-windows-x64.exe'))

; Setup database
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\setup-database.ps1"""; StatusMsg: "Setting up database..."; Components: app; Flags: waituntilterminated runhidden

; Install Windows service
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\install-service.ps1"" -InstallPath ""{app}"""; StatusMsg: "Installing Windows service..."; Components: service; Flags: waituntilterminated runhidden

; Start service
Filename: "net.exe"; Parameters: "start BetterThanSpreadsheetsGRC"; StatusMsg: "Starting service..."; Components: service; Tasks: startservice; Flags: waituntilterminated runhidden

; Open application in browser
Filename: "http://localhost:5197/setup"; Description: "{cm:LaunchProgram,Better Than Spreadsheets GRC}"; Flags: nowait postinstall shellexec skipifsilent

[UninstallRun]
; Stop service before uninstall
Filename: "net.exe"; Parameters: "stop BetterThanSpreadsheetsGRC"; Flags: waituntilterminated runhidden; Components: service

; Remove Windows service
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\uninstall-service.ps1"" -KeepDatabase"; Flags: waituntilterminated runhidden; Components: service

[Code]
function GetUninstallString(): String;
var
  sUnInstPath: String;
  sUnInstallString: String;
begin
  sUnInstPath := ExpandConstant('Software\Microsoft\Windows\CurrentVersion\Uninstall\{#emit SetupSetting("AppId")}_is1');
  sUnInstallString := '';
  if not RegQueryStringValue(HKLM, sUnInstPath, 'UninstallString', sUnInstallString) then
    RegQueryStringValue(HKCU, sUnInstPath, 'UninstallString', sUnInstallString);
  Result := sUnInstallString;
end;

function IsUpgrade(): Boolean;
begin
  Result := (GetUninstallString() <> '');
end;

function UnInstallOldVersion(): Integer;
var
  sUnInstallString: String;
  iResultCode: Integer;
begin
  Result := 0;
  sUnInstallString := GetUninstallString();
  if sUnInstallString <> '' then begin
    sUnInstallString := RemoveQuotes(sUnInstallString);
    if Exec(sUnInstallString, '/SILENT /NORESTART /SUPPRESSMSGBOXES','', SW_HIDE, ewWaitUntilTerminated, iResultCode) then
      Result := 3
    else
      Result := 2;
  end else
    Result := 1;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep=ssInstall) then
  begin
    if (IsUpgrade()) then
    begin
      UnInstallOldVersion();
    end;
  end;
end;

function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
begin
  Result := True;
  
  GetWindowsVersionEx(Version);
  
  // Check for Windows 10 or later
  if (Version.Major < 10) then
  begin
    MsgBox('This application requires Windows 10 or later.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  
  // Check for 64-bit system
  if not Is64BitInstallMode then
  begin
    MsgBox('This application requires a 64-bit version of Windows.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
end;

procedure InitializeWizard();
begin
  WizardForm.LicenseAcceptedRadio.Checked := True;
end;