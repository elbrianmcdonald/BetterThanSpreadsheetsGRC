import { env } from "@/env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg';

import { organizationFilterMiddleware } from "@/server/db/middleware/organization-filter";
import { graphSyncMiddleware } from "@/server/db/middleware/graph-sync";

/**
 * Raw Prisma Client without organization filtering
 *
 * SECURITY WARNING: Only use this for:
 * - Test cleanup operations
 * - System migrations
 * - Organization creation/deletion workflows
 *
 * Never use rawPrisma for regular business logic - always use `db` instead
 * to ensure multi-tenant isolation.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const rawPrisma = new PrismaClient({
  adapter: adapter,
  log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

/**
 * Multi-tenant models that require automatic organizationId filtering.
 * These models MUST always be filtered by organizationId to prevent cross-tenant data leakage.
 *
 * System models (Organization, Account, Session, VerificationToken) are excluded
 * because they are either root tenant tables or NextAuth system tables.
 *
 * @see docs/MULTI_TENANCY.md for the complete multi-tenancy strategy
 * @see Story 1.9: Multi-Tenant Data Access Middleware
 */
const MULTI_TENANT_MODELS = [
  "User",
  "Evidence",
  "Risk",
  "Framework",
  "AuditLog",
] as const;

const createPrismaClient = () => {
  /**
   * Base Prisma Client with Multi-Tenant Extension
   *
   * IMPORTANT: Multi-tenant data isolation is AUTOMATICALLY enforced through:
   * 1. Prisma Client Extension that injects organizationId filters on ALL queries (see middleware/)
   * 2. tRPC organizationProcedure middleware that sets organization context (see src/server/api/trpc.ts)
   * 3. Database foreign key constraints (see prisma/schema.prisma)
   *
   * The Client Extension approach eliminates an entire class of bugs by making it
   * impossible to forget organization filtering. Developers no longer need to
   * manually add organizationId to queries - it's automatic!
   *
   * Best Practice:
   * - Always use organizationProcedure for multi-tenant data access
   * - The extension will automatically filter all queries by organizationId
   * - No need to manually add { where: { organizationId: ctx.organizationId } }
   * - Cross-organization access attempts return NOT_FOUND (not FORBIDDEN)
   *
   * @see src/server/db/middleware/organization-filter.ts - Automatic filtering implementation
   * @see src/server/api/trpc.ts - organizationProcedure sets organization context
   * @see docs/MULTI_TENANCY.md - Complete multi-tenancy strategy
   */
  const baseClient = new PrismaClient({
    adapter: adapter,
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Extend client with organization filtering, then graph node-sync.
  // Order matters: graph-sync is the OUTER extension and reads ids/org from
  // the DB-returned row.
  const client = graphSyncMiddleware(organizationFilterMiddleware(baseClient));

  return client;
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
