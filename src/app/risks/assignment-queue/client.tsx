"use client";

/**
 * Assignment Queue Client Component (Story 4.13)
 *
 * Displays a searchable, filterable queue of unassigned risks with
 * quick assign and bulk assign capabilities.
 *
 * AC1-AC7: Assignment Queue Display
 * AC8-AC12: Queue Metrics Summary
 * AC13-AC18: Quick Assign Action
 * AC19-AC23: Bulk Assignment
 * AC24-AC28: Queue Filtering
 * AC33-AC36: Role-Based Access
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  ClipboardList,
  Calendar,
  X,
  CheckSquare,
  Square,
  Users,
} from "lucide-react";
import { UserRole, Severity, RiskFindingSource } from "@prisma/client";
import { format } from "date-fns";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { AppLayout } from "@/components/layout";
import { AssignmentQueueMetrics } from "@/components/risk/AssignmentQueueMetrics";
import { QuickAssignDialog } from "@/components/risk/QuickAssignDialog";
import { BulkAssignDialog } from "@/components/risk/BulkAssignDialog";
import { AssessmentTasksSection } from "@/components/risk/AssessmentTasksSection";
import { PendingApprovalsSection } from "@/components/risk/PendingApprovalsSection";

/** Roles that can access the assignment queue */
const QUEUE_ACCESS_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
  UserRole.AUDITOR,
];

/** Roles that can assign risks */
const ASSIGN_ROLES: UserRole[] = [
  UserRole.GRC_ANALYST,
  UserRole.SECURITY_ENGINEER,
  UserRole.ORG_ADMIN,
];

/** Severity badge colors */
const severityConfig = {
  HIGH: { color: "bg-red-100 text-red-800 border-red-200", label: "High" },
  MEDIUM: { color: "bg-amber-100 text-amber-800 border-amber-200", label: "Medium" },
  LOW: { color: "bg-green-100 text-green-800 border-green-200", label: "Low" },
};

/** Finding source labels */
const findingSourceLabels: Record<RiskFindingSource, string> = {
  VULNERABILITY_SCAN: "Vuln Scan",
  PENETRATION_TEST: "Pen Test",
  AUDIT_FINDING: "Audit",
  SECURITY_REVIEW: "Security Review",
  COMPLIANCE_ASSESSMENT: "Compliance",
  OTHER: "Other",
};

/** Impact score color based on value */
function getImpactScoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 75) return "text-red-600 font-bold";
  if (score >= 50) return "text-amber-600 font-semibold";
  if (score >= 25) return "text-yellow-600";
  return "text-green-600";
}

/** Calculate days since creation */
function getDaysUnassigned(createdAt: Date): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
}

/** Get aging color class */
function getAgingColor(days: number): string {
  if (days > 7) return "text-red-600 font-semibold";
  if (days > 3) return "text-amber-600";
  return "text-green-600";
}

export function AssignmentQueueClient() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const utils = api.useUtils();

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity[]>([]);
  const [findingSourceFilter, setFindingSourceFilter] = useState<RiskFindingSource | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selection state for bulk operations (AC19)
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

  // Dialog state
  const [quickAssignRiskId, setQuickAssignRiskId] = useState<string | null>(null);
  const [showBulkAssign, setShowBulkAssign] = useState(false);

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  }, []);

  // Check role
  const userRole = session?.user?.role as UserRole | undefined;
  const canAccessQueue = userRole && QUEUE_ACCESS_ROLES.includes(userRole);
  const canAssign = userRole && ASSIGN_ROLES.includes(userRole);
  const isAuditor = userRole === UserRole.AUDITOR;

  // Fetch queue data (AC1-AC6)
  // NOTE: All hooks must be called before any early returns
  const { data, isLoading, error } = api.risk.getAssignmentQueue.useQuery(
    {
      search: debouncedSearch || undefined,
      severity: severityFilter.length > 0 ? severityFilter : undefined,
      findingSource: findingSourceFilter ?? undefined,
      sortBy: "impactScore",
      sortOrder: "desc",
      limit: pageSize,
      offset: page * pageSize,
    },
    {
      enabled: isMounted && sessionStatus === "authenticated" && canAccessQueue,
      refetchInterval: 60000, // Refresh every 60 seconds (AC10)
    }
  );

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (!data?.risks) return;
    if (selectedRiskIds.length === data.risks.length) {
      setSelectedRiskIds([]);
    } else {
      setSelectedRiskIds(data.risks.map((r) => r.id));
    }
  }, [data?.risks, selectedRiskIds.length]);

  // Handle individual selection
  const handleSelectRisk = useCallback((riskId: string) => {
    setSelectedRiskIds((prev) =>
      prev.includes(riskId)
        ? prev.filter((id) => id !== riskId)
        : [...prev, riskId]
    );
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setSeverityFilter([]);
    setFindingSourceFilter(null);
    setPage(0);
  }, []);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (severityFilter.length > 0) count++;
    if (findingSourceFilter) count++;
    return count;
  }, [debouncedSearch, severityFilter.length, findingSourceFilter]);

  // Handle successful assignment
  const handleAssignSuccess = useCallback(() => {
    setQuickAssignRiskId(null);
    setShowBulkAssign(false);
    setSelectedRiskIds([]);
    void utils.risk.getAssignmentQueue.invalidate();
    void utils.risk.getAssignmentQueueMetrics.invalidate();
  }, [utils]);

  // Loading state - include isMounted check to prevent hydration mismatch
  if (!isMounted || sessionStatus === "loading") {
    return (
      <AppLayout breadcrumbs={[{ label: "Risk", href: "/risks" }, { label: "Risk Assessment Backlog" }]}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Redirect if not authorized
  if (sessionStatus === "authenticated" && !canAccessQueue) {
    router.push("/");
    return null;
  }

  // Redirect to login if not authenticated
  if (sessionStatus === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Risk", href: "/risks" }, { label: "Risk Assessment Backlog" }]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Risk Assessment Backlog
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Triage new security findings and route them to the appropriate IT and Business stakeholders.
              {isAuditor && (
                <span className="ml-2 text-amber-600">(Read-only access)</span>
              )}
            </p>
          </div>
        </div>

        {/* Metrics Summary (AC8-AC12) */}
        <AssignmentQueueMetrics />

        {/* Assessment Tasks Section */}
        {canAssign && userRole && (
          <AssessmentTasksSection userRole={userRole} />
        )}

        {/* Pending Approvals Section (Story 4.3) */}
        {userRole && (
          <PendingApprovalsSection userRole={userRole} />
        )}

        {/* Bulk Actions Toolbar (AC20) */}
        {selectedRiskIds.length > 0 && canAssign && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    {selectedRiskIds.length} risk{selectedRiskIds.length !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRiskIds([])}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowBulkAssign(true)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign to Same Owner
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters (AC24-AC28) */}
        <Card className="mb-6">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} active
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search (AC4) */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by title or description..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Severity Filter (AC25) */}
                <Select
                  value={severityFilter.length === 1 ? severityFilter[0] : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setSeverityFilter([]);
                    } else {
                      setSeverityFilter([value as Severity]);
                    }
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>

                {/* Finding Source Filter (AC25) */}
                <Select
                  value={findingSourceFilter ?? "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setFindingSourceFilter(null);
                    } else {
                      setFindingSourceFilter(value as RiskFindingSource);
                    }
                    setPage(0);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="VULNERABILITY_SCAN">Vulnerability Scan</SelectItem>
                    <SelectItem value="PENETRATION_TEST">Penetration Test</SelectItem>
                    <SelectItem value="AUDIT_FINDING">Audit Finding</SelectItem>
                    <SelectItem value="SECURITY_REVIEW">Security Review</SelectItem>
                    <SelectItem value="COMPLIANCE_ASSESSMENT">Compliance Assessment</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters (AC28) */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {debouncedSearch && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Search: {debouncedSearch}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => {
                          setSearch("");
                          setDebouncedSearch("");
                        }}
                      />
                    </Badge>
                  )}
                  {severityFilter.map((sev) => (
                    <Badge key={sev} variant="outline" className="flex items-center gap-1">
                      Severity: {sev}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setSeverityFilter(severityFilter.filter((s) => s !== sev))}
                      />
                    </Badge>
                  ))}
                  {findingSourceFilter && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      Source: {findingSourceLabels[findingSourceFilter]}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setFindingSourceFilter(null)}
                      />
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Queue Table (AC1-AC7) */}
        <Card>
          <CardHeader>
            <CardTitle>Unassigned Risks</CardTitle>
            <CardDescription>
              Click "Assign" to route a risk to IT and/or Business stakeholders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600">{error.message}</p>
              </div>
            ) : data?.risks.length === 0 ? (
              // Empty state (AC7)
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No unassigned risks
                </h3>
                <p className="text-gray-500">
                  Great job staying on top of triage! All risks have been assigned.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canAssign && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={
                                data?.risks &&
                                data.risks.length > 0 &&
                                selectedRiskIds.length === data.risks.length
                              }
                              onCheckedChange={handleSelectAll}
                              aria-label="Select all"
                            />
                          </TableHead>
                        )}
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[100px]">Severity</TableHead>
                        <TableHead className="w-[90px]">Impact</TableHead>
                        <TableHead className="w-[100px]">Source</TableHead>
                        <TableHead className="w-[110px]">Discovered</TableHead>
                        <TableHead className="w-[100px]">Days Open</TableHead>
                        <TableHead className="w-[150px]">Created By</TableHead>
                        {canAssign && <TableHead className="w-[100px]">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.risks.map((risk) => {
                        const severityStyle = severityConfig[risk.severity as keyof typeof severityConfig];
                        const daysOpen = getDaysUnassigned(risk.createdAt);
                        const isSelected = selectedRiskIds.includes(risk.id);

                        return (
                          <TableRow
                            key={risk.id}
                            className={isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                          >
                            {canAssign && (
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleSelectRisk(risk.id)}
                                  aria-label={`Select ${risk.title}`}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <Link
                                href={`/risks/${risk.id}`}
                                className="hover:underline"
                              >
                                <p className="font-medium text-gray-900">{risk.title}</p>
                                <p className="text-sm text-gray-500 truncate max-w-md">
                                  {risk.description.substring(0, 80)}
                                  {risk.description.length > 80 ? "..." : ""}
                                </p>
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge className={severityStyle?.color}>
                                {severityStyle?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={getImpactScoreColor(risk.impactScore)}>
                                {risk.impactScore ?? "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {risk.findingSource
                                ? findingSourceLabels[risk.findingSource]
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {risk.discoveryDate
                                ? format(new Date(risk.discoveryDate), "MMM d, yyyy")
                                : format(new Date(risk.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <span className={getAgingColor(daysOpen)}>
                                {daysOpen} day{daysOpen !== 1 ? "s" : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {risk.CreatedBy?.name ?? risk.CreatedBy?.email ?? "Unknown"}
                            </TableCell>
                            {canAssign && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickAssignRiskId(risk.id);
                                  }}
                                >
                                  Assign
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination (AC6) */}
                {data && data.total > pageSize && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                      Showing {page * pageSize + 1} to{" "}
                      {Math.min((page + 1) * pageSize, data.total)} of {data.total} risks
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!data.hasMore}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Assign Dialog (AC13-AC18) */}
      {quickAssignRiskId && (
        <QuickAssignDialog
          riskId={quickAssignRiskId}
          onClose={() => setQuickAssignRiskId(null)}
          onSuccess={handleAssignSuccess}
        />
      )}

      {/* Bulk Assign Dialog (AC21-AC23) */}
      {showBulkAssign && (
        <BulkAssignDialog
          riskIds={selectedRiskIds}
          onClose={() => setShowBulkAssign(false)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </AppLayout>
  );
}
