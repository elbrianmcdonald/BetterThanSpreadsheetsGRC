"use client";

/**
 * Risk Audit Trail Component
 *
 * Story 4.12: Risk Audit Trail with Timestamps
 *
 * Main component for displaying risk audit trail:
 * - AC9: Collapsible "Audit Trail" section
 * - AC10: Chronological display (newest first)
 * - AC13: Pagination with "Load More" button
 * - AC14: Filterable by action type
 * - AC15: Empty state for new risks
 *
 * @see Story 4.12: Risk Audit Trail with Timestamps
 */

import { useState } from "react";
import {
  History,
  Filter,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AuditTrailEntry } from "./AuditTrailEntry";

interface RiskAuditTrailProps {
  /** The risk ID */
  riskId: string;
  /** Whether the user can export the audit trail */
  canExport?: boolean;
}

const PAGE_SIZE = 20;

/**
 * Action type labels for the filter dropdown
 */
const ACTION_TYPE_LABELS: Record<string, string> = {
  CREATE_RISK: "Risk Created",
  UPDATE_RISK: "Risk Updated",
  ASSIGN_RISK: "Assignments",
  REASSIGN_RISK: "Reassignments",
  UPDATE_RISK_STATUS: "Status Changes",
  LINK_EVIDENCE_TO_RISK: "Evidence Linked",
  UNLINK_EVIDENCE_FROM_RISK: "Evidence Unlinked",
  ADD_REMEDIATION_OPTION: "Options Added",
  UPDATE_REMEDIATION_OPTION: "Options Updated",
  DELETE_REMEDIATION_OPTION: "Options Deleted",
  ADD_RISK_COMMENT: "Comments Added",
  UPDATE_RISK_COMMENT: "Comments Updated",
  DELETE_RISK_COMMENT: "Comments Deleted",
  CLOSE_RISK: "Risk Closed",
  REOPEN_RISK: "Risk Reopened",
};

export function RiskAuditTrail({ riskId, canExport = false }: RiskAuditTrailProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);

  // Fetch audit trail
  const { data, isLoading, isFetching } = api.risk.getRiskAuditTrail.useQuery(
    {
      riskId,
      actionType: actionFilter === "all" ? undefined : actionFilter,
      limit: PAGE_SIZE,
      offset,
    },
    {
      enabled: isOpen, // Only fetch when section is open
    }
  );

  // Fetch available action types for filter dropdown
  const { data: actionTypes } = api.risk.getAuditTrailActionTypes.useQuery(
    undefined,
    { enabled: isOpen }
  );

  // Export mutation
  const exportMutation = api.risk.exportRiskAuditTrail.useMutation({
    onSuccess: (result) => {
      // Create and download CSV file
      const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", result.filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  });

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setActionFilter(value);
    setOffset(0); // Reset pagination when filter changes
  };

  // Handle load more
  const handleLoadMore = () => {
    if (data?.hasMore) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  };

  // Handle export
  const handleExport = () => {
    exportMutation.mutate({ riskId });
  };

  const totalCount = data?.totalCount ?? 0;
  const auditLogs = data?.auditLogs ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* AC9: Collapsible header */}
        <CardHeader className="py-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Audit Trail
                {totalCount > 0 && (
                  <span className="text-muted-foreground font-normal text-sm">
                    ({totalCount})
                  </span>
                )}
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Toolbar: Filter and Export */}
            <div className="flex items-center justify-between gap-4">
              {/* AC14: Action type filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={actionFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-[180px] h-8 text-sm">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {actionTypes?.map((action) => (
                      <SelectItem key={action} value={action}>
                        {ACTION_TYPE_LABELS[action] ?? action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Export button */}
              {canExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exportMutation.isPending || totalCount === 0}
                >
                  {exportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export CSV
                </Button>
              )}
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* AC15: Empty state */}
            {!isLoading && auditLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No audit trail entries yet</p>
              </div>
            )}

            {/* AC10: Audit trail entries (newest first) */}
            {!isLoading && auditLogs.length > 0 && (
              <div className="divide-y">
                {auditLogs.map((entry) => (
                  <AuditTrailEntry
                    key={entry.id}
                    entry={{
                      ...entry,
                      timestamp: new Date(entry.timestamp),
                    }}
                  />
                ))}
              </div>
            )}

            {/* AC13: Load More button */}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Load More ({totalCount - auditLogs.length} remaining)
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
