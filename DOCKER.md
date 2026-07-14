# Docker Deployment Guide for BetterThanSpreadsheetsGRC

This guide explains how to deploy BetterThanSpreadsheetsGRC using Docker Compose on Windows servers or desktops.

## Prerequisites

### Windows Requirements

1. **Docker Desktop for Windows**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Minimum version: 20.10.0
   - Enable WSL 2 backend (recommended for best performance)

2. **System Requirements**
   - Windows 10/11 Pro, Enterprise, or Education (64-bit)
   - OR Windows 10/11 Home with WSL 2
   - Minimum 4GB RAM (8GB recommended)
   - 20GB available disk space

3. **Enable Hyper-V** (for Windows Pro/Enterprise)
   ```powershell
   Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
   ```

### Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Test Docker is running
docker ps
```

## Quick Start

### 1. Clone and Navigate to Project

```bash
cd betterthanspreadsheetsgrc
```

### 2. Configure Environment Variables

Copy the example environment file and customize:

```bash
cp .env.example .env
```

Edit `.env` and set required values:
- `AUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `POSTGRES_PASSWORD` - Strong password for PostgreSQL
- `POSTGRES_DB` - Database name (default: betterthanspreadsheetsGRC)

### 3. Build Docker Images

```bash
docker-compose build
```

This will:
- Build the Next.js application container
- Pull PostgreSQL 15 Alpine image
- Pull ClamAV latest image

### 4. Start All Services

```bash
docker-compose up -d
```

Services will start in this order:
1. PostgreSQL (waits for health check)
2. ClamAV (starts immediately)
3. App (waits for PostgreSQL to be healthy, then runs migrations)

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f app

# Access the application
# Open browser: http://localhost:3000
```

## Docker Compose Services

### Application Service (`app`)

- **Image**: Built from local Dockerfile
- **Port**: 3000 (mapped to host)
- **Volumes**:
  - `app_uploads:/app/uploads` - Persistent file storage
- **Health Check**: HTTP GET to `http://localhost:3000`
- **Startup**: Runs Prisma migrations automatically

### PostgreSQL Service (`postgres`)

- **Image**: `postgres:15-alpine`
- **Port**: 5432 (mapped to host)
- **Volumes**:
  - `postgres_data:/var/lib/postgresql/data` - Database persistence
- **Health Check**: `pg_isready` command
- **Environment**:
  - `POSTGRES_USER` - Database user
  - `POSTGRES_PASSWORD` - Database password
  - `POSTGRES_DB` - Database name

### ClamAV Service (`clamav`)

- **Image**: `clamav/clamav:latest`
- **Port**: 3310 (clamd daemon)
- **Volumes**:
  - `clamav_data:/var/lib/clamav` - Virus definitions
- **Features**:
  - Auto-updates virus definitions via freshclam
  - TCP socket for malware scanning
- **Startup**: May take 2-3 minutes for first-time virus DB download

## Helper Scripts

### docker-start.sh / docker-start.bat

Start all services:

```bash
# Linux/Mac
./docker-start.sh

# Windows
docker-start.bat
```

### docker-stop.sh / docker-stop.bat

Stop all services gracefully:

```bash
# Linux/Mac
./docker-stop.sh

# Windows
docker-stop.bat
```

### docker-logs.sh / docker-logs.bat

View combined logs:

```bash
# Linux/Mac
./docker-logs.sh

# Windows
docker-logs.bat
```

## Volume Management

### Named Volumes

The application uses three named Docker volumes for persistent data:

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `app_uploads` | `/app/uploads` | Evidence file storage |
| `clamav_data` | `/var/lib/clamav` | ClamAV virus definitions |

### Evidence File Storage Structure

Evidence files are stored in a multi-tenant directory structure:

```
/app/uploads/
├── {organizationId-1}/
│   ├── {evidenceId-1}/
│   │   └── {uuid}_{original-filename}
│   └── {evidenceId-2}/
│       └── {uuid}_{original-filename}
└── {organizationId-2}/
    └── {evidenceId-3}/
        └── {uuid}_{original-filename}
```

- **Organization isolation**: Each organization's files are in separate directories
- **Evidence isolation**: Each evidence record has its own subdirectory
- **Unique filenames**: UUID prefix prevents filename collisions
- **Atomic writes**: Files are written to temp location first, then renamed

### Health Checks

#### Application Health
```bash
curl http://localhost:3000
```

#### Storage Health (Story 3.2)
```bash
# Check file storage is mounted and writable
curl http://localhost:3000/api/health/storage
```

Response (healthy):
```json
{
  "healthy": true,
  "uploadDir": "/app/uploads",
  "exists": true,
  "writable": true,
  "availableSpace": 50000000000
}
```

### Backup Volumes

**IMPORTANT**: Always backup both the database AND uploads together to maintain consistency between file metadata and actual files.

#### Complete Backup (Database + Files)

```bash
# Create backup directory with timestamp
BACKUP_DIR="backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL data
docker run --rm \
  -v betterthanspreadsheetsgrc_postgres_data:/data \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup uploaded evidence files
docker run --rm \
  -v betterthanspreadsheetsgrc_app_uploads:/data \
  -v $(pwd)/$BACKUP_DIR:/backup \
  alpine tar czf /backup/uploads-backup.tar.gz -C /data .

echo "Backup complete: $BACKUP_DIR"
```

#### Windows PowerShell Backup

```powershell
# Create backup directory
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backups\$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir

# Backup PostgreSQL
docker run --rm `
  -v betterthanspreadsheetsgrc_postgres_data:/data `
  -v ${PWD}\${backupDir}:/backup `
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup uploads
docker run --rm `
  -v betterthanspreadsheetsgrc_app_uploads:/data `
  -v ${PWD}\${backupDir}:/backup `
  alpine tar czf /backup/uploads-backup.tar.gz -C /data .

Write-Host "Backup complete: $backupDir"
```

#### Automated Backup Script

Create `backup.sh` for scheduled backups:

```bash
#!/bin/bash
# BetterThanSpreadsheetsGRC Backup Script
# Run via cron: 0 2 * * * /path/to/backup.sh

BACKUP_ROOT="/path/to/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

# Backup database
docker run --rm \
  -v betterthanspreadsheetsgrc_postgres_data:/data \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/postgres.tar.gz -C /data .

# Backup uploads
docker run --rm \
  -v betterthanspreadsheetsgrc_app_uploads:/data \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf /backup/uploads.tar.gz -C /data .

# Clean up old backups
find "$BACKUP_ROOT" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +

echo "[$TIMESTAMP] Backup complete"
```

### Restore Volumes

#### Complete Restore (Database + Files)

**WARNING**: Restoring will overwrite existing data!

```bash
# Stop services
docker-compose down

# Restore PostgreSQL data
docker run --rm \
  -v betterthanspreadsheetsgrc_postgres_data:/data \
  -v $(pwd)/backups/YYYYMMDD-HHMMSS:/backup \
  alpine sh -c "cd /data && rm -rf * && tar xzf /backup/postgres-backup.tar.gz"

# Restore uploaded files
docker run --rm \
  -v betterthanspreadsheetsgrc_app_uploads:/data \
  -v $(pwd)/backups/YYYYMMDD-HHMMSS:/backup \
  alpine sh -c "cd /data && rm -rf * && tar xzf /backup/uploads-backup.tar.gz"

# Start services
docker-compose up -d

# Verify restore
curl http://localhost:3000/api/health/storage
```

#### Selective File Recovery

To recover a single organization's files without full restore:

```bash
# Extract specific organization's files
docker run --rm \
  -v betterthanspreadsheetsgrc_app_uploads:/data \
  -v $(pwd)/backups/YYYYMMDD-HHMMSS:/backup \
  alpine sh -c "cd /data && tar xzf /backup/uploads-backup.tar.gz {organizationId}"
```

### Disaster Recovery

#### Full Recovery from Backup

1. **Stop and remove all containers**:
   ```bash
   docker-compose down
   ```

2. **Remove existing volumes** (if corrupted):
   ```bash
   docker volume rm betterthanspreadsheetsgrc_postgres_data
   docker volume rm betterthanspreadsheetsgrc_app_uploads
   ```

3. **Create fresh volumes**:
   ```bash
   docker volume create betterthanspreadsheetsgrc_postgres_data
   docker volume create betterthanspreadsheetsgrc_app_uploads
   ```

4. **Restore from backup**:
   ```bash
   # Restore database
   docker run --rm \
     -v betterthanspreadsheetsgrc_postgres_data:/data \
     -v $(pwd)/backups/YYYYMMDD-HHMMSS:/backup \
     alpine tar xzf /backup/postgres-backup.tar.gz -C /data

   # Restore uploads
   docker run --rm \
     -v betterthanspreadsheetsgrc_app_uploads:/data \
     -v $(pwd)/backups/YYYYMMDD-HHMMSS:/backup \
     alpine tar xzf /backup/uploads-backup.tar.gz -C /data
   ```

5. **Start services**:
   ```bash
   docker-compose up -d
   ```

6. **Verify recovery**:
   ```bash
   # Check application health
   curl http://localhost:3000

   # Check storage health
   curl http://localhost:3000/api/health/storage

   # Check database connectivity
   docker-compose exec app npx prisma migrate status
   ```

### Volume Persistence

- Volumes persist across container restarts (`docker-compose restart`)
- Volumes persist after `docker-compose down`
- Volumes are **deleted** only by `docker-compose down -v` or `docker volume rm`
- Always backup before running destructive commands

## Troubleshooting

### Docker Desktop Not Running

**Error**: `error during connect: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`

**Solution**: Start Docker Desktop from Windows Start Menu

### Port Already in Use

**Error**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port 3000 (Windows)
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Map to different host port
```

### Database Connection Failed

**Error**: `Connection refused` or `database "betterthanspreadsheetsGRC" does not exist`

**Solution**:
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Verify database was created
docker-compose exec postgres psql -U postgres -c "\\l"

# Recreate database if needed
docker-compose down -v  # WARNING: Deletes all data
docker-compose up -d
```

### ClamAV Not Ready

**Error**: `Could not connect to clamd`

**Solution**:
```bash
# Check ClamAV is still downloading virus definitions
docker-compose logs clamav

# Wait 2-3 minutes for first-time startup
# ClamAV needs to download ~200MB virus database

# Verify ClamAV is running
docker-compose exec clamav clamdscan --version
```

### Migrations Not Running

**Error**: `Prisma migrate failed`

**Solution**:
```bash
# Run migrations manually
docker-compose exec app npx prisma migrate deploy

# Check migration status
docker-compose exec app npx prisma migrate status

# View migration logs
docker-compose logs app | grep -i prisma
```

### Build Failures

**Error**: `npm ci` or `npm run build` fails

**Solution**:
```bash
# Clear Docker build cache
docker-compose build --no-cache

# Ensure package.json and package-lock.json are in sync
npm install

# Rebuild
docker-compose build
```

### Container Out of Memory

**Error**: `JavaScript heap out of memory`

**Solution**:
```bash
# Increase Docker Desktop memory limit
# Docker Desktop Settings -> Resources -> Memory
# Set to at least 4GB (8GB recommended)
```

## Maintenance

### Update ClamAV Virus Definitions

```bash
# Manually trigger freshclam update
docker-compose exec clamav freshclam
```

### View Database with Prisma Studio

```bash
# Access Prisma Studio
docker-compose exec app npx prisma studio

# Open browser: http://localhost:5555
```

### Clean Up Unused Resources

```bash
# Remove stopped containers
docker-compose down

# Remove unused volumes (WARNING: Deletes data)
docker volume prune

# Remove unused images
docker image prune -a
```

## Production Deployment Notes

> Deploying the image to a managed platform (Azure Container Apps, ECS, Cloud Run, Kubernetes)
> rather than Docker Compose? Compose supplies defaults that those platforms do not, so the
> required-variable list is different. See **Deploying to a managed container platform** in
> [INSTALL.md](INSTALL.md) for the full environment variable reference.

### Security Hardening

1. **Change default passwords** in `.env`
2. **Use secrets management** (Azure Key Vault, AWS Secrets Manager)
3. **Restrict port exposure** - Only expose 3000, not 5432/3310
4. **Enable TLS/SSL** - Use reverse proxy (nginx, traefik)
5. **Regular backups** - Automate volume backups

### Performance Optimization

1. **Resource limits** in docker-compose.yml:
   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

2. **Enable Redis caching** (future story)
3. **Use CDN** for static assets

### Monitoring

1. **Health checks** are configured for all services
2. **Log aggregation** - Ship logs to ELK/Splunk
3. **Metrics** - Add Prometheus exporters

## Network Architecture

```
Internet
    |
    v
[Windows Firewall]
    |
    v
[localhost:3000] ─────> App Container (Next.js)
                            |
                            v
                       grc_network (bridge)
                       /            \\
                      v              v
            PostgreSQL:5432    ClamAV:3310
                |                  |
                v                  v
         postgres_data      clamav_data
           (volume)           (volume)

         app_uploads
           (volume)
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review this documentation
- Check Docker Desktop is running
- Verify all environment variables are set

---

Last updated: 2025-12-18 (Story 3.2: File Storage in Docker Volumes)
