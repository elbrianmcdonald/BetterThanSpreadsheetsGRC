@echo off
setlocal

title CyberRisk Platform Installer

echo.
echo ============================================
echo   CyberRisk Platform Enterprise Installer
echo ============================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo *** ERROR: Administrator privileges required! ***
    echo.
    echo Please right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo [✓] Running as Administrator
echo.

REM Get admin email
set /p ADMIN_EMAIL="Enter administrator email address: "

if "%ADMIN_EMAIL%"=="" (
    echo.
    echo ERROR: Administrator email is required!
    pause
    exit /b 1
)

echo.
echo Starting installation...
echo Admin Email: %ADMIN_EMAIL%
echo.

REM Run the PowerShell installer
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0Install-CyberRisk-App.ps1" -AdminEmail "%ADMIN_EMAIL%"

echo.
if %errorLevel% EQU 0 (
    echo Installation completed! Check the output above for next steps.
) else (
    echo Installation failed! Check the error messages above.
    echo Log files can be found in your temp directory.
)

echo.
pause