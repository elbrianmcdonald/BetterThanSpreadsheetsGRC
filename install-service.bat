@echo off
echo ======================================================
echo Better Than Spreadsheets GRC - Service Installer
echo ======================================================
echo.
echo This installer will:
echo  - Install .NET 8 Runtime (if needed)
echo  - Install PostgreSQL 16 (if needed)  
echo  - Build and publish the application
echo  - Install as Windows Service
echo  - Configure database and environment
echo.
echo IMPORTANT: This script must be run as Administrator
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Administrator rights required
    echo Please run this script as Administrator
    echo.
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0install-service.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo Service Installation Complete!
    echo ======================================================
    echo.
    echo The Better Than Spreadsheets GRC service is now installed
    echo and should be running automatically.
    echo.
    echo Access the application at: http://localhost:5197/setup
    echo.
    echo Service Name: BetterThanSpreadsheetsGRC
    echo Install Location: C:\Program Files\BetterThanSpreadsheetsGRC
    echo.
) else (
    echo.
    echo Installation failed. Check the output above for errors.
    echo.
)

pause