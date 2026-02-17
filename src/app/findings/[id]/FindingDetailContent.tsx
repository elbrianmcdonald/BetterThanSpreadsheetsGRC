"use client";

/**
 * Finding Detail Content Component
 *
 * Story 7.11: Finding Detail Page with Inline Expansion
 *
 * Client component that handles interactive elements:
 * - FindingActions with mutation callbacks
 * - InlineAssessmentSection with collapsible state
 * - Data refetching after status transitions
 *
 * @see Story 7.11: Finding Detail Page with Inline Expansion
 */

import { useRouter } from "next/navigation";
import {
  type UserRole,
  type FindingStatus,
  type FindingSource,
  type Severity,
  type AssessmentStatus,
  type TreatmentType,
} from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import { FileSearch } from "lucide-react";

import { api } from "@/trpc/react";
import { FindingHeader } from "@/components/findings/FindingHeader";
import { FindingDetails } from "@/components/findings/FindingDetails";
import { FindingActions } from "@/components/findings/FindingActions";
import { InlineAssessmentSection } from "@/components/findings/InlineAssessmentSection";
// Story 12.7: Finding-to-Control Linkage
import { FindingLinkedControls } from "@/components/findings/FindingLinkedControls";

/**
 * Extended finding data type with all included relations
 * Defined locally since tRPC type inference may not capture includes correctly
 */
interface FindingData {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: FindingStatus;
  source: FindingSource;
  severity: Severity;
  organizationId: string;
  affectedAssets: string[];
  evidenceIds: string[];
  assigneeId: string | null;
  duplicateOfId: string | null;
  lockedSnapshot: unknown;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  triagedBy: string | null;
  triagedAt: Date | null;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  // Included relations
  creator: { id: string; name: string | null; email: string | null };
  assignee: { id: string; name: string | null; email: string | null } | null;
  triager: { id: string; name: string | null; email: string | null } | null;
  accepter: { id: string; name: string | null; email: string | null } | null;
  affectedBusinessUnits: { id: string; name: string }[];
  duplicateOf: { id: string; identifier: string; title: string } | null;
  riskAssessment: {
    id: string;
    identifier: string;
    title: string;
    context: string | null;
    riskCategory: string | null;
    status: AssessmentStatus;
    affectedSystems: string[];
    likelihoodValue: Decimal | null;
    impactValue: Decimal | null;
    treatment: TreatmentType | null;
    ownerId: string | null;
    createdAt: Date;
    createdBy: string;
    approvedAt: Date | null;
    // Additional fields required by Prisma type
    organizationId: string;
    updatedAt: Date;
    exposureValue: Decimal | null;
    inherentScore: Decimal | null;
    inherentScoreLabel: string | null;
    residualScore: Decimal | null;
    residualScoreLabel: string | null;
    findingId: string | null;
    approverId: string | null;
    owner: { id: string; name: string | null; email: string | null } | null;
    scenarios: { id: string; description: string }[];
  } | null;
}

interface FindingDetailContentProps {
  /** Initial finding data from server */
  finding: FindingData;
  /** Current user's role */
  userRole: UserRole;
}

/**
 * Client component for finding detail page interactions.
 *
 * @example
 * ```tsx
 * <FindingDetailContent
 *   finding={finding}
 *   userRole={session.user.role}
 * />
 * ```
 */
export function FindingDetailContent({
  finding: initialFinding,
  userRole,
}: FindingDetailContentProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Use initial data from server, refetch on demand
  // Type assertion needed due to tRPC type inference limitations with Prisma includes
  const { data: finding } = api.finding.getById.useQuery(
    { id: initialFinding.id },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialData: initialFinding as any,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    }
  ) as { data: FindingData };

  // Callback after status transition (e.g., accepting a finding)
  const handleTransitionComplete = () => {
    // Invalidate and refetch finding data
    utils.finding.getById.invalidate({ id: finding.id });
    // Also refresh the page to update server-rendered content
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-2">
        <FileSearch className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground sr-only">
          Finding: {finding.identifier}
        </h1>
      </div>

      {/* AC7-AC12: Finding Header Section */}
      <FindingHeader
        identifier={finding.identifier}
        status={finding.status}
        source={finding.source}
        severity={finding.severity}
        createdAt={finding.createdAt}
        creator={finding.creator}
        acceptedAt={finding.acceptedAt}
        accepter={finding.accepter}
      />

      {/* AC13-AC18: Finding Details Section */}
      <FindingDetails
        title={finding.title}
        description={finding.description}
        affectedAssets={finding.affectedAssets}
        affectedBusinessUnits={finding.affectedBusinessUnits}
        status={finding.status}
      />

      {/* Story 12.7: Linked Controls Section (AC1-AC10) */}
      <FindingLinkedControls
        findingId={finding.id}
        findingIdentifier={finding.identifier}
      />

      {/* AC19-AC22: Finding Actions Section */}
      <FindingActions
        finding={{
          id: finding.id,
          identifier: finding.identifier,
          title: finding.title,
          status: finding.status,
          severity: finding.severity,
        }}
        userRole={userRole}
        onTransitionComplete={handleTransitionComplete}
        className="py-2"
      />

      {/* AC23-AC30: Inline Assessment Section (only when ACCEPTED) */}
      {finding.status === "ACCEPTED" && finding.riskAssessment && (
        <InlineAssessmentSection
          assessment={finding.riskAssessment}
          defaultExpanded={true}
        />
      )}
    </div>
  );
}
