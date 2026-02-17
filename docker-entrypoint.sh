#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push --skip-generate --accept-data-loss

# Seed on first run (if enabled)
if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Seeding database..."
  prisma db seed
fi

echo "Starting application..."
exec node server.js
