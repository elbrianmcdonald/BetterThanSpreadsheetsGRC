@echo off
echo ======================================================
echo Better Than Spreadsheets GRC - Installer Builder
echo ======================================================
echo.
echo This script will:
echo  - Build the application as a self-contained executable
echo  - Download dependency installers (.NET 8 + PostgreSQL)
echo  - Create a Windows installer using Inno Setup
echo.
echo Requirements:
echo  - Inno Setup must be installed
echo  - Internet connection for downloading dependencies
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause >nul

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: Not running as Administrator
    echo Some operations may require elevated permissions
    echo.
)

powershell -ExecutionPolicy Bypass -File "%~dp0create-installer.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo Installer Creation Complete!
    echo ======================================================
    echo.
    echo The Windows installer has been created in the
    echo installer-output directory.
    echo.
    echo You can now distribute the installer to install
    echo Better Than Spreadsheets GRC on other systems.
    echo.
    echo The installer will automatically:
    echo  - Install .NET 8 Runtime if needed
    echo  - Install PostgreSQL if needed
    echo  - Install the application as a Windows Service
    echo  - Configure the database
    echo.
) else (
    echo.
    echo Installer creation failed. Check the output above for errors.
    echo.
    echo Common issues:
    echo  - Inno Setup not installed
    echo  - Build errors in the application
    echo  - Network issues downloading dependencies
    echo.
)

pause