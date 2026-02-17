/**
 * Risk Scoring Utilities
 *
 * Story 7.6: Risk Assessment Form with Auto-Save (AC7)
 *
 * Provides functions for calculating risk scores and determining
 * visual styling based on score thresholds.
 *
 * Score Matrix (4x4):
 * - Score = Likelihood × Impact
 * - Range: 1-16
 * - Thresholds: Low (1-4), Medium (5-8), High (9-12), Critical (13-16)
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

/**
 * Score label type
 */
export type ScoreLabel = "Low" | "Medium" | "High" | "Critical";

/**
 * Calculate inherent risk score from likelihood and impact values
 * Uses simple multiplication: score = likelihood × impact
 *
 * @param likelihood - Likelihood value (1-4)
 * @param impact - Impact value (1-4)
 * @returns Calculated score (1-16)
 */
export function calculateScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}

/**
 * Get score label based on thresholds
 * - 1-4 = Low
 * - 5-8 = Medium
 * - 9-12 = High
 * - 13-16 = Critical
 *
 * @param score - Risk score (1-16)
 * @returns Score label (Low/Medium/High/Critical)
 */
export function getScoreLabel(score: number): ScoreLabel {
  if (score <= 4) return "Low";
  if (score <= 8) return "Medium";
  if (score <= 12) return "High";
  return "Critical";
}

/**
 * Get Tailwind CSS color class for score label (background)
 *
 * @param label - Score label
 * @returns Tailwind CSS class for background color
 */
export function getScoreColorClass(label: ScoreLabel): string {
  switch (label) {
    case "Low":
      return "bg-green-500";
    case "Medium":
      return "bg-yellow-500";
    case "High":
      return "bg-orange-500";
    case "Critical":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * Get Tailwind CSS color class for score label (text)
 *
 * @param label - Score label
 * @returns Tailwind CSS class for text color
 */
export function getScoreTextColorClass(label: ScoreLabel): string {
  switch (label) {
    case "Low":
      return "text-green-600 dark:text-green-400";
    case "Medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "High":
      return "text-orange-600 dark:text-orange-400";
    case "Critical":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
}

/**
 * Get Tailwind CSS color class for score label (badge variant)
 *
 * @param label - Score label
 * @returns Tailwind CSS classes for badge styling
 */
export function getScoreBadgeClass(label: ScoreLabel): string {
  switch (label) {
    case "Low":
      return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600";
    case "Medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600";
    case "High":
      return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-600";
    case "Critical":
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
  }
}

/**
 * Get progress bar percentage based on score
 * Normalizes 1-16 range to 0-100%
 *
 * @param score - Risk score (1-16)
 * @returns Percentage value (0-100)
 */
export function getScorePercentage(score: number): number {
  return Math.round((score / 16) * 100);
}

/**
 * Likelihood scale options for form select
 */
export const LIKELIHOOD_OPTIONS = [
  { value: 1, label: "1 - Low", description: "Unlikely to occur" },
  { value: 2, label: "2 - Medium", description: "May occur occasionally" },
  { value: 3, label: "3 - High", description: "Likely to occur" },
  { value: 4, label: "4 - Critical", description: "Almost certain to occur" },
] as const;

/**
 * Impact scale options for form select
 */
export const IMPACT_OPTIONS = [
  { value: 1, label: "1 - Low", description: "Minor impact" },
  { value: 2, label: "2 - Medium", description: "Moderate impact" },
  { value: 3, label: "3 - High", description: "Significant impact" },
  { value: 4, label: "4 - Critical", description: "Severe impact" },
] as const;
