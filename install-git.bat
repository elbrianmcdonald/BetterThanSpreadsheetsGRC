@echo off
echo ======================================================
echo Better Than Spreadsheets GRC - Git Installer
echo ======================================================
echo.
echo This installer will:
echo  - Clone the repository from Git
echo  - Install dependencies (.NET 8 + PostgreSQL)
echo  - Build the application from source
echo  - Install as Windows Service
echo  - Configure database and environment
echo.
echo Requirements:
echo  - Git must be installed
echo  - Internet connection
echo  - Administrator rights
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

powershell -ExecutionPolicy Bypass -File "%~dp0install-from-git.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================
    echo Git Installation Complete!
    echo ======================================================
    echo.
    echo The Better Than Spreadsheets GRC application has been
    echo installed from the Git repository.
    echo.
    echo Access at: http://localhost:5197/setup
    echo.
    echo To update in the future:
    echo   install-from-git.ps1 -Update
    echo.
) else (
    echo.
    echo Installation failed. Check the output above for errors.
    echo.
    echo Common issues:
    echo  - Git not installed or not in PATH
    echo  - Network connectivity issues
    echo  - Missing .NET SDK
    echo  - Database connection problems
    echo.
)

pause