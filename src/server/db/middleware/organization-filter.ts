/**
 * Multi-Tenant Organization Filtering Middleware
 *
 * Provides automatic organization_id filtering on all Prisma database queries
 * to enforce tenant isolation and prevent cross-organizational data leakage.
 *
 * IMPLEMENTATION NOTE: Prisma 6 uses Client Extensions instead of deprecated $use middleware.
 * This implementation uses the $extends API for automatic query filtering.
 *
 * @module organization-filter
 * @see Story 1.9: Multi-Tenant Data Access Middleware
 * @see docs/MULTI_TENANCY.md for usage examples
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions
 */

import type { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

/**
 * AsyncLocalStorage for organization context
 * Allows organization_id to be available throughout async call chain
 * without explicitly passing it through every function
 */
const organizationContext = new AsyncLocalStorage<string>();

/**
 * Set organization context for current async scope
 *
 * This should be called at the beginning of each request in tRPC middleware
 * to establish the organization context for all database queries in that request.
 *
 * @param organizationId - The organization ID to set in context
 *
 * @example
 * ```typescript
 * // In tRPC organizationProcedure middleware:
 * setOrganizationContext(ctx.session.user.organizationId);
 * ```
 */
export function setOrganizationContext(organizationId: string): void {
  organizationContext.enterWith(organizationId);
}

/**
 * Run a function with organization context using AsyncLocalStorage.run()
 *
 * This is the preferred method for setting organization context in tRPC middleware
 * because it properly propagates context through all async operations, including
 * Prisma transactions which create new async contexts.
 *
 * Note: enterWith() can lose context in Prisma $transaction callbacks because
 * transactions may run in a different async context. run() wraps the entire
 * execution and ensures context is maintained.
 *
 * @param organizationId - The organization ID to set in context
 * @param fn - The function to execute with the organization context
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * // In tRPC organizationProcedure middleware:
 * return runWithOrganizationContext(ctx.organizationId, () => next({ ctx }));
 * ```
 */
export function runWithOrganizationContext<T>(
  organizationId: string,
  fn: () => T,
): T {
  return organizationContext.run(organizationId, fn);
}

/**
 * Clear organization context for current async scope
 *
 * This should be called after cleanup operations that delete organizations
 * to ensure the context doesn't point to a non-existent organization.
 *
 * @example
 * ```typescript
 * // After deleting an organization:
 * await db.organization.delete({ where: { id: orgId } });
 * clearOrganizationContext();
 * ```
 */
export function clearOrganizationContext(): void {
  organizationContext.enterWith(undefined as unknown as string);
}

/**
 * Get organization context for current async scope
 *
 * Returns the organization ID that was set via setOrganizationContext,
 * or null if no organization context has been established.
 *
 * @returns The current organization ID, or null if not set
 *
 * @example
 * ```typescript
 * const orgId = getOrganizationContext();
 * if (orgId) {
 *   // Organization context is available
 * }
 * ```
 */
export function getOrganizationContext(): string | null {
  return organizationContext.getStore() ?? null;
}

/**
 * Tables that don't require organization filtering
 *
 * These are system tables or authentication-related tables that either:
 * 1. Don't have an organizationId column (Session, Account, VerificationToken)
 * 2. Are root tenant tables that need special handling (Organization)
 * 3. Require cross-organization queries for system operations (User for profile lookup)
 *
 * @see Task 5: Handle Special Cases
 */
const ALLOWLIST_TABLES = new Set([
  "Session",
  "Account",
  "VerificationToken",
  "Organization", // Special handling - only for org admin operations
  "LoginAttempt", // Authentication tracking - no organizationId
  "PasswordResetToken", // Password reset - no organizationId
  "User", // User lookups needed during authentication before org context
  "ControlDomain", // Global taxonomy table - not organization-specific
  "ControlDomainMapping", // Global mapping table - not organization-specific
  "ControlDomainControl", // Junction table - no organizationId, isolation via Control relation
  "ControlDomainStandardControl", // Junction table - no organizationId, isolation via StandardControl relation
  "ControlDomainMaturityDomain", // Junction table - no organizationId, isolation via MaturityDomain relation
  "EvidenceControlDomain", // Junction table - no organizationId, isolation via Evidence relation
  "EvidenceVersion", // Version table - no organizationId, isolation via Evidence relation
  "RiskEvidence", // Junction table - no organizationId, isolation via Risk/Evidence relations
  "EmailQueue", // Story 4.18: Background worker processes all organizations' emails
  "RiskMatrixVersion", // Version table - no organizationId, isolation via RiskMatrixTemplate relation
  // MITRE ATT&CK tables - global reference data, not organization-specific
  "MitreTactic",
  "MitreTechnique",
  "MitreTacticTechnique",
  "MitreSyncMetadata",
  // Strategy module - Goal/Objective get isolation through Strategy relation, not direct organizationId
  "Goal",
  "Objective",
  "ObjectiveAssignee",
  "Comment", // Story 2.4: Comments get isolation through Goal/Objective relation
  // Story 4.2: History tables get isolation through parent entity relations
  "StrategyHistory",
  "GoalHistory",
  "ObjectiveHistory",
  // Standards module - child tables get isolation through Standard relation, not direct organizationId
  "StandardControl", // Gets isolation through Standard relation
  "StandardControlMapping", // Junction table - isolation via StandardControl and FrameworkControl relations
  "StandardException", // Gets isolation through StandardControl → Standard relation
  "StandardExceptionApproval", // Gets isolation through StandardException → StandardControl → Standard relation
  "ControlMapping", // Junction table - isolation via StandardControl and FrameworkControl relations
  // Maturity Assessment module - needs to query both system templates (organizationId: null) and org-specific
  "MaturityFramework", // Router explicitly handles system templates vs org-specific frameworks
  "MaturityDomain", // Gets isolation through MaturityFramework relation
  "MaturityQuestion", // Gets isolation through MaturityFramework relation, supports both system and org questions
  "MaturityDomainScore", // Gets isolation through MaturityAssessment relation
  "MaturitySnapshot", // Gets isolation through MaturityAssessment relation
  "MaturityQuestionResponse", // Gets isolation through MaturityAssessment relation
  "AssessorAssignment", // Gets isolation through MaturityAssessment relation (verified by caller)
  // Risk threat chain tables — isolation via Risk relation (which has organizationId)
  "RiskThreatStep",
  "RiskThreatObjective",
  // Vendor assessment comments — isolation via VendorAssessment relation
  "VendorAssessmentComment",
  // Questionnaire template tree — isolation via QuestionnaireTemplate
  // (nullable organizationId; system templates have null)
  "QuestionnaireSection",
  "QuestionnaireQuestion",
  "QuestionChoice",
  // Compliance Assessment module - child tables get isolation through parent relations
  "ControlAssessmentScore", // Gets isolation through ComplianceAssessment relation
  // Epic 4: Questionnaire System - child tables get isolation through parent relations
  "AssessmentQuestionnaire", // Gets isolation through VendorAssessment relation (which has organizationId)
  "QuestionnaireResponse", // Gets isolation through AssessmentQuestionnaire → VendorAssessment relation
  "QuestionnaireReminder", // Gets isolation through AssessmentQuestionnaire → VendorAssessment relation
  // Epic 9-11: BIA Module - child tables get isolation through BIAConfiguration or BusinessProcess relations
  "BIAImpactCategory", // Gets isolation through BIAConfiguration relation
  "BIATierDefinition", // Gets isolation through BIAConfiguration relation
  "BIATimePeriod", // Gets isolation through BIAConfiguration relation
  "BIATierCriteria", // Gets isolation through BIAImpactCategory → BIAConfiguration relation
  "BIAImpactScore", // Gets isolation through BusinessProcess relation (which has organizationId)
  "BIATimeImpactScore", // Gets isolation through BusinessProcess relation (which has organizationId)
  "BIAAssessmentRequest", // Gets isolation through BusinessProcess relation (which has organizationId)
  // Epic 12: BIA Dependencies - junction tables get isolation through BusinessProcess relation
  "BusinessProcessDependency", // Gets isolation through upstream/downstream BusinessProcess relations
  "BusinessProcessVendor", // Gets isolation through BusinessProcess relation
  "BusinessProcessRisk", // Gets isolation through BusinessProcess relation
  // Epic 14: Asset Registry - junction table gets isolation through BusinessProcess and Asset relations
  "BusinessProcessAsset", // Gets isolation through BusinessProcess and Asset relations
]);

/**
 * Prisma Client Extension for automatic organization filtering
 *
 * Creates a Prisma Client Extension that intercepts all Prisma queries and automatically:
 * - Injects organizationId filters on read queries
 * - Validates organizationId on write operations
 * - Prevents cross-organizational data access
 *
 * The extension follows these rules:
 * 1. Read queries (findMany, findUnique, etc.) → Add organizationId to WHERE clause
 * 2. Write queries (create, update, delete) → Add/validate organizationId
 * 3. Allowlisted tables → Skip organization filtering
 * 4. Missing organization context → Throw error for protected operations
 *
 * @param prisma - The Prisma Client instance to extend
 * @returns Extended Prisma Client with organization filtering
 *
 * @example
 * ```typescript
 * // In src/server/db.ts:
 * const client = new PrismaClient();
 * const extendedClient = organizationFilterMiddleware(client);
 * export const db = extendedClient;
 * ```
 */
export function organizationFilterMiddleware<T extends PrismaClient>(
  prisma: T,
): T {
  return prisma.$extends({
    query: {
      $allModels: {
        // Intercept all operations on all models
        async $allOperations({ model, operation, args, query }) {
          const orgId = getOrganizationContext();

          // Skip if allowlisted table
          if (ALLOWLIST_TABLES.has(model)) {
            return query(args);
          }

          // Handle read operations
          if (
            operation === "findUnique" ||
            operation === "findFirst" ||
            operation === "findMany" ||
            operation === "count" ||
            operation === "aggregate" ||
            operation === "groupBy"
          ) {
            return handleReadQuery(args, query, orgId);
          }

          // Handle create operations
          if (operation === "create" || operation === "createMany") {
            return handleCreate(args, query, orgId, model);
          }

          // Handle update operations
          if (operation === "update" || operation === "updateMany") {
            return handleUpdate(args, query, orgId, model);
          }

          // Handle delete operations
          if (operation === "delete" || operation === "deleteMany") {
            return handleDelete(args, query, orgId, model);
          }

          // Handle upsert operations
          if (operation === "upsert") {
            return handleUpsert(args, query, orgId, model);
          }

          // All other operations pass through unchanged
          return query(args);
        },
      },
    },
  }) as T;
}

/**
 * Handle read queries - inject organization filter
 *
 * Automatically adds organizationId to the WHERE clause of all read queries
 * to ensure only records belonging to the current organization are returned.
 *
 * @param args - Query arguments
 * @param query - Query execution function
 * @param orgId - Current organization ID from context (or null)
 * @returns Query results filtered by organization
 */
function handleReadQuery(
  args: any,
  query: (args: any) => Promise<any>,
  orgId: string | null,
): Promise<any> {
  // If no organization context, allow query (for system operations)
  // This enables initial setup queries and system admin operations
  if (!orgId) {
    return query(args);
  }

  // Inject organization filter into WHERE clause
  const modifiedArgs = {
    ...args,
    where: {
      ...args.where,
      organizationId: orgId,
    },
  };

  return query(modifiedArgs);
}

/**
 * Handle create operations - add organization_id automatically
 *
 * Automatically injects the organization ID into create operations
 * so developers don't need to manually add it (and can't forget it).
 *
 * @param args - Query arguments
 * @param query - Query execution function
 * @param orgId - Current organization ID from context
 * @param model - Model name
 * @returns Created record with organizationId
 * @throws Error if organization context is missing
 */
function handleCreate(
  args: any,
  query: (args: any) => Promise<any>,
  orgId: string | null,
  model: string,
): Promise<any> {
  if (!orgId) {
    throw new Error(`Organization context required for creating ${model}`);
  }

  // Add organization_id to create data
  const modifiedArgs = {
    ...args,
    data: Array.isArray(args.data)
      ? // Handle createMany - array of records
        args.data.map((record: any) => ({
          ...record,
          organizationId: orgId,
        }))
      : // Handle create - single record
        {
          ...args.data,
          organizationId: orgId,
        },
  };

  return query(modifiedArgs);
}

/**
 * Handle update operations - validate organization ownership
 *
 * Injects organizationId into the WHERE clause to ensure only records
 * belonging to the current organization can be updated.
 *
 * If a record from a different organization is targeted, the update will
 * affect 0 rows (appearing as if the record doesn't exist - NOT_FOUND).
 *
 * @param args - Query arguments
 * @param query - Query execution function
 * @param orgId - Current organization ID from context
 * @param model - Model name
 * @returns Updated record (or null if cross-org attempt)
 * @throws Error if organization context is missing
 */
async function handleUpdate(
  args: any,
  query: (args: any) => Promise<any>,
  orgId: string | null,
  model: string,
): Promise<any> {
  if (!orgId) {
    throw new Error(`Organization context required for updating ${model}`);
  }

  // Inject organization filter to ensure only updating own org's records
  const modifiedArgs = {
    ...args,
    where: {
      ...args.where,
      organizationId: orgId,
    },
  };

  return query(modifiedArgs);
}

/**
 * Handle delete operations - validate organization ownership
 *
 * Injects organizationId into the WHERE clause to ensure only records
 * belonging to the current organization can be deleted.
 *
 * If a record from a different organization is targeted, the delete will
 * affect 0 rows (appearing as if the record doesn't exist - NOT_FOUND).
 *
 * @param args - Query arguments
 * @param query - Query execution function
 * @param orgId - Current organization ID from context
 * @param model - Model name
 * @returns Deleted record (or null if cross-org attempt)
 * @throws Error if organization context is missing
 */
async function handleDelete(
  args: any,
  query: (args: any) => Promise<any>,
  orgId: string | null,
  model: string,
): Promise<any> {
  if (!orgId) {
    throw new Error(`Organization context required for deleting ${model}`);
  }

  // Inject organization filter to ensure only deleting own org's records
  const modifiedArgs = {
    ...args,
    where: {
      ...args.where,
      organizationId: orgId,
    },
  };

  return query(modifiedArgs);
}

/**
 * Handle upsert operations - handle both create and update paths
 *
 * Upsert operations can either create a new record or update an existing one.
 * This function ensures organization ID is:
 * 1. Added to the create data (if creating)
 * 2. Added to the where clause (to ensure only own org's records are updated)
 *
 * @param args - Query arguments
 * @param query - Query execution function
 * @param orgId - Current organization ID from context
 * @param model - Model name
 * @returns Upserted record
 * @throws Error if organization context is missing
 */
function handleUpsert(
  args: any,
  query: (args: any) => Promise<any>,
  orgId: string | null,
  model: string,
): Promise<any> {
  if (!orgId) {
    throw new Error(`Organization context required for upserting ${model}`);
  }

  // Add organization_id to create data and filter where clause
  const modifiedArgs = {
    ...args,
    create: {
      ...args.create,
      organizationId: orgId,
    },
    where: {
      ...args.where,
      organizationId: orgId,
    },
  };

  return query(modifiedArgs);
}
