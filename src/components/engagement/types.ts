/**
 * Shared client-side types for the Engagement Wizard (Epic 18).
 *
 * These mirror the shape returned by `api.engagement.getById`. They are kept
 * local (rather than imported from the router output) so the step components
 * can be authored against an explicit contract.
 */

export type EngagementPhase =
  | "setup"
  | "schedule"
  | "stakeholders"
  | "evidence"
  | "interviews"
  | "review";

export type EngagementStatus =
  | "SCOPING"
  | "SCHEDULED"
  | "FIELDWORK"
  | "REVIEW"
  | "DELIVERED";

export type AssessmentKind =
  | "COMPLIANCE"
  | "VENDOR"
  | "RISK"
  | "MATURITY"
  | "BIA";

export type RaciRole = "R" | "A" | "C" | "I";

export type EvidenceStatus = "REQUESTED" | "PARTIAL" | "RECEIVED";

export interface EngagementSession {
  id: string;
  name: string;
  purpose: string | null;
  week: string | null;
  duration: string | null;
  attendees: string[];
  sortOrder: number;
}

export interface EngagementStakeholder {
  id: string;
  name: string;
  role: string | null;
  domain: string | null;
  raci: RaciRole | null;
  isReviewer: boolean;
  isApprover: boolean;
  sortOrder: number;
}

export interface EngagementEvidenceRequest {
  id: string;
  item: string;
  domain: string | null;
  status: EvidenceStatus;
  sortOrder: number;
}

/**
 * Resolved descriptor for the wrapped assessment, as returned by
 * `engagement.getById`'s `linkedAssessment`. `href` points at the assessment's
 * native detail page (where interviews/scoring happen).
 */
export interface LinkedAssessmentRef {
  kind: AssessmentKind;
  id: string;
  name: string;
  status: string | null;
  href: string;
}

export interface EngagementDetail {
  id: string;
  identifier: string;
  clientName: string;
  sector: string | null;
  size: string | null;
  engagementWindow: string | null;
  consultancy: string | null;
  /** Polymorphic link to the wrapped assessment. */
  assessmentKind: AssessmentKind;
  assessmentId: string;
  status: EngagementStatus;
  phase: EngagementPhase;
  inScopeDomains: string[];
  sessions: EngagementSession[];
  stakeholders: EngagementStakeholder[];
  evidenceRequests: EngagementEvidenceRequest[];
  /** Resolved descriptor for the wrapped assessment (null if it was deleted). */
  linkedAssessment: LinkedAssessmentRef | null;
}

/** Ordered list of wizard phases (matches ASSESSMENT_PHASES order). */
export const PHASE_ORDER: EngagementPhase[] = [
  "setup",
  "schedule",
  "stakeholders",
  "evidence",
  "interviews",
  "review",
];
