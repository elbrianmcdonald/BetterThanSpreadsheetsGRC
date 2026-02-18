#!/bin/sh
set -e

echo "Running database migrations..."
prisma db push --skip-generate --accept-data-loss

# Auto-seed when database is empty (no users exist yet)
# Also seeds when explicitly requested via SEED_ON_STARTUP=true
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log('0'); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ] || [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Seeding database (no users found or SEED_ON_STARTUP=true)..."
  prisma db seed
fi

echo "Starting application..."
exec node server.js
