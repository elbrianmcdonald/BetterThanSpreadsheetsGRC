@echo off
echo ====================================
echo  Deploying CyberRisk App to Container
echo ====================================

echo.
echo [1/4] Stopping existing containers...
docker-compose -f docker-compose.deploy.yml down

echo.
echo [2/4] Building updated container with latest changes...
docker-compose -f docker-compose.deploy.yml build --no-cache

echo.
echo [3/4] Starting containers...
docker-compose -f docker-compose.deploy.yml up -d

echo.
echo [4/4] Waiting for application to start...
timeout /t 10 >nul

echo.
echo ====================================
echo  Deployment Complete!
echo ====================================
echo.
echo Application is running at: http://localhost:5002
echo Login: admin@cyberrisk.com / Admin123!
echo.
echo To view logs: docker-compose -f docker-compose.deploy.yml logs -f cyberrisk-app
echo To stop: docker-compose -f docker-compose.deploy.yml down
echo.