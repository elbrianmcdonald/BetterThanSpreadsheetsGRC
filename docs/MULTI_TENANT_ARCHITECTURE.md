# Multi-Tenant Database Architecture

## Overview

BetterThanSpreadsheetsGRC implements **application-level multi-tenancy** using a shared database schema with organization-based data isolation.

## Architecture Decision: Shared Schema with organization_id

### Pattern Chosen: Shared Schema (Discriminator Column)

**Rationale:**
- Better resource utilization (single database instance)
- Easier maintenance and schema evolution
- Simpler backup and restore procedures
- Lower infrastructure costs for SaaS deployment
- Scales efficiently to 100+ organizations

### Alternative Patterns Considered:

1. **Schema-per-tenant:** Rejected due to maintenance complexity and schema drift risks
2. **Database-per-tenant:** Rejected due to resource overhead and cost inefficiency

## Data Isolation Strategy

### Core Principle
All queries MUST filter by `organization_id` to ensure zero cross-tenant data leakage.

### Implementation Layers

1. **Database Layer** (Prisma Schema)
   - All tenant-specific tables include `organizationId` field
   - Foreign key relationships to Organization table with `onDelete: Cascade`
   - Database indexes (including composite indexes) on `organizationId` for query performance
   - NOT NULL constraints prevent missing organizationId

2. **Application Layer** (tRPC Middleware)
   - Organization context extraction from user session via `organizationProcedure`
   - Automatic validation that user belongs to an organization
   - Context provides `ctx.organizationId` for all multi-tenant queries
   - Note: Prisma middleware ($use) deprecated in Prisma 5+ - manual filtering required

3. **API Layer** (Developer Responsibility)
   - All queries MUST explicitly filter by `organizationId`
   - tRPC `organizationProcedure` enforces organization context
   - Database constraints provide final safety net against invalid references
   - RBAC enforcement at procedure level

## Tables Requiring organization_id

### Tenant-Specific Tables (require organizationId)
- User (links users to their organization)
- Evidence (file uploads and metadata)
- Risk (risk and findings records)
- Framework (organization-specific framework activations)
- AuditLog (organization-scoped audit trail)
- ControlImplementation (future: control status per org)
- Remediation (future: remediation plans)
- EvidenceRequest (future: evidence request workflows)

### System Tables (NO organizationId)
- Organization (root tenant table)
- Account (NextAuth provider accounts)
- Session (NextAuth sessions)
- VerificationToken (NextAuth tokens)
- OscalCatalog (future: shared OSCAL framework definitions)

## Cascade Delete Rules

### Organization Deletion
When an organization is deleted, ALL related data is automatically deleted via `onDelete: Cascade`:

```
Organization (deleted)
  └─> User (cascade delete)
      └─> Account (cascade delete via User)
      └─> Session (cascade delete via User)
  └─> Evidence (cascade delete)
  └─> Risk (cascade delete)
  └─> Framework (cascade delete)
  └─> AuditLog (cascade delete)
```

**Rationale:**
- Ensures no orphaned data remains
- Simplifies data lifecycle management
- Supports GDPR/compliance requirements for data deletion

## Database Constraints

### Foreign Key Constraints
All `organizationId` fields have foreign key constraints to `Organization.id`:
```prisma
organizationId String
organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
```

### NOT NULL Constraints
All `organizationId` fields are required (NOT NULL):
```prisma
organizationId String // required, no ? suffix
```

### Unique Constraints
Organization slug must be unique for friendly URLs:
```prisma
slug String @unique
```

### Index Strategy
Composite indexes on `(organizationId, otherField)` for common query patterns:
```prisma
@@index([organizationId, timestamp]) // AuditLog
@@index([organizationId, status])    // Risk
@@index([organizationId])            // All tenant tables
```

## Performance Considerations

### Query Performance
- All organizationId columns are indexed
- Composite indexes for common WHERE clauses
- Database connection pooling via Prisma

### Scalability Targets
- 10-100 organizations (MVP)
- 50-500 concurrent users per organization
- 10K+ evidence files per organization
- 5K+ risks per organization

### Performance Thresholds
- API reads: <500ms (95th percentile)
- Page loads: <2s
- Evidence processing: <5s for 50MB files
- Compliance refresh: <3s for 500 controls

## Security Guarantees

### Zero Cross-Tenant Leakage
1. Database foreign key constraints prevent invalid organizationId references
2. Database NOT NULL constraints ensure organizationId is always present
3. tRPC organizationProcedure validates organization context before queries
4. Developer responsibility to include WHERE organizationId filter in all queries
5. UI components receive pre-filtered data from tRPC API

### Defense in Depth (Three Layers)
- **Layer 1: Database Constraints** - Foreign keys and NOT NULL ensure data integrity
- **Layer 2: tRPC Validation** - organizationProcedure enforces user has organization context
- **Layer 3: Explicit Filtering** - Developers must include organizationId in WHERE clauses

### Important Notes
- Prisma middleware ($use) is deprecated in Prisma 5+
- Automatic query filtering is NOT implemented
- Developers MUST manually filter all queries by organizationId
- Database constraints provide final safety net but should not be relied upon alone

## User Management Patterns (Story 1.4)

### Overview
User management implements the full multi-tenant security pattern with role-based access control (RBAC). All user operations enforce organization isolation and require ORG_ADMIN role.

### tRPC Router Pattern

#### Basic Query with Organization Isolation
```typescript
export const userRouter = createTRPCRouter({
  listUsers: organizationProcedure
    .input(z.object({ skip: z.number(), take: z.number() }))
    .query(async ({ ctx, input }) => {
      // CRITICAL: Always filter by organizationId
      const users = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.organizationId, // Required for tenant isolation
        },
        skip: input.skip,
        take: input.take,
        orderBy: { createdAt: "desc" },
      });

      const total = await ctx.db.user.count({
        where: { organizationId: ctx.organizationId }, // Also in count queries
      });

      return { users, total };
    }),
});
```

#### Mutation with RBAC and Audit Logging
```typescript
const requireOrgAdmin = organizationProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== UserRole.ORG_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Organization Administrators can manage users",
    });
  }
  return next({ ctx });
});

export const userRouter = createTRPCRouter({
  createUser: requireOrgAdmin
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      // 1. Validate business rules (email uniqueness within org)
      const existingUser = await ctx.db.user.findFirst({
        where: {
          email: input.email,
          organizationId: ctx.organizationId, // Scoped to organization
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists in your organization",
        });
      }

      // 2. Create user with organizationId
      const newUser = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          organizationId: ctx.organizationId, // CRITICAL: Set organization
        },
      });

      // 3. Create audit log entry
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
          action: "CREATE_USER",
          entityType: "User",
          entityId: newUser.id,
          changes: {
            user: {
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
            },
          },
        },
      });

      return newUser;
    }),
});
```

### Role-Based Access Control (RBAC)

#### 7-Tier Role System
```typescript
enum UserRole {
  // Tier 1: Full Administrative Access
  ORG_ADMIN              // Create/edit/delete users, manage org settings

  // Tier 2: Operational Access
  GRC_ANALYST            // Create/edit risks, evidence, frameworks
  SECURITY_ENGINEER      // Manage technical controls, integrations
  CISO                   // View all data, approve risk decisions

  // Tier 3: Limited Access
  IT_STAKEHOLDER         // View IT-related controls and evidence
  BUSINESS_STAKEHOLDER   // View business process controls
  AUDITOR                // Read-only access to compliance data
}
```

#### tRPC Middleware for Role Enforcement
```typescript
// organizationProcedure - Base procedure for all multi-tenant operations
// Ensures user has organization context and provides ctx.organizationId
export const organizationProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.user.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "User must be assigned to an organization",
    });
  }

  return next({
    ctx: {
      ...ctx,
      organizationId: ctx.session.user.organizationId,
    },
  });
});

// requireOrgAdmin - Composable middleware for admin-only operations
const requireOrgAdmin = organizationProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== UserRole.ORG_ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Organization Administrators can manage users",
    });
  }
  return next({ ctx });
});

// Usage examples:
// - listUsers: organizationProcedure (any authenticated user can list)
// - createUser: requireOrgAdmin (only admins can create)
// - updateUser: requireOrgAdmin (only admins can update)
// - deleteUser: requireOrgAdmin (only admins can delete)
```

#### Server-Side Route Protection
```typescript
// app/admin/layout.tsx - Protects all /admin routes
export default async function AdminLayout({ children }) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/api/auth/signin?callbackUrl=/admin");
  }

  if (session.user.role !== UserRole.ORG_ADMIN) {
    redirect("/?error=unauthorized");
  }

  return <div>{children}</div>;
}
```

### Security Validations

#### Self-Protection Rules
```typescript
// Prevent admin from deleting their own account
deleteUser: requireOrgAdmin
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    if (input.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete your own account",
      });
    }
    // ... rest of deletion logic
  }),

// Prevent admin from changing their own role
updateUserRole: requireOrgAdmin
  .input(z.object({ id: z.string(), role: userRoleSchema }))
  .mutation(async ({ ctx, input }) => {
    if (input.id === ctx.session.user.id) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot change your own role",
      });
    }
    // ... rest of update logic
  }),
```

#### Email Uniqueness Enforcement
```typescript
// Unique within organization, same email allowed across organizations
const existingUser = await ctx.db.user.findFirst({
  where: {
    email: input.email,
    organizationId: ctx.organizationId, // Scoped to current organization
  },
});

if (existingUser) {
  throw new TRPCError({
    code: "CONFLICT",
    message: "A user with this email already exists in your organization",
  });
}
```

### API Documentation

#### User Management Endpoints

##### `user.listUsers`
**Access:** All authenticated users within organization
**Input:**
```typescript
{
  skip: number;  // Pagination offset
  take: number;  // Number of records (max 100)
}
```
**Output:**
```typescript
{
  users: User[];
  total: number;
}
```
**Behavior:** Returns only users from the current user's organization

##### `user.getUserById`
**Access:** All authenticated users within organization
**Input:** `{ id: string }`
**Output:** `User`
**Errors:**
- `NOT_FOUND` if user doesn't exist or belongs to different organization

##### `user.createUser`
**Access:** ORG_ADMIN only
**Input:**
```typescript
{
  name: string;       // Min 1 char, max 255
  email: string;      // Valid email format
  role: UserRole;     // One of 7 roles
}
```
**Output:** `User` (created user object)
**Errors:**
- `FORBIDDEN` if caller is not ORG_ADMIN
- `CONFLICT` if email already exists in organization
**Side Effects:** Creates audit log entry with action "CREATE_USER"

##### `user.updateUser`
**Access:** ORG_ADMIN only
**Input:**
```typescript
{
  id: string;
  name?: string;      // Optional
  email?: string;     // Optional
  role?: UserRole;    // Optional
}
```
**Output:** `User` (updated user object)
**Errors:**
- `FORBIDDEN` if caller is not ORG_ADMIN
- `NOT_FOUND` if user doesn't exist or belongs to different organization
- `CONFLICT` if new email already exists in organization
**Side Effects:** Creates audit log entry with action "UPDATE_USER"

##### `user.updateUserRole`
**Access:** ORG_ADMIN only
**Input:**
```typescript
{
  id: string;
  role: UserRole;
}
```
**Output:** `User` (updated user object)
**Errors:**
- `FORBIDDEN` if caller is not ORG_ADMIN
- `BAD_REQUEST` if trying to change own role
- `NOT_FOUND` if user doesn't exist or belongs to different organization
**Side Effects:** Creates audit log entry with action "UPDATE_USER_ROLE"

##### `user.deleteUser`
**Access:** ORG_ADMIN only
**Input:** `{ id: string }`
**Output:**
```typescript
{
  success: true;
  deletedUserId: string;
}
```
**Errors:**
- `FORBIDDEN` if caller is not ORG_ADMIN
- `BAD_REQUEST` if trying to delete own account
- `NOT_FOUND` if user doesn't exist or belongs to different organization
**Side Effects:**
- Deletes user record (cascades to Account and Session tables)
- Creates audit log entry with action "DELETE_USER"

### Session Enhancement Pattern

#### NextAuth Configuration
```typescript
// src/server/auth/config.ts
import { type UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;              // Added in Story 1.4
      organizationId: string;       // Added in Story 1.4
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string;
  }
}

export const authConfig = {
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        role: user.role,                    // Included in session
        organizationId: user.organizationId, // Included in session
      },
    }),
  },
  // ...
};
```

**Benefits:**
- Eliminates extra DB query on every request (used in tRPC context)
- Enables server-side route protection without DB lookup
- Type-safe access to role and organizationId in components

### Testing Patterns

#### Integration Test Structure
```typescript
// Create test organizations and users
beforeAll(async () => {
  orgA = await db.organization.create({ data: { name: "Org A", slug: "org-a" } });
  orgB = await db.organization.create({ data: { name: "Org B", slug: "org-b" } });

  adminA = await db.user.create({
    data: {
      email: "admin-a@test.com",
      role: "ORG_ADMIN",
      organizationId: orgA.id,
    },
  });
});

// Create tRPC caller with user context
function createCaller(user: User) {
  return appRouter.createCaller({
    db,
    session: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    organizationId: user.organizationId,
    headers: new Headers(),
  });
}

// Test cross-organization isolation
it("should prevent Admin A from seeing users in Org B", async () => {
  const caller = createCaller(adminA);
  const result = await caller.user.listUsers({ skip: 0, take: 50 });

  expect(result.users.some((u) => u.id === adminB.id)).toBe(false);
});
```

### Key Learnings from Story 1.4

1. **Session Enhancement is Critical**: Adding role and organizationId to NextAuth session eliminates DB queries and enables all downstream authorization
2. **Composable Middleware**: `requireOrgAdmin` can be composed with `organizationProcedure` for reusable role checks
3. **Email Uniqueness Scoping**: Email must be unique within organization but can repeat across organizations
4. **Self-Protection**: Admins must not be able to delete themselves or change their own role
5. **Audit Trail**: Every user management operation must create an audit log entry for compliance
6. **Explicit Filtering**: All queries must manually include `where: { organizationId }` - no automatic filtering available

## Testing Strategy

### Data Isolation Tests
1. Create 2 test organizations (Org A, Org B)
2. Create test data for each organization
3. Verify cross-org queries return empty results
4. Test cascade delete (delete Org A, verify Org B untouched)

### Performance Tests
1. Simulate 50 concurrent users per organization
2. Measure query performance with organizationId indexes
3. Validate compliance calculation performance

### Security Tests
1. Attempt to query without organizationId context (should fail)
2. Attempt to query with invalid organizationId (should return empty)
3. Attempt to access another organization's data via API (should be rejected)

## Migration Strategy

### Initial Migration
- Creates Organization table as root tenant table
- Adds organizationId to all tenant-specific tables
- Creates all foreign key constraints and indexes
- Sets up cascade delete rules

### Future Migrations
- All new tenant-specific tables MUST include organizationId
- Schema changes apply to all organizations simultaneously
- No per-tenant schema customization allowed

## Monitoring and Observability

### Metrics to Track
- Query performance by organizationId
- Cross-tenant query attempts (should be zero)
- Cascade delete operations (audit trail)
- Database connection pool utilization

### Audit Logging
- All organization CRUD operations logged
- User assignments to organizations logged
- Organization deletion events with full context

## Compliance Considerations

### Data Residency
MVP: Single deployment region (no data residency requirements)
Future: Multi-region deployment with organization-specific data residency

### Data Deletion
- Organization deletion triggers cascade delete of all related data
- Audit logs preserved in separate compliance archive (future)
- Supports GDPR "right to be forgotten" requirements

### Backup and Recovery
- 15-minute RPO (Recovery Point Objective)
- Organization-specific restore capability (future)
- Point-in-time recovery for data corruption scenarios

## References

- [Prisma Multi-Tenant Guide](https://www.prisma.io/docs/guides/database/multi-tenant-applications)
- [Architecture Decision Document](../../docs/architecture.md)
- [Story 1.3: Multi-Tenant Schema](../../docs/sprint-artifacts/1-3-multi-tenant-schema.md)
