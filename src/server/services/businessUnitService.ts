/**
 * Story 7.0.1: Business Unit Hierarchy Service
 *
 * Provides utility functions for working with hierarchical business units:
 * - getBUWithDescendants: Get BU and all child/grandchild IDs (AC16)
 * - getBUAncestors: Get parent chain to root (AC17)
 * - getBUPath: Get formatted path string (AC18)
 * - validateBUHierarchy: Check for circular references (AC19)
 * - getBUDepth: Get depth level in hierarchy (AC20)
 */

import { db } from "@/server/db";
import { TRPCError } from "@trpc/server";

const MAX_HIERARCHY_DEPTH = 5; // AC12: Maximum hierarchy depth

interface BusinessUnitBasic {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * AC16: Get a BU and all its descendant IDs (recursive)
 * Used for queries like "Show all risks for Engineering" including sub-teams
 */
export async function getBUWithDescendants(buId: string): Promise<string[]> {
  const result: string[] = [buId];

  const children = await db.businessUnit.findMany({
    where: { parentId: buId, isActive: true },
    select: { id: true },
  });

  for (const child of children) {
    const descendants = await getBUWithDescendants(child.id);
    result.push(...descendants);
  }

  return result;
}

/**
 * AC17: Get the ancestor chain from a BU to the root
 * Returns array in order from root to immediate parent
 */
export async function getBUAncestors(buId: string): Promise<BusinessUnitBasic[]> {
  const ancestors: BusinessUnitBasic[] = [];
  let currentId: string | null = buId;

  // First, get the starting BU's parent
  const startBU = await db.businessUnit.findUnique({
    where: { id: buId },
    select: { parentId: true },
  });

  if (!startBU) {
    return ancestors;
  }

  currentId = startBU.parentId;

  // Walk up the tree
  while (currentId) {
    const parent = await db.businessUnit.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    });

    if (!parent) break;

    ancestors.unshift(parent); // Add to front for root-first order
    currentId = parent.parentId;
  }

  return ancestors;
}

/**
 * AC18: Get formatted path string for a BU
 * Example: "Engineering > Platform > Backend"
 */
export async function getBUPath(buId: string): Promise<string> {
  const ancestors = await getBUAncestors(buId);
  const bu = await db.businessUnit.findUnique({
    where: { id: buId },
    select: { name: true },
  });

  if (!bu) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Business unit not found",
    });
  }

  const path = [...ancestors.map((a) => a.name), bu.name];
  return path.join(" > ");
}

/**
 * AC19: Validate that setting newParentId won't create a circular reference
 * Returns true if valid, false if circular reference would be created
 *
 * Rules:
 * - A BU cannot be its own parent
 * - A BU cannot have any of its descendants as its parent
 */
export async function validateBUHierarchy(
  buId: string,
  newParentId: string | null
): Promise<boolean> {
  // Root assignment is always valid
  if (!newParentId) return true;

  // Cannot be own parent
  if (buId === newParentId) return false;

  // Check if newParentId is a descendant of buId
  const descendants = await getBUWithDescendants(buId);
  return !descendants.includes(newParentId);
}

/**
 * AC20: Get the depth level of a BU in the hierarchy
 * Root BUs have depth 0
 */
export async function getBUDepth(buId: string): Promise<number> {
  const ancestors = await getBUAncestors(buId);
  return ancestors.length;
}

/**
 * AC12: Validate that the new depth won't exceed MAX_HIERARCHY_DEPTH
 * Called when creating or moving a BU
 */
export async function validateBUDepth(
  parentId: string | null,
  buId?: string
): Promise<{ valid: boolean; currentDepth: number; maxDepth: number }> {
  let parentDepth = 0;

  if (parentId) {
    parentDepth = await getBUDepth(parentId);
  }

  // New BU would be at parentDepth + 1
  const newDepth = parentDepth + 1;

  // If updating an existing BU, we need to check its subtree depth
  let subtreeDepth = 0;
  if (buId) {
    subtreeDepth = await getMaxSubtreeDepth(buId);
  }

  const totalDepth = newDepth + subtreeDepth;

  return {
    valid: totalDepth <= MAX_HIERARCHY_DEPTH,
    currentDepth: totalDepth,
    maxDepth: MAX_HIERARCHY_DEPTH,
  };
}

/**
 * Helper: Get the maximum depth of the subtree under a BU
 * Used to ensure moving a BU with children doesn't exceed max depth
 */
async function getMaxSubtreeDepth(buId: string): Promise<number> {
  const children = await db.businessUnit.findMany({
    where: { parentId: buId, isActive: true },
    select: { id: true },
  });

  if (children.length === 0) {
    return 0;
  }

  let maxChildDepth = 0;
  for (const child of children) {
    const childDepth = await getMaxSubtreeDepth(child.id);
    maxChildDepth = Math.max(maxChildDepth, childDepth + 1);
  }

  return maxChildDepth;
}

/**
 * AC14: Validate that the parent BU is in the same organization
 * Returns the parent BU if valid, throws if invalid
 */
export async function validateParentOrganization(
  parentId: string,
  organizationId: string
): Promise<void> {
  const parent = await db.businessUnit.findUnique({
    where: { id: parentId },
    select: { organizationId: true, name: true },
  });

  if (!parent) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Parent business unit not found",
    });
  }

  if (parent.organizationId !== organizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Parent business unit must be in the same organization",
    });
  }
}

/**
 * Combined validation for creating/updating a BU
 * Validates: depth limit, circular references, organization match
 */
export async function validateBUOperation(options: {
  buId?: string; // undefined for create, id for update
  parentId: string | null;
  organizationId: string;
}): Promise<void> {
  const { buId, parentId, organizationId } = options;

  // AC14: Parent must be in same org
  if (parentId) {
    await validateParentOrganization(parentId, organizationId);
  }

  // AC13: No circular references (only for updates)
  if (buId && parentId) {
    const isValid = await validateBUHierarchy(buId, parentId);
    if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot set parent: would create circular reference",
      });
    }
  }

  // AC12: Depth limit check
  const depthCheck = await validateBUDepth(parentId, buId);
  if (!depthCheck.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Maximum hierarchy depth of ${depthCheck.maxDepth} levels exceeded. Current depth would be ${depthCheck.currentDepth}.`,
    });
  }
}

// ============================================================================
// Story 7.0.2: User-BusinessUnit Relationship Functions
// ============================================================================

/**
 * AC5: Validate that a user can be assigned to a business unit
 * The BU must be in the same organization as the user
 */
export async function validateUserBUAssignment(
  userId: string,
  buId: string
): Promise<{ valid: boolean; reason?: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user) {
    return { valid: false, reason: "User not found" };
  }

  const bu = await db.businessUnit.findUnique({
    where: { id: buId },
    select: { organizationId: true, isActive: true },
  });

  if (!bu) {
    return { valid: false, reason: "Business unit not found" };
  }

  if (!bu.isActive) {
    return { valid: false, reason: "Business unit is not active" };
  }

  if (user.organizationId !== bu.organizationId) {
    return {
      valid: false,
      reason: "Business unit must be in the same organization as user",
    };
  }

  return { valid: true };
}

/**
 * AC6: Get users by business unit ID
 * Returns users directly assigned to this BU
 */
export async function getUsersByBusinessUnit(buId: string, organizationId: string) {
  return db.user.findMany({
    where: {
      organizationId,
      businessUnitId: buId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessUnit: {
        select: { id: true, name: true, parentId: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * AC7: Get users by BU including all descendants
 * Used for queries like "Get all users in Engineering (including Platform, Backend, etc.)"
 */
export async function getUsersByBUWithDescendants(buId: string, organizationId: string) {
  const buIds = await getBUWithDescendants(buId);

  return db.user.findMany({
    where: {
      organizationId,
      businessUnitId: { in: buIds },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      businessUnit: {
        select: { id: true, name: true, parentId: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * AC10-AC12: Check if a business unit can be deleted
 * Returns false if users are assigned or children exist
 */
export async function canDeleteBusinessUnit(buId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  userCount?: number;
  childCount?: number;
}> {
  // Check for assigned users
  const userCount = await db.user.count({
    where: { businessUnitId: buId },
  });

  if (userCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete Business Unit with ${userCount} assigned user(s)`,
      userCount,
    };
  }

  // Check for active children
  const childCount = await db.businessUnit.count({
    where: { parentId: buId, isActive: true },
  });

  if (childCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete Business Unit with ${childCount} child unit(s)`,
      childCount,
    };
  }

  return { canDelete: true };
}

/**
 * Assign a user to a business unit with validation
 * Throws TRPCError if validation fails
 */
export async function assignUserToBusinessUnit(
  userId: string,
  buId: string | null
): Promise<void> {
  // Null means unassign from BU
  if (buId === null) {
    await db.user.update({
      where: { id: userId },
      data: { businessUnitId: null },
    });
    return;
  }

  // Validate the assignment
  const validation = await validateUserBUAssignment(userId, buId);
  if (!validation.valid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.reason ?? "Invalid business unit assignment",
    });
  }

  await db.user.update({
    where: { id: userId },
    data: { businessUnitId: buId },
  });
}
