/**
 * Threshold Templates
 *
 * Story 7.8.6: Matrix Builder UI - Thresholds
 *
 * Pre-defined threshold templates for common risk rating patterns.
 *
 * Templates (AC20-AC22):
 * - 3-level: Low, Medium, High
 * - 4-level: Low, Medium, High, Critical
 * - 5-level: Very Low, Low, Medium, High, Critical
 */

import type { Threshold } from "./types";

export type ThresholdTemplateName = "3-level" | "4-level" | "5-level";

interface TemplateDefinition {
  label: string;
  color: string;
  portion: number; // Fraction of total scale
  slaDays: number; // Story 11.1: Treatment SLA in days
}

const TEMPLATE_DEFINITIONS: Record<ThresholdTemplateName, TemplateDefinition[]> = {
  "3-level": [
    { label: "Low", color: "#22C55E", portion: 0.33, slaDays: 90 },
    { label: "Medium", color: "#EAB308", portion: 0.34, slaDays: 30 },
    { label: "High", color: "#EF4444", portion: 0.33, slaDays: 14 },
  ],
  "4-level": [
    { label: "Low", color: "#22C55E", portion: 0.25, slaDays: 90 },
    { label: "Medium", color: "#EAB308", portion: 0.25, slaDays: 30 },
    { label: "High", color: "#F97316", portion: 0.25, slaDays: 14 },
    { label: "Critical", color: "#EF4444", portion: 0.25, slaDays: 7 },
  ],
  "5-level": [
    { label: "Very Low", color: "#22C55E", portion: 0.2, slaDays: 180 },
    { label: "Low", color: "#84CC16", portion: 0.2, slaDays: 90 },
    { label: "Medium", color: "#EAB308", portion: 0.2, slaDays: 30 },
    { label: "High", color: "#F97316", portion: 0.2, slaDays: 14 },
    { label: "Critical", color: "#EF4444", portion: 0.2, slaDays: 7 },
  ],
};

/**
 * Generate thresholds from a template, scaled to outputScaleMax
 *
 * AC22: Template applies based on current outputScaleMax
 *
 * @param templateName The template to apply
 * @param outputScaleMax The maximum score value for the matrix
 * @returns Array of threshold objects with boundaries scaled to outputScaleMax
 */
export function getThresholdTemplate(
  templateName: ThresholdTemplateName,
  outputScaleMax: number
): Threshold[] {
  const template = TEMPLATE_DEFINITIONS[templateName];
  let currentMin = 0;

  return template.map((t, i) => {
    // For the last threshold, use exactly outputScaleMax to avoid floating point issues
    const maxValue =
      i === template.length - 1
        ? outputScaleMax
        : Number((currentMin + t.portion * outputScaleMax).toFixed(2));

    const threshold: Threshold = {
      minValue: Number(currentMin.toFixed(2)),
      maxValue,
      label: t.label,
      color: t.color,
      sortOrder: i + 1,
      slaDays: t.slaDays, // Story 11.1: Treatment SLA
    };

    currentMin = maxValue;
    return threshold;
  });
}

/**
 * Get template display name for dropdown
 */
export function getTemplateDisplayName(templateName: ThresholdTemplateName): string {
  switch (templateName) {
    case "3-level":
      return "3-Level (Low, Medium, High)";
    case "4-level":
      return "4-Level (Low, Medium, High, Critical)";
    case "5-level":
      return "5-Level (Very Low to Critical)";
    default:
      return templateName;
  }
}

/**
 * All available template names
 */
export const THRESHOLD_TEMPLATE_NAMES: ThresholdTemplateName[] = [
  "3-level",
  "4-level",
  "5-level",
];
