"use client";

/**
 * Reconciliation Report Client Component
 *
 * Displays:
 * - Framework update summary
 * - Deprecated controls with evidence counts (action required)
 * - New controls requiring evidence
 * - Export to CSV functionality
 *
 * @see Story 2.7: OSCAL Catalog Update Workflow (AC27-AC30)
 */

import Link from "next/link";
import { api } from "@/trpc/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout";

interface ReconciliationReportClientProps {
  frameworkId: string;
}

export function ReconciliationReportClient({ frameworkId }: ReconciliationReportClientProps) {
  // Fetch reconciliation report
  const { data: report, isLoading } =
    api.framework.getReconciliationReport.useQuery({ frameworkId });

  const handleExportCSV = () => {
    if (!report) return;

    const lines: string[] = [];

    // Header info
    lines.push(`Framework Reconciliation Report`);
    lines.push(`Framework: ${report.frameworkName} (${report.frameworkCode})`);
    lines.push(`Version: ${report.version}`);
    lines.push(`Total Controls: ${report.totalControls}`);
    lines.push(`Active Controls: ${report.activeControls}`);
    lines.push(`Deprecated Controls: ${report.deprecatedControls}`);
    lines.push(``);

    // Deprecated controls with evidence
    if (report.deprecatedWithEvidence.length > 0) {
      lines.push(`Deprecated Controls with Evidence (Action Required)`);
      lines.push(`Control ID,Title,Evidence Count`);
      for (const control of report.deprecatedWithEvidence) {
        lines.push(`"${control.controlId}","${control.title}",${control.evidenceCount}`);
      }
      lines.push(``);
    }

    // Controls requiring evidence
    if (report.controlsRequiringEvidence.length > 0) {
      lines.push(`New/Active Controls Requiring Evidence`);
      lines.push(`Control ID,Title`);
      for (const control of report.controlsRequiringEvidence) {
        lines.push(`"${control.controlId}","${control.title}"`);
      }
    }

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${report.frameworkCode}-reconciliation-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const breadcrumbs = [
    { label: "Frameworks", href: "/admin/frameworks" },
    { label: report?.frameworkName || "Loading...", href: `/admin/frameworks/${frameworkId}` },
    { label: "Reconciliation" },
  ];

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-16">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
          <p className="mt-4 text-gray-500">Report not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reconciliation Report</h1>
          <p className="text-gray-500 mt-1">
            <span className="font-mono">{report.frameworkCode}</span> - {report.frameworkName} v{report.version}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.totalControls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{report.activeControls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Deprecated Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{report.deprecatedControls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {report.deprecatedWithEvidence.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deprecated Controls with Evidence */}
      {report.deprecatedWithEvidence.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Deprecated Controls with Evidence
            </CardTitle>
            <CardDescription className="text-yellow-700">
              These controls have been deprecated but have evidence mapped to them. Review and reassign evidence as needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-yellow-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Evidence Count</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.deprecatedWithEvidence.map((control) => (
                    <TableRow key={control.controlId}>
                      <TableCell className="font-mono">{control.controlId}</TableCell>
                      <TableCell>{control.title}</TableCell>
                      <TableCell className="text-right font-bold text-yellow-700">
                        {control.evidenceCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Review Required
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Action Required */}
      {report.deprecatedWithEvidence.length === 0 && report.deprecatedControls > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium text-green-700">No Action Required</p>
            <p className="text-green-600">
              {report.deprecatedControls} controls were deprecated, but none have evidence mapped to them.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Controls Requiring Evidence */}
      {report.controlsRequiringEvidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Controls Requiring Evidence
            </CardTitle>
            <CardDescription>
              These active controls may need evidence mapped to them for compliance coverage.
              Showing first {report.controlsRequiringEvidence.length} controls.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control ID</TableHead>
                    <TableHead>Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.controlsRequiringEvidence.slice(0, 20).map((control) => (
                    <TableRow key={control.controlId}>
                      <TableCell className="font-mono">{control.controlId}</TableCell>
                      <TableCell>{control.title}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {report.controlsRequiringEvidence.length > 20 && (
              <p className="text-sm text-gray-500 mt-2 text-center">
                ...and {report.controlsRequiringEvidence.length - 20} more controls
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm">
                Review this report and take necessary actions to maintain compliance coverage
              </span>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/coverage`}>
                <Button variant="outline">
                  View Coverage Dashboard
                </Button>
              </Link>
              <Link href={`/admin/frameworks/${frameworkId}`}>
                <Button>
                  View Framework
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  );
}
