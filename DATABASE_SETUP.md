# Database Setup Guide

## Known Issue: Windows + Prisma + Docker Authentication

There is a known authentication issue when running Prisma commands from a Windows host to connect to PostgreSQL running in Docker Desktop. This affects:
- `npx prisma migrate`
- `npx prisma db push`
- `npx prisma studio`
- Running integration tests from the host

### Root Cause
The issue stems from PostgreSQL 15's default SCRAM-SHA-256 authentication method and how Prisma's underlying PostgreSQL driver handles authentication from Windows to Docker containers.

### Solution: Run Tests and Migrations in Docker (Recommended)

We've set up a dedicated test container that runs inside Docker, eliminating all Windows authentication issues.

#### Quick Start

```bash
# Run tests
scripts\test.bat

# Run migrations
scripts\migrate.bat

# Push schema changes
scripts\db-push.bat
```

That's it! The test container handles all database operations seamlessly.

#### How It Works

1. **Test Container**: A dedicated Docker service (`test`) that:
   - Has all dev dependencies (Jest, testing libraries)
   - Connects to PostgreSQL over Docker network (no auth issues)
   - Mounts your code as a volume (sees all changes immediately)

2. **Helper Scripts**: Convenient `.bat` files that:
   - Build the test container if needed
   - Run commands inside the container
   - Display results in your terminal

#### Running Specific Tests

```bash
# Run all tests
scripts\test.bat

# Run specific test file
docker-compose run --rm test npm test -- src/__tests__/integration/audit-logging.test.ts

# Run with watch mode
docker-compose run --rm test npm test -- --watch
```

#### Manual Commands

If you prefer direct docker-compose commands:

```bash
# Build test container
docker-compose build test

# Run tests
docker-compose run --rm test npm test

# Run migrations
docker-compose run --rm test npx prisma migrate deploy

# Push schema
docker-compose run --rm test npx prisma db push

# Open Prisma Studio
docker-compose run --rm -p 5555:5555 test npx prisma studio
```

### Alternative Workarounds

#### Option 1: Use WSL2
Run all Prisma commands and tests from within WSL2:
```bash
# From WSL2 terminal
cd /mnt/c/Dev/BetterThanSpreadsheetsGRC/betterthanspreadsheetsgrc
npm run test
npx prisma migrate deploy
```

#### Option 2: Apply Migrations via Docker Exec
Apply migrations by copying SQL directly to the container:

```bash
# Copy migration SQL to container
docker cp betterthanspreadsheetsgrc/prisma/migrations/20251215_init_multi_tenant_schema/migration.sql betterthanspreadsheetsGRC-postgres:/tmp/init.sql

# Execute migration
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -f /tmp/init.sql

# Repeat for enhanced audit log migration
docker cp betterthanspreadsheetsgrc/prisma/migrations/20251217_enhanced_audit_log/migration.sql betterthanspreadsheetsGRC-postgres:/tmp/audit.sql
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -f /tmp/audit.sql
```

#### Option 3: Manual SQL Execution
Execute migration SQL directly:

```bash
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC <<EOF
-- Paste migration SQL here
EOF
```

### Verifying Database Schema

Check that all tables were created:
```bash
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -c "\dt"
```

Expected tables:
- Account
- AuditLog ✅
- Evidence
- Framework
- LoginAttempt
- Organization
- PasswordResetToken
- Risk
- Session
- User
- VerificationToken

Check Audit​Log schema:
```bash
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -c "\d \"AuditLog\""
```

Expected columns:
- id (text)
- organizationId (text)
- userId (text)
- action (AuditAction enum)
- entityType (text)
- entityId (text)
- changes (jsonb)
- timestamp (timestamp)
- ipAddress (text)
- userAgent (text)

## Fresh Database Setup

To completely reset and rebuild the database:

```bash
# Stop and remove containers and volumes
cd betterthanspreadsheetsgrc
docker-compose down
docker volume rm betterthanspreadsheetsgrc_postgres_data

# Start fresh PostgreSQL
docker-compose up -d postgres

# Wait for PostgreSQL to initialize (10 seconds)
sleep 10

# Apply migrations (use one of the workarounds above)
# Option: Copy migrations and execute
docker cp betterthanspreadsheetsgrc/prisma/migrations/20251215_init_multi_tenant_schema/migration.sql betterthanspreadsheetsGRC-postgres:/tmp/init.sql
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -f /tmp/init.sql

docker cp betterthanspreadsheetsgrc/prisma/migrations/20251217_enhanced_audit_log/migration.sql betterthanspreadsheetsGRC-postgres:/tmp/audit.sql
docker exec betterthanspreadsheetsGRC-postgres psql -U postgres -d betterthanspreadsheetsGRC -f /tmp/audit.sql
```

## CI/CD Environment

In CI/CD environments (GitHub Actions, GitLab CI, etc.), this issue does not occur because:
1. Linux containers connect to Linux containers natively
2. No Windows-specific networking issues
3. Authentication works as expected

Integration tests will run successfully in CI/CD pipelines.

## Database Credentials

Default credentials (defined in .env):
- **Host**: localhost (from Windows) or postgres (from Docker network)
- **Port**: 5432
- **Database**: betterthanspreadsheetsGRC
- **User**: postgres
- **Password**: postgres

**Security Note**: These are development credentials only. Use strong passwords and restricted access in production.
