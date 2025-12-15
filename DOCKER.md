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

### Backup Volumes

#### PostgreSQL Data Backup

```bash
# Create backup directory
mkdir -p backups

# Backup PostgreSQL data
docker run --rm \\
  -v betterthanspreadsheetsgrc_postgres_data:/data \\
  -v $(pwd)/backups:/backup \\
  alpine tar czf /backup/postgres-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

#### Application Uploads Backup

```bash
# Backup uploaded files
docker run --rm \\
  -v betterthanspreadsheetsgrc_app_uploads:/data \\
  -v $(pwd)/backups:/backup \\
  alpine tar czf /backup/uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

### Restore Volumes

#### PostgreSQL Data Restore

```bash
# Stop services first
docker-compose down

# Restore PostgreSQL data
docker run --rm \\
  -v betterthanspreadsheetsgrc_postgres_data:/data \\
  -v $(pwd)/backups:/backup \\
  alpine sh -c "cd /data && tar xzf /backup/postgres-backup-YYYYMMDD-HHMMSS.tar.gz"

# Start services
docker-compose up -d
```

#### Application Uploads Restore

```bash
# Restore uploaded files
docker run --rm \\
  -v betterthanspreadsheetsgrc_app_uploads:/data \\
  -v $(pwd)/backups:/backup \\
  alpine sh -c "cd /data && tar xzf /backup/uploads-backup-YYYYMMDD-HHMMSS.tar.gz"
```

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

Last updated: 2025-12-15
