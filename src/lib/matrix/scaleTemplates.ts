/**
 * Scale Templates
 *
 * Story 7.8.5: Matrix Builder UI - Scales
 * Story 11.3: Likelihood Level Configuration
 * Story 11.4: Impact Level Configuration
 * Story 11.5: Exposure Level Configuration
 *
 * Pre-defined scale templates for quick setup (AC21-AC23):
 * - AC21: "Apply Template" dropdown for quick setup
 * - AC22: Templates: 3-level, 5-level, 10-level
 * - 11.3 AC7-AC9: Likelihood-specific templates for 3/4/5 levels
 * - 11.4 AC7-AC9: Impact-specific templates for 3/4/5 levels
 * - 11.5 AC7-AC9: Exposure-specific templates for 3/4/5 levels
 */

import type { ScaleLevel } from "./types";

export type ScaleTemplateName = "3-level" | "5-level" | "10-level";

// Story 11.3: Likelihood-specific template names
export type LikelihoodTemplateName = "likelihood-3" | "likelihood-4" | "likelihood-5";

// Story 11.4: Impact-specific template names
export type ImpactTemplateName = "impact-3" | "impact-4" | "impact-5";

// Story 11.5: Exposure-specific template names
export type ExposureTemplateName = "exposure-3" | "exposure-4" | "exposure-5";

/**
 * 3-Level Scale Template
 * Simple Low/Medium/High classification
 */
const THREE_LEVEL_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Low", description: "Minimal likelihood or impact" },
  { value: 2, label: "Medium", description: "Moderate likelihood or impact" },
  { value: 3, label: "High", description: "Significant likelihood or impact" },
];

/**
 * 5-Level Scale Template
 * Standard enterprise risk assessment scale
 */
const FIVE_LEVEL_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Very Low", description: "Rare or negligible" },
  { value: 2, label: "Low", description: "Unlikely or minor" },
  { value: 3, label: "Medium", description: "Possible or moderate" },
  { value: 4, label: "High", description: "Likely or major" },
  { value: 5, label: "Very High", description: "Almost certain or catastrophic" },
];

/**
 * 10-Level Scale Template
 * Granular scale for detailed risk scoring
 */
const TEN_LEVEL_TEMPLATE: ScaleLevel[] = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: `Level ${i + 1}`,
  description: i === 0
    ? "Lowest"
    : i === 9
      ? "Highest"
      : i < 3
        ? "Low range"
        : i < 7
          ? "Medium range"
          : "High range",
}));

/**
 * Story 11.3: Likelihood-Specific Templates
 *
 * Standard risk assessment likelihood terminology:
 * - AC7: 5-level uses "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"
 * - AC8: 3-level uses "Unlikely", "Possible", "Likely"
 * - AC9: 4-level uses "Rare", "Unlikely", "Likely", "Almost Certain"
 */

const LIKELIHOOD_3_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Unlikely", description: "Could occur at some time but not expected" },
  { value: 2, label: "Possible", description: "Might occur at some time" },
  { value: 3, label: "Likely", description: "Will probably occur in most circumstances" },
];

const LIKELIHOOD_4_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Rare", description: "May occur only in exceptional circumstances" },
  { value: 2, label: "Unlikely", description: "Could occur at some time but not expected" },
  { value: 3, label: "Likely", description: "Will probably occur in most circumstances" },
  { value: 4, label: "Almost Certain", description: "Expected to occur in most circumstances" },
];

const LIKELIHOOD_5_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Rare", description: "May occur only in exceptional circumstances" },
  { value: 2, label: "Unlikely", description: "Could occur at some time but not expected" },
  { value: 3, label: "Possible", description: "Might occur at some time" },
  { value: 4, label: "Likely", description: "Will probably occur in most circumstances" },
  { value: 5, label: "Almost Certain", description: "Expected to occur in most circumstances" },
];

/**
 * Story 11.4: Impact-Specific Templates
 *
 * Standard risk assessment impact terminology:
 * - AC7: 5-level uses "Negligible", "Minor", "Moderate", "Major", "Catastrophic"
 * - AC8: 3-level uses "Minor", "Moderate", "Major"
 * - AC9: 4-level uses "Negligible", "Minor", "Major", "Catastrophic"
 */

const IMPACT_3_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Minor", description: "Limited impact on operations or objectives" },
  { value: 2, label: "Moderate", description: "Noticeable impact requiring management attention" },
  { value: 3, label: "Major", description: "Significant impact threatening key objectives" },
];

const IMPACT_4_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Negligible", description: "Minimal or no discernible impact" },
  { value: 2, label: "Minor", description: "Limited impact on operations or objectives" },
  { value: 3, label: "Major", description: "Significant impact threatening key objectives" },
  { value: 4, label: "Catastrophic", description: "Severe impact threatening organizational viability" },
];

const IMPACT_5_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Negligible", description: "Minimal or no discernible impact" },
  { value: 2, label: "Minor", description: "Limited impact on operations or objectives" },
  { value: 3, label: "Moderate", description: "Noticeable impact requiring management attention" },
  { value: 4, label: "Major", description: "Significant impact threatening key objectives" },
  { value: 5, label: "Catastrophic", description: "Severe impact threatening organizational viability" },
];

/**
 * Story 11.5: Exposure-Specific Templates
 *
 * Standard risk assessment exposure terminology:
 * - AC7: 5-level uses "None", "Limited", "Moderate", "Significant", "Extensive"
 * - AC8: 3-level uses "Limited", "Moderate", "Significant"
 * - AC9: 4-level uses "None", "Limited", "Significant", "Extensive"
 */

const EXPOSURE_3_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "Limited", description: "Minimal exposure to the risk factor" },
  { value: 2, label: "Moderate", description: "Partial exposure requiring consideration" },
  { value: 3, label: "Significant", description: "Substantial exposure requiring attention" },
];

const EXPOSURE_4_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "None", description: "No exposure to the risk factor" },
  { value: 2, label: "Limited", description: "Minimal exposure to the risk factor" },
  { value: 3, label: "Significant", description: "Substantial exposure requiring attention" },
  { value: 4, label: "Extensive", description: "Maximum exposure to the risk factor" },
];

const EXPOSURE_5_TEMPLATE: ScaleLevel[] = [
  { value: 1, label: "None", description: "No exposure to the risk factor" },
  { value: 2, label: "Limited", description: "Minimal exposure to the risk factor" },
  { value: 3, label: "Moderate", description: "Partial exposure requiring consideration" },
  { value: 4, label: "Significant", description: "Substantial exposure requiring attention" },
  { value: 5, label: "Extensive", description: "Maximum exposure to the risk factor" },
];

/**
 * All available scale templates
 */
export const SCALE_TEMPLATES: Record<ScaleTemplateName, ScaleLevel[]> = {
  "3-level": THREE_LEVEL_TEMPLATE,
  "5-level": FIVE_LEVEL_TEMPLATE,
  "10-level": TEN_LEVEL_TEMPLATE,
};

/**
 * Story 11.3: Likelihood-specific templates
 */
export const LIKELIHOOD_TEMPLATES: Record<LikelihoodTemplateName, ScaleLevel[]> = {
  "likelihood-3": LIKELIHOOD_3_TEMPLATE,
  "likelihood-4": LIKELIHOOD_4_TEMPLATE,
  "likelihood-5": LIKELIHOOD_5_TEMPLATE,
};

/**
 * Story 11.4: Impact-specific templates
 */
export const IMPACT_TEMPLATES: Record<ImpactTemplateName, ScaleLevel[]> = {
  "impact-3": IMPACT_3_TEMPLATE,
  "impact-4": IMPACT_4_TEMPLATE,
  "impact-5": IMPACT_5_TEMPLATE,
};

/**
 * Story 11.5: Exposure-specific templates
 */
export const EXPOSURE_TEMPLATES: Record<ExposureTemplateName, ScaleLevel[]> = {
  "exposure-3": EXPOSURE_3_TEMPLATE,
  "exposure-4": EXPOSURE_4_TEMPLATE,
  "exposure-5": EXPOSURE_5_TEMPLATE,
};

/**
 * Template metadata for UI display
 */
export const SCALE_TEMPLATE_INFO: Record<
  ScaleTemplateName,
  { name: string; description: string; levelCount: number }
> = {
  "3-level": {
    name: "3-Level",
    description: "Simple Low/Medium/High classification",
    levelCount: 3,
  },
  "5-level": {
    name: "5-Level",
    description: "Standard enterprise risk scale",
    levelCount: 5,
  },
  "10-level": {
    name: "10-Level",
    description: "Granular scale for detailed scoring",
    levelCount: 10,
  },
};

/**
 * Story 11.3: Likelihood template metadata for UI display
 */
export const LIKELIHOOD_TEMPLATE_INFO: Record<
  LikelihoodTemplateName,
  { name: string; description: string; levelCount: number }
> = {
  "likelihood-3": {
    name: "Likelihood 3-Level",
    description: "Unlikely, Possible, Likely",
    levelCount: 3,
  },
  "likelihood-4": {
    name: "Likelihood 4-Level",
    description: "Rare, Unlikely, Likely, Almost Certain",
    levelCount: 4,
  },
  "likelihood-5": {
    name: "Likelihood 5-Level",
    description: "Rare to Almost Certain (standard)",
    levelCount: 5,
  },
};

/**
 * Story 11.4: Impact template metadata for UI display
 */
export const IMPACT_TEMPLATE_INFO: Record<
  ImpactTemplateName,
  { name: string; description: string; levelCount: number }
> = {
  "impact-3": {
    name: "Impact 3-Level",
    description: "Minor, Moderate, Major",
    levelCount: 3,
  },
  "impact-4": {
    name: "Impact 4-Level",
    description: "Negligible, Minor, Major, Catastrophic",
    levelCount: 4,
  },
  "impact-5": {
    name: "Impact 5-Level",
    description: "Negligible to Catastrophic (standard)",
    levelCount: 5,
  },
};

/**
 * Story 11.5: Exposure template metadata for UI display
 */
export const EXPOSURE_TEMPLATE_INFO: Record<
  ExposureTemplateName,
  { name: string; description: string; levelCount: number }
> = {
  "exposure-3": {
    name: "Exposure 3-Level",
    description: "Limited, Moderate, Significant",
    levelCount: 3,
  },
  "exposure-4": {
    name: "Exposure 4-Level",
    description: "None, Limited, Significant, Extensive",
    levelCount: 4,
  },
  "exposure-5": {
    name: "Exposure 5-Level",
    description: "None to Extensive (standard)",
    levelCount: 5,
  },
};

/**
 * Get template by name with deep copy to prevent mutation
 */
export function getScaleTemplate(templateName: ScaleTemplateName): ScaleLevel[] {
  return SCALE_TEMPLATES[templateName].map((level) => ({ ...level }));
}

/**
 * Story 11.3: Get likelihood template for a specific gridSize
 * Returns the appropriate likelihood template based on gridSize (3, 4, or 5)
 */
export function getLikelihoodTemplateForGridSize(gridSize: 3 | 4 | 5): ScaleLevel[] {
  const templateName = `likelihood-${gridSize}` as LikelihoodTemplateName;
  return LIKELIHOOD_TEMPLATES[templateName].map((level) => ({ ...level }));
}

/**
 * Story 11.4: Get impact template for a specific gridSize
 * Returns the appropriate impact template based on gridSize (3, 4, or 5)
 */
export function getImpactTemplateForGridSize(gridSize: 3 | 4 | 5): ScaleLevel[] {
  const templateName = `impact-${gridSize}` as ImpactTemplateName;
  return IMPACT_TEMPLATES[templateName].map((level) => ({ ...level }));
}

/**
 * Story 11.5: Get exposure template for a specific gridSize
 * Returns the appropriate exposure template based on gridSize (3, 4, or 5)
 */
export function getExposureTemplateForGridSize(gridSize: 3 | 4 | 5): ScaleLevel[] {
  const templateName = `exposure-${gridSize}` as ExposureTemplateName;
  return EXPOSURE_TEMPLATES[templateName].map((level) => ({ ...level }));
}
