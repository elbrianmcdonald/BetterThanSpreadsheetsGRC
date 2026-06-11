/**
 * Risk Matrix Module
 *
 * Story 7.8.3: RiskMatrixVersion Schema & Lifecycle
 * Story 7.8.4: Default Matrix & Assessment Type Seeding
 * Story 7.8.5: Matrix Builder UI - Scales
 * Story 7.8.7: Matrix Version Publishing
 * Story 7.8.8: Multiplicative Scoring Algorithm
 *
 * Exports types, validation functions, defaults, and utilities for risk matrices.
 */

export * from "./types";
export * from "./validation";
export * from "./defaults";
export * from "./seedDefaults";
export * from "./scaleTemplates";
export * from "./thresholdTemplates";
export * from "./colorUtils";
export * from "./comparison";
export * from "./scoring";
export * from "./heatmap";
