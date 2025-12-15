# BetterThanSpreadsheetsGRC

A modern GRC (Governance, Risk, and Compliance) platform built with the T3 Stack, designed to replace spreadsheet-based compliance workflows with a powerful, multi-tenant SaaS application.

## Features

### User Management (Story 1.4)

**Multi-Tenant User Account Management** - Organization Administrators can manage users within their organization with comprehensive role-based access control.

**Key Capabilities:**
- ✅ **Create, Edit, Delete Users** - Full CRUD operations for user accounts
- ✅ **7-Tier Role System** - Granular permissions across organizational tiers:
  - **Tier 1**: Organization Administrator (full access)
  - **Tier 2**: GRC Analyst, Security Engineer, CISO (operational access)
  - **Tier 3**: IT Stakeholder, Business Stakeholder, Auditor (limited access)
- ✅ **Multi-Tenant Isolation** - Complete data separation between organizations
- ✅ **Role-Based UI** - Interface elements adapt based on user permissions
- ✅ **Audit Logging** - Every user operation tracked for compliance
- ✅ **Email Uniqueness** - Enforced within organization boundaries
- ✅ **Self-Protection** - Administrators cannot delete themselves or change their own role

**Access:** `/admin/users` (Organization Administrator role required)

**Security Features:**
- Server-side role validation on all routes
- tRPC middleware for API authorization
- Explicit multi-tenant filtering in all database queries
- Complete audit trail for all user management operations

## Technology Stack

This project is built with the **T3 Stack** - a modern, type-safe web development stack:

- **[Next.js 15](https://nextjs.org)** - React framework with App Router, Server Components, and Streaming
- **[TypeScript 5.x](https://www.typescriptlang.org/)** - Strict mode enabled for maximum type safety
- **[Prisma 6.x](https://prisma.io)** - Type-safe ORM with PostgreSQL adapter
- **[tRPC 11.x](https://trpc.io)** - End-to-end type-safe APIs without code generation
- **[NextAuth.js 5.x](https://next-auth.js.org)** - Authentication with database-backed sessions
- **[Tailwind CSS 4.x](https://tailwindcss.com)** - Utility-first CSS with JIT compiler
- **[shadcn/ui](https://ui.shadcn.com)** - Copy-paste component library built on Radix UI

### Additional Technologies
- **PostgreSQL 16** - Production database
- **React Query (TanStack Query)** - Server state management
- **Zod** - Runtime validation and type inference
- **Docker Compose** - Local development environment orchestration

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20.x or higher ([Download](https://nodejs.org/))
- **npm** 10.x or higher (comes with Node.js)
- **Docker Desktop** (optional, for local PostgreSQL)
- **PostgreSQL** 15+ (if not using Docker)

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
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/grc"
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
npm run db:generate  # Generate Prisma Client (runs on postinstall)
npm run db:migrate   # Run database migrations (development)
npm run db:push      # Push schema changes without migration
npm run db:studio    # Open Prisma Studio (database GUI)
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

## Architecture Decisions

### Type Safety

- **Strict TypeScript**: All code uses TypeScript with `strict: true`
- **End-to-end types**: tRPC ensures types flow from server to client
- **Runtime validation**: Zod schemas validate all inputs at runtime
- **Path aliases**: `@/` prefix for clean imports

### Authentication

- **NextAuth.js 5.x**: Modern authentication with Auth.js
- **Database sessions**: Sessions stored in PostgreSQL via Prisma
- **Multiple providers**: Support for Azure AD, Discord, Email
- **Type-safe**: Session and user types extend NextAuth defaults

### Database

- **Prisma ORM**: Type-safe database access with migrations
- **PostgreSQL**: Production-ready relational database
- **Multi-tenancy ready**: Organization model for data isolation
- **Audit logging**: User roles and activity tracking

### UI/UX

- **shadcn/ui**: Accessible, customizable components
- **Tailwind CSS v4**: Modern @theme-based styling
- **Dark mode ready**: CSS variables for theming
- **Responsive**: Mobile-first design approach

## Troubleshooting

### Build Errors

**Error: "Invalid environment variables"**
- Solution: Ensure all required variables in `.env` match schema in `src/env.js`
- Make optional variables `.optional()` in the schema if not required

**Error: "Module not found: Can't resolve '@/...'"**
- Solution: Verify `tsconfig.json` has correct path aliases under `paths`
- Restart your editor/IDE to pick up tsconfig changes

### Database Issues

**Error: "Can't reach database server"**
- Solution: Ensure PostgreSQL is running (check Docker: `docker-compose ps`)
- Verify DATABASE_URL in `.env` matches your database configuration
- Test connection: `npx prisma db pull`

**Error: "Migration failed"**
- Solution: Reset database: `npx prisma migrate reset` (WARNING: deletes all data)
- Or manually fix migration files in `prisma/migrations/`

### Development Server

**Error: "Port 3000 is already in use"**
- Solution: Kill process on port 3000 or use different port:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F

  # Linux/Mac
  lsof -ti:3000 | xargs kill

  # Or use different port
  PORT=3001 npm run dev
  ```

**Hot reload not working**
- Solution: Restart dev server
- Check `.next` cache: delete and rebuild: `rm -rf .next && npm run dev`

### TypeScript Errors

**Error: "Property does not exist on type"**
- Solution: Run `npx prisma generate` to regenerate Prisma Client
- Restart TypeScript server in your editor (VS Code: Cmd+Shift+P -> "Restart TS Server")

**Error: "Cannot find module" after adding new file**
- Solution: Restart dev server - Next.js needs to pick up new files

## Learn More

### T3 Stack Resources

- [T3 Stack Documentation](https://create.t3.gg/)
- [T3 Stack Tutorial](https://create.t3.gg/en/usage/first-steps)
- [T3 Community Discord](https://t3.gg/discord)

### Technology Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [tRPC Docs](https://trpc.io/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com/)

## Contributing

This project uses:
- **TypeScript** with strict mode
- **ESLint** for linting
- **Prettier** (recommended) for code formatting
- **Conventional Commits** (recommended) for commit messages

## License

[Add your license here]
