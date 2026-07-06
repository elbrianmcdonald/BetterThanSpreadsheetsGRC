/**
 * Assessment Components Index
 *
 * Story 7.8.8: Multiplicative Scoring Algorithm
 * Story 7.8.9: Assessment Form Matrix Integration
 * Story 7.9: Approval Gates & Assessment Approval
 *
 * Exports assessment-related UI components.
 */

// Story 7.8.8: Score display components
export { ScoreDisplay, ScoreBadge } from "./ScoreDisplay";

// Story 7.8.9: Form selector components
export { AssessmentTypeSelector } from "./AssessmentTypeSelector";
export { MatrixSelector, MatrixDisplay } from "./MatrixSelector";
export { ScaleLevelSelector, ScaleLevelDisplay } from "./ScaleLevelSelector";
export { MatrixPreview, CompactMatrixPreview } from "./MatrixPreview";
export { AssessmentScoringPanel } from "./AssessmentScoringPanel";

// Story 7.9: Approval gate components
export {
  ApprovalGateChecklist,
  ApprovalGateSummary,
  ALL_GATES,
  GATE_SHORT_LABELS,
  type ApprovalGateResult,
} from "./ApprovalGateChecklist";

// Epic 3: Vendor Assessment Workflow
export {
  AssessmentStatusBadge,
  getAssessmentStatusOptions,
} from "./AssessmentStatusBadge";
export {
  AssessmentRecommendationBadge,
  getAssessmentRecommendationOptions,
} from "./AssessmentRecommendationBadge";
export { VendorAssessmentForm } from "./VendorAssessmentForm";
