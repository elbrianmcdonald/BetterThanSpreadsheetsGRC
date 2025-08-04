@echo off
echo ========================================
echo CyberRisk App Installer Builder
echo ========================================
echo.

REM Check if running from correct directory
if not exist "publish-windows.ps1" (
    echo ERROR: Please run this script from the CyberRiskApp project directory
    pause
    exit /b 1
)

echo Step 1: Publishing application...
echo --------------------------------
powershell -ExecutionPolicy Bypass -File publish-windows.ps1
if errorlevel 1 (
    echo ERROR: Failed to publish application
    pause
    exit /b 1
)

echo.
echo Step 2: Creating installer configuration...
echo ------------------------------------------
powershell -ExecutionPolicy Bypass -File create-installer.ps1
if errorlevel 1 (
    echo ERROR: Failed to create installer configuration
    pause
    exit /b 1
)

echo.
echo Step 3: Checking for Inno Setup...
echo ----------------------------------
set INNO_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe
if not exist "%INNO_PATH%" (
    echo WARNING: Inno Setup not found at default location
    echo.
    echo Please install Inno Setup from:
    echo https://jrsoftware.org/isdl.php
    echo.
    echo After installation, you can compile the installer manually:
    echo 1. Open Inno Setup Compiler
    echo 2. Open: %CD%\installer\CyberRiskApp.iss
    echo 3. Press F9 to compile
    echo.
    pause
    exit /b 0
)

echo.
echo Step 4: Compiling installer...
echo ------------------------------
"%INNO_PATH%" /Q "installer\CyberRiskApp.iss"
if errorlevel 1 (
    echo ERROR: Failed to compile installer
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Installer created at:
echo %CD%\installer\CyberRiskApp-Setup-1.0.0.exe
echo ========================================
echo.
echo File size: 
dir "installer\CyberRiskApp-Setup-*.exe" | find "CyberRiskApp"
echo.
echo You can now:
echo 1. Test the installer locally
echo 2. Distribute to users
echo 3. Upload to a file server
echo.
pause