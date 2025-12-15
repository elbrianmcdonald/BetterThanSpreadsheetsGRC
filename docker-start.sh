#!/bin/bash
# Start BetterThanSpreadsheetsGRC Docker Services
# Usage: ./docker-start.sh

echo "==================================="
echo "Starting BetterThanSpreadsheetsGRC"
echo "==================================="
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo ""
    echo "Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "WARNING: .env file not found!"
    echo ""
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "Please edit .env and set AUTH_SECRET before continuing."
    echo "Generate with: openssl rand -base64 32"
    echo ""
    exit 1
fi

echo "Building and starting services..."
echo ""

docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "==================================="
    echo "Services started successfully!"
    echo "==================================="
    echo ""
    echo "Application: http://localhost:3000"
    echo "PostgreSQL: localhost:5432"
    echo "ClamAV: localhost:3310"
    echo ""
    echo "View logs: ./docker-logs.sh"
    echo "Stop services: ./docker-stop.sh"
    echo ""
    docker-compose ps
else
    echo ""
    echo "ERROR: Failed to start services!"
    echo "Check the errors above for details."
    exit 1
fi
