/**
 * OSCAL Updater Service
 *
 * Handles OSCAL catalog updates with version detection, control diff calculation,
 * and migration logic for safe framework updates.
 *
 * @see Story 2.7: OSCAL Catalog Update Workflow
 * @module server/services/oscal-updater
 */

import type { PrismaClient, Control } from "@prisma/client";

/**
 * Parsed control from OSCAL catalog
 */
export interface ParsedControl {
  id: string;
  title: string;
  description: string;
  parentId?: string;
}

/**
 * Update detection result
 */
export interface UpdateDetection {
  isUpdate: boolean;
  currentVersion: string;
  newVersion: string;
  currentCode: string;
  newCode: string;
  error?: string;
}

/**
 * Control diff result
 */
export interface ControlDiff {
  added: ParsedControl[];
  removed: Control[];
  modified: Array<{
    existing: Control;
    updated: ParsedControl;
    changes: {
      titleChanged: boolean;
      descriptionChanged: boolean;
    };
  }>;
  unchanged: Control[];
}

/**
 * Migration impact preview
 */
export interface MigrationPreview {
  detection: UpdateDetection;
  controlDiff: ControlDiff;
  affectedEvidenceCount: number;
  affectedRiskCount: number;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Reconciliation report for post-update review
 */
export interface ReconciliationReport {
  frameworkId: string;
  frameworkCode: string;
  oldVersion: string;
  newVersion: string;
  updatedAt: Date;
  updatedBy: string;
  controlsAdded: number;
  controlsDeprecated: number;
  controlsModified: number;
  deprecatedControlsWithEvidence: Array<{
    controlId: string;
    title: string;
    evidenceCount: number;
  }>;
  newControlsRequiringEvidence: Array<{
    controlId: string;
    title: string;
  }>;
  modifiedControls: Array<{
    controlId: string;
    title: string;
    changes: string[];
  }>;
}

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  // Normalize versions - remove leading 'v' if present
  const normalizeVersion = (v: string) => v.replace(/^v/i, "");
  const versionA = normalizeVersion(a);
  const versionB = normalizeVersion(b);

  // Split by dots and compare each segment
  const partsA = versionA.split(".").map((p) => parseInt(p, 10) || 0);
  const partsB = versionB.split(".").map((p) => parseInt(p, 10) || 0);

  // Pad shorter version with zeros
  const maxLength = Math.max(partsA.length, partsB.length);
  while (partsA.length < maxLength) partsA.push(0);
  while (partsB.length < maxLength) partsB.push(0);

  for (let i = 0; i < maxLength; i++) {
    if (partsA[i]! > partsB[i]!) return 1;
    if (partsA[i]! < partsB[i]!) return -1;
  }

  return 0;
}

/**
 * Extract controls from OSCAL catalog structure
 */
function extractControlsFromCatalog(catalog: Record<string, unknown>): ParsedControl[] {
  const controls: ParsedControl[] = [];

  // Navigate to the catalog structure
  const catalogData = (catalog as { catalog?: Record<string, unknown> }).catalog ?? catalog;

  // Extract controls from groups
  const groups = (catalogData as { groups?: Array<Record<string, unknown>> }).groups ?? [];

  function processGroup(group: Record<string, unknown>, parentId?: string) {
    const groupControls = (group.controls as Array<Record<string, unknown>> | undefined) ?? [];

    for (const control of groupControls) {
      const controlId = control.id as string;
      const title = control.title as string;

      // Extract description from parts
      let description = "";
      const parts = (control.parts as Array<Record<string, unknown>> | undefined) ?? [];
      for (const part of parts) {
        if (part.name === "statement" || part.name === "overview") {
          description = (part.prose as string) ?? "";
          break;
        }
      }
      if (!description && parts.length > 0) {
        description = (parts[0]?.prose as string) ?? "";
      }

      controls.push({
        id: controlId,
        title: title ?? controlId,
        description: description ?? "",
        parentId,
      });

      // Process nested controls (enhancements)
      const nestedControls = (control.controls as Array<Record<string, unknown>> | undefined) ?? [];
      for (const nested of nestedControls) {
        const nestedId = nested.id as string;
        const nestedTitle = nested.title as string;

        let nestedDescription = "";
        const nestedParts = (nested.parts as Array<Record<string, unknown>> | undefined) ?? [];
        for (const part of nestedParts) {
          if (part.name === "statement" || part.name === "overview") {
            nestedDescription = (part.prose as string) ?? "";
            break;
          }
        }
        if (!nestedDescription && nestedParts.length > 0) {
          nestedDescription = (nestedParts[0]?.prose as string) ?? "";
        }

        controls.push({
          id: nestedId,
          title: nestedTitle ?? nestedId,
          description: nestedDescription ?? "",
          parentId: controlId,
        });
      }
    }

    // Process nested groups
    const nestedGroups = (group.groups as Array<Record<string, unknown>> | undefined) ?? [];
    for (const nestedGroup of nestedGroups) {
      processGroup(nestedGroup, parentId);
    }
  }

  for (const group of groups) {
    processGroup(group);
  }

  // Also check for top-level controls (not in groups)
  const topControls = (catalogData as { controls?: Array<Record<string, unknown>> }).controls ?? [];
  for (const control of topControls) {
    const controlId = control.id as string;
    const title = control.title as string;

    let description = "";
    const parts = (control.parts as Array<Record<string, unknown>> | undefined) ?? [];
    for (const part of parts) {
      if (part.name === "statement" || part.name === "overview") {
        description = (part.prose as string) ?? "";
        break;
      }
    }
    if (!description && parts.length > 0) {
      description = (parts[0]?.prose as string) ?? "";
    }

    controls.push({
      id: controlId,
      title: title ?? controlId,
      description: description ?? "",
    });
  }

  return controls;
}

/**
 * Extract metadata from OSCAL catalog
 */
function extractCatalogMetadata(catalog: Record<string, unknown>): {
  version: string;
  title: string;
  uuid: string;
} {
  const catalogData = (catalog as { catalog?: Record<string, unknown> }).catalog ?? catalog;
  const metadata = (catalogData as { metadata?: Record<string, unknown> }).metadata ?? {};

  return {
    version: (metadata.version as string) ?? "1.0",
    title: (metadata.title as string) ?? "Unknown",
    uuid: (catalogData as { uuid?: string }).uuid ?? "",
  };
}

/**
 * OSCAL Updater Service
 */
export class OSCALUpdater {
  constructor(private db: PrismaClient) {}

  /**
   * Detect if the new catalog is an update to the current one
   */
  detectUpdate(
    currentCatalog: Record<string, unknown> | null,
    newCatalog: Record<string, unknown>,
    currentCode: string,
    currentVersion: string
  ): UpdateDetection {
    const newMetadata = extractCatalogMetadata(newCatalog);

    // If no current catalog, this is a new import, not an update
    if (!currentCatalog) {
      return {
        isUpdate: false,
        currentVersion: currentVersion,
        newVersion: newMetadata.version,
        currentCode: currentCode,
        newCode: currentCode,
        error: "No existing catalog to update",
      };
    }

    const newVersion = newMetadata.version;

    // Check if new version is actually newer
    const versionComparison = compareVersions(newVersion, currentVersion);

    if (versionComparison < 0) {
      return {
        isUpdate: false,
        currentVersion,
        newVersion,
        currentCode,
        newCode: currentCode,
        error: `Cannot downgrade: new version ${newVersion} is older than current version ${currentVersion}`,
      };
    }

    if (versionComparison === 0) {
      return {
        isUpdate: false,
        currentVersion,
        newVersion,
        currentCode,
        newCode: currentCode,
        error: `Version ${newVersion} is the same as current version`,
      };
    }

    return {
      isUpdate: true,
      currentVersion,
      newVersion,
      currentCode,
      newCode: currentCode,
    };
  }

  /**
   * Calculate the diff between current and new controls
   */
  calculateControlDiff(currentControls: Control[], newCatalog: Record<string, unknown>): ControlDiff {
    const newParsedControls = extractControlsFromCatalog(newCatalog);

    const currentControlMap = new Map(currentControls.map((c) => [c.controlId, c]));
    const newControlMap = new Map(newParsedControls.map((c) => [c.id, c]));

    const added: ParsedControl[] = [];
    const removed: Control[] = [];
    const modified: ControlDiff["modified"] = [];
    const unchanged: Control[] = [];

    // Find added and modified controls
    for (const newControl of newParsedControls) {
      const existing = currentControlMap.get(newControl.id);

      if (!existing) {
        added.push(newControl);
      } else {
        const titleChanged = existing.title !== newControl.title;
        const descriptionChanged = existing.description !== newControl.description;

        if (titleChanged || descriptionChanged) {
          modified.push({
            existing,
            updated: newControl,
            changes: { titleChanged, descriptionChanged },
          });
        } else {
          unchanged.push(existing);
        }
      }
    }

    // Find removed controls
    for (const currentControl of currentControls) {
      if (!newControlMap.has(currentControl.controlId)) {
        removed.push(currentControl);
      }
    }

    return { added, removed, modified, unchanged };
  }

  /**
   * Generate a full migration preview
   */
  async generateMigrationPreview(
    frameworkId: string,
    newCatalog: Record<string, unknown>
  ): Promise<MigrationPreview> {
    // Get current framework with controls
    const framework = await this.db.framework.findUnique({
      where: { id: frameworkId },
      include: {
        Control: {
          where: { isActive: true },
        },
      },
    });

    if (!framework) {
      return {
        detection: {
          isUpdate: false,
          currentVersion: "",
          newVersion: "",
          currentCode: "",
          newCode: "",
          error: "Framework not found",
        },
        controlDiff: { added: [], removed: [], modified: [], unchanged: [] },
        affectedEvidenceCount: 0,
        affectedRiskCount: 0,
        isValid: false,
        validationErrors: ["Framework not found"],
      };
    }

    // Detect update
    const detection = this.detectUpdate(
      framework.oscalCatalog as Record<string, unknown> | null,
      newCatalog,
      framework.code,
      framework.version
    );

    const validationErrors: string[] = [];

    if (detection.error) {
      validationErrors.push(detection.error);
    }

    // Calculate control diff
    const controlDiff = this.calculateControlDiff(framework.Control, newCatalog);

    // Count affected evidence (evidence linked to controls that will be deprecated)
    // Note: Since we don't have direct evidence-control links yet (only via control domains),
    // we count evidence linked to control domains that map to deprecated controls
    let affectedEvidenceCount = 0;
    if (controlDiff.removed.length > 0) {
      const deprecatedControlIds = controlDiff.removed.map((c) => c.controlId);

      // Get control domain mappings for deprecated controls
      const mappings = await this.db.controlDomainMapping.findMany({
        where: {
          frameworkCode: framework.code,
          controlId: { in: deprecatedControlIds },
        },
        select: { controlDomainId: true },
      });

      if (mappings.length > 0) {
        const domainIds = [...new Set(mappings.map((m) => m.controlDomainId))];

        // Count evidence linked to these domains
        affectedEvidenceCount = await this.db.evidenceControlDomain.count({
          where: {
            controlDomainId: { in: domainIds },
            Evidence: {
              organizationId: framework.organizationId,
              isActive: true,
            },
          },
        });
      }
    }

    // TODO: Count affected risks when risk-control linkage is implemented
    const affectedRiskCount = 0;

    return {
      detection,
      controlDiff,
      affectedEvidenceCount,
      affectedRiskCount,
      isValid: detection.isUpdate && validationErrors.length === 0,
      validationErrors,
    };
  }

  /**
   * Generate reconciliation report after update
   */
  async generateReconciliationReport(
    frameworkId: string,
    oldVersion: string,
    newVersion: string,
    controlDiff: ControlDiff,
    updatedBy: string
  ): Promise<ReconciliationReport> {
    const framework = await this.db.framework.findUnique({
      where: { id: frameworkId },
    });

    if (!framework) {
      throw new Error("Framework not found");
    }

    // Get evidence counts for deprecated controls
    const deprecatedControlIds = controlDiff.removed.map((c) => c.controlId);
    const deprecatedWithEvidence: ReconciliationReport["deprecatedControlsWithEvidence"] = [];

    if (deprecatedControlIds.length > 0) {
      // Get control domain mappings for deprecated controls
      const mappings = await this.db.controlDomainMapping.findMany({
        where: {
          frameworkCode: framework.code,
          controlId: { in: deprecatedControlIds },
        },
        select: { controlId: true, controlDomainId: true },
      });

      const controlToDomains = new Map<string, string[]>();
      for (const mapping of mappings) {
        const domains = controlToDomains.get(mapping.controlId) ?? [];
        domains.push(mapping.controlDomainId);
        controlToDomains.set(mapping.controlId, domains);
      }

      for (const control of controlDiff.removed) {
        const domainIds = controlToDomains.get(control.controlId) ?? [];
        let evidenceCount = 0;

        if (domainIds.length > 0) {
          evidenceCount = await this.db.evidenceControlDomain.count({
            where: {
              controlDomainId: { in: domainIds },
              Evidence: {
                organizationId: framework.organizationId,
                isActive: true,
              },
            },
          });
        }

        deprecatedWithEvidence.push({
          controlId: control.controlId,
          title: control.title,
          evidenceCount,
        });
      }
    }

    return {
      frameworkId,
      frameworkCode: framework.code,
      oldVersion,
      newVersion,
      updatedAt: new Date(),
      updatedBy,
      controlsAdded: controlDiff.added.length,
      controlsDeprecated: controlDiff.removed.length,
      controlsModified: controlDiff.modified.length,
      deprecatedControlsWithEvidence: deprecatedWithEvidence.filter((c) => c.evidenceCount > 0),
      newControlsRequiringEvidence: controlDiff.added.map((c) => ({
        controlId: c.id,
        title: c.title,
      })),
      modifiedControls: controlDiff.modified.map((m) => ({
        controlId: m.existing.controlId,
        title: m.updated.title,
        changes: [
          ...(m.changes.titleChanged ? ["Title changed"] : []),
          ...(m.changes.descriptionChanged ? ["Description changed"] : []),
        ],
      })),
    };
  }
}

export { compareVersions, extractControlsFromCatalog, extractCatalogMetadata };
