@echo off
REM Push database schema inside Docker container

echo Building test container...
docker-compose build test

echo Pushing database schema...
docker-compose run --rm test npx prisma db push

echo.
echo Database schema updated!
