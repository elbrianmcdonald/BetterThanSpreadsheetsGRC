#!/bin/bash
# Stop BetterThanSpreadsheetsGRC Docker Services
# Usage: ./docker-stop.sh

echo "==================================="
echo "Stopping BetterThanSpreadsheetsGRC"
echo "==================================="
echo ""

docker-compose down

if [ $? -eq 0 ]; then
    echo ""
    echo "Services stopped successfully!"
    echo ""
    echo "Data is preserved in Docker volumes."
    echo "To remove volumes (WARNING - deletes all data): docker-compose down -v"
else
    echo ""
    echo "ERROR: Failed to stop services!"
    exit 1
fi
