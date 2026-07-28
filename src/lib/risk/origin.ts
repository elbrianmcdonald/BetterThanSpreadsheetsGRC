/**
 * Risk origin resolver.
 *
 * A risk can be born from several kinds of assessment, each tracked by its own
 * foreign key on the Risk model. This helper collapses whichever origin relation
 * is populated into a single { label, href } for the risk detail Overview
 * ("Identified in: …").
 *
 * Origins handled (in precedence order):
 *   - SourceRiskAssessmentQuestion  → routes to its parent RiskAssessmentProject
 *   - DiscoveryProject               (RiskAssessmentProject — the primary path)
 *   - sourceComplianceAssessment     (ComplianceAssessment)
 *   - VendorAssessment               (VendorAssessment)
 *
 * Deliberately NOT handled: `Risk.assessmentId` (relation `Assessment` →
 * RiskAssessment). That FK is never populated on create and no page route loads
 * a RiskAssessment by id, so linking it would only ever produce dead links.
 * Do not add it here without also adding a route and a creation path.
 */

export interface RiskOrigin {
  /** Human-facing label, e.g. "COMP-2026-0007 — SOC 2 Type II". */
  label: string;
  /** Route to the originating record, or null when the origin has no page. */
  href: string | null;
}

/** The origin relations resolveRiskOrigin reads. All optional/nullable. */
export interface RiskOriginRelations {
  DiscoveryProject?: { id: string; subject: string | null } | null;
  sourceComplianceAssessment?: {
    id: string;
    identifier: string | null;
    name: string | null;
  } | null;
  VendorAssessment?: {
    id: string;
    identifier: string | null;
    title: string | null;
  } | null;
  SourceRiskAssessmentQuestion?: {
    id: string;
    /** Question number is a string in the schema (supports "1.3" numbering). */
    number: string | null;
    text: string | null;
  } | null;
}

/** Joins non-empty parts with an em dash, e.g. "VA-2026-0003 — Acme Review". */
function joinLabel(...parts: Array<string | null | undefined>): string {
  return parts.map((p) => p?.trim()).filter(Boolean).join(" — ");
}

/**
 * Resolves the assessment a risk was identified in, or null when the risk has
 * no assessment origin (created manually or via CSV import).
 */
export function resolveRiskOrigin(
  risk: RiskOriginRelations
): RiskOrigin | null {
  const {
    DiscoveryProject: project,
    sourceComplianceAssessment: compliance,
    VendorAssessment: vendor,
    SourceRiskAssessmentQuestion: question,
  } = risk;

  // A question-sourced risk: label by its parent project (when set) plus the
  // question number, routed to the project. The question "number" is a verbatim
  // control refcode (e.g. "PR.DS-1"), not an integer — do not prefix it.
  if (question) {
    return {
      label: joinLabel(project?.subject, question.number) || "Risk assessment",
      href: project ? `/risk-assessments/${project.id}` : null,
    };
  }

  if (project) {
    return {
      label: project.subject?.trim() || "Risk assessment",
      href: `/risk-assessments/${project.id}`,
    };
  }

  if (compliance) {
    return {
      label: joinLabel(compliance.identifier, compliance.name),
      href: `/compliance/assessments/${compliance.id}`,
    };
  }

  if (vendor) {
    return {
      label: joinLabel(vendor.identifier, vendor.title),
      href: `/tprm/assessments/${vendor.id}`,
    };
  }

  return null;
}
