"use client";

/**
 * Framework Mappings Panel
 *
 * Main panel for base framework mapping feature:
 * - Select/change base framework
 * - View coverage statistics
 * - Manage framework-to-framework mappings
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Loader2,
  Settings,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
} from "lucide-react";
import { FrameworkMappingDrilldown } from "./FrameworkMappingDrilldown";

export function FrameworkMappingsPanel() {
  const [selectedSourceFramework, setSelectedSourceFramework] = useState<string | null>(null);
  const [showChangeBaseDialog, setShowChangeBaseDialog] = useState(false);
  const [pendingBaseFrameworkId, setPendingBaseFrameworkId] = useState<string>("");

  const utils = api.useUtils();

  // Fetch base framework
  const { data: baseFramework, isLoading: baseLoading } =
    api.baseFrameworkMapping.getBaseFramework.useQuery();

  // Fetch active frameworks for selection
  const { data: frameworksData } = api.framework.list.useQuery({
    isActive: true,
    includeControlCount: true,
  });

  // Fetch mapping summary
  const { data: mappingSummary, isLoading: summaryLoading } =
    api.baseFrameworkMapping.listMappingSummary.useQuery();

  // Fetch coverage statistics
  const { data: coverageStats, isLoading: statsLoading } =
    api.baseFrameworkMapping.getCoverageStatistics.useQuery();

  // Fetch unmapped base controls
  const { data: unmappedControls } =
    api.baseFrameworkMapping.getUnmappedBaseControls.useQuery();

  // Set base framework mutation
  const setBaseFramework = api.baseFrameworkMapping.setBaseFramework.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
      setShowChangeBaseDialog(false);
      setPendingBaseFrameworkId("");
    },
  });

  // Clear base framework mutation
  const clearBaseFramework = api.baseFrameworkMapping.clearBaseFramework.useMutation({
    onSuccess: () => {
      void utils.baseFrameworkMapping.invalidate();
    },
  });

  // Export mappings
  const { refetch: exportMappings, isFetching: isExporting } =
    api.baseFrameworkMapping.exportMappings.useQuery(
      { frameworkId: undefined },
      { enabled: false }
    );

  const handleExport = async () => {
    const result = await exportMappings();
    if (result.data) {
      const blob = new Blob([result.data.content], { type: result.data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSetBaseFramework = (frameworkId: string) => {
    if (baseFramework) {
      // Changing base framework - show confirmation
      setPendingBaseFrameworkId(frameworkId);
      setShowChangeBaseDialog(true);
    } else {
      // Setting base framework for first time
      setBaseFramework.mutate({ frameworkId });
    }
  };

  const confirmChangeBaseFramework = () => {
    setBaseFramework.mutate({ frameworkId: pendingBaseFrameworkId });
  };

  const isLoading = baseLoading || summaryLoading || statsLoading;

  // If drill-down is open
  if (selectedSourceFramework) {
    const selectedFw = mappingSummary?.frameworks.find(
      (fw) => fw.id === selectedSourceFramework
    );
    return (
      <FrameworkMappingDrilldown
        frameworkId={selectedSourceFramework}
        frameworkName={selectedFw?.name ?? ""}
        frameworkCode={selectedFw?.code ?? ""}
        onBack={() => setSelectedSourceFramework(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Base Framework Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Base Framework
              </CardTitle>
              <CardDescription>
                Select the framework that serves as your source of truth for control
                mappings
              </CardDescription>
            </div>
            {baseFramework && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearBaseFramework.mutate()}
                disabled={clearBaseFramework.isPending}
              >
                <Settings className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {baseLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Select
                value={baseFramework?.id ?? ""}
                onValueChange={handleSetBaseFramework}
                disabled={setBaseFramework.isPending}
              >
                <SelectTrigger className="w-[400px]">
                  <SelectValue placeholder="Select a base framework..." />
                </SelectTrigger>
                <SelectContent>
                  {frameworksData?.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>
                      {fw.name} ({fw.code} v{fw.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {baseFramework && (
                <Badge variant="secondary" className="text-sm">
                  {baseFramework._count.Control} controls
                </Badge>
              )}
              {setBaseFramework.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Show rest only if base framework is set */}
      {baseFramework ? (
        <>
          {/* Coverage Statistics */}
          {coverageStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Base Controls</p>
                      <p className="text-2xl font-semibold">
                        {coverageStats.totalBaseControls}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Covered</p>
                      <p className="text-2xl font-semibold text-green-600">
                        {coverageStats.coveredControls}
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Gaps</p>
                      <p className="text-2xl font-semibold text-orange-600">
                        {coverageStats.uncoveredControls}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Coverage</p>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={coverageStats.coveragePercentage}
                        className="flex-1"
                      />
                      <span className="text-xl font-semibold">
                        {coverageStats.coveragePercentage}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mapping Type Breakdown */}
          {coverageStats && coverageStats.totalMappings > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Mapping Statistics</CardTitle>
                    <CardDescription>
                      {coverageStats.totalMappings} total mappings with{" "}
                      {coverageStats.avgConfidence}% average confidence
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                    <span className="font-medium text-green-700">Equivalent</span>
                    <Badge variant="secondary">{coverageStats.typeBreakdown.EQUIVALENT}</Badge>
                  </div>
                  <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg">
                    <span className="font-medium text-purple-700">Subset of</span>
                    <Badge variant="secondary">{coverageStats.typeBreakdown.SUBSET_OF}</Badge>
                  </div>
                  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                    <span className="font-medium text-blue-700">Superset of</span>
                    <Badge variant="secondary">{coverageStats.typeBreakdown.SUPERSET_OF}</Badge>
                  </div>
                  <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-lg">
                    <span className="font-medium text-yellow-700">Intersects</span>
                    <Badge variant="secondary">{coverageStats.typeBreakdown.INTERSECTS}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source Frameworks Table */}
          <Card>
            <CardHeader>
              <CardTitle>Source Frameworks</CardTitle>
              <CardDescription>
                Map controls from these frameworks to your base framework (
                {baseFramework.name})
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : mappingSummary?.frameworks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No other active frameworks available for mapping.</p>
                  <p className="text-sm mt-2">
                    Activate additional frameworks to create mappings.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Framework</TableHead>
                        <TableHead>Total Controls</TableHead>
                        <TableHead>Mapped Controls</TableHead>
                        <TableHead>Coverage</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappingSummary?.frameworks.map((fw) => (
                        <TableRow key={fw.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{fw.name}</div>
                              <div className="text-sm text-gray-500">
                                {fw.code} v{fw.version}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{fw.totalControls}</TableCell>
                          <TableCell>
                            <Badge
                              variant={fw.mappedControls > 0 ? "default" : "secondary"}
                            >
                              {fw.mappedControls}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 w-[150px]">
                              <Progress
                                value={fw.coveragePercentage}
                                className="flex-1"
                              />
                              <span className="text-sm font-medium w-12 text-right">
                                {fw.coveragePercentage}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSourceFramework(fw.id)}
                            >
                              Manage Mappings
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unmapped Base Controls (Gap Analysis) */}
          {unmappedControls && unmappedControls.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Unmapped Base Controls
                </CardTitle>
                <CardDescription>
                  These base framework controls have no mappings from other frameworks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Control ID</TableHead>
                        <TableHead>Title</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedControls.slice(0, 20).map((control) => (
                        <TableRow key={control.id}>
                          <TableCell className="font-mono">
                            {control.controlId}
                          </TableCell>
                          <TableCell>{control.title}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {unmappedControls.length > 20 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      And {unmappedControls.length - 20} more...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No Base Framework Selected</p>
            <p className="text-sm mt-2">
              Select a base framework above to start mapping controls from other
              frameworks.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Change Base Framework Confirmation Dialog */}
      <AlertDialog open={showChangeBaseDialog} onOpenChange={setShowChangeBaseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Base Framework?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the base framework will affect how mappings are interpreted.
              Existing mappings will remain but may need to be reviewed. Are you sure
              you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingBaseFrameworkId("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmChangeBaseFramework}>
              Change Base Framework
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
