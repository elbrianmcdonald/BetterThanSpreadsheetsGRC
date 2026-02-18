"use client";

/**
 * Compliance Assessments List Client Component
 *
 * Displays a list of all compliance assessments with filters and pagination.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Loader2,
  FileText,
  Plus,
  ChevronRight,
  Search,
  Filter,
  Building2,
  Shield,
} from "lucide-react";
import { ComplianceAssessmentStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { StartAssessmentDialog } from "@/components/compliance/StartAssessmentDialog";

// Type for assessment list items with included relations
interface AssessmentListItem {
  id: string;
  identifier: string;
  name: string;
  status: ComplianceAssessmentStatus;
  totalControls: number;
  notAssessedCount: number;
  complianceScore: string | null;
  createdAt: Date;
  framework: {
    id: string;
    name: string;
    code: string;
  };
  owner: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

/**
 * Status badge configuration
 */
const statusConfig: Record<
  ComplianceAssessmentStatus,
  { label: string; color: string; bgColor: string }
> = {
  DRAFT: {
    label: "Draft",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  IN_REVIEW: {
    label: "In Review",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  ARCHIVED: {
    label: "Archived",
    color: "text-slate-500",
    bgColor: "bg-slate-100",
  },
};

export function ComplianceAssessmentsClient() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [frameworkFilter, setFrameworkFilter] = useState<string>("all");
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch assessments
  const { data, isLoading } = api.complianceAssessment.list.useQuery({
    status: statusFilter !== "all" ? (statusFilter as ComplianceAssessmentStatus) : undefined,
    frameworkId: frameworkFilter !== "all" ? frameworkFilter : undefined,
    businessUnitId: businessUnitFilter !== "all" ? businessUnitFilter : undefined,
    page,
    pageSize,
  });

  // Fetch frameworks for filtering
  const { data: frameworksData } = api.framework.list.useQuery({});

  // Fetch business units for filtering
  const { data: businessUnitsData } = api.businessUnit.list.useQuery({
    includeInactive: false,
  });

  const assessments = data?.assessments ?? [];
  const pagination = data?.pagination;

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Compliance", href: "/compliance/management" },
        { label: "Assessments" },
      ]}
    >
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Compliance Assessments
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and track compliance assessments across your frameworks
            </p>
          </div>

          <NewAssessmentButton frameworks={frameworksData} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assessments..."
                    className="pl-9"
                    disabled
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frameworkFilter} onValueChange={(value) => { setFrameworkFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <Shield className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  {frameworksData?.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={businessUnitFilter} onValueChange={(value) => { setBusinessUnitFilter(value); setPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <Building2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by business unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Business Units</SelectItem>
                  {businessUnitsData?.flatOptions.map((bu) => (
                    <SelectItem key={bu.id} value={bu.id}>
                      {bu.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Assessments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Assessments</CardTitle>
            <CardDescription>
              {pagination
                ? `${pagination.total} assessment${pagination.total !== 1 ? "s" : ""}`
                : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : assessments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Assessments</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== "all" || frameworkFilter !== "all" || businessUnitFilter !== "all"
                    ? "No assessments match the selected filters"
                    : "Create your first compliance assessment to get started"}
                </p>
                <div className="mt-4">
                  <NewAssessmentButton frameworks={frameworksData} />
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Framework</TableHead>
                    <TableHead>Business Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => {
                    const config = statusConfig[assessment.status];
                    const progress =
                      assessment.totalControls > 0
                        ? ((assessment.totalControls - assessment.notAssessedCount) /
                            assessment.totalControls) *
                          100
                        : 0;

                    return (
                      <TableRow
                        key={assessment.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          router.push(`/compliance/assessments/${assessment.id}`)
                        }
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{assessment.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {assessment.identifier}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {(assessment as unknown as { framework: { code: string } }).framework.code}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(assessment as unknown as { businessUnit?: { code?: string; name: string } | null }).businessUnit ? (
                            <Badge variant="secondary" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {(assessment as unknown as { businessUnit: { code?: string; name: string } }).businessUnit.code ||
                                (assessment as unknown as { businessUnit: { name: string } }).businessUnit.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${config.color} ${config.bgColor}`}
                          >
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="w-16 h-2" />
                            <span className="text-xs text-muted-foreground">
                              {progress.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {assessment.complianceScore ? (
                            <span className="font-medium">
                              {Number(assessment.complianceScore).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {(assessment as unknown as { owner: { name: string | null; email: string | null } }).owner.name || (assessment as unknown as { owner: { email: string | null } }).owner.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(assessment.createdAt), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

/**
 * New Assessment Button with framework picker dialog
 *
 * Lets user select a framework, then opens StartAssessmentDialog to create the assessment.
 */
function NewAssessmentButton({
  frameworks,
}: {
  frameworks?: Array<{ id: string; name: string; code: string }>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  // If a framework is selected, render the StartAssessmentDialog
  if (selectedFramework) {
    return (
      <StartAssessmentDialog
        frameworkId={selectedFramework.id}
        frameworkName={selectedFramework.name}
        frameworkCode={selectedFramework.code}
        defaultOpen
        trigger={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        }
        onSuccess={() => setSelectedFramework(null)}
        onCancel={() => setSelectedFramework(null)}
      />
    );
  }

  return (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Framework</DialogTitle>
          <DialogDescription>
            Choose a framework to assess. You&apos;ll configure assessment details in the next step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          {!frameworks || frameworks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No frameworks available. Activate a framework first in{" "}
              <Link href="/admin/frameworks" className="underline">
                Administration
              </Link>
              .
            </p>
          ) : (
            frameworks.map((fw) => (
              <Button
                key={fw.id}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setPickerOpen(false);
                  setSelectedFramework(fw);
                }}
              >
                <Shield className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <div className="font-medium">{fw.code}</div>
                  <div className="text-xs text-muted-foreground">{fw.name}</div>
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
