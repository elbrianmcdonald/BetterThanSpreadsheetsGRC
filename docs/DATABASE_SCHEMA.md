# Database Schema Documentation

## Overview

BetterThanSpreadsheetsGRC uses PostgreSQL with Prisma ORM for database operations. The schema supports multi-tenant isolation, OSCAL catalog storage, control taxonomy, and evidence tracking.

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Organization   │────<│      User       │     │   AuditLog      │
│                 │     │                 │────<│                 │
│  id             │     │  id             │     │  id             │
│  name           │     │  email          │     │  action         │
│  slug           │     │  role           │     │  entityType     │
│  settings       │     │  organizationId │     │  entityId       │
│  active         │     │  hashedPassword │     │  changes        │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ├──────────────────────────────────────────────────┐
         │                                                  │
         ▼                                                  ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Framework     │────<│    Control      │     │    Evidence     │
│                 │     │                 │     │                 │
│  id             │     │  id             │     │  id             │
│  code           │     │  controlId      │     │  title          │
│  name           │     │  title          │     │  filePath       │
│  version        │     │  description    │     │  fileType       │
│  oscalCatalog   │     │  parentId       │     │  uploadedBy     │
│  isActive       │     │  frameworkId    │     │  isActive       │
│  organizationId │     │  organizationId │     │  organizationId │
└─────────────────┘     │  isActive       │     └────────┬────────┘
                        └─────────────────┘              │
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│ ControlDomain   │────<│ControlDomain   │     │EvidenceControl  │
│   (Global)      │     │   Mapping      │     │    Domain       │
│                 │     │                 │     │                 │
│  id             │     │  id             │     │  id             │
│  code           │     │  controlDomainId│     │  evidenceId     │
│  name           │     │  frameworkCode  │     │  controlDomainId│
│  sortOrder      │     │  controlId      │     └─────────────────┘
│  isActive       │     │  confidence     │
└─────────────────┘     └─────────────────┘
```

## Multi-Tenant Architecture

All tenant-scoped tables include an `organizationId` foreign key with `ON DELETE CASCADE`:

- **Framework** - OSCAL catalogs per organization
- **Control** - Framework controls per organization
- **Evidence** - Compliance evidence per organization
- **Risk** - Risk records per organization
- **AuditLog** - Audit trail per organization
- **User** - Users belong to one organization

**Global Tables** (no organizationId):
- **ControlDomain** - Shared taxonomy across all organizations
- **ControlDomainMapping** - Shared control mappings (templates)

## Core Models

### Organization

Root tenant entity. All data is isolated by organization.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Display name |
| slug | String | URL-safe identifier (unique) |
| settings | JSON | Org-specific settings |
| active | Boolean | Soft-delete flag |

**Indexes:**
- `slug` - Unique lookup
- `active` - Active organization queries

### User

Organization members with role-based access.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email address |
| name | String | Display name |
| role | UserRole | One of 7 roles |
| hashedPassword | String | bcrypt hash (nullable for OAuth) |
| organizationId | UUID | FK to Organization |

**Roles:** ORG_ADMIN, GRC_ANALYST, SECURITY_ENGINEER, CISO, IT_STAKEHOLDER, BUSINESS_STAKEHOLDER, AUDITOR

**Indexes:**
- `organizationId` - Tenant isolation
- `email` - Unique login lookup

### Framework

OSCAL catalogs imported from JSON/YAML files.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | String | Framework code (ISO27001, SOC2, NISTCSF) |
| name | String | Full framework name |
| version | String | Catalog version |
| description | Text | Framework description |
| publicationDate | DateTime | Original publication date |
| sourceUrl | String | Source URL reference |
| oscalCatalog | JSONB | Full OSCAL catalog |
| isActive | Boolean | Activation status |
| activatedAt | DateTime | When activated |
| activatedBy | UUID | FK to User who activated |
| targetCompletionDate | DateTime | Target compliance date |
| deactivatedAt | DateTime | When deactivated |
| deactivatedBy | UUID | FK to User who deactivated |
| organizationId | UUID | FK to Organization |

**Constraints:**
- `@@unique([organizationId, code, version])` - Prevent duplicate imports

**Indexes:**
- `organizationId` - Tenant isolation
- `organizationId, id` - Composite for efficient lookups
- `organizationId, isActive` - Active frameworks per org
- `code` - Framework code lookup
- `isActive` - Global active filter

**Cascade Behavior:**
- Deleting Framework cascades to all Controls

### Control

Framework controls extracted from OSCAL catalogs.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| controlId | String | OSCAL control ID (A.9.1.1, CC6.1, PR.AC-1) |
| title | String | Control title |
| description | Text | Control description |
| guidance | Text | Implementation guidance |
| parentControlId | UUID | Self-reference for hierarchy |
| isActive | Boolean | Soft-delete for OSCAL updates |
| frameworkId | UUID | FK to Framework (CASCADE) |
| organizationId | UUID | FK to Organization (CASCADE) |

**Constraints:**
- `@@unique([frameworkId, controlId])` - Unique control per framework

**Indexes:**
- `organizationId` - Tenant isolation
- `organizationId, id` - Composite for efficient lookups
- `organizationId, frameworkId` - Controls by framework
- `frameworkId` - Framework controls
- `frameworkId, isActive` - Active controls per framework
- `parentControlId` - Hierarchy queries

**Cascade Behavior:**
- Deleted when parent Framework is deleted
- Children set to NULL when parent Control is deleted

### ControlDomain (Global)

Simplified 12-domain taxonomy for evidence tagging.

| Field | Type | Description |
|-------|------|-------------|
| id | CUID | Primary key |
| code | String | Domain code (ACCESS_CONTROL, etc.) |
| name | String | Display name |
| description | Text | Domain description |
| sortOrder | Int | Display order |
| isActive | Boolean | Availability flag |

**Standard Domains:**
1. ACCESS_CONTROL - Access Control
2. AUTHENTICATION - Authentication & Identity
3. DATA_PROTECTION - Data Protection
4. ENCRYPTION - Encryption & Cryptography
5. NETWORK_SECURITY - Network Security
6. ENDPOINT_SECURITY - Endpoint Security
7. SECURITY_MONITORING - Security Monitoring
8. INCIDENT_RESPONSE - Incident Response
9. VENDOR_MANAGEMENT - Vendor Management
10. PHYSICAL_SECURITY - Physical Security
11. BUSINESS_CONTINUITY - Business Continuity
12. GOVERNANCE - Governance & Compliance

**Indexes:**
- `code` - Unique lookup
- `sortOrder` - Ordered display
- `isActive, sortOrder` - Active domains ordered

### ControlDomainMapping (Global)

Maps control domains to framework-specific OSCAL control IDs.

| Field | Type | Description |
|-------|------|-------------|
| id | CUID | Primary key |
| controlDomainId | CUID | FK to ControlDomain |
| frameworkCode | String | Framework code (not FK - template mapping) |
| controlId | String | OSCAL control ID |
| confidence | Int | Mapping confidence (0-100) |

**Constraints:**
- `@@unique([controlDomainId, frameworkCode, controlId])` - Unique mapping

**Indexes:**
- `controlDomainId, frameworkCode` - Mappings by domain and framework
- `frameworkCode, controlId` - Reverse lookup
- `controlDomainId` - Domain mappings

**Design Note:** Uses `frameworkCode` string instead of `frameworkId` FK to allow reusable template mappings across organizations.

### EvidenceControlDomain

Junction table linking Evidence to Control Domains.

| Field | Type | Description |
|-------|------|-------------|
| id | CUID | Primary key |
| evidenceId | UUID | FK to Evidence (CASCADE) |
| controlDomainId | CUID | FK to ControlDomain (CASCADE) |

**Constraints:**
- `@@unique([evidenceId, controlDomainId])` - Prevent duplicate tagging

**Indexes:**
- `evidenceId` - Tags per evidence
- `controlDomainId` - Evidence per domain

### Evidence

Compliance evidence files uploaded by users.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Evidence title |
| description | String | Description |
| filePath | String | Storage path |
| fileSize | Int | File size in bytes |
| fileType | String | MIME type |
| uploadedBy | UUID | User who uploaded |
| isActive | Boolean | Soft-delete flag |
| organizationId | UUID | FK to Organization |

**Indexes:**
- `organizationId` - Tenant isolation
- `organizationId, uploadedBy` - User's evidence
- `organizationId, isActive` - Active evidence
- `uploadedBy` - User lookup

### Risk

Risk and finding records.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Risk title |
| description | String | Risk description |
| severity | Severity | HIGH, MEDIUM, LOW |
| status | RiskStatus | OPEN, REMEDIATED, CLOSED |
| organizationId | UUID | FK to Organization |

**Indexes:**
- `organizationId` - Tenant isolation
- `organizationId, status` - Risks by status
- `organizationId, severity` - Risks by severity
- `status` - Global status filter
- `severity` - Global severity filter

### AuditLog

Immutable audit trail for all actions.

| Field | Type | Description |
|-------|------|-------------|
| id | CUID | Primary key |
| organizationId | UUID | FK to Organization |
| userId | UUID | FK to User |
| action | AuditAction | Action enum (28 types) |
| entityType | String | Target entity type |
| entityId | String | Target entity ID |
| changes | JSON | Before/after state |
| timestamp | DateTime | When action occurred |
| ipAddress | String | Client IP |
| userAgent | String | Client user agent |

**Indexes:**
- `organizationId, timestamp` - Time-ordered org logs
- `organizationId, entityType, entityId` - Entity history
- `organizationId, userId` - User activity
- `timestamp` - Global time queries

## Cascade Delete Behaviors

| Parent | Child | Behavior |
|--------|-------|----------|
| Organization | User | CASCADE |
| Organization | Framework | CASCADE |
| Organization | Control | CASCADE |
| Organization | Evidence | CASCADE |
| Organization | Risk | CASCADE |
| Organization | AuditLog | CASCADE |
| Framework | Control | CASCADE |
| ControlDomain | ControlDomainMapping | CASCADE |
| ControlDomain | EvidenceControlDomain | CASCADE |
| Evidence | EvidenceControlDomain | CASCADE |
| Control (parent) | Control (child) | SET NULL |
| User | Framework (activatedBy) | SET NULL |
| User | Framework (deactivatedBy) | SET NULL |

## Index Strategy

### Multi-Tenant Query Pattern

All tenant-scoped queries include `organizationId` in the WHERE clause. Composite indexes with `organizationId` as the leading column ensure efficient query execution:

```sql
-- Uses index: (organizationId, frameworkId)
SELECT * FROM "Control"
WHERE "organizationId" = ? AND "frameworkId" = ?;

-- Uses index: (organizationId, isActive)
SELECT * FROM "Framework"
WHERE "organizationId" = ? AND "isActive" = true;
```

### Unique Constraints

Prevent duplicate data at the database level:

- `Organization.slug` - Unique org identifiers
- `User.email` - Unique login emails
- `Framework(organizationId, code, version)` - Unique framework imports
- `Control(frameworkId, controlId)` - Unique controls per framework
- `ControlDomain.code` - Unique domain codes
- `ControlDomainMapping(controlDomainId, frameworkCode, controlId)` - Unique mappings

## Migrations

Migrations are managed by Prisma and stored in `prisma/migrations/`.

**Apply migrations:**
```bash
npx prisma migrate deploy
```

**Generate new migration:**
```bash
npx prisma migrate dev --name <migration-name>
```

**Reset database:**
```bash
npx prisma migrate reset
```

## Seed Data

The seed script (`prisma/seed.ts`) is idempotent and creates:

1. **2 Organizations:** Acme Corp, TechStart Inc
2. **4 Users:** Admin and Analyst per org
3. **3 Frameworks:** ISO 27001, SOC 2, NIST CSF (with full OSCAL catalogs)
4. **12 Control Domains:** Standard taxonomy
5. **118 Control Domain Mappings:** Pre-configured mappings

**Run seed:**
```bash
npx prisma db seed
```

## Performance Considerations

1. **JSONB for OSCAL:** Full catalogs stored as JSONB for flexible querying
2. **Composite Indexes:** All multi-tenant tables have `(organizationId, id)` indexes
3. **Soft Deletes:** `isActive` flags with indexes for efficient filtering
4. **Cascade Deletes:** Automatic cleanup prevents orphaned records
5. **Text Fields:** `@db.Text` for long descriptions (no VARCHAR limit)

## Security

1. **Tenant Isolation:** All queries filter by `organizationId` via tRPC middleware
2. **Cascade Deletes:** Prevent data leakage on organization deletion
3. **Audit Trail:** All actions logged with before/after state
4. **Password Hashing:** bcrypt with cost factor 12
5. **No Sensitive PII:** Passwords stored as hashes only

## References

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html)
