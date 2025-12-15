@echo off
REM Start BetterThanSpreadsheetsGRC Docker Services
REM Usage: docker-start.bat

echo ===================================
echo Starting BetterThanSpreadsheetsGRC
echo ===================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Desktop is not running!
    echo.
    echo Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo WARNING: .env file not found!
    echo.
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo Please edit .env and set AUTH_SECRET before continuing.
    echo Generate with: openssl rand -base64 32
    echo.
    pause
    exit /b 1
)

echo Building and starting services...
echo.

docker-compose up -d --build

if %errorlevel% equ 0 (
    echo.
    echo ===================================
    echo Services started successfully!
    echo ===================================
    echo.
    echo Application: http://localhost:3000
    echo PostgreSQL: localhost:5432
    echo ClamAV: localhost:3310
    echo.
    echo View logs: docker-logs.bat
    echo Stop services: docker-stop.bat
    echo.
    docker-compose ps
) else (
    echo.
    echo ERROR: Failed to start services!
    echo Check the errors above for details.
    echo.
    pause
    exit /b 1
)

echo.
pause
