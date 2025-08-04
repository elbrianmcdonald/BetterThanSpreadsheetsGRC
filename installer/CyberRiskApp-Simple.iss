#define MyAppName "CyberRisk Management Platform"
#define MyAppVersion "1.0.0"
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
OutputDir=installer
OutputBaseFilename=CyberRiskApp-Setup-v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Additional icons:"
Name: "startmenu"; Description: "Create a start menu entry"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\publish\CyberRiskApp\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\install.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\setup-secure.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\setup-database.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "http://localhost:5000"; Tasks: startmenu
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:5000"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\scripts\install.ps1"" -InstallPath ""{app}"" -UseWebSetup"; StatusMsg: "Setting up service..."; Flags: runhidden
Filename: "http://localhost:5000/Setup"; Description: "Open setup page"; Flags: shellexec postinstall nowait skipifsilent

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop CyberRiskApp"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete CyberRiskApp"; Flags: runhidden
