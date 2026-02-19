# BetterThanSpreadsheetsGRC

This GRC application is meant for organizations who want to move out of spreadsheets but do not have the budget to move to an enterprise tool, hence the name of better than spreadsheets grc. I do not recommend putting this on anything that is internet facing, i am not a programmer and could of missed some vulnerabilities. This is in what I would consider an alpha release, as there are some features that i would like to eventually put in here. 

** Current Features**
                                                                                                                                                                                                                                                                       
 Features
                                                                                                                                                                                                                                                                        
  Assignments

  - My Assignments — Kanban board of your assigned assessment tasks, with drag-and-drop status tracking across To Do, In Progress, and Completed columns.
  - Backlog — View and assign unassigned assessment tasks across all assessment types, with filtering by priority, type, and business unit.

  Governance

  - Strategy — Create and track security strategies by fiscal year with progress monitoring, ownership, and lifecycle status.
  - Maturity — Assess and visualize organizational maturity levels across supported frameworks (NIST CSF 2.0, C2M2, OWASP SAMM) with current vs. target scoring.
  - Frameworks — Import OSCAL-formatted compliance frameworks, manage their lifecycle, and review control counts and validation status. Comes with NIST CSF (which is not a control framework but some use it this way for some reason) NIST 800-171, NIST 800-53r5 (able to select which baseline you want to assess against), and a sample of ISO 27001 controls.
  - Control Library — Browse, search, and manage controls across all imported frameworks with health indicators, bulk operations, and CSV export.

  Risk

  - Risk Dashboard — Visualize risk posture through a heatmap, severity distribution, remediation velocity trends, and summary metrics.
  - Risk Register — Searchable, filterable catalog of all organizational risks with severity scoring, owner assignment, and CSV export.
  - Findings Register — Track security findings from audits and assessments, triage them by severity, and accept findings to convert them into risks.
  - Risk Assessments — Create and manage risk assessment projects, claim unassigned assessments, and track reassessment schedules.

  Compliance

  - Dashboard — Monitor compliance coverage percentages across frameworks and business units with real-time score updates and gap analysis.
  - Assessments — Conduct compliance assessments against adopted frameworks, track progress with compliance scores, and filter by status or assessor.
  - Standards — Maintain a registry of organizational standards with lifecycle status, review cycles, and CSV import support.
  - Evidence — Upload, tag, and manage compliance evidence files with framework mappings, control domain associations, and a full audit trail.
  - Velocity Metrics — Measure remediation speed with average days-to-close breakdowns by severity, owner, and finding source.

  Third Party

  - TPRM Dashboard — Summarize vendor risk across tiers with assessment coverage metrics, overdue review alerts, and side-by-side vendor comparison.
  - Vendor Registry — Manage vendors with risk tiering, review scheduling, and business unit assignment, including bulk CSV import and export.
  - Assessments — Track vendor assessment progress with status workflows, due date monitoring, and assessor assignment.
  - Questionnaires — Browse and customize security questionnaire templates for vendor risk intake.

  Business Impact

  - BIA Dashboard — View business impact analysis coverage, tier distribution, and assessment freshness across all business processes.
  - Business Processes — Catalog business processes with criticality tiering, ownership, and links to supporting functions and assets.
  - Business Functions — Define and organize business functions that group related business processes.
  - Asset Registry — Inventory IT assets by type (server, database, application, network, endpoint) with status tracking and process linkage.
  - BIA Configuration — Configure impact categories, scoring scales, tier definitions with RTO/RPO targets, and threshold criteria.

  Administration

  - User Management — Create and manage user accounts with role-based access control, framework assignments, and business unit placement.
  - Business Units — Build a hierarchical organizational structure (up to 5 levels) for department-based routing and reporting.
  - Assessment Types — Define and manage risk assessment types used across the platform.
  - Risk Matrices — Configure risk scoring matrices with customizable grid sizes, dimensions, and scoring scales.
  - Mappings — View and manage control-to-domain mappings across frameworks with confidence scoring.
  - Taxonomy — Manage the control domain taxonomy used to categorize and cross-reference controls.
  - MITRE ATT&CK — Browse MITRE ATT&CK tactics and techniques, synced from the STIX repository, for threat-informed defense alignment.

Planned features
- SSO integrations
- Email Notifications
- More maturity frameworks
- Taxonomy — Manage the control domain taxonomy used to categorize and cross-reference controls.
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


