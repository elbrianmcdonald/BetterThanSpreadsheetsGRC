"use client";

/**
 * Risk Detail Client Component
 *
 * Story 4.17: Risk Detail Page with Full Context and Actions
 *
 * Comprehensive risk detail page with:
 * - Hero section with title, severity, status, impact score
 * - Tab navigation: Findings, Evidence, Remediation, Comments, Audit Trail, History
 * - Sidebar with metadata and role-based actions
 *
 * @see Story 4.17: Risk Detail Page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { UserRole, RiskStatus } from "@prisma/client";
import toast from "react-hot-toast";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Story 4.17: New components
import { RiskDetailHero } from "@/components/risk/RiskDetailHero";
import { RiskDetailTabs, useActiveTab } from "@/components/risk/RiskDetailTabs";
import { RiskMetadataSidebar } from "@/components/risk/RiskMetadataSidebar";
import { RiskActionsSidebar } from "@/components/risk/RiskActionsSidebar";

// Tab content components
import { RiskFindingDisplay } from "@/components/risk/RiskFindingDisplay";
import { RiskEvidenceSection } from "@/components/risk/RiskEvidenceSection";
import { RemediationOptionsList } from "@/components/risk/RemediationOptionsList";
import { RiskComments } from "@/components/risk/RiskComments";
import { RiskAuditTrail } from "@/components/risk/RiskAuditTrail";
import { StatusHistory } from "@/components/risk/StatusHistory";
import { BusinessImpactStatement } from "@/components/risk/BusinessImpactStatement";
// Story 12.6: Risk-to-Control Linkage
import { RiskControlsSection } from "@/components/risk/RiskControlsSection";
// Story 21.3: Risk ↔ Finding link management
import { RiskLinkedFindingsSection } from "@/components/risk/RiskLinkedFindingsSection";
// Story 22.1: Derived scoring display
import { RiskEffectiveScoreCard } from "@/components/risk/RiskEffectiveScoreCard";
// Story 23.1: Risk-level acceptance
import { RiskTreatmentSection } from "@/components/risk/RiskTreatmentSection";
// Story 16.4: Residual Severity Section
import { ResidualSeveritySection } from "@/components/risk/ResidualSeveritySection";
// Story 16.2: MITRE Threat Modeling
import { ThreatModelingSection } from "@/components/risk/ThreatModelingSection";
// Story 16.9: Attack Chain Visualization
import { AttackChainVisualization } from "@/components/risk/AttackChainVisualization";

// Story 16.8: Treatment SLA Display
import { TreatmentSLACard } from "@/components/risk/TreatmentSLACard";

// Dialogs
import { EditRiskDialog } from "@/components/risk/EditRiskDialog";
import { AttachEvidenceDialog } from "@/components/risk/AttachEvidenceDialog";
import { StatusTransitionDialog } from "@/components/risk/StatusTransitionDialog";
import { AssignRiskDialog } from "@/components/risk/AssignRiskDialog";

interface RiskDetailClientProps {
  riskId: string;
}

/** Roles that can attach/link evidence */
const CAN_ATTACH_EVIDENCE_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
  UserRole.BUSINESS_USER,
];

/** Roles that can export audit trail */
const CAN_EXPORT_AUDIT_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
  UserRole.BUSINESS_USER,
];

/** Roles that can comment */
const CAN_COMMENT_ROLES: UserRole[] = [
  UserRole.ANALYST,
  UserRole.ADMINISTRATOR,
  UserRole.ANALYST,
  UserRole.BUSINESS_USER,
  UserRole.BUSINESS_USER,
];

export function RiskDetailClient({ riskId }: RiskDetailClientProps) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const activeTab = useActiveTab();

  // Track client-side mount to prevent hydration mismatches with session-dependent UI
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [attachEvidenceOpen, setAttachEvidenceOpen] = useState(false);
  const [statusTransitionOpen, setStatusTransitionOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // User permissions - only evaluate after mount to prevent hydration mismatch
  const userRole = isMounted ? (session?.user?.role as UserRole | undefined) : undefined;
  const userId = isMounted ? session?.user?.id : undefined;
  const canAttachEvidence = userRole && CAN_ATTACH_EVIDENCE_ROLES.includes(userRole);
  const canExportAudit = userRole && CAN_EXPORT_AUDIT_ROLES.includes(userRole);
  const canComment = userRole && CAN_COMMENT_ROLES.includes(userRole);
  const canEditImpactStatement =
    userRole && (userRole === UserRole.ANALYST || userRole === UserRole.ADMINISTRATOR);
  // Story 23.5 (review MJ-5): mirrors the server's RISK_UPDATE_ROLES —
  // Security Engineers may override scores, accept risk, and manage links.
  const canManageRisk =
    userRole &&
    (userRole === UserRole.ANALYST ||
      userRole === UserRole.ANALYST ||
      userRole === UserRole.ADMINISTRATOR);

  // Fetch risk data with all relations
  const {
    data: risk,
    isLoading,
    error,
    refetch,
  } = api.risk.getById.useQuery({ id: riskId });

  // Controls tab count — sources from organizational controls (the /controls
  // library) via RiskOrganizationalControl, matching the UI in the tab.
  const { data: orgControlLinks } = api.organizationalControl.getForRisk.useQuery(
    { riskId },
    { enabled: !!risk }
  );

  // Story 16.4: Fetch the matrix version the risk was scored against. Falls
  // back to the org's published matrix for older risks without a locked
  // version. Using the locked version is the correct long-term source of
  // truth; getOrgPublishedMatrix also returns null when no template is
  // flagged isDefault, which previously made this section display nothing.
  const { data: lockedMatrix } = api.riskMatrix.getVersionForAssessment.useQuery(
    { id: risk?.matrixVersionId ?? "" },
    { enabled: !!risk?.matrixVersionId }
  );
  const { data: fallbackMatrix } = api.riskMatrix.getOrgPublishedMatrix.useQuery(
    undefined,
    { enabled: !!risk && !risk.matrixVersionId }
  );
  const matrixData = lockedMatrix
    ? {
        scales: lockedMatrix.scales,
        thresholds: lockedMatrix.thresholds,
        outputScaleMax: lockedMatrix.template.outputScaleMax,
      }
    : fallbackMatrix;

  // Story 16.9: Fetch threat modeling data for attack chain visualization
  const { data: threatModelingData } = api.risk.getThreatModeling.useQuery(
    { riskId },
    { enabled: !!risk }
  );

  // Delete risk mutation
  const deleteMutation = api.risk.delete.useMutation({
    onSuccess: () => {
      toast.success("Risk deleted");
      router.push("/risks");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle delete confirmation
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this risk? This action cannot be undone.")) {
      deleteMutation.mutate({ id: riskId });
    }
  };

  // Handle mark remediated
  const handleMarkRemediated = () => {
    setStatusTransitionOpen(true);
  };

  // Breadcrumbs for layout
  const breadcrumbs = [
    { label: "Risk", href: "/risks" },
    { label: risk?.title || "Loading..." },
  ];

  // Loading state - include isMounted check to prevent hydration mismatch
  if (!isMounted || isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <div>
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-red-100 p-4 mb-6">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            {error.data?.code === "FORBIDDEN" ? "Access Denied" : "Error Loading Risk"}
          </h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            {error.data?.code === "FORBIDDEN"
              ? "You don't have permission to view this risk."
              : error.message}
          </p>
          <Button variant="outline" onClick={() => router.push("/risks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Not found state
  if (!risk) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-amber-100 p-4 mb-6">
            <AlertTriangle className="h-10 w-10 text-amber-600" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Risk Not Found</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md">
            The risk you're looking for doesn't exist or has been deleted.
          </p>
          <Button variant="outline" onClick={() => router.push("/risks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Get counts for tabs
  const counts = {
    controlsCount:
      (orgControlLinks?.inPlace.length ?? 0) + (orgControlLinks?.needed.length ?? 0),
    evidenceCount: risk.RiskEvidence?.length ?? 0,
    remediationCount: risk.RemediationOptions?.length ?? 0,
    commentsCount: risk.Comments?.length ?? 0,
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "findings":
        return (
          <div className="space-y-6">
            <RiskFindingDisplay
              risk={{
                id: risk.id,
                title: risk.title,
                description: risk.description,
                affectedSystems: risk.affectedSystems,
                severity: risk.severity,
                status: risk.status,
                findingSource: risk.findingSource,
                cveId: risk.cveId,
                discoveryDate: risk.discoveryDate,
                technicalDetails: risk.technicalDetails,
                createdAt: risk.createdAt,
                updatedAt: risk.updatedAt,
                // Story 16.3: Controls documentation fields
                mitigatingControlsInPlace: risk.mitigatingControlsInPlace,
                preventativeControlsInPlace: risk.preventativeControlsInPlace,
                mitigatingControlsNeeded: risk.mitigatingControlsNeeded,
                preventativeControlsNeeded: risk.preventativeControlsNeeded,
              }}
              showHeader={false}
            />
            {/* Story 22.1: Effective severity (derived from linked findings) */}
            <RiskEffectiveScoreCard
              riskId={riskId}
              matrixVersionId={risk.matrixVersionId}
              canManage={!!canManageRisk}
              useManualScore={risk.useManualScore}
              manualScore={risk.manualScore ? Number(risk.manualScore) : null}
              manualScoreLabel={risk.manualScoreLabel}
              manualLikelihood={risk.manualLikelihood ? Number(risk.manualLikelihood) : null}
              manualImpact={risk.manualImpact ? Number(risk.manualImpact) : null}
              manualExposure={risk.manualExposure ? Number(risk.manualExposure) : null}
              calculatedScore={risk.calculatedScore ? Number(risk.calculatedScore) : null}
              calculatedScoreLabel={risk.calculatedScoreLabel}
              effectiveScore={risk.effectiveScore ? Number(risk.effectiveScore) : null}
              effectiveScoreLabel={risk.effectiveScoreLabel}
              effectiveScoreSource={risk.effectiveScoreSource}
              onChanged={() => refetch()}
            />
            {/* Story 23.1: Treatment / acceptance (risk-level only) */}
            <RiskTreatmentSection
              riskId={riskId}
              canManage={!!canManageRisk}
              acceptanceReReviewRequired={!!risk.acceptanceReReviewRequired}
              onChanged={() => refetch()}
            />
            {/* Story 21.3: Linked findings — the risk's evidence trail */}
            <RiskLinkedFindingsSection
              riskId={riskId}
              canManage={!!canManageRisk}
              onScoreChanged={() => refetch()}
            />
            <BusinessImpactStatement
              riskId={riskId}
              statement={risk.businessImpactStatement}
              canEdit={canEditImpactStatement}
              onSaved={() => refetch()}
            />
            {/* Story 16.4: Residual Severity Section (AC8-AC17) */}
            <ResidualSeveritySection
              riskId={riskId}
              residualLikelihood={risk.residualLikelihood ? Number(risk.residualLikelihood) : null}
              residualImpact={risk.residualImpact ? Number(risk.residualImpact) : null}
              residualExposure={risk.residualExposure ? Number(risk.residualExposure) : null}
              residualScore={risk.residualScore ? Number(risk.residualScore) : null}
              residualScoreLabel={risk.residualScoreLabel}
              inherentLikelihood={risk.inherentLikelihood ? Number(risk.inherentLikelihood) : null}
              inherentImpact={risk.inherentImpact ? Number(risk.inherentImpact) : null}
              inherentExposure={risk.inherentExposure ? Number(risk.inherentExposure) : null}
              inherentScore={risk.inherentScore ? Number(risk.inherentScore) : null}
              inherentScoreLabel={risk.inherentScoreLabel}
              scales={matrixData?.scales ?? null}
              thresholds={matrixData?.thresholds ?? null}
              outputScaleMax={matrixData?.outputScaleMax ?? null}
              isReadOnly={!canEditImpactStatement}
              defaultExpanded={false}
              onUpdate={() => refetch()}
            />
            {/* Story 16.2: MITRE ATT&CK Threat Modeling (AC10-AC22) */}
            <ThreatModelingSection
              riskId={riskId}
              isReadOnly={!canEditImpactStatement}
              defaultExpanded={false}
              onUpdate={() => refetch()}
            />
            {/* Story 16.9: Attack Chain Visualization (AC7) */}
            {(threatModelingData?.initialAccessVector ||
              (threatModelingData?.threatSteps?.length ?? 0) > 0 ||
              (threatModelingData?.threatObjectives?.length ?? 0) > 0) && (
              <AttackChainVisualization
                initialAccessVector={threatModelingData?.initialAccessVector}
                threatSteps={threatModelingData?.threatSteps}
                threatObjectives={threatModelingData?.threatObjectives}
              />
            )}
          </div>
        );

      // Controls tab — sources controls from the /controls organizational
      // control library via RiskOrganizationalControl (in-place + needed).
      case "controls":
        return <RiskControlsSection riskId={riskId} defaultExpanded />;

      case "evidence":
        return (
          <RiskEvidenceSection
            riskId={riskId}
            showActions={canAttachEvidence}
          />
        );

      case "remediation":
        return <RemediationOptionsList riskId={riskId} userRole={userRole} />;

      case "comments":
        return (
          <RiskComments
            riskId={riskId}
            currentUserId={userId ?? ""}
            currentUserRole={userRole ?? UserRole.BUSINESS_USER}
            canComment={!!canComment}
          />
        );

      case "audit-trail":
        return <RiskAuditTrail riskId={riskId} canExport={canExportAudit} />;

      case "history":
        return <StatusHistory riskId={riskId} />;

      default:
        return null;
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      {/* Hero Section (AC7-AC12) */}
      <RiskDetailHero
        risk={{
          id: risk.id,
          title: risk.title,
          severity: risk.severity,
          status: risk.status as RiskStatus,
          impactScore: risk.impactScore,
          createdAt: risk.createdAt,
          updatedAt: risk.updatedAt,
          CreatedBy: risk.CreatedBy,
        }}
        userRole={userRole}
        userId={userId}
        onEditClick={() => setEditDialogOpen(true)}
        onChangeStatusClick={() => setStatusTransitionOpen(true)}
        onDeleteClick={handleDelete}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Main content area (2/3 width) - Tabs */}
        <div className="lg:col-span-2">
          <RiskDetailTabs riskId={riskId} counts={counts}>
            {renderTabContent()}
          </RiskDetailTabs>
        </div>

        {/* Sidebar (1/3 width) */}
        <div className="space-y-4">
          {/* Metadata Sidebar (AC53-AC57) */}
          <RiskMetadataSidebar
            risk={{
              id: risk.id,
              assetCriticality: risk.assetCriticality,
              nextAuditDate: risk.nextAuditDate,
              createdAt: risk.createdAt,
              updatedAt: risk.updatedAt,
              itOwner: risk.ITOwner,
              businessOwner: risk.BusinessOwner,
              // Story 4.17 AC55: Frameworks affected from evidence mappings
              frameworksAffected: risk.frameworksAffected,
            }}
          />

          {/* Story 16.8: Treatment SLA Display (AC4) */}
          <TreatmentSLACard riskId={riskId} />

          {/* Actions Sidebar (AC58-AC63) */}
          <RiskActionsSidebar
            risk={{
              id: risk.id,
              status: risk.status as RiskStatus,
            }}
            userRole={userRole}
            hasRemediationOptions={(risk.RemediationOptions?.length ?? 0) > 0}
            onAssignClick={() => setAssignDialogOpen(true)}
            onChangeStatusClick={() => setStatusTransitionOpen(true)}
            onMarkRemediatedClick={handleMarkRemediated}
            onApproveClick={() => setStatusTransitionOpen(true)}
            onRejectClick={() => setStatusTransitionOpen(true)}
            onCloseRiskClick={() => setStatusTransitionOpen(true)}
          />
        </div>
      </div>

      {/* Dialogs */}
      <EditRiskDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        risk={{
          id: risk.id,
          title: risk.title,
          description: risk.description,
          affectedSystems: risk.affectedSystems,
          severity: risk.severity,
          findingSource: risk.findingSource,
          cveId: risk.cveId,
          discoveryDate: risk.discoveryDate,
          technicalDetails: risk.technicalDetails,
          assetCriticality: risk.assetCriticality,
          nextAuditDate: risk.nextAuditDate,
          // Story 16.3: Controls documentation fields
          mitigatingControlsInPlace: risk.mitigatingControlsInPlace,
          preventativeControlsInPlace: risk.preventativeControlsInPlace,
          mitigatingControlsNeeded: risk.mitigatingControlsNeeded,
          preventativeControlsNeeded: risk.preventativeControlsNeeded,
          enterpriseRiskId: (risk as { enterpriseRiskId?: string | null }).enterpriseRiskId ?? null,
        }}
        onSuccess={() => refetch()}
      />

      <AttachEvidenceDialog
        riskId={riskId}
        open={attachEvidenceOpen}
        onOpenChange={setAttachEvidenceOpen}
        onSuccess={() => refetch()}
      />

      <StatusTransitionDialog
        open={statusTransitionOpen}
        onOpenChange={setStatusTransitionOpen}
        riskId={riskId}
        riskTitle={risk.title}
        currentStatus={risk.status as RiskStatus}
        onSuccess={() => refetch()}
      />

      <AssignRiskDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        riskId={riskId}
        riskTitle={risk.title}
        currentITOwnerId={risk.itOwnerId}
        currentBusinessOwnerId={risk.businessOwnerId}
        onSuccess={() => refetch()}
      />
    </AppLayout>
  );
}

