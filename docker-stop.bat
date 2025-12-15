@echo off
REM Stop BetterThanSpreadsheetsGRC Docker Services
REM Usage: docker-stop.bat

echo ===================================
echo Stopping BetterThanSpreadsheetsGRC
echo ===================================
echo.

docker-compose down

if %errorlevel% equ 0 (
    echo.
    echo Services stopped successfully!
    echo.
    echo Data is preserved in Docker volumes.
    echo To remove volumes (WARNING - deletes all data): docker-compose down -v
) else (
    echo.
    echo ERROR: Failed to stop services!
    pause
    exit /b 1
)

echo.
pause
