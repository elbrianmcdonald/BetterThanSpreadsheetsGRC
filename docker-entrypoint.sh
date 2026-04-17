#!/bin/sh
set -e

echo "Running database migrations..."
# Prisma 7 no longer reads `url` from schema.prisma; pass it via --url to avoid
# needing prisma.config.ts (and its dotenv/prisma/config imports) at runtime.
prisma db push --accept-data-loss --schema ./prisma/schema.prisma --url "$DATABASE_URL"

# Auto-seed when database is empty (no users exist yet)
# Also seeds when explicitly requested via SEED_ON_STARTUP=true
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const p = new PrismaClient({ adapter });
  p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log('0'); p.\$disconnect(); });
" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ] || [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "Seeding database (no users found or SEED_ON_STARTUP=true)..."
  # `prisma db seed` needs a config file entry; the upgrade removed it without
  # adding it back to prisma.config.ts, so invoke the seed script directly.
  tsx prisma/seed.ts
fi

echo "Starting application..."
exec node server.js
