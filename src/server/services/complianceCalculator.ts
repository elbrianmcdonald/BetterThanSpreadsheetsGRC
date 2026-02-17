/**
 * Compliance Calculator Service
 *
 * Story 5.1: Compliance Summary Dashboard (AC7-AC12)
 *
 * Calculates framework coverage percentages based on evidence mapped to controls.
 * Coverage = (controls with evidence / total controls) × 100
 *
 * A control is considered "satisfied" if at least one piece of evidence
 * is mapped to it via the control domain taxonomy.
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @module server/services/complianceCalculator
 */

import type { PrismaClient } from "@prisma/client";

/**
 * Framework coverage calculation result
 */
export interface FrameworkCoverageResult {
  frameworkId: string;
  organizationId: string;
  coveragePercentage: number;
  satisfiedControlsCount: number;
  totalControlsCount: number;
  lastUpdated: Date;
}

/**
 * Coverage snapshot for trend calculation
 */
export interface CoverageSnapshot {
  frameworkId: string;
  coveragePercentage: number;
  snapshotDate: Date;
}

/**
 * Calculate framework coverage for a specific framework and organization
 *
 * AC7: Coverage percentage = (controls with evidence / total controls in framework) × 100
 * AC8: Control "has evidence" if at least one evidence file mapped to that control
 * AC9: Coverage calculated per active framework for organization
 *
 * Performance: Optimized for frameworks with 100+ controls (AC11)
 *
 * @param frameworkId - The framework to calculate coverage for
 * @param organizationId - The organization to calculate coverage for
 * @param db - Prisma client instance
 * @returns Framework coverage result
 */
export async function calculateFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult> {
  // Get the framework to retrieve its code
  const framework = await db.framework.findUnique({
    where: { id: frameworkId },
    select: { code: true },
  });

  if (!framework) {
    throw new Error(`Framework not found: ${frameworkId}`);
  }

  // Get total control count for this framework
  const totalControlsCount = await db.control.count({
    where: {
      frameworkId,
      isActive: true,
    },
  });

  if (totalControlsCount === 0) {
    return {
      frameworkId,
      organizationId,
      coveragePercentage: 0,
      satisfiedControlsCount: 0,
      totalControlsCount: 0,
      lastUpdated: new Date(),
    };
  }

  // Get all control IDs for this framework
  const controls = await db.control.findMany({
    where: {
      frameworkId,
      isActive: true,
    },
    select: {
      controlId: true,
    },
  });

  const controlIds = controls.map((c) => c.controlId);

  // Get control domain IDs that have active evidence for this organization
  const domainsWithEvidence = await db.evidenceControlDomain.findMany({
    where: {
      Evidence: {
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    },
    select: {
      controlDomainId: true,
    },
    distinct: ["controlDomainId"],
  });

  if (domainsWithEvidence.length === 0) {
    return {
      frameworkId,
      organizationId,
      coveragePercentage: 0,
      satisfiedControlsCount: 0,
      totalControlsCount,
      lastUpdated: new Date(),
    };
  }

  const domainIds = domainsWithEvidence.map((d) => d.controlDomainId);

  // Get control IDs that are mapped to domains with evidence
  const satisfiedMappings = await db.controlDomainMapping.findMany({
    where: {
      frameworkCode: framework.code,
      controlDomainId: { in: domainIds },
    },
    select: {
      controlId: true,
    },
    distinct: ["controlId"],
  });

  const satisfiedControlIdSet = new Set(satisfiedMappings.map((m) => m.controlId));

  // Count how many of our framework's controls are satisfied
  let satisfiedControlsCount = 0;
  for (const controlId of controlIds) {
    if (satisfiedControlIdSet.has(controlId)) {
      satisfiedControlsCount++;
    }
  }

  // Calculate percentage (round to 2 decimal places)
  const coveragePercentage =
    Math.round((satisfiedControlsCount / totalControlsCount) * 10000) / 100;

  return {
    frameworkId,
    organizationId,
    coveragePercentage,
    satisfiedControlsCount,
    totalControlsCount,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate coverage for all active frameworks in an organization
 *
 * @param organizationId - The organization to calculate coverage for
 * @param db - Prisma client instance
 * @returns Array of framework coverage results
 */
export async function calculateAllFrameworkCoverage(
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult[]> {
  // Get all active frameworks for the organization
  const frameworks = await db.framework.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  // Calculate coverage for each framework
  const coverageResults = await Promise.all(
    frameworks.map((framework) =>
      calculateFrameworkCoverage(framework.id, organizationId, db)
    )
  );

  return coverageResults;
}

/**
 * Update cached framework coverage in the database
 *
 * AC12: Coverage stored in database for performance (cached, refreshed on evidence changes)
 *
 * @param frameworkId - The framework to update coverage for
 * @param organizationId - The organization to update coverage for
 * @param db - Prisma client instance
 * @returns The updated cached coverage record
 */
export async function refreshFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult> {
  // Calculate fresh coverage
  const coverage = await calculateFrameworkCoverage(frameworkId, organizationId, db);

  // Update or create cache entry
  // BU-Scoped Compliance: Use null businessUnitId for org-level coverage
  // Note: Prisma doesn't handle null in compound unique keys well, so we use findFirst + update/create
  const existing = await db.frameworkCoverage.findFirst({
    where: {
      frameworkId,
      organizationId,
      businessUnitId: null,
    },
  });

  if (existing) {
    await db.frameworkCoverage.update({
      where: { id: existing.id },
      data: {
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
        lastCalculatedAt: new Date(),
      },
    });
  } else {
    await db.frameworkCoverage.create({
      data: {
        frameworkId,
        organizationId,
        businessUnitId: null,
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
        lastCalculatedAt: new Date(),
      },
    });
  }

  return coverage;
}

/**
 * Refresh coverage for all active frameworks in an organization
 *
 * @param organizationId - The organization to refresh coverage for
 * @param db - Prisma client instance
 * @returns Array of updated coverage records
 */
export async function refreshAllFrameworkCoverage(
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult[]> {
  const frameworks = await db.framework.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const results = await Promise.all(
    frameworks.map((framework) =>
      refreshFrameworkCoverage(framework.id, organizationId, db)
    )
  );

  return results;
}

/**
 * Get cached coverage for a framework
 * Falls back to live calculation if cache miss
 *
 * @param frameworkId - The framework to get coverage for
 * @param organizationId - The organization to get coverage for
 * @param db - Prisma client instance
 * @returns Framework coverage result
 */
export async function getFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult> {
  // Try to get from cache
  // BU-Scoped Compliance: Use null businessUnitId for org-level coverage
  const cached = await db.frameworkCoverage.findFirst({
    where: {
      frameworkId,
      organizationId,
      businessUnitId: null,
    },
  });

  if (cached) {
    return {
      frameworkId: cached.frameworkId,
      organizationId: cached.organizationId,
      coveragePercentage: Number(cached.coveragePercentage),
      satisfiedControlsCount: cached.satisfiedControlsCount,
      totalControlsCount: cached.totalControlsCount,
      lastUpdated: cached.lastCalculatedAt,
    };
  }

  // Cache miss - calculate live and cache for next time
  return refreshFrameworkCoverage(frameworkId, organizationId, db);
}

/**
 * Get cached coverage for all active frameworks
 *
 * @param organizationId - The organization to get coverage for
 * @param db - Prisma client instance
 * @returns Array of framework coverage results
 */
export async function getAllFrameworkCoverage(
  organizationId: string,
  db: PrismaClient
): Promise<FrameworkCoverageResult[]> {
  // Get all active frameworks
  const frameworks = await db.framework.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  // Get coverage for each
  const coverageResults = await Promise.all(
    frameworks.map((framework) =>
      getFrameworkCoverage(framework.id, organizationId, db)
    )
  );

  return coverageResults;
}

/**
 * Calculate overall compliance score (average of all framework coverages)
 *
 * AC18: Overall compliance score = average of all framework coverages
 *
 * @param organizationId - The organization to calculate for
 * @param db - Prisma client instance
 * @returns Overall compliance score (0-100)
 */
export async function calculateOverallComplianceScore(
  organizationId: string,
  db: PrismaClient
): Promise<number> {
  const coverages = await getAllFrameworkCoverage(organizationId, db);

  if (coverages.length === 0) {
    return 0;
  }

  const totalCoverage = coverages.reduce(
    (sum, c) => sum + c.coveragePercentage,
    0
  );

  // Round to 2 decimal places
  return Math.round((totalCoverage / coverages.length) * 100) / 100;
}

/**
 * Trend direction for coverage changes
 */
export type TrendDirection = "up" | "down" | "stable" | "new";

/**
 * Coverage trend result
 */
export interface CoverageTrend {
  frameworkId: string;
  direction: TrendDirection;
  change: number; // Percentage point change (e.g., +5.0 or -2.5)
  previousCoverage: number | null;
  currentCoverage: number;
}

/**
 * Save a daily coverage snapshot for trend tracking
 *
 * AC25: Trend stored in database (historical coverage snapshots)
 *
 * @param frameworkId - The framework to save snapshot for
 * @param organizationId - The organization
 * @param db - Prisma client instance
 */
export async function saveCoverageSnapshot(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<void> {
  const coverage = await getFrameworkCoverage(frameworkId, organizationId, db);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  // BU-Scoped Compliance: Use null businessUnitId for org-level snapshots
  // Note: Prisma doesn't handle null in compound unique keys well, so we use findFirst + update/create
  const existingSnapshot = await db.coverageHistory.findFirst({
    where: {
      frameworkId,
      organizationId,
      businessUnitId: null,
      snapshotDate: today,
    },
  });

  if (existingSnapshot) {
    await db.coverageHistory.update({
      where: { id: existingSnapshot.id },
      data: {
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
      },
    });
  } else {
    await db.coverageHistory.create({
      data: {
        frameworkId,
        organizationId,
        businessUnitId: null,
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
        snapshotDate: today,
      },
    });
  }
}

/**
 * Get coverage trend for a framework
 *
 * AC23-AC27: Coverage trend calculation
 * - ↑ (increased vs 7 days ago)
 * - ↓ (decreased)
 * - → (no change)
 * - "New" badge for first-time frameworks
 *
 * @param frameworkId - The framework to get trend for
 * @param organizationId - The organization
 * @param db - Prisma client instance
 * @returns Coverage trend information
 */
export async function getCoverageTrend(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<CoverageTrend> {
  // Get current coverage
  const currentCoverage = await getFrameworkCoverage(frameworkId, organizationId, db);

  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Get historical snapshot from 7 days ago (or closest before that)
  const historicalSnapshot = await db.coverageHistory.findFirst({
    where: {
      frameworkId,
      organizationId,
      snapshotDate: {
        lte: sevenDaysAgo,
      },
    },
    orderBy: {
      snapshotDate: "desc",
    },
  });

  // If no historical data, this is a new framework
  if (!historicalSnapshot) {
    return {
      frameworkId,
      direction: "new",
      change: 0,
      previousCoverage: null,
      currentCoverage: currentCoverage.coveragePercentage,
    };
  }

  const previousCoverage = Number(historicalSnapshot.coveragePercentage);
  const change = Math.round((currentCoverage.coveragePercentage - previousCoverage) * 100) / 100;

  let direction: TrendDirection;
  if (change > 0.5) {
    direction = "up";
  } else if (change < -0.5) {
    direction = "down";
  } else {
    direction = "stable";
  }

  return {
    frameworkId,
    direction,
    change,
    previousCoverage,
    currentCoverage: currentCoverage.coveragePercentage,
  };
}

/**
 * Get trends for all active frameworks
 *
 * @param organizationId - The organization
 * @param db - Prisma client instance
 * @returns Map of framework ID to trend
 */
export async function getAllCoverageTrends(
  organizationId: string,
  db: PrismaClient
): Promise<Map<string, CoverageTrend>> {
  const frameworks = await db.framework.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  const trends = new Map<string, CoverageTrend>();

  await Promise.all(
    frameworks.map(async (framework) => {
      const trend = await getCoverageTrend(framework.id, organizationId, db);
      trends.set(framework.id, trend);
    })
  );

  return trends;
}

/**
 * Save coverage snapshots for all active frameworks
 * Should be called daily by a background job
 *
 * @param organizationId - The organization
 * @param db - Prisma client instance
 */
export async function saveAllCoverageSnapshots(
  organizationId: string,
  db: PrismaClient
): Promise<void> {
  const frameworks = await db.framework.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  await Promise.all(
    frameworks.map((framework) =>
      saveCoverageSnapshot(framework.id, organizationId, db)
    )
  );
}

// ========================================
// BU-Scoped Compliance Functions
// ========================================

/**
 * BU-Scoped coverage result with optional business unit
 */
export interface BUFrameworkCoverageResult extends FrameworkCoverageResult {
  businessUnitId: string | null;
  businessUnitName?: string;
}

/**
 * Calculate framework coverage for a specific business unit
 *
 * BU-Scoped Compliance: Only counts evidence belonging to the specified BU
 *
 * @param frameworkId - The framework to calculate coverage for
 * @param organizationId - The organization
 * @param businessUnitId - The business unit (or null for org-level)
 * @param db - Prisma client instance
 * @returns BU-specific coverage result
 */
export async function calculateBUFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  businessUnitId: string | null,
  db: PrismaClient
): Promise<BUFrameworkCoverageResult> {
  // Get the framework to retrieve its code
  const framework = await db.framework.findUnique({
    where: { id: frameworkId },
    select: { code: true },
  });

  if (!framework) {
    throw new Error(`Framework not found: ${frameworkId}`);
  }

  // Get total control count for this framework
  const totalControlsCount = await db.control.count({
    where: {
      frameworkId,
      isActive: true,
    },
  });

  if (totalControlsCount === 0) {
    return {
      frameworkId,
      organizationId,
      businessUnitId,
      coveragePercentage: 0,
      satisfiedControlsCount: 0,
      totalControlsCount: 0,
      lastUpdated: new Date(),
    };
  }

  // Get all control IDs for this framework
  const controls = await db.control.findMany({
    where: {
      frameworkId,
      isActive: true,
    },
    select: {
      controlId: true,
    },
  });

  const controlIds = controls.map((c) => c.controlId);

  // Get control domain IDs that have active evidence for this BU
  // BU-Scoped Compliance: Filter by businessUnitId
  const domainsWithEvidence = await db.evidenceControlDomain.findMany({
    where: {
      Evidence: {
        organizationId,
        isActive: true,
        deletedAt: null,
        // Filter by business unit if specified
        ...(businessUnitId !== null ? { businessUnitId } : {}),
      },
    },
    select: {
      controlDomainId: true,
    },
    distinct: ["controlDomainId"],
  });

  if (domainsWithEvidence.length === 0) {
    return {
      frameworkId,
      organizationId,
      businessUnitId,
      coveragePercentage: 0,
      satisfiedControlsCount: 0,
      totalControlsCount,
      lastUpdated: new Date(),
    };
  }

  const domainIds = domainsWithEvidence.map((d) => d.controlDomainId);

  // Get control IDs that are mapped to domains with evidence
  const satisfiedMappings = await db.controlDomainMapping.findMany({
    where: {
      frameworkCode: framework.code,
      controlDomainId: { in: domainIds },
    },
    select: {
      controlId: true,
    },
    distinct: ["controlId"],
  });

  const satisfiedControlIdSet = new Set(satisfiedMappings.map((m) => m.controlId));

  // Count how many of our framework's controls are satisfied
  let satisfiedControlsCount = 0;
  for (const controlId of controlIds) {
    if (satisfiedControlIdSet.has(controlId)) {
      satisfiedControlsCount++;
    }
  }

  // Calculate percentage (round to 2 decimal places)
  const coveragePercentage =
    Math.round((satisfiedControlsCount / totalControlsCount) * 10000) / 100;

  return {
    frameworkId,
    organizationId,
    businessUnitId,
    coveragePercentage,
    satisfiedControlsCount,
    totalControlsCount,
    lastUpdated: new Date(),
  };
}

/**
 * Refresh and cache BU-specific framework coverage
 *
 * @param frameworkId - The framework
 * @param organizationId - The organization
 * @param businessUnitId - The business unit (or null for org-level)
 * @param db - Prisma client instance
 * @returns The updated coverage result
 */
export async function refreshBUFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  businessUnitId: string | null,
  db: PrismaClient
): Promise<BUFrameworkCoverageResult> {
  // Calculate fresh coverage
  const coverage = await calculateBUFrameworkCoverage(
    frameworkId,
    organizationId,
    businessUnitId,
    db
  );

  // Update or create cache entry
  const existing = await db.frameworkCoverage.findFirst({
    where: {
      frameworkId,
      organizationId,
      businessUnitId,
    },
  });

  if (existing) {
    await db.frameworkCoverage.update({
      where: { id: existing.id },
      data: {
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
        lastCalculatedAt: new Date(),
      },
    });
  } else {
    await db.frameworkCoverage.create({
      data: {
        frameworkId,
        organizationId,
        businessUnitId,
        coveragePercentage: coverage.coveragePercentage,
        satisfiedControlsCount: coverage.satisfiedControlsCount,
        totalControlsCount: coverage.totalControlsCount,
        lastCalculatedAt: new Date(),
      },
    });
  }

  return coverage;
}

/**
 * Calculate organization rollup as simple average of BU coverages
 *
 * BU-Scoped Compliance: Only includes BUs that have the framework assigned
 *
 * @param frameworkId - The framework
 * @param organizationId - The organization
 * @param db - Prisma client instance
 * @returns Organization-level coverage (average of assigned BUs)
 */
export async function calculateOrganizationRollup(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<BUFrameworkCoverageResult> {
  // Get all BUs assigned to this framework
  const assignedBUs = await db.businessUnitFramework.findMany({
    where: {
      frameworkId,
      organizationId,
    },
    select: {
      businessUnitId: true,
      businessUnit: { select: { name: true } },
    },
  });

  if (assignedBUs.length === 0) {
    // No BUs assigned - return zero coverage
    const totalControls = await db.control.count({
      where: { frameworkId, isActive: true },
    });

    return {
      frameworkId,
      organizationId,
      businessUnitId: null,
      coveragePercentage: 0,
      satisfiedControlsCount: 0,
      totalControlsCount: totalControls,
      lastUpdated: new Date(),
    };
  }

  // Calculate coverage for each assigned BU
  const coverages = await Promise.all(
    assignedBUs.map((bu) =>
      calculateBUFrameworkCoverage(frameworkId, organizationId, bu.businessUnitId, db)
    )
  );

  // Simple average of all BU coverages
  const totalCoverage = coverages.reduce((sum, c) => sum + c.coveragePercentage, 0);
  const avgCoverage = Math.round((totalCoverage / coverages.length) * 100) / 100;

  // Average satisfied controls (for display purposes)
  const avgSatisfied = Math.round(
    coverages.reduce((sum, c) => sum + c.satisfiedControlsCount, 0) / coverages.length
  );
  const totalControls = coverages[0]?.totalControlsCount ?? 0;

  return {
    frameworkId,
    organizationId,
    businessUnitId: null, // null indicates org-level rollup
    coveragePercentage: avgCoverage,
    satisfiedControlsCount: avgSatisfied,
    totalControlsCount: totalControls,
    lastUpdated: new Date(),
  };
}

/**
 * Get cached BU coverage or calculate if missing
 *
 * @param frameworkId - The framework
 * @param organizationId - The organization
 * @param businessUnitId - The business unit (or null for org-level)
 * @param db - Prisma client instance
 * @returns BU-specific coverage result
 */
export async function getBUFrameworkCoverage(
  frameworkId: string,
  organizationId: string,
  businessUnitId: string | null,
  db: PrismaClient
): Promise<BUFrameworkCoverageResult> {
  // Try to get from cache
  const cached = await db.frameworkCoverage.findFirst({
    where: {
      frameworkId,
      organizationId,
      businessUnitId,
    },
  });

  if (cached) {
    return {
      frameworkId: cached.frameworkId,
      organizationId: cached.organizationId,
      businessUnitId: cached.businessUnitId,
      coveragePercentage: Number(cached.coveragePercentage),
      satisfiedControlsCount: cached.satisfiedControlsCount,
      totalControlsCount: cached.totalControlsCount,
      lastUpdated: cached.lastCalculatedAt,
    };
  }

  // Cache miss - calculate and cache
  return refreshBUFrameworkCoverage(frameworkId, organizationId, businessUnitId, db);
}

/**
 * Get coverage breakdown for all BUs for a framework
 *
 * @param frameworkId - The framework
 * @param organizationId - The organization
 * @param db - Prisma client instance
 * @returns Array of BU coverages plus org rollup
 */
export async function getFrameworkBUCoverageBreakdown(
  frameworkId: string,
  organizationId: string,
  db: PrismaClient
): Promise<{
  orgRollup: BUFrameworkCoverageResult;
  buCoverages: BUFrameworkCoverageResult[];
}> {
  // Get all BUs assigned to this framework
  const assignedBUs = await db.businessUnitFramework.findMany({
    where: {
      frameworkId,
      organizationId,
    },
    select: {
      businessUnitId: true,
      businessUnit: { select: { id: true, name: true } },
    },
  });

  // Get coverage for each BU
  const buCoverages = await Promise.all(
    assignedBUs.map(async (bu) => {
      const coverage = await getBUFrameworkCoverage(
        frameworkId,
        organizationId,
        bu.businessUnitId,
        db
      );
      return {
        ...coverage,
        businessUnitName: bu.businessUnit.name,
      };
    })
  );

  // Get org rollup
  const orgRollup = await calculateOrganizationRollup(frameworkId, organizationId, db);

  return {
    orgRollup,
    buCoverages,
  };
}
