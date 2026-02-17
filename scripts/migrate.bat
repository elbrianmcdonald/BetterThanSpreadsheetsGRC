@echo off
REM Run database migrations inside Docker container

echo Building test container...
docker-compose build test

echo Running migrations...
docker-compose run --rm test npx prisma migrate deploy

echo.
echo Migrations completed!
