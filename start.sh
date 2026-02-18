#!/usr/bin/env bash
# ============================================================================
# BetterThanSpreadsheetsGRC — Quick Start Script
# ============================================================================
# Usage:  ./start.sh
#
# First run:  generates .env, builds images, starts services, seeds database.
# Subsequent: just run  docker compose up -d
# ============================================================================
set -euo pipefail

APP_CONTAINER="betterthanspreadsheetsGRC-app"
HEALTH_URL="http://localhost/api/health"
TIMEOUT=180  # seconds

# ------------------------------------------------------------------
# Already running?
# ------------------------------------------------------------------
if docker compose ps --status running 2>/dev/null | grep -q "$APP_CONTAINER"; then
    echo "BetterThanSpreadsheetsGRC is already running."
    echo "  Open:    http://localhost"
    echo "  Stop:    docker compose down"
    echo "  Rebuild: docker compose up -d --build"
    exit 0
fi

# ------------------------------------------------------------------
# Create .env from example if missing
# ------------------------------------------------------------------
if [ ! -f .env ]; then
    echo "No .env found — creating from .env.example..."
    cp .env.example .env
    FIRST_RUN=true
else
    FIRST_RUN=false
    echo "Using existing .env configuration."
fi

# ------------------------------------------------------------------
# Helper: cross-platform sed -i
# ------------------------------------------------------------------
sedi() {
    if sed --version >/dev/null 2>&1; then
        sed -i "$@"
    else
        sed -i '' "$@"
    fi
}

# ------------------------------------------------------------------
# Auto-generate any required secrets that are still blank
# ------------------------------------------------------------------
# Source .env to read current values (strip comments/quotes)
_pg_pass=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2- | sed 's/#.*//' | xargs)
_auth_sec=$(grep '^AUTH_SECRET=' .env | cut -d= -f2- | sed 's/#.*//' | xargs)

if [ -z "$_pg_pass" ]; then
    PG_PASS=$(openssl rand -hex 16)
    sedi "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${PG_PASS}|" .env
    echo "  Generated random POSTGRES_PASSWORD."
else
    echo "  POSTGRES_PASSWORD already set."
fi

if [ -z "$_auth_sec" ]; then
    AUTH_SEC=$(openssl rand -base64 32 | tr -d '\n')
    sedi "s|^AUTH_SECRET=.*|AUTH_SECRET=${AUTH_SEC}|" .env
    echo "  Generated random AUTH_SECRET."
else
    echo "  AUTH_SECRET already set."
fi

# ------------------------------------------------------------------
# Enable seeding on first run
# ------------------------------------------------------------------
if [ "$FIRST_RUN" = true ]; then
    sedi "s|^# SEED_ON_STARTUP=.*|SEED_ON_STARTUP=true|" .env
fi

# ------------------------------------------------------------------
# Build and start
# ------------------------------------------------------------------
echo ""
echo "Building and starting services (this may take a few minutes on first run)..."
docker compose up -d --build

# ------------------------------------------------------------------
# Wait for healthy
# ------------------------------------------------------------------
echo ""
echo "Waiting for application to be ready..."
ELAPSED=0
while ! curl -sf "$HEALTH_URL" >/dev/null 2>&1; do
    if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
        echo ""
        echo "ERROR: Application did not become healthy within ${TIMEOUT}s."
        echo "Check logs:  docker logs $APP_CONTAINER"
        exit 1
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    printf "."
done

# ------------------------------------------------------------------
# Disable seed flag after first run (so restarts don't re-seed)
# ------------------------------------------------------------------
if [ "$FIRST_RUN" = true ]; then
    sedi "s|^SEED_ON_STARTUP=true|# SEED_ON_STARTUP=false|" .env
fi

# ------------------------------------------------------------------
# Done
# ------------------------------------------------------------------
echo ""
echo "========================================================"
echo "  BetterThanSpreadsheetsGRC is ready!"
echo "========================================================"
echo ""
echo "  Open:      http://localhost"
echo ""
if [ "$FIRST_RUN" = true ]; then
echo "  Login:     admin@acme-corp.com"
echo "  Password:  Admin123!@#"
echo ""
echo "  (Change this password after first login)"
echo ""
fi
echo "  Stop:      docker compose down"
echo "  Logs:      docker logs $APP_CONTAINER -f"
echo "  Rebuild:   docker compose up -d --build"
echo "========================================================"
