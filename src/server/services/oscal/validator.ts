/**
 * OSCAL Validation Service
 *
 * Validates OSCAL catalogs for structural integrity, required fields,
 * and semantic correctness before import.
 *
 * @see Story 2.1: OSCAL Catalog Import Pipeline (AC-8 through AC-15)
 * @module server/services/oscal/validator
 */

import type {
  OscalCatalog,
  OscalControl,
  OscalGroup,
  OscalValidationIssue,
  ParsedOscalCatalog,
} from "@/types/oscal";

/**
 * Validation severity levels
 */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * Validation error codes with descriptions
 */
export const VALIDATION_CODES = {
  // Parse errors
  INVALID_JSON: "Invalid JSON syntax",
  INVALID_YAML: "Invalid YAML syntax",
  PARSE_ERROR: "Failed to parse OSCAL content",

  // Structure errors
  MISSING_CATALOG: 'Missing "catalog" root element',
  MISSING_UUID: "Catalog is missing UUID identifier",
  INVALID_UUID: "Invalid UUID format",
  MISSING_METADATA: "Catalog is missing metadata section",
  MISSING_TITLE: "Catalog metadata is missing title",

  // Control errors
  NO_CONTROLS: "Catalog contains no controls",
  MISSING_CONTROL_ID: "Control is missing ID",
  DUPLICATE_CONTROL_ID: "Duplicate control ID found",
  MISSING_CONTROL_TITLE: "Control is missing title",
  INVALID_CONTROL_ID_FORMAT: "Control ID format is invalid",
  ORPHANED_PARENT_REF: "Control references non-existent parent",

  // Group errors
  MISSING_GROUP_ID: "Group is missing ID",
  DUPLICATE_GROUP_ID: "Duplicate group ID found",
  MISSING_GROUP_TITLE: "Group is missing title",

  // Content warnings
  EMPTY_DESCRIPTION: "Control has no description",
  LONG_TITLE: "Title exceeds recommended length",
  SPECIAL_CHARACTERS: "Field contains unusual characters",

  // Version warnings
  OSCAL_VERSION_MISSING: "OSCAL version not specified",
  OSCAL_VERSION_OLD: "OSCAL version may be outdated",
  OSCAL_VERSION_UNSUPPORTED: "OSCAL version not fully supported",
} as const;

export type ValidationCode = keyof typeof VALIDATION_CODES;

/**
 * Maximum recommended lengths for fields
 */
const MAX_LENGTHS = {
  title: 500,
  controlId: 50,
  groupId: 50,
  description: 50000,
};

/**
 * UUID validation regex (RFC 4122)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Supported OSCAL versions
 */
const SUPPORTED_OSCAL_VERSIONS = ["1.0.0", "1.0.4", "1.0.6", "1.1.0", "1.1.1", "1.1.2"];

/**
 * Validate UUID format
 *
 * @param uuid - UUID string to validate
 * @returns True if valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Validate OSCAL catalog structure
 *
 * Performs comprehensive validation of an OSCAL catalog including:
 * - Required fields
 * - UUID format
 * - Control structure
 * - Group structure
 * - Content quality checks
 *
 * @param catalog - Parsed OSCAL catalog
 * @returns Array of validation issues
 */
export function validateOscalCatalog(
  catalog: OscalCatalog,
): OscalValidationIssue[] {
  const issues: OscalValidationIssue[] = [];
  const controlIds = new Set<string>();
  const groupIds = new Set<string>();

  // Validate catalog root
  validateCatalogRoot(catalog, issues);

  // Validate metadata
  validateMetadata(catalog, issues);

  // Validate groups
  if (catalog.groups) {
    validateGroups(catalog.groups, issues, groupIds, controlIds);
  }

  // Validate top-level controls
  if (catalog.controls) {
    validateControls(catalog.controls, issues, controlIds);
  }

  // Check for empty catalog
  if (!catalog.controls?.length && !catalog.groups?.length) {
    issues.push({
      severity: "error",
      code: "NO_CONTROLS",
      message: VALIDATION_CODES.NO_CONTROLS,
    });
  }

  return issues;
}

/**
 * Validate catalog root structure
 */
function validateCatalogRoot(
  catalog: OscalCatalog,
  issues: OscalValidationIssue[],
): void {
  // Check UUID
  if (!catalog.uuid) {
    issues.push({
      severity: "warning",
      code: "MISSING_UUID",
      message: VALIDATION_CODES.MISSING_UUID,
    });
  } else if (!isValidUUID(catalog.uuid)) {
    issues.push({
      severity: "warning",
      code: "INVALID_UUID",
      message: `${VALIDATION_CODES.INVALID_UUID}: ${catalog.uuid}`,
    });
  }
}

/**
 * Validate catalog metadata
 */
function validateMetadata(
  catalog: OscalCatalog,
  issues: OscalValidationIssue[],
): void {
  const { metadata } = catalog;

  if (!metadata) {
    issues.push({
      severity: "error",
      code: "MISSING_METADATA",
      message: VALIDATION_CODES.MISSING_METADATA,
    });
    return;
  }

  // Title is required
  if (!metadata.title) {
    issues.push({
      severity: "error",
      code: "MISSING_TITLE",
      message: VALIDATION_CODES.MISSING_TITLE,
    });
  } else if (metadata.title.length > MAX_LENGTHS.title) {
    issues.push({
      severity: "warning",
      code: "LONG_TITLE",
      message: `${VALIDATION_CODES.LONG_TITLE} (${metadata.title.length} > ${MAX_LENGTHS.title})`,
    });
  }

  // OSCAL version check
  if (!metadata["oscal-version"]) {
    issues.push({
      severity: "info",
      code: "OSCAL_VERSION_MISSING",
      message: VALIDATION_CODES.OSCAL_VERSION_MISSING,
    });
  } else {
    const version = metadata["oscal-version"];
    if (!SUPPORTED_OSCAL_VERSIONS.some((v) => version.startsWith(v))) {
      issues.push({
        severity: "warning",
        code: "OSCAL_VERSION_UNSUPPORTED",
        message: `${VALIDATION_CODES.OSCAL_VERSION_UNSUPPORTED}: ${version}`,
      });
    }
  }
}

/**
 * Validate groups recursively
 */
function validateGroups(
  groups: OscalGroup[],
  issues: OscalValidationIssue[],
  groupIds: Set<string>,
  controlIds: Set<string>,
): void {
  for (const group of groups) {
    // Check group ID
    if (!group.id) {
      issues.push({
        severity: "warning",
        code: "MISSING_GROUP_ID",
        message: `${VALIDATION_CODES.MISSING_GROUP_ID}: "${group.title}"`,
      });
    } else {
      if (groupIds.has(group.id)) {
        issues.push({
          severity: "warning",
          code: "DUPLICATE_GROUP_ID",
          message: `${VALIDATION_CODES.DUPLICATE_GROUP_ID}: ${group.id}`,
        });
      }
      groupIds.add(group.id);

      if (group.id.length > MAX_LENGTHS.groupId) {
        issues.push({
          severity: "warning",
          code: "LONG_TITLE",
          message: `Group ID exceeds recommended length: ${group.id}`,
        });
      }
    }

    // Check group title
    if (!group.title) {
      issues.push({
        severity: "warning",
        code: "MISSING_GROUP_TITLE",
        message: `${VALIDATION_CODES.MISSING_GROUP_TITLE}: ${group.id}`,
      });
    }

    // Validate nested groups
    if (group.groups) {
      validateGroups(group.groups, issues, groupIds, controlIds);
    }

    // Validate controls in this group
    if (group.controls) {
      validateControls(group.controls, issues, controlIds, group.id);
    }
  }
}

/**
 * Validate controls recursively
 */
function validateControls(
  controls: OscalControl[],
  issues: OscalValidationIssue[],
  controlIds: Set<string>,
  parentPath?: string,
): void {
  for (const control of controls) {
    const path = parentPath ? `${parentPath}/${control.id}` : control.id;

    // Check control ID
    if (!control.id) {
      issues.push({
        severity: "error",
        code: "MISSING_CONTROL_ID",
        message: `${VALIDATION_CODES.MISSING_CONTROL_ID} in ${parentPath ?? "root"}`,
        path,
      });
    } else {
      // Check for duplicates
      if (controlIds.has(control.id)) {
        issues.push({
          severity: "warning",
          code: "DUPLICATE_CONTROL_ID",
          message: `${VALIDATION_CODES.DUPLICATE_CONTROL_ID}: ${control.id}`,
          controlId: control.id,
          path,
        });
      }
      controlIds.add(control.id);

      // Check ID length
      if (control.id.length > MAX_LENGTHS.controlId) {
        issues.push({
          severity: "warning",
          code: "INVALID_CONTROL_ID_FORMAT",
          message: `Control ID exceeds recommended length: ${control.id}`,
          controlId: control.id,
          path,
        });
      }
    }

    // Check control title
    if (!control.title) {
      issues.push({
        severity: "warning",
        code: "MISSING_CONTROL_TITLE",
        message: `${VALIDATION_CODES.MISSING_CONTROL_TITLE}: ${control.id}`,
        controlId: control.id,
        path,
      });
    }

    // Check for empty description (info only)
    if (!control.parts || control.parts.length === 0) {
      issues.push({
        severity: "info",
        code: "EMPTY_DESCRIPTION",
        message: `${VALIDATION_CODES.EMPTY_DESCRIPTION}: ${control.id}`,
        controlId: control.id,
        path,
      });
    }

    // Validate nested controls (enhancements)
    if (control.controls) {
      validateControls(control.controls, issues, controlIds, path);
    }
  }
}

/**
 * Validate parsed catalog (after parsing)
 *
 * Additional validation on the parsed/flattened structure
 *
 * @param parsed - Parsed OSCAL catalog
 * @returns Array of validation issues
 */
export function validateParsedCatalog(
  parsed: ParsedOscalCatalog,
): OscalValidationIssue[] {
  const issues: OscalValidationIssue[] = [];
  const { metadata, controls } = parsed;

  // Validate metadata
  if (!metadata.uuid) {
    issues.push({
      severity: "warning",
      code: "MISSING_UUID",
      message: VALIDATION_CODES.MISSING_UUID,
    });
  }

  if (!metadata.title) {
    issues.push({
      severity: "error",
      code: "MISSING_TITLE",
      message: VALIDATION_CODES.MISSING_TITLE,
    });
  }

  // Validate controls
  if (controls.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_CONTROLS",
      message: VALIDATION_CODES.NO_CONTROLS,
    });
    return issues;
  }

  // Check for orphaned parent references
  const controlIds = new Set(controls.map((c) => c.controlId));
  for (const control of controls) {
    if (control.parentControlId && !controlIds.has(control.parentControlId)) {
      issues.push({
        severity: "warning",
        code: "ORPHANED_PARENT_REF",
        message: `${VALIDATION_CODES.ORPHANED_PARENT_REF}: ${control.controlId} -> ${control.parentControlId}`,
        controlId: control.controlId,
      });
    }
  }

  return issues;
}

/**
 * Check if validation result is valid (no errors)
 *
 * @param issues - Array of validation issues
 * @returns True if no errors (warnings/info are OK)
 */
export function isValidationPassing(issues: OscalValidationIssue[]): boolean {
  return !issues.some((issue) => issue.severity === "error");
}

/**
 * Get validation summary
 *
 * @param issues - Array of validation issues
 * @returns Summary object with counts by severity
 */
export function getValidationSummary(issues: OscalValidationIssue[]): {
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isValid: boolean;
  summary: string;
} {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;
  const isValid = errorCount === 0;

  const parts: string[] = [];
  if (errorCount > 0) parts.push(`${errorCount} error(s)`);
  if (warningCount > 0) parts.push(`${warningCount} warning(s)`);
  if (infoCount > 0) parts.push(`${infoCount} info`);

  const summary =
    parts.length > 0
      ? `Validation ${isValid ? "passed" : "failed"}: ${parts.join(", ")}`
      : "Validation passed: No issues found";

  return {
    errorCount,
    warningCount,
    infoCount,
    isValid,
    summary,
  };
}
