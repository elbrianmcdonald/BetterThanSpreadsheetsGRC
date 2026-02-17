"use client";

/**
 * Gap Analysis Client Component
 *
 * Displays unsatisfied controls (gaps) for a specific framework with:
 * - Framework name and gap count
 * - Gap table with control ID, title, description, domains
 * - Pagination for large frameworks
 * - Export to CSV functionality
 *
 * @see Story 2.6: AC25-AC29
 */

import { useState } from "react";
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
import { CoverageProgressBar } from "@/components/coverage/CoverageProgressBar";
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Tag,
} from "lucide-react";

interface GapAnalysisClientProps {
  frameworkId: string;
}

export function GapAnalysisClient({ frameworkId }: GapAnalysisClientProps) {
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Fetch framework coverage for header stats
  const { data: coverage, isLoading: isLoadingCoverage } =
    api.coverage.calculateFrameworkCoverage.useQuery({ frameworkId });

  // Fetch gaps with pagination
  const { data: gapsData, isLoading: isLoadingGaps } =
    api.coverage.getFrameworkGaps.useQuery({
      frameworkId,
      page,
      pageSize,
    });

  const isLoading = isLoadingCoverage || isLoadingGaps;

  const handleExportCSV = () => {
    if (!gapsData?.gaps || !coverage) return;

    const headers = ["Control ID", "Title", "Description", "Control Domains"];
    const rows = gapsData.gaps.map((gap) => [
      gap.controlId,
      gap.title,
      gap.description.replace(/"/g, '""'), // Escape quotes
      gap.controlDomains.join("; "),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${coverage.frameworkCode}-gaps-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-500">Loading gap analysis...</p>
        </div>
      </div>
    );
  }

  if (!coverage) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
        <p className="mt-4 text-gray-500">Framework not found</p>
        <Link href="/admin/coverage">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Coverage Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const gapCount = coverage.totalControls - coverage.satisfiedControls;
  const gapPercentage = coverage.totalControls > 0
    ? Math.round((gapCount / coverage.totalControls) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/coverage"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Coverage Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Gap Analysis</h1>
          <p className="text-gray-500 mt-1">
            <span className="font-mono">{coverage.frameworkCode}</span> - {coverage.frameworkName}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} disabled={!gapsData?.gaps.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coverage.totalControls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Satisfied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{coverage.satisfiedControls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{gapCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Gap Percentage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{gapPercentage}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Coverage Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <CoverageProgressBar percentage={coverage.coveragePercentage} showLabel size="lg" />
        </CardContent>
      </Card>

      {/* Gap List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Unsatisfied Controls ({gapsData?.pagination.totalCount ?? 0})
          </CardTitle>
          <CardDescription>
            These controls do not have any evidence mapped to them
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gapsData?.gaps.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-green-500" />
              <p className="mt-4 text-lg font-medium text-green-700">No gaps found!</p>
              <p className="text-gray-500">
                All controls have evidence mapped to them.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Control ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="hidden md:table-cell">Control Domains</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gapsData?.gaps.map((gap) => (
                      <TableRow key={gap.id}>
                        <TableCell className="font-mono text-sm">{gap.controlId}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{gap.title}</p>
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {gap.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {gap.controlDomains.length > 0 ? (
                              gap.controlDomains.map((domain) => (
                                <Badge key={domain} variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {domain}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-gray-400 text-sm">No domains mapped</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {gapsData && gapsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Showing {page * pageSize + 1} to{" "}
                    {Math.min((page + 1) * pageSize, gapsData.pagination.totalCount)} of{" "}
                    {gapsData.pagination.totalCount} gaps
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= gapsData.pagination.totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
