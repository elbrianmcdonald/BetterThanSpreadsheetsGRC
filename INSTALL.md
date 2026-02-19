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
- Generates secure random passwords and creates `.env`
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

1. Create your environment file:
   ```bash
   cp .env.example .env
   ```

2. Set the required values in `.env`:
   ```env
   POSTGRES_PASSWORD=your-strong-password-here
   AUTH_SECRET=your-secret-here          # Generate with: openssl rand -base64 32
   SEED_ON_STARTUP=true                  # Remove after first run
   ```

3. Start the application:
   ```bash
   docker compose up -d --build
   ```
   > The first build takes 3–5 minutes. Seeding adds another 1–2 minutes on first run.

4. Open `http://<server-ip>`

5. After the first successful start, remove `SEED_ON_STARTUP=true` from `.env` so restarts don't re-seed.

---

## Production with Domain + HTTPS

Uses [Caddy](https://caddyserver.com/) for automatic HTTPS via Let's Encrypt.

1. Point your DNS A record to the server's IP address.

2. Configure `.env`:
   ```env
   POSTGRES_PASSWORD=your-strong-password-here
   AUTH_SECRET=your-secret-here
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

---

## Updating

```bash
git pull
docker compose up -d --build
```

The entrypoint script automatically runs database migrations on startup.

---

## Backup & Restore

### Backup

```bash
docker exec betterthanspreadsheetsGRC-postgres \
  pg_dump -U postgres betterthanspreadsheetsGRC > backup-$(date +%Y%m%d).sql
```

### Restore

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
