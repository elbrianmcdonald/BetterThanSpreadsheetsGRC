"use client";

/**
 * Finding Detail Content Component
 *
 * Story 7.11: Finding Detail Page
 *
 * Client component that handles interactive elements:
 * - FindingActions with mutation callbacks
 * - Data refetching after status transitions
 */

import { useRouter } from "next/navigation";
import {
  type UserRole,
  type FindingStatus,
  type FindingSource,
  type Severity,
} from "@prisma/client";
import { FileSearch } from "lucide-react";

import { api } from "@/trpc/react";
import { FindingHeader } from "@/components/findings/FindingHeader";
import { FindingDetails } from "@/components/findings/FindingDetails";
import { FindingSeverityPanel } from "@/components/findings/FindingSeverityPanel";
import { FindingLinkedRisksSection } from "@/components/findings/FindingLinkedRisksSection";
import { FindingActions } from "@/components/findings/FindingActions";
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
  severityLabel: string | null;
  matrixVersionId: string | null;
  organizationId: string;
  // Story 20.1 follow-up: finding-context documentation
  cveId: string | null;
  discoveryDate: Date | null;
  technicalDetails: string | null;
  // Story 20.2: matrix scores (Prisma Decimals arrive serialized — number|string)
  inherentLikelihood: number | string | null;
  inherentImpact: number | string | null;
  inherentExposure: number | string | null;
  inherentScore: number | string | null;
  residualLikelihood: number | string | null;
  residualImpact: number | string | null;
  residualExposure: number | string | null;
  residualScore: number | string | null;
  residualScoreLabel: string | null;
  residualEliminated: boolean;
  // Story 21.2: linked register risks (23.1 adds latest treatment for badges)
  riskLinks?: {
    riskId: string;
    risk: {
      id: string;
      identifier: string | null;
      title: string;
      severity: Severity;
      status: string;
      Treatments?: { treatmentType: string; decidedAt: Date | string }[];
    };
  }[];
  affectedAssets: string[];
  evidenceIds: string[];
  assigneeId: string | null;
  duplicateOfId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  triagedBy: string | null;
  triagedAt: Date | null;
  // Included relations
  creator: { id: string; name: string | null; email: string | null };
  assignee: { id: string; name: string | null; email: string | null } | null;
  triager: { id: string; name: string | null; email: string | null } | null;
  affectedBusinessUnits: { id: string; name: string }[];
  duplicateOf: { id: string; identifier: string; title: string } | null;
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
        severityLabel={finding.severityLabel}
        createdAt={finding.createdAt}
        creator={finding.creator}
      />

      {/* AC13-AC18: Finding Details Section */}
      <FindingDetails
        title={finding.title}
        description={finding.description}
        affectedAssets={finding.affectedAssets}
        affectedBusinessUnits={finding.affectedBusinessUnits}
        status={finding.status}
        cveId={finding.cveId}
        discoveryDate={finding.discoveryDate}
        technicalDetails={finding.technicalDetails}
      />

      {/* Story 20.2: Severity panel with rescore against the locked matrix */}
      <FindingSeverityPanel
        findingId={finding.id}
        status={finding.status}
        canRescore={["ANALYST", "ANALYST", "ADMINISTRATOR"].includes(userRole)}
        severityLabel={finding.severityLabel}
        matrixVersionId={finding.matrixVersionId}
        inherentLikelihood={finding.inherentLikelihood}
        inherentImpact={finding.inherentImpact}
        inherentExposure={finding.inherentExposure}
        inherentScore={finding.inherentScore}
        residualLikelihood={finding.residualLikelihood}
        residualImpact={finding.residualImpact}
        residualExposure={finding.residualExposure}
        residualScore={finding.residualScore}
        residualScoreLabel={finding.residualScoreLabel}
        residualEliminated={finding.residualEliminated}
        onRescored={handleTransitionComplete}
      />

      {/* Story 21.3: Linked risks — where this observation rolls up */}
      <FindingLinkedRisksSection
        findingId={finding.id}
        findingIdentifier={finding.identifier}
        status={finding.status}
        riskLinks={finding.riskLinks ?? []}
        onChanged={handleTransitionComplete}
        canManage={["ANALYST", "ANALYST", "ADMINISTRATOR"].includes(userRole)}
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
        linkedRiskIds={finding.riskLinks?.map((l) => l.riskId) ?? []}
        userRole={userRole}
        onTransitionComplete={handleTransitionComplete}
        className="py-2"
      />
    </div>
  );
}
