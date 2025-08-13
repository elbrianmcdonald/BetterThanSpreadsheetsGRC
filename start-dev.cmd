@echo off
REM Batch file alternative for starting development environment

if "%1"=="stop" (
    echo 🛑 Stopping development containers...
    docker-compose -f docker-compose.dev.yml --env-file .env.dev down
    goto :eof
)

if "%1"=="status" (
    echo 📊 Container Status:
    docker-compose -f docker-compose.dev.yml ps
    echo.
    echo 📊 Health Status:
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=cyberrisk"
    goto :eof
)

if "%1"=="logs" (
    echo 📋 Following logs... (Ctrl+C to stop)
    docker-compose -f docker-compose.dev.yml --env-file .env.dev logs -f
    goto :eof
)

echo 🐳 Cyber Risk Platform - Development Environment
echo =================================================

if "%1"=="fresh" (
    echo 🗑️ Removing existing containers and volumes...
    docker-compose -f docker-compose.dev.yml --env-file .env.dev down -v
    docker system prune -f
)

if "%1"=="build" (
    echo 🔨 Building containers...
    docker-compose -f docker-compose.dev.yml --env-file .env.dev build --no-cache
)

echo 🚀 Starting development environment...
docker-compose -f docker-compose.dev.yml --env-file .env.dev up -d

echo ⏳ Waiting for services to be ready...
timeout /t 5 /nobreak > nul

echo.
echo 🌐 Development URLs:
echo   Application: http://localhost:5000
echo   Database:    localhost:5433 (User: cyberrisk_user, Password: CyberRisk123!)
echo   PgAdmin:     http://localhost:8080 (admin@cyberrisk.local / admin123)
echo.
echo 📝 Useful Commands:
echo   View logs:       start-dev.cmd logs
echo   Stop containers: start-dev.cmd stop
echo   Check status:    start-dev.cmd status
echo   Rebuild:         start-dev.cmd build
echo   Fresh start:     start-dev.cmd fresh