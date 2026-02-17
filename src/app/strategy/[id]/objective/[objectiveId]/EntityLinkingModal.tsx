"use client";

/**
 * Entity Linking Modal Component
 *
 * Story 3.5: Entity Linking UI
 * AC1: Modal with tabs for Risks, Controls, Evidence
 * AC2: Debounced search (300ms), multi-select entities
 * AC3: Link selected entities, recalculate KPI if auto-type
 */

import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "use-debounce";
import {
  Search,
  Link,
  Loader2,
  AlertTriangle,
  Shield,
  FileText,
  Check,
} from "lucide-react";
import { RiskStatus, Severity, OrgControlStatus } from "@prisma/client";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface EntityLinkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  strategyId: string;
  goalId: string;
  isAutoKpi: boolean;
  onLinked: () => void;
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

export function EntityLinkingModal({
  open,
  onOpenChange,
  objectiveId,
  strategyId,
  goalId,
  isAutoKpi,
  onLinked,
}: EntityLinkingModalProps) {
  const utils = api.useUtils();

  /**
   * Story 4.4 AC5: Cascade progress invalidation
   * When entities are linked, invalidate goal and strategy queries
   */
  const invalidateProgressHierarchy = () => {
    void utils.objective.getById.invalidate({ id: objectiveId });
    void utils.goal.getById.invalidate({ id: goalId });
    void utils.goal.listByStrategy.invalidate({ strategyId });
    void utils.strategy.getById.invalidate({ id: strategyId });
    void utils.strategy.list.invalidate();
  };

  // Search state
  const [activeTab, setActiveTab] = useState<"risks" | "controls" | "evidence">("risks");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300); // AC2: 300ms debounce

  // Selection state - AC2: Multi-select
  const [selectedRisks, setSelectedRisks] = useState<Set<string>>(new Set());
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());

  // Linking state
  const [isLinking, setIsLinking] = useState(false);

  // Reset selections when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedRisks(new Set());
      setSelectedControls(new Set());
      setSelectedEvidence(new Set());
    }
  }, [open]);

  // Search queries - only run when query has content
  const { data: risksData, isLoading: risksLoading } = api.objective.searchRisks.useQuery(
    { objectiveId, query: debouncedQuery || "a" }, // Default to "a" for initial results
    { enabled: open && activeTab === "risks" && debouncedQuery.length >= 1 }
  );

  const { data: controlsData, isLoading: controlsLoading } = api.objective.searchControls.useQuery(
    { objectiveId, query: debouncedQuery || "a" },
    { enabled: open && activeTab === "controls" && debouncedQuery.length >= 1 }
  );

  const { data: evidenceData, isLoading: evidenceLoading } = api.objective.searchEvidence.useQuery(
    { objectiveId, query: debouncedQuery || "a" },
    { enabled: open && activeTab === "evidence" && debouncedQuery.length >= 1 }
  );

  // Link mutations
  const linkRiskMutation = api.objective.linkRisk.useMutation();
  const linkControlMutation = api.objective.linkControl.useMutation();
  const linkEvidenceMutation = api.objective.linkEvidence.useMutation();
  const calculateKpiMutation = api.objective.calculateKpi.useMutation();

  // Toggle selection handlers
  const toggleRisk = useCallback((id: string) => {
    setSelectedRisks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleControl = useCallback((id: string) => {
    setSelectedControls(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleEvidence = useCallback((id: string) => {
    setSelectedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // AC3: Link selected entities
  const handleLink = async () => {
    setIsLinking(true);

    try {
      // Link all selected risks
      for (const riskId of selectedRisks) {
        await linkRiskMutation.mutateAsync({ objectiveId, riskId });
      }

      // Link all selected controls
      for (const controlId of selectedControls) {
        await linkControlMutation.mutateAsync({ objectiveId, controlId });
      }

      // Link all selected evidence
      for (const evidenceId of selectedEvidence) {
        await linkEvidenceMutation.mutateAsync({ objectiveId, evidenceId });
      }

      // AC3: Recalculate KPI if auto-calculated type
      if (isAutoKpi) {
        await calculateKpiMutation.mutateAsync({ objectiveId });
      }

      // Story 4.4 AC5: Cascade progress invalidation
      invalidateProgressHierarchy();
      await utils.objective.getLinkedEntityCounts.invalidate({ objectiveId });

      const totalLinked = selectedRisks.size + selectedControls.size + selectedEvidence.size;
      toast.success(`Linked ${totalLinked} ${totalLinked === 1 ? "entity" : "entities"}`);

      onLinked();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to link some entities");
    } finally {
      setIsLinking(false);
    }
  };

  const totalSelected = selectedRisks.size + selectedControls.size + selectedEvidence.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Entities
          </DialogTitle>
          <DialogDescription>
            Search and link Risks, Controls, or Evidence to this objective.
          </DialogDescription>
        </DialogHeader>

        {/* AC1: Tabs for Risks, Controls, Evidence */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="risks" className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Risks
              {selectedRisks.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedRisks.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="controls" className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Controls
              {selectedControls.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedControls.size}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="evidence" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Evidence
              {selectedEvidence.size > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {selectedEvidence.size}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Input - AC2: Debounced search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Risks Tab */}
          <TabsContent value="risks" className="mt-4">
            <ScrollArea className="h-[300px]">
              {risksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !risksData || risksData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No risks found matching your search." : "Type to search for risks."}
                </div>
              ) : (
                <div className="space-y-2">
                  {risksData.map((risk) => (
                    <div
                      key={risk.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                        risk.isLinked ? "opacity-50" : ""
                      } ${selectedRisks.has(risk.id) ? "bg-muted border-primary" : ""}`}
                      onClick={() => !risk.isLinked && toggleRisk(risk.id)}
                    >
                      <Checkbox
                        checked={risk.isLinked || selectedRisks.has(risk.id)}
                        disabled={risk.isLinked}
                        onCheckedChange={() => !risk.isLinked && toggleRisk(risk.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{risk.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={riskStatusConfig[risk.status].color}>
                            {riskStatusConfig[risk.status].label}
                          </Badge>
                          <Badge variant="outline" className={severityConfig[risk.severity].color}>
                            {severityConfig[risk.severity].label}
                          </Badge>
                        </div>
                      </div>
                      {risk.isLinked && (
                        <Badge variant="secondary" className="shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Controls Tab */}
          <TabsContent value="controls" className="mt-4">
            <ScrollArea className="h-[300px]">
              {controlsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !controlsData || controlsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No controls found matching your search." : "Type to search for controls."}
                </div>
              ) : (
                <div className="space-y-2">
                  {controlsData.map((control) => (
                    <div
                      key={control.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                        control.isLinked ? "opacity-50" : ""
                      } ${selectedControls.has(control.id) ? "bg-muted border-primary" : ""}`}
                      onClick={() => !control.isLinked && toggleControl(control.id)}
                    >
                      <Checkbox
                        checked={control.isLinked || selectedControls.has(control.id)}
                        disabled={control.isLinked}
                        onCheckedChange={() => !control.isLinked && toggleControl(control.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{control.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={controlStatusConfig[control.status].color}>
                            {controlStatusConfig[control.status].label}
                          </Badge>
                          {control.framework && (
                            <Badge variant="secondary" className="text-xs">
                              {control.framework.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {control.isLinked && (
                        <Badge variant="secondary" className="shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Evidence Tab */}
          <TabsContent value="evidence" className="mt-4">
            <ScrollArea className="h-[300px]">
              {evidenceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !evidenceData || evidenceData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No evidence found matching your search." : "Type to search for evidence."}
                </div>
              ) : (
                <div className="space-y-2">
                  {evidenceData.map((evidence) => (
                    <div
                      key={evidence.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${
                        evidence.isLinked ? "opacity-50" : ""
                      } ${selectedEvidence.has(evidence.id) ? "bg-muted border-primary" : ""}`}
                      onClick={() => !evidence.isLinked && toggleEvidence(evidence.id)}
                    >
                      <Checkbox
                        checked={evidence.isLinked || selectedEvidence.has(evidence.id)}
                        disabled={evidence.isLinked}
                        onCheckedChange={() => !evidence.isLinked && toggleEvidence(evidence.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{evidence.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>
                            Uploaded {new Date(evidence.uploadedAt).toLocaleDateString()}
                          </span>
                          {evidence.controlDomain && (
                            <Badge variant="secondary" className="text-xs">
                              {evidence.controlDomain.code}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {evidence.isLinked && (
                        <Badge variant="secondary" className="shrink-0">
                          <Check className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={totalSelected === 0 || isLinking}
          >
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <Link className="h-4 w-4 mr-2" />
                Link {totalSelected > 0 ? `(${totalSelected})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
