/**
 * Hooks Index
 *
 * Central export file for all custom React hooks.
 *
 * @see Story 1.8: Role-Based UI Component Rendering
 * @see Story 7.8.8: Multiplicative Scoring Algorithm
 */

export { usePermission } from "./usePermission";
export { useHasRole } from "./useHasRole";
export { useRiskScore, getScoreStatusMessage } from "./useRiskScore";
export type { UseRiskScoreParams, UseRiskScoreResult } from "./useRiskScore";
