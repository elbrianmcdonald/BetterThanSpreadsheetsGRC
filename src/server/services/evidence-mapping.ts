/**
 * Evidence Mapping Service - OSCAL Translation Engine Integration
 *
 * Calculates framework control mappings for evidence based on control domain tags.
 * This is the "Evidence Amplification" engine that shows how one piece of evidence
 * satisfies controls across ISO 27001, SOC 2, and NIST CSF frameworks.
 *
 * @see Story 3.4: Automatic OSCAL Mapping Display
 * @see Story 2.4: OSCAL Translation Engine
 * @module server/services/evidence-mapping
 */

import { db } from "@/server/db";

/**
 * Represents a single framework control that evidence satisfies
 */
export interface MappedControl {
  /** Control ID from the framework (e.g., "A.9.1.1", "CC6.1", "PR.AC-1") */
  controlId: string;
  /** Control title */
  title: string;
  /** Control description */
  description: string;
  /** Optional guidance text */
  guidance?: string | null;
  /** Confidence score of the mapping (0-100) */
  confidence: number;
}

/**
 * Represents a framework with its matched controls
 */
export interface FrameworkMapping {
  /** Framework database ID */
  frameworkId: string;
  /** Framework code (e.g., "ISO27001", "SOC2", "NISTCSF") */
  frameworkCode: string;
  /** Framework display name */
  frameworkName: string;
  /** Framework version */
  frameworkVersion: string;
  /** List of controls that evidence satisfies */
  controls: MappedControl[];
  /** Total count of controls in this framework */
  controlCount: number;
}

/**
 * Complete framework mapping result
 */
export interface FrameworkMappingResult {
  /** List of frameworks with their matched controls */
  frameworks: FrameworkMapping[];
  /** Total control count across all frameworks */
  totalControlCount: number;
  /** Count of frameworks with at least one control */
  frameworkCount: number;
}

/**
 * Evidence Mapping Service
 *
 * Provides methods to calculate which framework controls are satisfied
 * when evidence is tagged with control domains.
 */
export const evidenceMappingService = {
  /**
   * Calculate framework mappings for given control domain IDs
   *
   * This is the core "evidence amplification" calculation that shows
   * how tagging evidence with simplified control domains maps to
   * specific framework controls across ISO 27001, SOC 2, and NIST CSF.
   *
   * Performance target: < 500ms for 5 control domains (AC21)
   *
   * @param params - Parameters for mapping calculation
   * @param params.controlDomainIds - Array of control domain IDs
   * @param params.organizationId - Organization ID for framework filtering
   * @returns Framework mappings grouped by framework
   */
  async calculateFrameworkMappings(params: {
    controlDomainIds: string[];
    organizationId: string;
  }): Promise<FrameworkMappingResult> {
    const { controlDomainIds, organizationId } = params;

    // If no control domains, return empty result
    if (!controlDomainIds || controlDomainIds.length === 0) {
      return {
        frameworks: [],
        totalControlCount: 0,
        frameworkCount: 0,
      };
    }

    // Step 1: Get all control domain mappings for the given domains
    // This gives us frameworkCode + controlId pairs
    const domainMappings = await db.controlDomainMapping.findMany({
      where: {
        controlDomainId: { in: controlDomainIds },
      },
      select: {
        frameworkCode: true,
        controlId: true,
        confidence: true,
      },
    });

    if (domainMappings.length === 0) {
      return {
        frameworks: [],
        totalControlCount: 0,
        frameworkCount: 0,
      };
    }

    // Step 2: Get unique frameworkCode + controlId combinations
    // Use a Map to deduplicate and keep highest confidence
    const controlMap = new Map<string, { frameworkCode: string; controlId: string; confidence: number }>();
    for (const mapping of domainMappings) {
      const key = `${mapping.frameworkCode}:${mapping.controlId}`;
      const existing = controlMap.get(key);
      if (!existing || mapping.confidence > existing.confidence) {
        controlMap.set(key, mapping);
      }
    }

    // Step 3: Get active frameworks for the organization
    const frameworks = await db.framework.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        version: true,
      },
    });

    if (frameworks.length === 0) {
      return {
        frameworks: [],
        totalControlCount: 0,
        frameworkCount: 0,
      };
    }

    // Create a map of framework code to framework info
    const frameworkMap = new Map(frameworks.map((f) => [f.code, f]));

    // Step 4: Get the actual Control records for matched controls
    // Group control IDs by framework code for efficient querying
    const controlIdsByFramework = new Map<string, string[]>();
    for (const mapping of controlMap.values()) {
      if (frameworkMap.has(mapping.frameworkCode)) {
        const existing = controlIdsByFramework.get(mapping.frameworkCode) ?? [];
        existing.push(mapping.controlId);
        controlIdsByFramework.set(mapping.frameworkCode, existing);
      }
    }

    // Fetch all controls in one query per framework (avoid N+1)
    const frameworkMappings: FrameworkMapping[] = [];
    let totalControlCount = 0;

    for (const [frameworkCode, controlIds] of controlIdsByFramework.entries()) {
      const framework = frameworkMap.get(frameworkCode);
      if (!framework) continue;

      // Find controls for this framework
      const controls = await db.control.findMany({
        where: {
          frameworkId: framework.id,
          controlId: { in: controlIds },
          isActive: true,
        },
        select: {
          controlId: true,
          title: true,
          description: true,
          guidance: true,
        },
        orderBy: { controlId: "asc" },
      });

      if (controls.length === 0) continue;

      // Map controls with confidence scores
      const mappedControls: MappedControl[] = controls.map((control) => {
        const key = `${frameworkCode}:${control.controlId}`;
        const mapping = controlMap.get(key);
        return {
          controlId: control.controlId,
          title: control.title,
          description: control.description,
          guidance: control.guidance,
          confidence: mapping?.confidence ?? 100,
        };
      });

      frameworkMappings.push({
        frameworkId: framework.id,
        frameworkCode: framework.code,
        frameworkName: framework.name,
        frameworkVersion: framework.version,
        controls: mappedControls,
        controlCount: mappedControls.length,
      });

      totalControlCount += mappedControls.length;
    }

    // Sort frameworks alphabetically by name
    frameworkMappings.sort((a, b) => a.frameworkName.localeCompare(b.frameworkName));

    return {
      frameworks: frameworkMappings,
      totalControlCount,
      frameworkCount: frameworkMappings.length,
    };
  },

  /**
   * Calculate framework mappings for a specific evidence record
   *
   * Convenience method that fetches evidence control domains and calculates mappings.
   *
   * @param params - Parameters
   * @param params.evidenceId - Evidence ID
   * @param params.organizationId - Organization ID
   * @returns Framework mappings or null if evidence not found
   */
  async calculateMappingsForEvidence(params: {
    evidenceId: string;
    organizationId: string;
  }): Promise<FrameworkMappingResult | null> {
    const { evidenceId, organizationId } = params;

    // Get evidence with control domains
    const evidence = await db.evidence.findUnique({
      where: {
        id: evidenceId,
        organizationId,
      },
      select: {
        EvidenceControlDomain: {
          select: {
            controlDomainId: true,
          },
        },
      },
    });

    if (!evidence) {
      return null;
    }

    const controlDomainIds = evidence.EvidenceControlDomain.map((cd) => cd.controlDomainId);

    return this.calculateFrameworkMappings({
      controlDomainIds,
      organizationId,
    });
  },

  /**
   * Get total control count for evidence
   *
   * Lighter-weight query for listing pages where only counts are needed.
   *
   * @param params - Parameters
   * @param params.controlDomainIds - Control domain IDs
   * @param params.organizationId - Organization ID
   * @returns Total control count across all active frameworks
   */
  async getControlCount(params: {
    controlDomainIds: string[];
    organizationId: string;
  }): Promise<number> {
    const { controlDomainIds, organizationId } = params;

    if (!controlDomainIds || controlDomainIds.length === 0) {
      return 0;
    }

    // Get domain mappings
    const domainMappings = await db.controlDomainMapping.findMany({
      where: {
        controlDomainId: { in: controlDomainIds },
      },
      select: {
        frameworkCode: true,
        controlId: true,
      },
    });

    if (domainMappings.length === 0) {
      return 0;
    }

    // Get unique control IDs per framework
    const controlsByFramework = new Map<string, Set<string>>();
    for (const mapping of domainMappings) {
      const existing = controlsByFramework.get(mapping.frameworkCode) ?? new Set();
      existing.add(mapping.controlId);
      controlsByFramework.set(mapping.frameworkCode, existing);
    }

    // Get active frameworks
    const activeFrameworks = await db.framework.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });

    const activeFrameworkCodes = new Set(activeFrameworks.map((f) => f.code));
    const frameworkIdMap = new Map(activeFrameworks.map((f) => [f.code, f.id]));

    // Count only controls from active frameworks
    let totalCount = 0;
    for (const [frameworkCode, controlIds] of controlsByFramework.entries()) {
      if (!activeFrameworkCodes.has(frameworkCode)) continue;

      const frameworkId = frameworkIdMap.get(frameworkCode);
      if (!frameworkId) continue;

      // Count active controls
      const count = await db.control.count({
        where: {
          frameworkId,
          controlId: { in: Array.from(controlIds) },
          isActive: true,
        },
      });

      totalCount += count;
    }

    return totalCount;
  },
};
