# BetterThanSpreadsheetsGRC — Self-Hosted Installation Guide

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- At least 2 GB RAM (4 GB recommended with ClamAV)
- Port 80 available (and 443 for HTTPS)

---

## Quick Start

```bash
git clone https://github.com/elbrianmcdonald/BetterThanSpreadsheetsGRC.git
cd BetterThanSpreadsheetsGRC
./start.sh
```

That's it. The script automatically:
- Generates secure random `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `CRON_SECRET` and creates `.env`
- Builds and starts all services
- Runs database migrations and seeds frameworks + demo data
- Prints the login credentials when ready

Open **http://localhost** and sign in.

> **Windows:** Run from Git Bash or WSL.
>
> **Subsequent starts:** Just use `docker compose up -d`
---

## Manual Setup

If you prefer to configure things yourself instead of using the start script:

1. Generate the required secrets and create `.env` in one step:
   ```bash
   # Linux / macOS / Git Bash on Windows
   ./scripts/setup-env.sh

   # PowerShell on Windows
   .\scripts\setup-env.ps1
   ```
   This copies `.env.example` → `.env` (if missing) and fills in `POSTGRES_PASSWORD`,
   `AUTH_SECRET`, and `CRON_SECRET` with cryptographically random values. It is
   idempotent — already-set values are preserved.

2. Set the remaining values in `.env`:
   ```env
   SEED_ON_STARTUP=true                  # Remove after first run
   ```

3. Start the application:
   ```bash
   docker compose up -d --build
   ```
   > The first build takes 3–5 minutes. Seeding adds another 1–2 minutes on first run.
   >
   > Docker Compose refuses to start if `CRON_SECRET` is unset — if you skipped
   > step 1, the error message will tell you exactly what to do.

4. Open `http://<server-ip>`

5. After the first successful start, remove `SEED_ON_STARTUP=true` from `.env` so restarts don't re-seed.

6. Configure your scheduler to call the three cron endpoints with the
   `CRON_SECRET` bearer token — see **[Scheduling cron jobs](#scheduling-cron-jobs)** below.

---

## Production with Domain + HTTPS

Uses [Caddy](https://caddyserver.com/) for automatic HTTPS via Let's Encrypt.

1. Point your DNS A record to the server's IP address.

2. Generate secrets and configure `.env`:
   ```bash
   ./scripts/setup-env.sh    # populates POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET
   ```
   Then edit `.env` to add the production-only values:
   ```env
   NEXTAUTH_URL=https://grc.example.com
   DOMAIN=grc.example.com
   APP_PORT=                              # Empty — Caddy handles external traffic
   SEED_ON_STARTUP=true                   # Remove after first run
   ```

3. Ensure ports 80 and 443 are open on your firewall.

4. Start with the production profile:
   ```bash
   docker compose --profile production up -d --build
   ```
   > The first build takes 3–5 minutes. Seeding adds another 1–2 minutes on first run.

5. Access the application at `https://grc.example.com`

6. After the first successful start, remove `SEED_ON_STARTUP=true` from `.env` so restarts don't re-seed.

Caddy automatically provisions and renews TLS certificates from Let's Encrypt.

> **Subsequent starts:** `docker compose --profile production up -d`

7. Configure your scheduler to call the three cron endpoints — see **[Scheduling cron jobs](#scheduling-cron-jobs)** below.

---

## Behind an Existing Reverse Proxy

If you already run nginx, Traefik, or another reverse proxy:

1. Configure `.env`:
   ```env
   APP_PORT=3000                          # Or any internal port
   NEXTAUTH_URL=https://grc.example.com   # Your public URL
   ```

2. Start the application:
   ```bash
   docker compose up -d --build
   ```

3. Configure your reverse proxy to forward traffic to `localhost:3000`.

4. Ensure your proxy sets `X-Forwarded-Proto` and `X-Forwarded-Host` headers.

---

## Using an Existing PostgreSQL Server (Alternate)

If you already run PostgreSQL on the host (or on another reachable server), you can point the app at it and skip the bundled Postgres container.

> **Note:** The containerized flow (`./start.sh`) is the primary and recommended path. Use this only if you have a specific reason — an existing managed Postgres, consolidated backups/monitoring, or a required data directory location. Setup is harder, not easier.

### Prerequisites

- PostgreSQL 13+ reachable from the Docker host (the bundled image uses 15).
- Docker Engine 20.10+ and Docker Compose v2.20+ (for `host-gateway` and `depends_on.required`).
- Ability to edit `postgresql.conf` and `pg_hba.conf` on your Postgres server.

### Step 1 — Prepare a dedicated database

**Do not reuse a database that contains data you can't afford to lose.** The app runs `prisma db push --accept-data-loss` on every start and will reconcile the schema aggressively.

```sql
CREATE DATABASE btsgrc;
CREATE USER btsgrc_app WITH ENCRYPTED PASSWORD 'CHANGE-ME';
GRANT ALL PRIVILEGES ON DATABASE btsgrc TO btsgrc_app;
\c btsgrc
GRANT ALL ON SCHEMA public TO btsgrc_app;
```

### Step 2 — Allow connections from Docker

Docker bridge networks use the `172.16.0.0/12` range by default.

In `postgresql.conf`:
```
listen_addresses = '*'
```

In `pg_hba.conf`:
```
host  btsgrc  btsgrc_app  172.16.0.0/12  scram-sha-256
```

Reload or restart PostgreSQL.

### Step 3 — Edit `docker-compose.yml`

Four changes — three in the `app` service, one in `postgres`.

**a.** Replace the `DATABASE_URL` line in the `app` service `environment` block:
```yaml
    environment:
      - DATABASE_URL=${DATABASE_URL:?required}
      # ... leave all other environment entries unchanged ...
```

**b.** Add an `extra_hosts` entry to the `app` service (no-op on Docker Desktop, required on Linux):
```yaml
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**c.** Make the postgres dependency non-fatal in the `app` service:
```yaml
    depends_on:
      postgres:
        condition: service_healthy
        required: false
```

**d.** Gate the bundled `postgres` service behind a profile so it never starts:
```yaml
  postgres:
    # ... existing fields unchanged ...
    profiles: ["bundled-db"]
```

### Step 4 — Configure `.env`

```env
DATABASE_URL=postgresql://btsgrc_app:CHANGE-ME@host.docker.internal:5432/btsgrc
AUTH_SECRET=                   # Generate with: openssl rand -base64 32
CRON_SECRET=                   # Generate with: openssl rand -hex 32
NEXTAUTH_URL=http://localhost
SEED_ON_STARTUP=true           # First run only; remove after the app is up
```

Use `host.docker.internal` when Postgres runs on the same host as Docker. Use the actual hostname or IP for a remote Postgres. Do **not** set `POSTGRES_PASSWORD` or `POSTGRES_DB` — they only applied to the bundled container.

### Step 5 — Start the app

```bash
docker compose up -d --build app
```

> `./start.sh` is **not** supported on this path — it expects the bundled Postgres. Use plain `docker compose` commands instead.

### Step 6 — Verify

```bash
curl http://localhost/api/health
# {"status":"healthy","timestamp":"..."}
```

Log in at `http://localhost` with `admin@acme-corp.com` / `Admin123!@#`. After the first successful start, remove `SEED_ON_STARTUP=true` from `.env` so restarts don't re-seed.

### Updating

```bash
git pull
docker compose up -d --build app
```

Prisma `db push --accept-data-loss` runs against your external DB on every start. Keep this DB dedicated to the app.

### Backup & restore

The `docker exec betterthanspreadsheetsGRC-postgres pg_dump …` examples elsewhere in this guide do not apply. Use your native tooling against the external DB:

```bash
pg_dump -h localhost -U btsgrc_app btsgrc > backup-$(date +%Y%m%d).sql
psql    -h localhost -U btsgrc_app btsgrc < backup.sql
```

### Reverting to the bundled Postgres

1. Remove the `profiles: ["bundled-db"]` line from the `postgres` service.
2. Restore the original `DATABASE_URL` entry in the `app` service `environment` block.
3. Unset `DATABASE_URL` in `.env`, set `POSTGRES_PASSWORD` to a value.
4. `docker compose down` and then `./start.sh` (or `docker compose up -d --build`).

Your external DB is untouched; the containerized DB starts fresh.

### Gotchas

- **Firewalls** — host-based firewalls (UFW, firewalld, Windows Defender) often block the Docker bridge range. Whitelist the Postgres port for `172.16.0.0/12`.
- **`host-gateway`** requires Docker Engine 20.10+ on Linux. Older engines need the literal host IP in `extra_hosts`.
- **Schema drift** — `prisma db push --accept-data-loss` reconciles the schema every boot. Don't share the DB with other apps.
- **Prisma client engine compatibility** — PostgreSQL 13–16 all work. Versions outside that range are untested.

---

## Scheduling cron jobs

The app exposes three POST endpoints that perform daily background work. Each
is protected by the `CRON_SECRET` bearer token from `.env`. Without an external
scheduler hitting them, evidence-request reminders and SLA breach detection
will not run.

Endpoints:

| Endpoint | Purpose | Suggested cadence |
|---|---|---|
| `POST /api/cron/evidence-request-reminders` | Send 3-days-before and overdue reminders | Daily |
| `POST /api/cron/finding-sla-breach` | Flip `slaBreached=true` on overdue findings | Daily |
| `POST /api/cron/treatment-sla-breach` | Flip `slaBreached=true` on overdue treatments | Daily |

Test one manually:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost/api/cron/finding-sla-breach
# {"success":true,"processedCount":0,"breachedCount":0,"errors":[]}
```

### Host cron (Linux self-hosted)

`crontab -e`:

```cron
CRON_SECRET=<paste the value from your .env>
URL=https://grc.example.com

0 8 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/evidence-request-reminders > /dev/null
5 8 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/finding-sla-breach > /dev/null
10 8 * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" $URL/api/cron/treatment-sla-breach > /dev/null
```

### Vercel Cron

Add to `vercel.json` and put `CRON_SECRET` in the Vercel project's
Environment Variables. Vercel injects the value into the `Authorization`
header automatically when the path matches.

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: grc-finding-sla-breach
spec:
  schedule: "5 8 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: curl
              image: curlimages/curl:latest
              env:
                - name: CRON_SECRET
                  valueFrom:
                    secretKeyRef: { name: grc-secrets, key: CRON_SECRET }
              command:
                - sh
                - -c
                - >
                  curl -fsS -X POST
                  -H "Authorization: Bearer $CRON_SECRET"
                  https://grc.example.com/api/cron/finding-sla-breach
```

### GitHub Actions (last resort)

```yaml
on:
  schedule: [{cron: "5 8 * * *"}]
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://grc.example.com/api/cron/finding-sla-breach
```

---

## Optional Features

### ClamAV Malware Scanning

Adds antivirus scanning for uploaded files (~1 GB RAM additional):

```bash
docker compose --profile clamav up -d
```

Set in `.env`:
```env
ENABLE_CLAMAV=true
CLAMAV_HOST=clamav
```

### Email Notifications

**SendGrid:**
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM_ADDRESS=noreply@example.com
```

**AWS SES:**
```env
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=AKIA...
AWS_SES_SECRET_ACCESS_KEY=...
EMAIL_FROM_ADDRESS=noreply@example.com
```

> **Password reset delivery.** With `EMAIL_PROVIDER=console` (the default) the
> app has no way to email reset links, so the "Forgot password" flow shows the
> link **on-screen** to whoever submits the form. This keeps self-service
> working without email, but it means anyone who can name a registered email
> can obtain a working reset link — only run console mode on a trusted or
> internal network. Configuring SendGrid or SES above switches delivery to
> email automatically and disables the on-screen link.

---

## Updating

```bash
git pull
docker compose up -d --build
```

The entrypoint script automatically runs database migrations on startup.

---

## Backup & Restore

### From the UI (recommended)

Sign in as an organization admin and go to **Administration → Backups** (`/admin/backups`).

- **Download backup** — produces a `.tar.gz` on demand containing a plain-text
  Postgres dump (`db.sql`) plus all uploaded evidence files (`uploads/`). Saved
  directly to your browser; nothing is persisted on the server.
- **Restore from backup** — upload a previously downloaded archive. The app
  drops and recreates the `public` schema before applying the dump and replaces
  the uploads volume with the archive's contents.

> **Restore is destructive.** It replaces the entire database and the uploads
> volume. Active sessions are invalidated — you'll be bounced to `/login` and
> must sign in using credentials that exist in the backup. Always download a
> fresh backup before restoring an older one if you want an escape hatch.

### From the command line

For CI or scheduled backups, use `pg_dump` against the postgres container:

```bash
# Database only
docker exec betterthanspreadsheetsGRC-postgres \
  pg_dump -U postgres betterthanspreadsheetsGRC > backup-$(date +%Y%m%d).sql

# Uploads volume (optional)
docker run --rm -v betterthanspreadsheetsgrc_app_uploads:/data -v $(pwd):/out alpine \
  tar -czf /out/uploads-$(date +%Y%m%d).tar.gz -C / data
```

To restore the database:

```bash
docker exec -i betterthanspreadsheetsGRC-postgres \
  psql -U postgres betterthanspreadsheetsGRC < backup.sql
```

---

## Health Check

```bash
# HTTP (Quick Start / Manual Setup)
curl http://localhost/api/health

# HTTPS (Production profile)
curl https://grc.example.com/api/health

# {"status":"healthy","timestamp":"2025-01-01T00:00:00.000Z"}
```

---

## Troubleshooting

**View application logs:**
```bash
docker logs betterthanspreadsheetsGRC-app -f
```

**View all service logs:**
```bash
docker compose logs -f
```

**Restart services:**
```bash
docker compose restart
```

**Full reset (destroys data):**
```bash
docker compose down -v
./start.sh
```
