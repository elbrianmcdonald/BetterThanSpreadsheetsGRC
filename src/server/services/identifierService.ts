/**
 * Identifier Service
 *
 * Story 7.1: Identifier Sequence for sequential ID generation (AC11-AC15)
 *
 * Generates sequential, human-readable identifiers in the format:
 * {PREFIX}-{YEAR}-{NNNN}
 *
 * Supported prefixes:
 * - FND: Findings (FND-2025-0001)
 * - RSK: Risk Assessments (RSK-2025-0001)
 * - RR: Risk Register entries (RR-2025-0001)
 * - RISK: Risks (RISK-2025-0001)
 * - VND: Vendors (VND-2025-0001)
 * - VA: Vendor Assessments (VA-2025-0001)
 * - BF: Business Functions (BF-2025-0001)
 * - BP: Business Processes (BP-2025-0001)
 * - AST: Assets (AST-2025-0001)
 *
 * Features:
 * - Atomic generation (no duplicates under concurrent load)
 * - Per-organization, per-prefix, per-year sequences
 * - Zero-padded sequence numbers (4 digits)
 * - Automatic year rollover
 */

import { db } from "@/server/db";

/**
 * Valid identifier prefixes
 */
export type IdentifierPrefix = "FND" | "RSK" | "RR" | "RISK" | "VND" | "VA" | "BF" | "BP" | "AST" | "ENG" | "AP";

/**
 * Generates a sequential identifier for the given organization and prefix.
 *
 * Uses Prisma's upsert with increment for atomic operation:
 * - If sequence exists for this org/prefix/year, increments lastSequence
 * - If not, creates new sequence starting at 1
 *
 * @param organizationId - The organization ID
 * @param prefix - The identifier prefix (FND, RSK, or RR)
 * @returns The generated identifier (e.g., "FND-2025-0001")
 *
 * @example
 * const id = await generateIdentifier("org-123", "FND");
 * // Returns "FND-2025-0001" (first finding of 2025)
 */
export async function generateIdentifier(
  organizationId: string,
  prefix: IdentifierPrefix
): Promise<string> {
  const year = new Date().getFullYear();

  // Atomic upsert with increment to prevent race conditions
  const sequence = await db.identifierSequence.upsert({
    where: {
      organizationId_prefix_year: {
        organizationId,
        prefix,
        year,
      },
    },
    create: {
      organizationId,
      prefix,
      year,
      lastSequence: 1,
    },
    update: {
      lastSequence: {
        increment: 1,
      },
    },
  });

  // Format: PREFIX-YYYY-NNNN (zero-padded to 4 digits)
  return `${prefix}-${year}-${String(sequence.lastSequence).padStart(4, "0")}`;
}

/**
 * Gets the next sequence number for a given organization, prefix, and year
 * without incrementing it. Useful for previewing the next ID.
 *
 * @param organizationId - The organization ID
 * @param prefix - The identifier prefix
 * @returns The next sequence number (1 if no sequence exists)
 */
export async function peekNextSequence(
  organizationId: string,
  prefix: IdentifierPrefix
): Promise<number> {
  const year = new Date().getFullYear();

  const sequence = await db.identifierSequence.findUnique({
    where: {
      organizationId_prefix_year: {
        organizationId,
        prefix,
        year,
      },
    },
  });

  return sequence ? sequence.lastSequence + 1 : 1;
}

/**
 * Gets the current sequence count for a given organization and prefix.
 * Useful for statistics and reporting.
 *
 * @param organizationId - The organization ID
 * @param prefix - The identifier prefix
 * @param year - Optional year (defaults to current year)
 * @returns The current sequence count (0 if no sequence exists)
 */
export async function getSequenceCount(
  organizationId: string,
  prefix: IdentifierPrefix,
  year?: number
): Promise<number> {
  const targetYear = year ?? new Date().getFullYear();

  const sequence = await db.identifierSequence.findUnique({
    where: {
      organizationId_prefix_year: {
        organizationId,
        prefix,
        year: targetYear,
      },
    },
  });

  return sequence?.lastSequence ?? 0;
}

/**
 * Parses an identifier string into its components.
 *
 * @param identifier - The identifier to parse (e.g., "FND-2025-0001")
 * @returns Parsed components or null if invalid format
 */
export function parseIdentifier(identifier: string): {
  prefix: IdentifierPrefix;
  year: number;
  sequence: number;
} | null {
  const match = identifier.match(/^(FND|RSK|RR|RISK|VND|VA|BF|BP|AST|ENG)-(\d{4})-(\d+)$/);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1] as IdentifierPrefix,
    year: parseInt(match[2]!, 10),
    sequence: parseInt(match[3]!, 10),
  };
}

/**
 * Validates an identifier format.
 *
 * @param identifier - The identifier to validate
 * @returns True if valid format, false otherwise
 */
export function isValidIdentifier(identifier: string): boolean {
  return /^(FND|RSK|RR|RISK|VND|VA|BF|BP|AST|ENG)-\d{4}-\d{4,}$/.test(identifier);
}
