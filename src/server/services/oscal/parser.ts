/**
 * OSCAL Catalog Parser Service
 *
 * Parses OSCAL (Open Security Controls Assessment Language) catalogs in JSON and YAML formats.
 * Extracts framework metadata and flattens nested control hierarchies for database storage.
 *
 * @see Story 2.1: OSCAL Catalog Import Pipeline
 * @module server/services/oscal/parser
 */

import yaml from "js-yaml";
import type {
  OscalDocument,
  OscalCatalog,
  OscalGroup,
  OscalControl,
  OscalPart,
  ParsedFrameworkMetadata,
  ParsedControl,
  ParsedOscalCatalog,
  OscalValidationIssue,
} from "@/types/oscal";

/**
 * Supported file formats for OSCAL catalogs
 */
export type OscalFileFormat = "json" | "yaml" | "yml";

/**
 * Detect file format from content or filename
 *
 * @param content - File content as string
 * @param filename - Optional filename for extension-based detection
 * @returns Detected format
 */
export function detectFormat(
  content: string,
  filename?: string,
): OscalFileFormat {
  // Check by filename extension first
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop();
    if (ext === "json") return "json";
    if (ext === "yaml" || ext === "yml") return "yaml";
  }

  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return "json";
  }

  // Default to YAML for non-JSON content
  return "yaml";
}

/**
 * Parse OSCAL catalog content from string
 *
 * Supports both JSON and YAML formats. Automatically detects format
 * if not explicitly specified.
 *
 * @param content - Raw file content as string
 * @param format - Optional format override
 * @param filename - Optional filename for format detection
 * @returns Parsed OSCAL catalog structure
 * @throws Error if parsing fails or content is invalid
 */
export function parseOscalContent(
  content: string,
  format?: OscalFileFormat,
  filename?: string,
): OscalDocument {
  const detectedFormat = format ?? detectFormat(content, filename);

  try {
    let parsed: unknown;

    if (detectedFormat === "json") {
      parsed = JSON.parse(content);
    } else {
      parsed = yaml.load(content);
    }

    // Validate basic structure
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid OSCAL document: expected object");
    }

    const doc = parsed as Record<string, unknown>;

    if (!doc.catalog || typeof doc.catalog !== "object") {
      throw new Error(
        'Invalid OSCAL document: missing "catalog" root element',
      );
    }

    return parsed as OscalDocument;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse ${detectedFormat.toUpperCase()} content: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Extract prose text from control parts
 *
 * OSCAL controls contain prose in "parts" sections, typically with
 * a "statement" part for the main description and "guidance" for implementation notes.
 *
 * @param parts - Array of OSCAL parts
 * @param partName - Name of the part to extract (default: "statement")
 * @returns Concatenated prose text
 */
function extractProseFromParts(
  parts: OscalPart[] | undefined,
  partName: string = "statement",
): string {
  if (!parts || parts.length === 0) return "";

  const targetPart = parts.find((p) => p.name === partName);
  if (!targetPart) return "";

  // Collect prose from the target part and its nested parts
  const proseLines: string[] = [];

  if (targetPart.prose) {
    proseLines.push(targetPart.prose);
  }

  // Recursively collect nested prose
  if (targetPart.parts) {
    for (const nested of targetPart.parts) {
      if (nested.prose) {
        proseLines.push(nested.prose);
      }
    }
  }

  return proseLines.join("\n\n");
}

/**
 * Extract guidance text from control parts
 *
 * Looks for "guidance", "supplemental-guidance", or "implementation" parts.
 *
 * @param parts - Array of OSCAL parts
 * @returns Guidance text if found
 */
function extractGuidance(parts: OscalPart[] | undefined): string | undefined {
  if (!parts || parts.length === 0) return undefined;

  const guidanceNames = ["guidance", "supplemental-guidance", "implementation"];

  for (const name of guidanceNames) {
    const guidancePart = parts.find((p) => p.name === name);
    if (guidancePart?.prose) {
      return guidancePart.prose;
    }
  }

  return undefined;
}

/**
 * Flatten nested controls into a flat array with parent references
 *
 * OSCAL controls can be nested (control enhancements). This function
 * flattens them while preserving parent-child relationships.
 *
 * @param control - OSCAL control to process
 * @param parentId - Optional parent control ID
 * @param groupId - Optional group ID this control belongs to
 * @param groupTitle - Optional group title
 * @returns Array of parsed controls
 */
function flattenControl(
  control: OscalControl,
  parentId?: string,
  groupId?: string,
  groupTitle?: string,
): ParsedControl[] {
  const result: ParsedControl[] = [];

  // Extract description from parts (typically "statement")
  const description =
    extractProseFromParts(control.parts, "statement") ||
    extractProseFromParts(control.parts, "overview") ||
    control.title;

  // Extract guidance
  const guidance = extractGuidance(control.parts);

  // Add this control
  result.push({
    controlId: control.id,
    title: control.title,
    description,
    guidance,
    parentControlId: parentId,
    class: control.class,
    groupId,
    groupTitle,
  });

  // Process nested controls (control enhancements)
  if (control.controls) {
    for (const nested of control.controls) {
      result.push(...flattenControl(nested, control.id, groupId, groupTitle));
    }
  }

  return result;
}

/**
 * Process a group and its nested groups/controls
 *
 * @param group - OSCAL group to process
 * @returns Array of parsed controls from this group hierarchy
 */
function processGroup(group: OscalGroup): ParsedControl[] {
  const result: ParsedControl[] = [];

  // Process controls in this group
  if (group.controls) {
    for (const control of group.controls) {
      result.push(
        ...flattenControl(control, undefined, group.id, group.title),
      );
    }
  }

  // Process nested groups recursively
  if (group.groups) {
    for (const nested of group.groups) {
      result.push(...processGroup(nested));
    }
  }

  return result;
}

/**
 * Extract framework metadata from OSCAL catalog
 *
 * @param catalog - OSCAL catalog
 * @returns Parsed framework metadata
 */
function extractMetadata(catalog: OscalCatalog): ParsedFrameworkMetadata {
  const { metadata } = catalog;

  return {
    uuid: catalog.uuid,
    title: metadata.title,
    version: metadata.version ?? "1.0",
    oscalVersion: metadata["oscal-version"],
    published: metadata.published ? new Date(metadata.published) : undefined,
    lastModified: metadata["last-modified"]
      ? new Date(metadata["last-modified"])
      : undefined,
    description: metadata.remarks,
    sourceUrl: metadata.links?.find((l) => l.rel === "canonical")?.href,
  };
}

/**
 * Count groups in catalog (including nested)
 *
 * @param groups - Array of OSCAL groups
 * @returns Total count of groups
 */
function countGroups(groups: OscalGroup[] | undefined): number {
  if (!groups) return 0;

  let count = groups.length;
  for (const group of groups) {
    count += countGroups(group.groups);
  }
  return count;
}

/**
 * Parse complete OSCAL catalog
 *
 * Main entry point for parsing OSCAL catalogs. Extracts metadata,
 * flattens control hierarchies, and validates the structure.
 *
 * @param content - Raw file content
 * @param format - Optional format override
 * @param filename - Optional filename for format detection
 * @returns Parsed catalog with metadata and flattened controls
 * @throws Error if parsing or validation fails
 */
export function parseOscalCatalog(
  content: string,
  format?: OscalFileFormat,
  filename?: string,
): ParsedOscalCatalog {
  // Parse raw content
  const doc = parseOscalContent(content, format, filename);
  const { catalog } = doc;

  // Extract metadata
  const metadata = extractMetadata(catalog);

  // Flatten all controls
  const controls: ParsedControl[] = [];

  // Process top-level controls (not in groups)
  if (catalog.controls) {
    for (const control of catalog.controls) {
      controls.push(...flattenControl(control));
    }
  }

  // Process groups
  if (catalog.groups) {
    for (const group of catalog.groups) {
      controls.push(...processGroup(group));
    }
  }

  return {
    metadata,
    controls,
    rawCatalog: catalog,
  };
}

/**
 * Generate import preview for user review
 *
 * Creates a summary of what will be imported, without committing to database.
 *
 * @param content - Raw file content
 * @param format - Optional format override
 * @param filename - Optional filename for format detection
 * @returns Import preview with metadata, counts, and validation issues
 */
export function generateImportPreview(
  content: string,
  format?: OscalFileFormat,
  filename?: string,
): {
  metadata: ParsedFrameworkMetadata;
  controlCount: number;
  groupCount: number;
  topLevelControls: Array<{ id: string; title: string; childCount: number }>;
  issues: OscalValidationIssue[];
  isValid: boolean;
} {
  const issues: OscalValidationIssue[] = [];

  try {
    const parsed = parseOscalCatalog(content, format, filename);
    const { metadata, controls, rawCatalog } = parsed;

    // Collect top-level controls (no parent)
    const topLevelControls = controls
      .filter((c) => !c.parentControlId)
      .map((c) => ({
        id: c.controlId,
        title: c.title,
        childCount: controls.filter((child) => child.parentControlId === c.controlId).length,
      }))
      .slice(0, 20); // Limit preview to first 20

    // Run validation
    const validationIssues = validateParsedCatalog(parsed);
    issues.push(...validationIssues);

    // Count groups
    const groupCount = countGroups(rawCatalog.groups);

    return {
      metadata,
      controlCount: controls.length,
      groupCount,
      topLevelControls,
      issues,
      isValid: !issues.some((i) => i.severity === "error"),
    };
  } catch (error) {
    issues.push({
      severity: "error",
      code: "PARSE_ERROR",
      message: error instanceof Error ? error.message : "Unknown parsing error",
    });

    return {
      metadata: {
        uuid: "",
        title: "Parse Error",
        version: "",
      },
      controlCount: 0,
      groupCount: 0,
      topLevelControls: [],
      issues,
      isValid: false,
    };
  }
}

/**
 * Validate parsed OSCAL catalog
 *
 * Checks for common issues that might cause problems during import.
 *
 * @param parsed - Parsed OSCAL catalog
 * @returns Array of validation issues
 */
function validateParsedCatalog(
  parsed: ParsedOscalCatalog,
): OscalValidationIssue[] {
  const issues: OscalValidationIssue[] = [];
  const { metadata, controls } = parsed;

  // Check metadata
  if (!metadata.uuid) {
    issues.push({
      severity: "warning",
      code: "MISSING_UUID",
      message: "Catalog is missing a UUID identifier",
    });
  }

  if (!metadata.title) {
    issues.push({
      severity: "error",
      code: "MISSING_TITLE",
      message: "Catalog metadata is missing a title",
    });
  }

  // Check for controls
  if (controls.length === 0) {
    issues.push({
      severity: "error",
      code: "NO_CONTROLS",
      message: "Catalog contains no controls",
    });
  }

  // Check for duplicate control IDs
  const controlIds = new Set<string>();
  for (const control of controls) {
    if (controlIds.has(control.controlId)) {
      issues.push({
        severity: "warning",
        code: "DUPLICATE_CONTROL_ID",
        message: `Duplicate control ID found: ${control.controlId}`,
        controlId: control.controlId,
      });
    }
    controlIds.add(control.controlId);
  }

  // Check for controls without titles
  for (const control of controls) {
    if (!control.title) {
      issues.push({
        severity: "warning",
        code: "MISSING_CONTROL_TITLE",
        message: `Control ${control.controlId} is missing a title`,
        controlId: control.controlId,
      });
    }
  }

  // Check for orphaned parent references
  for (const control of controls) {
    if (
      control.parentControlId &&
      !controlIds.has(control.parentControlId)
    ) {
      issues.push({
        severity: "warning",
        code: "ORPHANED_PARENT_REF",
        message: `Control ${control.controlId} references non-existent parent ${control.parentControlId}`,
        controlId: control.controlId,
      });
    }
  }

  return issues;
}
