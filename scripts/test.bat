@echo off
REM Run tests inside Docker container

echo Building test container...
docker-compose build test

echo Running tests...
docker-compose run --rm test npm test %*

echo.
echo Tests completed!
