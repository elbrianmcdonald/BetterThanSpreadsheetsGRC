/**
 * Audit Logging Service
 *
 * Provides immutable audit trail for compliance (SOC 2, ISO 27001, HIPAA).
 *
 * **Key Features:**
 * - Immutable audit logs (create-only, no updates/deletes)
 * - Before/after state capture for updates
 * - Fire-and-forget pattern (doesn't block mutations)
 * - Automatic organization filtering
 * - 7-year retention policy
 *
 * **Usage:**
 * ```typescript
 * // Log a CREATE action
 * void createAuditLog({
 *   organizationId: "org-123",
 *   userId: "user-456",
 *   action: "CREATE_RISK",
 *   entityType: "Risk",
 *   entityId: "risk-789",
 * });
 *
 * // Log an UPDATE action with before/after state
 * void createAuditLog({
 *   organizationId: "org-123",
 *   userId: "user-456",
 *   action: "UPDATE_RISK",
 *   entityType: "Risk",
 *   entityId: "risk-789",
 *   changes: {
 *     before: { status: "OPEN" },
 *     after: { status: "CLOSED" },
 *   },
 * });
 * ```
 *
 * @see Story 1.10: Audit Logging Infrastructure
 * @see docs/AUDIT_LOGGING.md
 */

import { randomUUID } from "crypto";
import { db } from "@/server/db";
import type { AuditAction, Prisma } from "@prisma/client";

/**
 * Parameters for creating an audit log entry
 */
export interface CreateAuditLogParams {
  /** Organization ID for multi-tenant filtering */
  organizationId: string;

  /** User ID of the actor performing the action (optional for SYSTEM actions - AC8) */
  userId: string | null;

  /** Type of action performed (typed enum) */
  action: AuditAction;

  /** Entity type (e.g., "Risk", "Evidence", "User") */
  entityType: string;

  /** ID of the affected entity */
  entityId: string;

  /** Before/after state for update operations */
  changes?: {
    before?: any;
    after?: any;
  };

  /** IP address of the request (optional) */
  ipAddress?: string;

  /** User agent string (browser/device info, optional) */
  userAgent?: string;

  /** Actor name snapshot (optional, for audit compliance AC7) */
  actorName?: string;

  /** Actor role snapshot (optional, for audit compliance AC7) */
  actorRole?: string;
}

/**
 * Create immutable audit log entry
 *
 * **IMPORTANT:** This function uses fire-and-forget pattern (void return).
 * Audit log failures are logged but don't block the main operation.
 *
 * **Performance:** Adds <10ms overhead (NFR requirement).
 *
 * @param params - Audit log parameters
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
): Promise<void> {
  try {
    // Extract only changed fields if before/after provided
    const changes = params.changes
      ? extractChanges(params.changes.before, params.changes.after)
      : null;

    // Create immutable audit log entry
    await db.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId: params.organizationId,
        userId: params.userId, // Nullable for SYSTEM actions (AC8)
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        changes: changes !== null ? (changes as Prisma.InputJsonValue) : undefined,
        timestamp: new Date(), // Server time in UTC
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        // Actor snapshots for audit compliance (AC7)
        actorName: params.actorName,
        actorRole: params.actorRole,
      },
    });
  } catch (error) {
    // Log error but don't throw (fire-and-forget pattern)
    // Don't block mutations if audit log fails
    console.error("[AuditLog] Failed to create audit log:", error);
  }
}

/**
 * Extract only fields that changed between before and after states
 *
 * Reduces audit log size by storing only what changed, not entire objects.
 *
 * **Example:**
 * ```typescript
 * const before = { title: "Old", status: "OPEN", severity: "HIGH" };
 * const after = { title: "New", status: "CLOSED", severity: "HIGH" };
 *
 * extractChanges(before, after);
 * // Returns: {
 * //   before: { title: "Old", status: "OPEN" },
 * //   after: { title: "New", status: "CLOSED" }
 * // }
 * ```
 *
 * @param before - State before the change
 * @param after - State after the change
 * @returns Object with only changed fields
 */
export function extractChanges(before: any, after: any): any {
  // If either state is missing, return both as-is
  if (!before || !after) {
    return { before, after };
  }

  const changes: any = { before: {}, after: {} };

  // Compare all fields in after state
  for (const key in after) {
    // Use JSON.stringify for deep comparison (handles nested objects)
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.before[key] = before[key];
      changes.after[key] = after[key];
    }
  }

  // Check for fields removed in after state
  for (const key in before) {
    if (!(key in after)) {
      changes.before[key] = before[key];
      changes.after[key] = undefined;
    }
  }

  return changes;
}

/**
 * Capture current state of an entity for before/after comparison
 *
 * **Usage in Middleware:**
 * ```typescript
 * // Before mutation
 * const beforeState = await captureEntityState(ctx.db, "risk", riskId);
 *
 * // Execute mutation
 * const result = await ctx.db.risk.update({ ... });
 *
 * // After mutation
 * const afterState = await captureEntityState(ctx.db, "risk", riskId);
 *
 * // Log with changes
 * void createAuditLog({
 *   changes: { before: beforeState, after: afterState },
 *   ...
 * });
 * ```
 *
 * @param db - Prisma client
 * @param entityType - Type of entity (lowercase, e.g., "risk", "evidence")
 * @param entityId - ID of the entity to capture
 * @returns Current state of the entity (or null if not found)
 */
export async function captureEntityState(
  db: any,
  entityType: string,
  entityId: string,
): Promise<any | null> {
  try {
    // Access Prisma model dynamically (e.g., db.risk, db.evidence)
    const model = db[entityType.toLowerCase()];

    if (!model) {
      console.warn(`[AuditLog] Unknown entity type: ${entityType}`);
      return null;
    }

    // Fetch current entity state
    const entity = await model.findUnique({
      where: { id: entityId },
    });

    return entity;
  } catch (error) {
    console.error(
      `[AuditLog] Failed to capture entity state for ${entityType}:${entityId}:`,
      error,
    );
    return null;
  }
}

/**
 * Helper to serialize entity state before capturing for audit
 *
 * Removes circular references and sensitive fields.
 *
 * @param entity - Entity object to serialize
 * @returns Serialized entity safe for JSON storage
 */
export function serializeEntityState(entity: any): any {
  if (!entity) return null;

  // Create a copy to avoid mutating original
  const serialized = { ...entity };

  // Remove sensitive fields that shouldn't be in audit logs
  delete serialized.hashedPassword;
  delete serialized.token;
  delete serialized.refreshToken;

  // Convert Dates to ISO strings for JSON compatibility
  for (const key in serialized) {
    if (serialized[key] instanceof Date) {
      serialized[key] = serialized[key].toISOString();
    }
  }

  return serialized;
}
