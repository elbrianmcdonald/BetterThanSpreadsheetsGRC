"use client";

/**
 * Linked Entities Section Component
 *
 * Story 3.5: Entity Linking UI
 * AC4: Display linked Risks with Title, Status badge, Severity badge, link to detail
 * AC5: Unlink button with confirmation dialog
 */

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  Shield,
  FileText,
  ExternalLink,
  X,
  Loader2,
  Link as LinkIcon,
  Plus,
} from "lucide-react";
import { RiskStatus, Severity, OrgControlStatus, KpiType } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LinkedRisk {
  id: string;
  title: string;
  status: RiskStatus;
  severity: Severity;
}

interface LinkedControl {
  id: string;
  name: string;
  status: OrgControlStatus;
  FrameworkControl?: {
    controlId: string;
    Framework?: {
      name: string;
    };
  } | null;
}

interface LinkedEvidence {
  id: string;
  title: string;
  createdAt: Date | string;
  fileType: string;
}

interface LinkedEntitiesSectionProps {
  objectiveId: string;
  strategyId: string;
  goalId: string;
  linkedRisks: LinkedRisk[];
  linkedControls: LinkedControl[];
  linkedEvidence: LinkedEvidence[];
  canManage: boolean;
  kpiType: KpiType;
  onLinkClick: () => void;
}

/** Risk status badge configuration */
const riskStatusConfig: Record<RiskStatus, { color: string; label: string }> = {
  DRAFT: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  PENDING_REVIEW: { color: "bg-yellow-100 text-yellow-700", label: "Pending" },
  OPEN: { color: "bg-red-100 text-red-700", label: "Open" },
  ASSIGNED: { color: "bg-blue-100 text-blue-700", label: "Assigned" },
  REMEDIATED: { color: "bg-green-100 text-green-700", label: "Remediated" },
  CLOSED: { color: "bg-gray-100 text-gray-700", label: "Closed" },
};

/** Severity badge configuration */
const severityConfig: Record<Severity, { color: string; label: string }> = {
  HIGH: { color: "bg-red-100 text-red-700", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-700", label: "Medium" },
  LOW: { color: "bg-green-100 text-green-700", label: "Low" },
};

/** Control status badge configuration */
const controlStatusConfig: Record<OrgControlStatus, { color: string; label: string }> = {
  ACTIVE: { color: "bg-green-100 text-green-700", label: "Active" },
  PLANNED: { color: "bg-blue-100 text-blue-700", label: "Planned" },
  DEPRECATED: { color: "bg-gray-100 text-gray-700", label: "Deprecated" },
};

/** Auto-calculated KPI types */
const AUTO_KPI_TYPES: KpiType[] = [
  KpiType.RISK_REMEDIATION_RATE,
  KpiType.RISK_OPEN_COUNT,
  KpiType.HIGH_SEVERITY_RISK_COUNT,
  KpiType.CONTROL_IMPLEMENTATION_RATE,
  KpiType.CONTROL_EFFECTIVENESS_AVG,
  KpiType.EVIDENCE_FRESHNESS_RATE,
  KpiType.EVIDENCE_COVERAGE,
];

export function LinkedEntitiesSection({
  objectiveId,
  strategyId,
  goalId,
  linkedRisks,
  linkedControls,
  linkedEvidence,
  canManage,
  kpiType,
  onLinkClick,
}: LinkedEntitiesSectionProps) {
  const utils = api.useUtils();

  /**
   * Story 4.4 AC5: Cascade progress invalidation
   * When entities are linked/unlinked, invalidate goal and strategy queries
   */
  const invalidateProgressHierarchy = () => {
    void utils.objective.getById.invalidate({ id: objectiveId });
    void utils.goal.getById.invalidate({ id: goalId });
    void utils.goal.listByStrategy.invalidate({ strategyId });
    void utils.strategy.getById.invalidate({ id: strategyId });
    void utils.strategy.list.invalidate();
  };

  // Unlink confirmation state
  const [unlinkDialog, setUnlinkDialog] = useState<{
    type: "risk" | "control" | "evidence";
    id: string;
    title: string;
  } | null>(null);

  // Unlink mutations - Story 4.4 AC5: Cascade progress invalidation
  const unlinkRiskMutation = api.objective.unlinkRisk.useMutation({
    onSuccess: async () => {
      toast.success("Risk unlinked");
      // Recalculate KPI if auto-type
      if (AUTO_KPI_TYPES.includes(kpiType)) {
        await calculateKpiMutation.mutateAsync({ objectiveId });
      }
      // Cascade progress invalidation
      invalidateProgressHierarchy();
    },
    onError: () => toast.error("Failed to unlink risk"),
  });

  const unlinkControlMutation = api.objective.unlinkControl.useMutation({
    onSuccess: async () => {
      toast.success("Control unlinked");
      if (AUTO_KPI_TYPES.includes(kpiType)) {
        await calculateKpiMutation.mutateAsync({ objectiveId });
      }
      // Cascade progress invalidation
      invalidateProgressHierarchy();
    },
    onError: () => toast.error("Failed to unlink control"),
  });

  const unlinkEvidenceMutation = api.objective.unlinkEvidence.useMutation({
    onSuccess: async () => {
      toast.success("Evidence unlinked");
      if (AUTO_KPI_TYPES.includes(kpiType)) {
        await calculateKpiMutation.mutateAsync({ objectiveId });
      }
      // Cascade progress invalidation
      invalidateProgressHierarchy();
    },
    onError: () => toast.error("Failed to unlink evidence"),
  });

  const calculateKpiMutation = api.objective.calculateKpi.useMutation();

  const handleUnlink = () => {
    if (!unlinkDialog) return;

    switch (unlinkDialog.type) {
      case "risk":
        unlinkRiskMutation.mutate({ objectiveId, riskId: unlinkDialog.id });
        break;
      case "control":
        unlinkControlMutation.mutate({ objectiveId, controlId: unlinkDialog.id });
        break;
      case "evidence":
        unlinkEvidenceMutation.mutate({ objectiveId, evidenceId: unlinkDialog.id });
        break;
    }
    setUnlinkDialog(null);
  };

  const isUnlinking =
    unlinkRiskMutation.isPending ||
    unlinkControlMutation.isPending ||
    unlinkEvidenceMutation.isPending;

  const totalLinked = linkedRisks.length + linkedControls.length + linkedEvidence.length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Linked Entities
                {totalLinked > 0 && (
                  <Badge variant="secondary">{totalLinked}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Risks, Controls, and Evidence linked to this objective
              </CardDescription>
            </div>
            {canManage && (
              <Button variant="outline" size="sm" onClick={onLinkClick}>
                <Plus className="h-4 w-4 mr-1" />
                Link Entity
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {totalLinked === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No linked entities yet.</p>
              {canManage && (
                <Button variant="link" className="mt-2" onClick={onLinkClick}>
                  Link your first entity
                </Button>
              )}
            </div>
          ) : (
            <Tabs defaultValue="risks">
              <TabsList>
                <TabsTrigger value="risks" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Risks ({linkedRisks.length})
                </TabsTrigger>
                <TabsTrigger value="controls" className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  Controls ({linkedControls.length})
                </TabsTrigger>
                <TabsTrigger value="evidence" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Evidence ({linkedEvidence.length})
                </TabsTrigger>
              </TabsList>

              {/* AC4: Linked Risks */}
              <TabsContent value="risks" className="mt-4">
                {linkedRisks.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No linked risks.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedRisks.map((risk) => (
                      <div
                        key={risk.id}
                        className="flex items-center gap-3 p-3 rounded-lg border group"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/risks/${risk.id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            {risk.title}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={riskStatusConfig[risk.status].color}>
                              {riskStatusConfig[risk.status].label}
                            </Badge>
                            <Badge variant="outline" className={severityConfig[risk.severity].color}>
                              {severityConfig[risk.severity].label}
                            </Badge>
                          </div>
                        </div>
                        {/* AC5: Unlink button */}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => setUnlinkDialog({ type: "risk", id: risk.id, title: risk.title })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Linked Controls */}
              <TabsContent value="controls" className="mt-4">
                {linkedControls.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No linked controls.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedControls.map((control) => (
                      <div
                        key={control.id}
                        className="flex items-center gap-3 p-3 rounded-lg border group"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/admin/controls?id=${control.id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            {control.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={controlStatusConfig[control.status].color}>
                              {controlStatusConfig[control.status].label}
                            </Badge>
                            {control.FrameworkControl && (
                              <Badge variant="secondary" className="text-xs">
                                {control.FrameworkControl.Framework?.name} - {control.FrameworkControl.controlId}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => setUnlinkDialog({ type: "control", id: control.id, title: control.name })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Linked Evidence */}
              <TabsContent value="evidence" className="mt-4">
                {linkedEvidence.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4">No linked evidence.</p>
                ) : (
                  <div className="space-y-2">
                    {linkedEvidence.map((evidence) => (
                      <div
                        key={evidence.id}
                        className="flex items-center gap-3 p-3 rounded-lg border group"
                      >
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/admin/evidence/${evidence.id}`}
                            className="font-medium hover:underline flex items-center gap-1"
                          >
                            {evidence.title}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                          </Link>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Uploaded {format(new Date(evidence.createdAt), "MMM d, yyyy")}</span>
                            <Badge variant="secondary" className="text-xs">
                              {evidence.fileType}
                            </Badge>
                          </div>
                        </div>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => setUnlinkDialog({ type: "evidence", id: evidence.id, title: evidence.title })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* AC5: Unlink Confirmation Dialog */}
      <AlertDialog open={!!unlinkDialog} onOpenChange={() => setUnlinkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {unlinkDialog?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlink "{unlinkDialog?.title}" from this objective.
              {AUTO_KPI_TYPES.includes(kpiType) && (
                <span className="block mt-2 text-amber-600">
                  The KPI will be recalculated after unlinking.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} disabled={isUnlinking}>
              {isUnlinking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Unlink"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
