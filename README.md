# BetterThanSpreadsheetsGRC

A modern GRC (Governance, Risk, and Compliance) platform built with the T3 Stack, designed to replace spreadsheet-based compliance workflows.


## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd betterthanspreadsheetsgrc
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

**Required Environment Variables:**

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc"

# NextAuth.js
AUTH_SECRET="<generate-with-openssl-rand-base64-32>"
NEXTAUTH_URL="http://localhost:3000"

```

Generate AUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Start Database (Using Docker)

If using Docker for local development:

```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Verify it's running
docker-compose ps
```

### 5. Run Database Migrations

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations to create database schema
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 6. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your application running.

## Docker Deployment (Recommended for Windows)

For Windows deployments or containerized environments, use Docker Compose to run the entire stack:

### Quick Start with Docker

```bash
# 1. Create .env file from example
cp .env.example .env

# 2. Edit .env and set AUTH_SECRET
#    Generate with: openssl rand -base64 32

# 3. Start all services (Windows)
docker-start.bat

# OR for Linux/Mac
./docker-start.sh
```

This will start:
- **Next.js Application** on `http://localhost:3000`
- **PostgreSQL Database** on `localhost:5432`
- **ClamAV Malware Scanner** on `localhost:3310`

### Docker Services

The Docker Compose stack includes:

- **app**: Next.js application with automatic database migrations
- **postgres**: PostgreSQL 15 database with persistent storage
- **clamav**: ClamAV malware scanner for file uploads

All services run on an isolated Docker network with health checks and automatic restart policies.

### Docker Commands

```bash
# Start services
docker-start.bat          # Windows
./docker-start.sh         # Linux/Mac

# Stop services
docker-stop.bat           # Windows
./docker-stop.sh          # Linux/Mac

# View logs
docker-logs.bat           # Windows
./docker-logs.sh          # Linux/Mac

# View logs for specific service
docker-logs.bat app       # Windows
./docker-logs.sh app      # Linux/Mac
```

### Manual Docker Commands

```bash
# Build images
docker-compose build

# Start all services in background
docker-compose up -d

# View running services
docker-compose ps

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Data Persistence

Data is persisted in Docker volumes:
- `postgres_data` - Database storage
- `app_uploads` - Uploaded files
- `clamav_data` - Virus definitions

See [DOCKER.md](./DOCKER.md) for complete Docker deployment documentation including:
- Windows prerequisites
- Volume backup/restore procedures
- Troubleshooting guide
- Production deployment notes

### 7. Test the Setup

Visit [http://localhost:3000/test](http://localhost:3000/test) to verify:
- ✅ tRPC queries work
- ✅ shadcn/ui components render
- ✅ Tailwind CSS styling applies
- ✅ TypeScript type safety end-to-end

## NPM Scripts

### Development

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Create production build
npm run start        # Start production server
npm run typecheck    # Run TypeScript compiler (no emit)
```

### Database

```bash
npm run db:generate         # Generate Prisma Client (runs on postinstall)
npm run db:migrate          # Run database migrations (development)
npm run db:push             # Push schema changes without migration
npm run db:studio           # Open Prisma Studio (database GUI)
npm run db:cleanup-sessions # Delete expired sessions (run via cron every 6 hours)
```

### Build Process

The build command runs:
1. TypeScript compilation check
2. Next.js optimization
3. Static page generation
4. Asset bundling

## Project Structure

```
betterthanspreadsheetsgrc/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # NextAuth.js endpoints
│   │   │   └── trpc/           # tRPC HTTP handler
│   │   ├── test/               # Test page
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Homepage
│   ├── components/
│   │   └── ui/                 # shadcn/ui components
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/        # tRPC routers
│   │   │   ├── root.ts         # Main tRPC router
│   │   │   └── trpc.ts         # tRPC configuration
│   │   ├── auth/               # NextAuth.js configuration
│   │   └── db.ts               # Prisma client instance
│   ├── trpc/
│   │   ├── react.tsx           # tRPC React client
│   │   └── server.ts           # tRPC server-side client
│   ├── styles/
│   │   └── globals.css         # Global styles + Tailwind
│   └── env.js                  # Environment variable validation
├── prisma/
│   └── schema.prisma           # Database schema
├── public/                     # Static assets
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment template
├── components.json             # shadcn/ui configuration
├── docker-compose.yml          # Docker services
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```


