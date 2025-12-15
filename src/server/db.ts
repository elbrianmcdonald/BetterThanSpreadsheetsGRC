import { env } from "@/env";
import { PrismaClient } from "../../generated/prisma";

/**
 * Multi-tenant models that require automatic organizationId filtering.
 * These models MUST always be filtered by organizationId to prevent cross-tenant data leakage.
 *
 * System models (Organization, Account, Session, VerificationToken) are excluded
 * because they are either root tenant tables or NextAuth system tables.
 *
 * @see docs/MULTI_TENANT_ARCHITECTURE.md for the complete multi-tenancy strategy
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
   * Base Prisma Client
   *
   * Note: Prisma middleware ($use) was deprecated in Prisma 5+.
   * For query logging and validation, use Prisma Client Extensions or
   * implement validation at the tRPC procedure level.
   *
   * IMPORTANT: Multi-tenant data isolation is enforced through:
   * 1. Database foreign key constraints (see prisma/schema.prisma)
   * 2. tRPC organizationProcedure middleware (see src/server/api/trpc.ts)
   * 3. Explicit organizationId filtering in all queries (developer responsibility)
   *
   * Best Practice:
   * - Always use organizationProcedure for multi-tenant data access
   * - Always include { where: { organizationId: ctx.organizationId } } in queries
   * - Database constraints prevent invalid cross-tenant references
   *
   * @see src/server/api/trpc.ts - organizationProcedure enforces organizationId context
   * @see docs/MULTI_TENANT_ARCHITECTURE.md - Complete multi-tenancy strategy
   */
  const client = new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  return client;
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
