"use client";

/**
 * Inline Assessment Section Component
 *
 * Story 7.11: Finding Detail Page (AC23-AC30)
 * Story 7.6: Risk Assessment Form with Auto-Save (AC12 integration)
 *
 * Displays the risk assessment inline with the finding:
 * - AC23: Section visible only when status = ACCEPTED
 * - AC24: Visual separator between finding and assessment
 * - AC25: Assessment header with identifier and status badge
 * - AC26: Collapsible/expandable section
 * - AC27: Default expanded after initial acceptance
 * - AC28: Contains AssessmentForm component (Story 7.6)
 * - AC29: Contains ScenarioList component (Story 7.7)
 * - AC30: Contains ApprovalGateChecklist component (Story 7.6)
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 * @see Story 7.6: Risk Assessment Form with Auto-Save
 */

import { useState, useCallback, useMemo } from "react";
import { type AssessmentStatus, type TreatmentType, Prisma } from "@prisma/client";
import { ChevronDown, ChevronUp, FileCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { AssessmentForm } from "./AssessmentForm";
import { ApprovalGateChecklist } from "./ApprovalGateChecklist";
import { ScenarioList } from "./ScenarioList";
import { AssessmentActions, ApprovalStatusBadge } from "@/components/assessment";

/**
 * Assessment status badge configuration
 */
const STATUS_CONFIG: Record<AssessmentStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-600",
  },
  APPROVED: {
    label: "Approved",
    className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600",
  },
};

/**
 * Assessment data from Finding query (accepts Prisma Decimal types)
 */
interface AssessmentInput {
  id: string;
  identifier: string;
  title: string;
  context: string | null;
  riskCategory?: string | null;
  status: AssessmentStatus;
  affectedSystems: string[];
  likelihoodValue?: number | Prisma.Decimal | null;
  impactValue?: number | Prisma.Decimal | null;
  treatment?: TreatmentType | null;
  ownerId?: string | null;
  createdAt: Date | string;
  createdBy?: string;
  approvedAt?: Date | string | null;
  approvedBy?: string | null;
  approvedByUser?: { id: string; name: string | null; email: string } | null;
  owner?: { id: string; name: string | null; email: string | null } | null;
  scenarios?: { id: string; description: string }[];
  riskRegisterEntry?: { id: string; identifier: string; status: string } | null;
}

/**
 * Normalized assessment data for internal use (number types)
 */
interface AssessmentData {
  id: string;
  identifier: string;
  title: string;
  context: string | null;
  riskCategory: string | null;
  status: AssessmentStatus;
  affectedSystems: string[];
  likelihoodValue: number | null;
  impactValue: number | null;
  treatment: TreatmentType | null;
  ownerId: string | null;
  approvedAt?: Date | string | null;
  owner?: { id: string; name: string | null; email: string | null } | null;
  // Story 16.1: Business context fields
  businessOwnerId: string | null;
  businessUnitId: string | null;
  performedById: string | null;
  businessOwner?: { id: string; name: string | null; email: string | null } | null;
  businessUnit?: { id: string; name: string; code: string | null } | null;
  performedBy?: { id: string; name: string | null; email: string | null } | null;
  approvalGates: {
    canApprove: boolean;
    missingGates: string[];
  };
}

interface InlineAssessmentSectionProps {
  /** The risk assessment data */
  assessment: AssessmentInput;
  /** Whether to start expanded (AC27) */
  defaultExpanded?: boolean;
  /** Callback when assessment is updated */
  onUpdate?: (assessment: AssessmentInput) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Helper to convert Prisma.Decimal to number
 */
function toNumber(value: number | Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

/**
 * Displays the risk assessment section inline with the finding.
 *
 * @example
 * ```tsx
 * {finding.status === "ACCEPTED" && finding.riskAssessment && (
 *   <InlineAssessmentSection
 *     assessment={finding.riskAssessment}
 *     defaultExpanded={true}
 *   />
 * )}
 * ```
 */
export function InlineAssessmentSection({
  assessment: initialAssessment,
  defaultExpanded = true,
  onUpdate,
  className,
}: InlineAssessmentSectionProps) {
  // AC26, AC27: Collapsible section, default expanded
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Local state for optimistic updates from auto-save
  const [assessment, setAssessment] = useState(initialAssessment);

  const statusConfig = STATUS_CONFIG[assessment.status];

  // Get approval gates (use default if not provided)
  const approvalGates = useMemo(() => ({
    canApprove: false,
    missingGates: [
      ...(toNumber(assessment.likelihoodValue) === null || toNumber(assessment.impactValue) === null
        ? ["Score populated (likelihood and impact values required)"]
        : []),
      ...(!assessment.scenarios || assessment.scenarios.length === 0
        ? ["Scenario defined (at least one risk scenario required)"]
        : []),
      ...(assessment.treatment === null || assessment.treatment === undefined
        ? ["Treatment selected (ACCEPT, MITIGATE, TRANSFER, or AVOID)"]
        : []),
      ...(assessment.ownerId === null || assessment.ownerId === undefined
        ? ["Owner assigned"]
        : []),
    ],
  }), [assessment.likelihoodValue, assessment.impactValue, assessment.scenarios, assessment.treatment, assessment.ownerId]);

  // Normalize assessment data for AssessmentForm
  const normalizedAssessment: AssessmentData = useMemo(() => ({
    id: assessment.id,
    identifier: assessment.identifier,
    title: assessment.title,
    context: assessment.context,
    riskCategory: assessment.riskCategory ?? null,
    status: assessment.status,
    affectedSystems: assessment.affectedSystems,
    likelihoodValue: toNumber(assessment.likelihoodValue),
    impactValue: toNumber(assessment.impactValue),
    treatment: assessment.treatment ?? null,
    ownerId: assessment.ownerId ?? null,
    approvedAt: assessment.approvedAt,
    owner: assessment.owner,
    // Story 16.1: Business context fields (cast via unknown for flexible typing)
    businessOwnerId: (assessment as unknown as { businessOwnerId?: string | null }).businessOwnerId ?? null,
    businessUnitId: (assessment as unknown as { businessUnitId?: string | null }).businessUnitId ?? null,
    performedById: (assessment as unknown as { performedById?: string | null }).performedById ?? null,
    businessOwner: (assessment as unknown as { businessOwner?: { id: string; name: string | null; email: string | null } | null }).businessOwner ?? null,
    businessUnit: (assessment as unknown as { businessUnit?: { id: string; name: string; code: string | null } | null }).businessUnit ?? null,
    performedBy: (assessment as unknown as { performedBy?: { id: string; name: string | null; email: string | null } | null }).performedBy ?? null,
    approvalGates: {
      canApprove: approvalGates.missingGates.length === 0,
      missingGates: approvalGates.missingGates,
    },
  }), [assessment, approvalGates]);

  // Handle assessment updates from form
  const handleAssessmentUpdate = useCallback((updated: AssessmentData) => {
    // Convert back to input format
    const updatedInput: AssessmentInput = {
      ...assessment,
      ...updated,
    };
    setAssessment(updatedInput);
    onUpdate?.(updatedInput);
  }, [assessment, onUpdate]);

  // Determine if form should be read-only
  const isReadOnly = assessment.status !== "DRAFT";

  return (
    <div className={className}>
      {/* AC24: Visual separator between finding and assessment */}
      <Separator className="my-6" />

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* AC25: Assessment header with identifier and status badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">
              Risk Assessment
            </h2>
            <Badge variant="outline" className="font-mono">
              {assessment.identifier}
            </Badge>
            <Badge variant="outline" className={`border ${statusConfig.className}`}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* AC26: Collapse/expand toggle */}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expand
                </>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-6">
          {/* AC28: AssessmentForm component (Story 7.6) */}
          <AssessmentForm
            assessment={normalizedAssessment}
            isReadOnly={isReadOnly}
            onUpdate={handleAssessmentUpdate}
          />
          {/* AC29: ScenarioList component (Story 7.7) */}
          <ScenarioList
            scenarios={(assessment.scenarios || []).map((s, i) => ({ ...s, order: i }))}
            assessmentId={assessment.id}
            isReadOnly={isReadOnly}
            onUpdate={() => onUpdate?.(assessment)}
          />

          {/* AC30: ApprovalGateChecklist component */}
          <ApprovalGateChecklist gates={normalizedAssessment.approvalGates} />

          {/* AC31-AC34: Assessment Actions (Approve/Reject) */}
          {assessment.status === "DRAFT" && (
            <AssessmentActions
              assessmentId={assessment.id}
              status={assessment.status}
              gates={normalizedAssessment.approvalGates}
              canModify={true}
              onApproved={() => {
                // Refresh the assessment data
                onUpdate?.(assessment);
              }}
              onRejected={() => {
                onUpdate?.(assessment);
              }}
            />
          )}

          {/* AC30: ApprovalStatusBadge for approved/rejected assessments */}
          {(assessment.status === "APPROVED" || assessment.status === "REJECTED") && (
            <ApprovalStatusBadge
              status={assessment.status}
              approvedAt={assessment.approvedAt ? new Date(assessment.approvedAt as string) : null}
              approvedBy={assessment.approvedByUser}
              riskRegisterEntry={assessment.riskRegisterEntry}
            />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
