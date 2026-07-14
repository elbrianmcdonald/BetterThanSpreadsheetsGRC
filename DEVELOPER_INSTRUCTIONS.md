# Claude Code Instructions for BetterThanSpreadsheetsGRC

## Development Environment

**IMPORTANT: Always use Docker containers for running services.**

### Starting the Application

```bash
# Start all services (app + database) on port 80
docker compose up -d

# View logs
docker logs betterthanspreadsheetsGRC-app -f

# Rebuild after code changes
docker compose up -d --build
```

### Services

| Service | Container Name | Port |
|---------|---------------|------|
| Next.js App | betterthanspreadsheetsGRC-app | 80 (mapped from 3000) |
| PostgreSQL | betterthanspreadsheetsGRC-postgres | internal only |

Optional profiles:
- `--profile clamav` — ClamAV malware scanner
- `--profile production` — Caddy reverse proxy with auto-HTTPS
- `--profile test` — Test runner container

### DO NOT

- Do NOT run `npm run dev` directly - always use Docker containers
- Do NOT start standalone database servers - use the Docker PostgreSQL container
- Do NOT kill Docker container processes to run local dev servers

### Testing with Browser

When testing with Playwright MCP, the app runs at `http://localhost` via Docker (port 80).

### Database Operations

```bash
# Push schema changes (inside container)
# Prisma 7 reads the datasource URL from prisma.config.ts by default; pass --url
# explicitly so the command also works in the runner (which doesn't ship the config file).
docker exec betterthanspreadsheetsGRC-app sh -c 'prisma db push --accept-data-loss --schema ./prisma/schema.prisma --url "$DATABASE_URL"'

# Generate Prisma client (requires rebuild for standalone image)
docker compose up -d --build
```

### Manual data migrations (`prisma/migrations-manual/`)

Schema is applied automatically (`prisma db push` in `docker-entrypoint.sh`), but
**data** migrations in `prisma/migrations-manual/` are NOT run by the entrypoint,
by the seed, or by anything else. Deploying an image does not apply them — an
operator must run them once per environment, and each has a runbook in `docs/`:

| Script | Runbook | Applies to |
|---|---|---|
| `2026-07-11-role-consolidation.sql` | `docs/runbook-role-consolidation-deploy.md` | any DB still on the 8-role schema |
| `2026-07-13-backfill-800-53-control-text.sql` | `docs/runbook-800-53-control-text-backfill.md` | any DB whose NIST 800-53 controls predate the OSCAL text import |

The 800-53 backfill matters on every existing environment: the seed only creates
800-53 controls when there are none (`prisma/seed.ts`, `existing80053 === 0`), so
without running the SQL an upgraded database keeps the old text (every description
a copy of its own title, no guidance) and **reports no error**. It overwrites
`description` and `guidance` on every 800-53 control, destroying any hand-edits —
back up first; read the runbook.

### Stopping Services

```bash
docker compose down
```

### Viewing Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
