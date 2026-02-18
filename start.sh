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

# Prevent MINGW/Git Bash from mangling paths passed to commands
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

APP_CONTAINER="betterthanspreadsheetsGRC-app"
HEALTH_URL="http://localhost/api/health"
TIMEOUT=300  # seconds (seeding frameworks takes time on first run)

# ------------------------------------------------------------------
# Prerequisites
# ------------------------------------------------------------------
missing=()
command -v docker   >/dev/null 2>&1 || missing+=("docker")
command -v openssl  >/dev/null 2>&1 || missing+=("openssl")
command -v curl     >/dev/null 2>&1 || missing+=("curl")

if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required tools: ${missing[*]}"
    echo ""
    echo "Please install them and try again."
    echo "  Docker:  https://docs.docker.com/get-docker/"
    echo "  openssl/curl are included with Git Bash on Windows."
    exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: 'docker compose' (v2) is required but not found."
    echo ""
    echo "If you have docker-compose (v1), please upgrade Docker Desktop."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo ""
    echo "Please start Docker Desktop and try again."
    exit 1
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
# Helper: read a value from .env (handles comments, quotes, blanks)
# ------------------------------------------------------------------
env_val() {
    local key="$1"
    local val=""
    val=$(grep "^${key}=" .env 2>/dev/null | head -1 | cut -d= -f2-) || true
    # Strip inline comments, surrounding whitespace, and quotes
    val=$(echo "$val" | sed 's/[[:space:]]*#.*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed "s/^['\"]//;s/['\"]$//")
    echo "$val"
}

# ------------------------------------------------------------------
# Helper: set a value in .env (safe replacement via temp file)
# ------------------------------------------------------------------
env_set() {
    local key="$1"
    local val="$2"
    local tmpfile=".env.tmp.$$"
    # Replace the line matching ^key=... with key=val
    awk -v k="$key" -v v="$val" 'BEGIN{FS=OFS=""} /^#/ {print; next} index($0,k"=")==1 {print k"="v; next} {print}' .env > "$tmpfile"
    mv "$tmpfile" .env
}

# ------------------------------------------------------------------
# Auto-generate any required secrets that are still blank
# ------------------------------------------------------------------
_pg_pass=$(env_val POSTGRES_PASSWORD)
_auth_sec=$(env_val AUTH_SECRET)

if [ -z "$_pg_pass" ]; then
    PG_PASS=$(openssl rand -hex 16)
    env_set POSTGRES_PASSWORD "$PG_PASS"
    echo "  Generated random POSTGRES_PASSWORD."
else
    echo "  POSTGRES_PASSWORD already set."
fi

if [ -z "$_auth_sec" ]; then
    AUTH_SEC=$(openssl rand -base64 32 | tr -d '\n')
    env_set AUTH_SECRET "$AUTH_SEC"
    echo "  Generated random AUTH_SECRET."
else
    echo "  AUTH_SECRET already set."
fi

# ------------------------------------------------------------------
# Already running? (check after .env + secrets so compose can parse)
# ------------------------------------------------------------------
if docker compose ps --status running 2>/dev/null | grep -q "$APP_CONTAINER"; then
    echo "BetterThanSpreadsheetsGRC is already running."
    echo "  Open:    http://localhost"
    echo "  Stop:    docker compose down"
    echo "  Rebuild: docker compose up -d --build"
    exit 0
fi

# ------------------------------------------------------------------
# Clean up stale volumes on first run
# ------------------------------------------------------------------
# If this is first run, remove any leftover postgres volume from a
# previous failed install (the volume would have a different password
# baked in, causing P1000 auth errors).
if [ "$FIRST_RUN" = true ]; then
    docker compose down -v 2>/dev/null || true
fi

# ------------------------------------------------------------------
# Enable seeding on first run
# ------------------------------------------------------------------
if [ "$FIRST_RUN" = true ]; then
    # Uncomment and enable SEED_ON_STARTUP
    _tmpfile=".env.tmp.$$"
    sed 's/^# *SEED_ON_STARTUP=.*/SEED_ON_STARTUP=true/' .env > "$_tmpfile"
    mv "$_tmpfile" .env
    # If the key didn't exist at all, append it
    if ! grep -q '^SEED_ON_STARTUP=' .env; then
        echo "SEED_ON_STARTUP=true" >> .env
    fi
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
    _tmpfile=".env.tmp.$$"
    sed 's/^SEED_ON_STARTUP=.*/# SEED_ON_STARTUP=false/' .env > "$_tmpfile"
    mv "$_tmpfile" .env
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
