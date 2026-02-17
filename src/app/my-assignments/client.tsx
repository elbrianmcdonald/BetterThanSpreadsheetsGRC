"use client";

/**
 * Unified My Assignments Client Page
 *
 * Shows all work assignments across the platform:
 * - Risk Treatments (assigned via Person entity)
 * - Maturity Audits (via AssessorAssignment)
 * - Compliance Audits (via assessorId)
 *
 * Features:
 * - Tabbed interface for filtering by assignment type
 * - Urgency indicators (overdue, due this week, etc.)
 * - Summary statistics
 * - Direct navigation to assignment details
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Shield,
  CheckSquare,
  FileCheck,
  AlertCircle,
  Calendar,
  Building2,
} from "lucide-react";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AssignmentType = "RISK_TREATMENT" | "MATURITY_AUDIT" | "COMPLIANCE_AUDIT";
type UrgencyLevel = "OVERDUE" | "DUE_THIS_WEEK" | "DUE_SOON" | "UPCOMING" | "NO_DUE_DATE";

const typeLabels: Record<AssignmentType, string> = {
  RISK_TREATMENT: "Risk Treatment",
  MATURITY_AUDIT: "Maturity Audit",
  COMPLIANCE_AUDIT: "Compliance Audit",
};

const typeIcons: Record<AssignmentType, typeof Shield> = {
  RISK_TREATMENT: Shield,
  MATURITY_AUDIT: CheckSquare,
  COMPLIANCE_AUDIT: FileCheck,
};

const urgencyColors: Record<UrgencyLevel, { badge: string; text: string }> = {
  OVERDUE: { badge: "bg-red-100 text-red-700 border-red-200", text: "text-red-600" },
  DUE_THIS_WEEK: { badge: "bg-orange-100 text-orange-700 border-orange-200", text: "text-orange-600" },
  DUE_SOON: { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", text: "text-yellow-600" },
  UPCOMING: { badge: "bg-blue-100 text-blue-700 border-blue-200", text: "text-blue-600" },
  NO_DUE_DATE: { badge: "bg-gray-100 text-gray-700 border-gray-200", text: "text-gray-500" },
};

const urgencyLabels: Record<UrgencyLevel, string> = {
  OVERDUE: "Overdue",
  DUE_THIS_WEEK: "Due This Week",
  DUE_SOON: "Due Soon",
  UPCOMING: "Upcoming",
  NO_DUE_DATE: "No Due Date",
};

export function UnifiedAssignmentsClient() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | AssignmentType>("all");

  // Track client-side mount to prevent hydration mismatches
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Determine which types to fetch based on active tab
  const typesToFetch = activeTab === "all" ? undefined : [activeTab];

  // Fetch unified assignments
  const { data, isLoading, error } = api.myAssignments.getAll.useQuery({
    types: typesToFetch,
    includeCompleted,
  });

  // Fetch summary for the cards (always fetch all types)
  const { data: summary } = api.myAssignments.getSummary.useQuery();

  // Loading state - include isMounted check to prevent hydration issues
  if (!isMounted || sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error.message}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.refresh()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignments = data?.assignments ?? [];
  const stats = data?.stats;

  return (
    <AppLayout breadcrumbs={[{ label: "My Assignments" }]}>
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ClipboardList className="h-8 w-8" />
              My Assignments
            </h1>
            <p className="text-muted-foreground mt-1">
              All your work assignments across risk treatments, maturity audits, and compliance audits
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-completed"
                checked={includeCompleted}
                onCheckedChange={setIncludeCompleted}
              />
              <Label htmlFor="show-completed" className="text-sm">
                Show Completed
              </Label>
            </div>
          </div>
        </div>

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Active</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.total ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Assignments requiring attention
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab("RISK_TREATMENT")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk Treatments</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.riskTreatments ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Treatment actions assigned
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab("MATURITY_AUDIT")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Maturity Audits</CardTitle>
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.maturityAudits ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Assessment areas to review
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setActiveTab("COMPLIANCE_AUDIT")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Audits</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.complianceAudits ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                Compliance assessments
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Urgency Indicators */}
        {stats && (stats.byUrgency.overdue > 0 || stats.byUrgency.dueThisWeek > 0) && (
          <div className="flex flex-wrap gap-2">
            {stats.byUrgency.overdue > 0 && (
              <Badge className={urgencyColors.OVERDUE.badge}>
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.byUrgency.overdue} Overdue
              </Badge>
            )}
            {stats.byUrgency.dueThisWeek > 0 && (
              <Badge className={urgencyColors.DUE_THIS_WEEK.badge}>
                <AlertCircle className="h-3 w-3 mr-1" />
                {stats.byUrgency.dueThisWeek} Due This Week
              </Badge>
            )}
            {stats.byUrgency.dueSoon > 0 && (
              <Badge className={urgencyColors.DUE_SOON.badge}>
                <Calendar className="h-3 w-3 mr-1" />
                {stats.byUrgency.dueSoon} Due Soon
              </Badge>
            )}
          </div>
        )}

        {/* Tabbed Assignments List */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="all">
                  All ({summary?.total ?? 0})
                </TabsTrigger>
                <TabsTrigger value="RISK_TREATMENT">
                  <Shield className="h-4 w-4 mr-1" />
                  Risk ({summary?.riskTreatments ?? 0})
                </TabsTrigger>
                <TabsTrigger value="MATURITY_AUDIT">
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Maturity ({summary?.maturityAudits ?? 0})
                </TabsTrigger>
                <TabsTrigger value="COMPLIANCE_AUDIT">
                  <FileCheck className="h-4 w-4 mr-1" />
                  Compliance ({summary?.complianceAudits ?? 0})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Assignments</h3>
                <p className="text-muted-foreground">
                  {activeTab === "all"
                    ? "You don't have any active assignments."
                    : `You don't have any ${typeLabels[activeTab].toLowerCase()} assignments.`}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => {
                    const TypeIcon = typeIcons[assignment.type as AssignmentType];
                    const urgency = assignment.urgency as UrgencyLevel;
                    const isOverdue = urgency === "OVERDUE";

                    return (
                      <TableRow
                        key={assignment.id}
                        className={isOverdue ? "bg-destructive/5" : ""}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {typeLabels[assignment.type as AssignmentType]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.title}</span>
                            {assignment.description && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {assignment.description}
                              </span>
                            )}
                            {typeof assignment.metadata?.businessUnit === "string" && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Building2 className="h-3 w-3" />
                                {assignment.metadata.businessUnit}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {assignment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.dueDate ? (
                            <div className="flex items-center gap-2">
                              <Clock
                                className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
                              />
                              <div className="flex flex-col">
                                <span
                                  className={`text-sm ${isOverdue ? "text-destructive font-medium" : ""}`}
                                >
                                  {format(new Date(assignment.dueDate), "MMM d, yyyy")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(assignment.dueDate), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No due date</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={urgencyColors[urgency].badge}>
                            {urgency === "OVERDUE" && (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            )}
                            {urgencyLabels[urgency]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(assignment.entityUrl)}
                          >
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
