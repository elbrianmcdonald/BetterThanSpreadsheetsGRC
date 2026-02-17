/**
 * Default Matrix & Assessment Type Configuration
 *
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 * Story 11.8: GridSize-Aware Default Generation
 *
 * Pre-configured defaults for new organizations to enable immediate use.
 * These defaults can be customized or replaced later.
 */

import type { MatrixScales, Threshold } from "./types";
import {
  getLikelihoodTemplateForGridSize,
  getImpactTemplateForGridSize,
  getExposureTemplateForGridSize,
} from "./scaleTemplates";
import {
  getThresholdTemplate,
  type ThresholdTemplateName,
} from "./thresholdTemplates";

// ============================================================================
// Default Assessment Type (AC1-AC2)
// ============================================================================

/**
 * Default assessment type configuration
 * AC1: "General Risk Assessment" seeded for each new organization
 * AC2: Standard description for general organizational risks
 */
export const DEFAULT_ASSESSMENT_TYPE = {
  name: "General Risk Assessment",
  description: "Standard risk assessment for general organizational risks",
} as const;

// ============================================================================
// Default Matrix Template (AC5-AC7)
// ============================================================================

/**
 * Default risk matrix template configuration
 * AC5: "Standard Risk Matrix" template
 * AC6: 2D matrix (Likelihood × Impact)
 * AC7: Output scale max = 25 (5×5 grid)
 */
export const DEFAULT_MATRIX_TEMPLATE = {
  name: "Standard Risk Matrix",
  description: "Default 5×5 risk matrix using likelihood and impact dimensions",
  dimensionCount: 2,
  outputScaleMax: 25,
} as const;

// ============================================================================
// Default Scales (AC8, AC11-AC14)
// ============================================================================

/**
 * Default likelihood scale
 * AC11: 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
 * AC13: Each level has descriptive text for guidance
 * AC14: Values are integers for simplicity
 */
export const DEFAULT_LIKELIHOOD_SCALE = [
  {
    value: 1,
    label: "Rare",
    description: "May occur only in exceptional circumstances"
  },
  {
    value: 2,
    label: "Unlikely",
    description: "Could occur but not expected"
  },
  {
    value: 3,
    label: "Possible",
    description: "Might occur at some time"
  },
  {
    value: 4,
    label: "Likely",
    description: "Will probably occur in most circumstances"
  },
  {
    value: 5,
    label: "Almost Certain",
    description: "Expected to occur in most circumstances"
  },
] as const;

/**
 * Default impact scale
 * AC12: 1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic
 * AC13: Each level has descriptive text for guidance
 * AC14: Values are integers for simplicity
 */
export const DEFAULT_IMPACT_SCALE = [
  {
    value: 1,
    label: "Negligible",
    description: "Minimal impact, easily absorbed"
  },
  {
    value: 2,
    label: "Minor",
    description: "Some impact, minor disruption"
  },
  {
    value: 3,
    label: "Moderate",
    description: "Noticeable impact, requires management attention"
  },
  {
    value: 4,
    label: "Major",
    description: "Significant impact, threatens objectives"
  },
  {
    value: 5,
    label: "Catastrophic",
    description: "Severe impact, business-threatening"
  },
] as const;

/**
 * Combined default scales for version creation
 * AC8: Pre-configured scales (1-5 for each dimension)
 */
export const DEFAULT_SCALES: MatrixScales = {
  likelihood: [...DEFAULT_LIKELIHOOD_SCALE],
  impact: [...DEFAULT_IMPACT_SCALE],
};

// ============================================================================
// Default Thresholds (AC9, AC15-AC18)
// ============================================================================

/**
 * Default risk thresholds for 5×5 matrix
 * AC9: Pre-configured thresholds (Critical, High, Medium, Low)
 * AC15: Critical: 20-25 (Red #EF4444)
 * AC16: High: 12-19.99 (Orange #F97316)
 * AC17: Medium: 5-11.99 (Yellow #EAB308)
 * AC18: Low: 0-4.99 (Green #22C55E)
 *
 * Story 11.1: Added slaDays for treatment workflow SLA tracking
 * - Low: 90 days, Medium: 30 days, High: 14 days, Critical: 7 days
 *
 * Note: Thresholds use maxValue as exclusive bound (except last)
 * Score ranges: Low [0,5), Medium [5,12), High [12,20), Critical [20,25]
 */
export const DEFAULT_THRESHOLDS: Threshold[] = [
  {
    minValue: 0,
    maxValue: 5,
    label: "Low",
    color: "#22C55E",
    sortOrder: 0,
    slaDays: 90
  },
  {
    minValue: 5,
    maxValue: 12,
    label: "Medium",
    color: "#EAB308",
    sortOrder: 1,
    slaDays: 30
  },
  {
    minValue: 12,
    maxValue: 20,
    label: "High",
    color: "#F97316",
    sortOrder: 2,
    slaDays: 14
  },
  {
    minValue: 20,
    maxValue: 25,
    label: "Critical",
    color: "#EF4444",
    sortOrder: 3,
    slaDays: 7
  },
];

// ============================================================================
// Story 11.8: GridSize-Aware Default Generation (AC19-AC22)
// ============================================================================

/**
 * Generate default scales for a given gridSize
 * Story 11.8 AC19-AC20: Scales auto-populated based on gridSize
 *
 * @param gridSize - 3, 4, or 5 level scales
 * @param dimensionCount - 2 for L×I, 3 for L×I×E
 * @returns MatrixScales with appropriate scale levels
 */
export function getDefaultScalesForGridSize(
  gridSize: 3 | 4 | 5,
  dimensionCount: 2 | 3 = 2
): MatrixScales {
  const scales: MatrixScales = {
    likelihood: getLikelihoodTemplateForGridSize(gridSize),
    impact: getImpactTemplateForGridSize(gridSize),
  };

  if (dimensionCount === 3) {
    scales.exposure = getExposureTemplateForGridSize(gridSize);
  }

  return scales;
}

/**
 * Generate default thresholds for a given gridSize
 * Story 11.8 AC21: Thresholds auto-populated based on gridSize
 *
 * Uses matching threshold template (3-level, 4-level, 5-level)
 *
 * @param gridSize - 3, 4, or 5 level thresholds
 * @param outputScaleMax - Maximum score value
 * @returns Threshold array with appropriate levels
 */
export function getDefaultThresholdsForGridSize(
  gridSize: 3 | 4 | 5,
  outputScaleMax: number
): Threshold[] {
  const templateName = `${gridSize}-level` as ThresholdTemplateName;
  return getThresholdTemplate(templateName, outputScaleMax);
}

/**
 * Calculate outputScaleMax based on gridSize and dimensionCount
 * Story 11.8: Used for determining appropriate output scale
 *
 * For 2D: gridSize × gridSize (e.g., 5×5 = 25)
 * For 3D: gridSize × gridSize × gridSize (e.g., 5×5×5 = 125)
 *
 * @param gridSize - 3, 4, or 5
 * @param dimensionCount - 2 or 3
 * @returns Maximum possible score
 */
export function calculateOutputScaleMax(
  gridSize: 3 | 4 | 5,
  dimensionCount: 2 | 3 = 2
): number {
  if (dimensionCount === 3) {
    return gridSize * gridSize * gridSize;
  }
  return gridSize * gridSize;
}

/**
 * Get complete default configuration for a given gridSize
 * Story 11.8 AC22: "Reset to Defaults" action support
 *
 * Returns scales, thresholds, and outputScaleMax for the given configuration.
 *
 * @param gridSize - 3, 4, or 5
 * @param dimensionCount - 2 or 3
 * @returns Complete default configuration
 */
export function getDefaultsForGridSize(
  gridSize: 3 | 4 | 5,
  dimensionCount: 2 | 3 = 2
): {
  scales: MatrixScales;
  thresholds: Threshold[];
  outputScaleMax: number;
} {
  const outputScaleMax = calculateOutputScaleMax(gridSize, dimensionCount);
  return {
    scales: getDefaultScalesForGridSize(gridSize, dimensionCount),
    thresholds: getDefaultThresholdsForGridSize(gridSize, outputScaleMax),
    outputScaleMax,
  };
}

/**
 * Get default matrix template configuration for a given gridSize
 * Story 11.8: Template name and description based on gridSize
 *
 * @param gridSize - 3, 4, or 5
 * @param dimensionCount - 2 or 3
 * @returns Template configuration object
 */
export function getDefaultTemplateConfigForGridSize(
  gridSize: 3 | 4 | 5,
  dimensionCount: 2 | 3 = 2
): {
  name: string;
  description: string;
  dimensionCount: 2 | 3;
  gridSize: 3 | 4 | 5;
  outputScaleMax: number;
} {
  const outputScaleMax = calculateOutputScaleMax(gridSize, dimensionCount);
  const dimensionLabel = dimensionCount === 3 ? "3D" : "2D";

  return {
    name: `Standard ${gridSize}×${gridSize} Risk Matrix`,
    description: `Default ${gridSize}×${gridSize} ${dimensionLabel} risk matrix using ${dimensionCount === 3 ? "likelihood, impact, and exposure" : "likelihood and impact"} dimensions`,
    dimensionCount,
    gridSize,
    outputScaleMax,
  };
}
