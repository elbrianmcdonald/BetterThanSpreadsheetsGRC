@echo off
REM View BetterThanSpreadsheetsGRC Docker Logs
REM Usage: docker-logs.bat [service]
REM Examples:
REM   docker-logs.bat         (all services)
REM   docker-logs.bat app     (app service only)
REM   docker-logs.bat postgres

echo ===================================
echo BetterThanSpreadsheetsGRC Logs
echo ===================================
echo.

if "%1"=="" (
    echo Showing logs for all services...
    echo Press Ctrl+C to exit
    echo.
    docker-compose logs -f
) else (
    echo Showing logs for service: %1
    echo Press Ctrl+C to exit
    echo.
    docker-compose logs -f %1
)
