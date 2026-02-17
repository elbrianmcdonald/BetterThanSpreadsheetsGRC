"use client";

/**
 * Framework Detail Client Component
 *
 * Story 5.1: Compliance Summary Dashboard (AC28-AC31)
 * Story 5.7: PDF Evidence Package Export (AC1-AC5)
 *
 * Client-side rendering for framework detail page:
 * - AC30: Shows all controls with evidence status (satisfied/missing)
 * - AC31: "Upload Evidence" button for missing controls
 * - Story 5.7 AC1: Export Evidence Package (PDF) button
 *
 * @see Story 5.1: Compliance Summary Dashboard
 * @see Story 5.7: PDF Evidence Package Export
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Upload,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLayout } from "@/components/layout";

/**
 * Story 5.7 AC28: Roles that can export evidence packages
 */
const CAN_EXPORT_PDF_ROLES = ["GRC_ANALYST", "ORG_ADMIN", "AUDITOR"] as const;

interface FrameworkDetailClientProps {
  frameworkId: string;
}

export function FrameworkDetailClient({
  frameworkId,
}: FrameworkDetailClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "satisfied" | "missing">("all");

  // Get session for role check
  const { data: session } = useSession();

  // Fetch framework details
  const { data, isLoading, error } = api.compliance.getFrameworkDetails.useQuery({
    frameworkId,
  });

  // Story 5.7: PDF Export mutation
  const exportMutation = api.compliance.exportEvidencePackage.useMutation({
    onSuccess: (result) => {
      // AC3-AC4: Download the PDF file
      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`Exported evidence package: ${result.filename}`);
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  // Story 5.7 AC1: Handler for PDF export
  const handleExportPDF = useCallback(() => {
    exportMutation.mutate({ frameworkId });
  }, [frameworkId, exportMutation]);

  // Story 5.7 AC28: Check if user can export
  const canExportPDF = session?.user?.role && CAN_EXPORT_PDF_ROLES.includes(session.user.role as typeof CAN_EXPORT_PDF_ROLES[number]);

  if (isLoading) {
    return <FrameworkDetailSkeleton />;
  }

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Framework Details" }]}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading framework</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load framework details. Please try again."}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  if (!data) {
    return null;
  }

  const { framework, controls } = data;

  // Filter controls based on search and status
  const filteredControls = controls.filter((control) => {
    // Search filter
    const matchesSearch =
      searchQuery === "" ||
      control.controlId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      control.title.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "satisfied" && control.isSatisfied) ||
      (filterStatus === "missing" && !control.isSatisfied);

    return matchesSearch && matchesStatus;
  });

  const satisfiedCount = controls.filter((c) => c.isSatisfied).length;
  const missingCount = controls.filter((c) => !c.isSatisfied).length;

  return (
    <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Framework Details" }]}>
      <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">

          {/* Story 5.7 AC1: Export Evidence Package (PDF) button */}
          {canExportPDF && (
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={exportMutation.isPending}
              className="gap-2"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exportMutation.isPending ? "Generating PDF..." : "Export Evidence Package (PDF)"}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{framework.name}</h1>
            <p className="text-muted-foreground">
              {framework.code} v{framework.version}
            </p>
            {framework.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                {framework.description}
              </p>
            )}
          </div>

          {/* Coverage summary */}
          <Card className="shrink-0">
            <CardContent className="py-4 px-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {framework.coveragePercentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Coverage</div>
                </div>
                <div className="w-px h-12 bg-border" />
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xl font-semibold">{satisfiedCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Satisfied</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xl font-semibold">{missingCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Missing</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Controls table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Controls</CardTitle>
              <CardDescription>
                {filteredControls.length} of {controls.length} controls shown
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search controls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[200px]"
                />
              </div>

              {/* Filter buttons */}
              <div className="flex gap-1 border rounded-md p-1">
                <Button
                  variant={filterStatus === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "satisfied" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("satisfied")}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  Satisfied
                </Button>
                <Button
                  variant={filterStatus === "missing" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus("missing")}
                  className="gap-1"
                >
                  <XCircle className="h-3 w-3 text-red-600" />
                  Missing
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredControls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {controls.length === 0
                ? "No controls found in this framework"
                : "No controls match your search criteria"}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Control ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                    <TableHead className="w-[100px] text-center">Evidence</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredControls.map((control) => (
                    <TableRow key={control.id}>
                      <TableCell className="font-mono text-sm">
                        {control.controlId}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help line-clamp-1">
                                {control.title}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-md"
                            >
                              <p className="font-medium mb-1">{control.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {control.description}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center">
                        {control.isSatisfied ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Satisfied
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {control.evidenceCount > 0 ? (
                          <div className="flex items-center justify-center gap-1 text-sm">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            {control.evidenceCount}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!control.isSatisfied && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="gap-1"
                          >
                            <Link href="/admin/evidence">
                              <Upload className="h-3 w-3" />
                              Upload
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}

/**
 * Loading skeleton for framework detail
 */
function FrameworkDetailSkeleton() {
  return (
    <AppLayout breadcrumbs={[{ label: "Compliance", href: "/compliance/dashboard" }, { label: "Framework Details" }]}>
      <div className="space-y-6">
      <Skeleton className="h-8 w-32" />

      <div className="flex justify-between">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-20 w-48" />
      </div>

      <Card>
        <CardContent className="py-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
