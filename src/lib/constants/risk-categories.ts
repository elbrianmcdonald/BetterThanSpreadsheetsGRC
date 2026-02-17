/**
 * Risk Categories Constant
 *
 * Story 7.6: Risk Assessment Form with Auto-Save (AC3)
 *
 * Provides standardized risk categories for assessment classification.
 * Categories align with common GRC frameworks and organizational domains.
 *
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

/**
 * Available risk categories for assessments
 * Used in Risk Category dropdown (AC3)
 */
export const RISK_CATEGORIES = [
  "Access Control",
  "Data Protection",
  "Network Security",
  "Application Security",
  "Identity Management",
  "Encryption",
  "Logging & Monitoring",
  "Incident Response",
  "Business Continuity",
  "Third Party Risk",
  "Physical Security",
  "Other",
] as const;

/**
 * Type for a valid risk category
 */
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

/**
 * Risk category options for form selects
 * Includes label and value for UI components
 */
export const RISK_CATEGORY_OPTIONS = RISK_CATEGORIES.map((category) => ({
  value: category,
  label: category,
}));
