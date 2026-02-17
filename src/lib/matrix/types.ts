/**
 * Risk Matrix Types
 *
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle (AC9-AC18)
 *
 * TypeScript interfaces and Zod schemas for risk matrix scales and thresholds.
 */

import { z } from "zod";

// ============================================================================
// Scale Level Types (AC9-AC13)
// ============================================================================

/**
 * Individual level within a scale (likelihood, impact, or exposure)
 * AC9: Each level has value, label, and optional description
 */
export interface ScaleLevel {
  value: number;        // Decimal stored as number (must be positive, unique within scale)
  label: string;        // Display label, e.g., "Low", "Medium", "High"
  description?: string; // Optional explanatory text
}

/**
 * Complete matrix scales structure
 * AC10-AC12: Likelihood and Impact required, Exposure only for 3D matrices
 */
export interface MatrixScales {
  likelihood: ScaleLevel[];  // AC10: Required, 3-10 levels
  impact: ScaleLevel[];      // AC11: Required, 3-10 levels
  exposure?: ScaleLevel[];   // AC12: Required only if dimensionCount = 3
}

// ============================================================================
// Threshold Types (AC14-AC18)
// ============================================================================

/**
 * Risk threshold defining a risk band/category
 * AC14: Each threshold has minValue, maxValue, label, color, sortOrder
 * Story 11.1: Added slaDays for treatment workflow SLA tracking
 */
export interface Threshold {
  minValue: number;  // Inclusive lower bound
  maxValue: number;  // Exclusive upper bound (except for last threshold)
  label: string;     // Display label, e.g., "Critical", "High", "Medium", "Low"
  color: string;     // Hex color code, e.g., "#FF0000"
  sortOrder: number; // For consistent ordering (typically matches severity)
  slaDays: number;   // Story 11.1: Treatment SLA in days (e.g., Critical=7, High=14, Medium=30, Low=90)
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Scale level validation
 * AC9: value positive, label required
 */
export const scaleLevelSchema = z.object({
  value: z.number().positive("Value must be positive"),
  label: z.string().min(1, "Label is required").max(50, "Label too long"),
  description: z.string().max(500, "Description too long").optional(),
});

/**
 * Scale array validation
 * AC10-AC11: 3-10 levels required
 */
export const scaleArraySchema = z
  .array(scaleLevelSchema)
  .min(3, "Scale must have at least 3 levels")
  .max(10, "Scale cannot exceed 10 levels");

/**
 * Optional scale array for exposure (AC12)
 */
export const optionalScaleArraySchema = z
  .array(scaleLevelSchema)
  .min(3, "Scale must have at least 3 levels")
  .max(10, "Scale cannot exceed 10 levels")
  .optional();

/**
 * Full matrix scales validation
 * AC10-AC12: Validates required scales presence
 */
export const matrixScalesSchema = z.object({
  likelihood: scaleArraySchema,
  impact: scaleArraySchema,
  exposure: optionalScaleArraySchema,
});

/**
 * Threshold validation
 * AC14: All fields required except sortOrder defaults
 * Story 11.1: Added slaDays validation
 */
export const thresholdSchema = z.object({
  minValue: z.number().min(0, "Min value cannot be negative"),
  maxValue: z.number().positive("Max value must be positive"),
  label: z.string().min(1, "Label is required").max(50, "Label too long"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format"),
  sortOrder: z.number().int().min(0, "Sort order must be non-negative"),
  slaDays: z.number().int().positive("SLA days must be a positive integer"),
});

/**
 * Threshold array validation
 * AC14-AC18: At least one threshold required
 */
export const thresholdArraySchema = z
  .array(thresholdSchema)
  .min(1, "At least one threshold is required");

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard for ScaleLevel
 */
export function isScaleLevel(obj: unknown): obj is ScaleLevel {
  return scaleLevelSchema.safeParse(obj).success;
}

/**
 * Type guard for MatrixScales
 */
export function isMatrixScales(obj: unknown): obj is MatrixScales {
  return matrixScalesSchema.safeParse(obj).success;
}

/**
 * Type guard for Threshold
 */
export function isThreshold(obj: unknown): obj is Threshold {
  return thresholdSchema.safeParse(obj).success;
}

/**
 * Type guard for Threshold array
 */
export function isThresholdArray(obj: unknown): obj is Threshold[] {
  return thresholdArraySchema.safeParse(obj).success;
}

// ============================================================================
// Default Values
// ============================================================================
// Note: Default scales and thresholds are now defined in ./defaults.ts
// for Story 7.8.4: Default Matrix & Assessment Type Seeding.
// Import from ./defaults.ts for the official default configuration.
