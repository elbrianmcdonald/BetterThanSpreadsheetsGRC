# BetterThanSpreadsheetsGRC — Self-Hosted Installation Guide

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- At least 2 GB RAM (4 GB recommended with ClamAV)
- Ports 80 (and 443 for HTTPS) available

---

## Quick Start (LAN / Internal)

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/BetterThanSpreadsheetsGRC.git
   cd BetterThanSpreadsheetsGRC/betterthanspreadsheetsgrc
   ```

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```

3. Set the required values in `.env`:
   ```env
   POSTGRES_PASSWORD=your-strong-password-here
   AUTH_SECRET=your-secret-here          # Generate with: openssl rand -base64 32
   ```

4. Start the application:
   ```bash
   docker compose up -d --build
   ```

5. (First run) Seed the database with frameworks and demo data:
   ```bash
   docker exec betterthanspreadsheetsGRC-app prisma db seed
   ```
   Or set `SEED_ON_STARTUP=true` in `.env` before the first start to seed automatically.

6. Access the application at `http://<server-ip>`

---

## Production with Domain + HTTPS

Uses [Caddy](https://caddyserver.com/) for automatic HTTPS via Let's Encrypt.

1. Point your DNS A record to the server's IP address.

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```

3. Configure `.env`:
   ```env
   POSTGRES_PASSWORD=your-strong-password-here
   AUTH_SECRET=your-secret-here
   NEXTAUTH_URL=https://grc.example.com
   DOMAIN=grc.example.com
   APP_PORT=                              # Empty — Caddy handles external traffic
   ```

4. Ensure ports 80 and 443 are open on your firewall.

5. Start with the production profile:
   ```bash
   docker compose --profile production up -d --build
   ```

6. Access the application at `https://grc.example.com`

Caddy automatically provisions and renews TLS certificates from Let's Encrypt.

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

### Azure AD / Entra ID SSO

Set in `.env`:
```env
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
```

Configure the redirect URI in Azure Portal:
`https://your-domain.com/api/auth/callback/azure-ad`

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

The application exposes a health endpoint:

```bash
curl http://localhost/api/health
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
docker compose up -d --build
```
