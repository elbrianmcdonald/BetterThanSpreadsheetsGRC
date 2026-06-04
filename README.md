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

BetterThanSpreadsheetsGRC runs entirely in Docker. You do **not** need Node.js, npm, or PostgreSQL installed on your host — only Docker.

### Prerequisites

- Docker Engine 20.10+ and Docker Compose v2
- `openssl` and `curl` (bundled with Git Bash on Windows)
- Port 80 free on the host

### Quick Start

```bash
git clone <repository-url>
cd betterthanspreadsheetsgrc
./start.sh
```

`start.sh` creates `.env` from `.env.example`, generates a random `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `CRON_SECRET`, builds the images, starts PostgreSQL and the app, runs `prisma db push` to create the schema, and seeds frameworks + demo data on first run. Expect 3–5 minutes for the first build plus ~1 minute for seeding.

When it finishes, open **http://localhost** and sign in:

- Email: `admin@acme-corp.com`
- Password: `Admin123!@#`

> **Windows:** run `./start.sh` from Git Bash or WSL (not PowerShell/CMD).
>
> **Subsequent starts:** `docker compose up -d`

### Manual Setup (if you want to configure `.env` yourself)

The cross-platform helper script generates every required secret in one step:

```bash
# Linux / macOS / Git Bash on Windows
./scripts/setup-env.sh

# PowerShell on Windows
.\scripts\setup-env.ps1
```

Then start the stack:

```bash
# Set SEED_ON_STARTUP=true in .env for the first run, then remove it
docker compose up -d --build
```

If you prefer to manage `.env` entirely by hand: copy `.env.example`, then set
`POSTGRES_PASSWORD`, `AUTH_SECRET` (generate with `openssl rand -base64 32`),
and `CRON_SECRET` (generate with `openssl rand -hex 32`). All three are
required — `docker compose up` will refuse to start without `CRON_SECRET`.

The app container runs `prisma db push --accept-data-loss` on every start and seeds the database when it is empty or when `SEED_ON_STARTUP=true`. There is no separate `prisma migrate` step to run by hand.

### Verify

```bash
curl http://localhost/api/health
# {"status":"healthy","timestamp":"..."}
```

### Production, HTTPS, reverse proxy, ClamAV, email, backups

See **[INSTALL.md](./INSTALL.md)** for the full deployment guide (Caddy + Let's Encrypt, existing reverse proxy, ClamAV malware scanning, SendGrid / SES email, backup & restore, and troubleshooting).

See **[DOCKER.md](./DOCKER.md)** for Docker internals, volumes, and Windows notes.



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


