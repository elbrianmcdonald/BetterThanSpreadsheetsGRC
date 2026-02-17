"use client";

/**
 * Control Mappings Admin Client Component
 *
 * Manages various mapping types:
 * - Control Domains: OSCAL translation engine mappings
 * - Framework Mappings: Base framework-to-framework control mappings
 * - Standard Mappings: Standard-to-framework control mappings
 *
 * @see Story 2.4: OSCAL Translation Engine
 * @see Feature: Base Framework Mapping
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Link2,
  BarChart3,
  Layers,
  FileText,
  Eye,
  GitCompare,
} from "lucide-react";
import { BaseMappingsPanel } from "@/components/admin/mappings/BaseMappingsPanel";

// Framework code to display name mapping
const frameworkDisplayNames: Record<string, string> = {
  ISO27001: "ISO 27001",
  SOC2: "SOC 2",
  NISTCSF: "NIST CSF",
};

// Confidence badge color
function getConfidenceBadgeVariant(
  confidence: number
): "default" | "secondary" | "destructive" | "outline" {
  if (confidence >= 90) return "default";
  if (confidence >= 70) return "secondary";
  return "destructive";
}

function ControlDomainsTab() {
  const [selectedMapping, setSelectedMapping] = useState<{
    domainId: string;
    domainName: string;
    frameworkCode: string;
  } | null>(null);

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } =
    api.mapping.getStatistics.useQuery();

  // Fetch mapping summary
  const { data: summary, isLoading: summaryLoading } =
    api.mapping.listMappingSummary.useQuery();

  // Fetch detailed mappings when drill-down is open
  const { data: detailMappings, isLoading: detailLoading } =
    api.mapping.listMappingsForDomainFramework.useQuery(
      {
        controlDomainId: selectedMapping?.domainId ?? "",
        frameworkCode: selectedMapping?.frameworkCode ?? "",
      },
      { enabled: !!selectedMapping }
    );

  const isLoading = statsLoading || summaryLoading;

  return (
    <div className="space-y-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Mappings</p>
                <p className="text-2xl font-semibold">
                  {stats?.totalMappings ?? 0}
                </p>
              </div>
              <Link2 className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Control Domains</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {stats?.totalDomains ?? 0}
                </p>
              </div>
              <Layers className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Frameworks</p>
                <p className="text-2xl font-semibold text-green-600">
                  {stats?.totalFrameworks ?? 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg per Domain</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {stats?.avgMappingsPerDomain ?? 0}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Framework Breakdown */}
      {stats?.frameworkBreakdown && stats.frameworkBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Framework Breakdown</CardTitle>
            <CardDescription>
              Control mappings distributed across compliance frameworks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {stats.frameworkBreakdown.map((fw) => (
                <div
                  key={fw.frameworkCode}
                  className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg"
                >
                  <span className="font-medium">
                    {frameworkDisplayNames[fw.frameworkCode] ?? fw.frameworkCode}
                  </span>
                  <Badge variant="secondary">{fw.count} controls</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Summary</CardTitle>
          <CardDescription>
            Control domain to framework mappings. Click View to see specific
            control IDs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Control Domain</TableHead>
                    <TableHead>ISO 27001</TableHead>
                    <TableHead>SOC 2</TableHead>
                    <TableHead>NIST CSF</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary?.map((domain) => (
                    <TableRow key={domain.domainId}>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="font-medium cursor-help">
                                {domain.domainName}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Code: {domain.domainCode}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      {["ISO27001", "SOC2", "NISTCSF"].map((fwCode) => {
                        const fw = domain.frameworks.find(
                          (f) => f.frameworkCode === fwCode
                        );
                        return (
                          <TableCell key={fwCode}>
                            {fw ? (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={getConfidenceBadgeVariant(
                                    fw.avgConfidence
                                  )}
                                  className="font-mono text-xs"
                                >
                                  {fw.controlCount} ({fw.avgConfidence}%)
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedMapping({
                                      domainId: domain.domainId,
                                      domainName: domain.domainName,
                                      frameworkCode: fwCode,
                                    })
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold">
                        {domain.totalMappings}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drill-down Dialog */}
      <Dialog
        open={!!selectedMapping}
        onOpenChange={(open) => !open && setSelectedMapping(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMapping?.domainName} →{" "}
              {frameworkDisplayNames[selectedMapping?.frameworkCode ?? ""] ??
                selectedMapping?.frameworkCode}
            </DialogTitle>
            <DialogDescription>
              Control ID mappings for this domain-framework pair
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : detailMappings && detailMappings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control ID</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono">
                        {mapping.controlId}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={getConfidenceBadgeVariant(mapping.confidence)}
                        >
                          {mapping.confidence}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-500 py-8">No mappings found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MappingAdminClient() {
  return (
    <AppLayout breadcrumbs={[{ label: "Governance" }, { label: "Mappings" }]}>
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="sm:flex sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Link2 className="h-6 w-6" />
              Control Mappings
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage control mappings across domains, frameworks, and standards.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="control-mappings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="control-mappings" className="flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Control Mappings
            </TabsTrigger>
            <TabsTrigger value="domains" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Control Domains
            </TabsTrigger>
          </TabsList>

          <TabsContent value="control-mappings">
            <BaseMappingsPanel />
          </TabsContent>

          <TabsContent value="domains">
            <ControlDomainsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
