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
docker exec betterthanspreadsheetsGRC-app npx prisma db push --accept-data-loss

# Generate Prisma client (requires rebuild for standalone image)
docker compose up -d --build
```

### Stopping Services

```bash
docker compose down
```

### Viewing Container Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
