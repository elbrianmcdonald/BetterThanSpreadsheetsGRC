#!/bin/bash
# View BetterThanSpreadsheetsGRC Docker Logs
# Usage: ./docker-logs.sh [service]
# Examples:
#   ./docker-logs.sh         (all services)
#   ./docker-logs.sh app     (app service only)
#   ./docker-logs.sh postgres

echo "==================================="
echo "BetterThanSpreadsheetsGRC Logs"
echo "==================================="
echo ""

if [ -z "$1" ]; then
    echo "Showing logs for all services..."
    echo "Press Ctrl+C to exit"
    echo ""
    docker-compose logs -f
else
    echo "Showing logs for service: $1"
    echo "Press Ctrl+C to exit"
    echo ""
    docker-compose logs -f "$1"
fi
