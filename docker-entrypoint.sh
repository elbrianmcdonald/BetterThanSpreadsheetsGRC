#!/bin/sh
set -e

# Fail fast, and by name, on missing production config. Without this the first
# symptom is either a Prisma stack trace (bad DATABASE_URL) or Next.js's opaque
# "An error occurred while loading instrumentation hook: Invalid environment
# variables" — neither of which names the variable at fault. The contract here
# deliberately mirrors src/env.js; do not tighten it independently.
if [ "$NODE_ENV" = "production" ]; then
  missing=""

  # Note: src/env.js sets emptyStringAsUndefined, so "" is treated as unset —
  # a dangling secret reference (e.g. Azure secretref to a nonexistent secret)
  # resolves to "" and must fail here, not later as a confusing "Required".
  # These are `if` blocks, not `[ ... ] && ...` one-liners: under `set -e` a
  # trailing && whose test is false makes the script exit.
  if [ -z "$DATABASE_URL" ]; then
    missing="${missing}
  DATABASE_URL  is not set. Postgres connection string, e.g.
                postgresql://user:password@host:5432/dbname"
  fi

  if [ -z "$AUTH_SECRET" ]; then
    missing="${missing}
  AUTH_SECRET   is not set. Generate one with: openssl rand -base64 32"
  fi

  if [ -z "$CRON_SECRET" ]; then
    missing="${missing}
  CRON_SECRET   is not set. Generate one with: openssl rand -hex 32"
  elif [ "${#CRON_SECRET}" -lt 32 ]; then
    missing="${missing}
  CRON_SECRET   is only ${#CRON_SECRET} characters; at least 32 are required.
                Generate one with: openssl rand -hex 32"
  fi

  if [ -n "$missing" ]; then
    echo "" >&2
    echo "ERROR: the app cannot start — required environment variables are missing or invalid:" >&2
    echo "$missing" >&2
    echo "" >&2
    echo "  Docker Compose:        set these in .env (or run ./scripts/setup-env.sh)" >&2
    echo "  Azure Container Apps:  az containerapp update -n <app> -g <rg> \\" >&2
    echo "                           --set-env-vars CRON_SECRET=secretref:cron-secret" >&2
    echo "" >&2
    echo "  See the 'Deploying to a managed container platform' section of INSTALL.md." >&2
    echo "" >&2
    exit 1
  fi
fi

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
