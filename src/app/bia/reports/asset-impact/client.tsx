"use client";

/**
 * Asset Impact Report Client Component
 *
 * Epic 14: Asset Registry & BIA Integration
 * Story 14.7: Asset Impact Report
 */

import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Server,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  AppWindow,
  Network,
  HardDrive,
  Monitor,
} from "lucide-react";

// Asset type icons
const TYPE_ICONS: Record<string, React.ReactNode> = {
  SERVER: <Server className="h-4 w-4" />,
  DATABASE: <Database className="h-4 w-4" />,
  APPLICATION: <AppWindow className="h-4 w-4" />,
  NETWORK: <Network className="h-4 w-4" />,
  STORAGE: <HardDrive className="h-4 w-4" />,
  ENDPOINT: <Monitor className="h-4 w-4" />,
};

export function AssetImpactClient() {
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const { data, isLoading } = api.biaDashboard.getAssetImpactReport.useQuery();

  const toggleExpanded = (assetId: string) => {
    const newSet = new Set(expandedAssets);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setExpandedAssets(newSet);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Assets with Dependencies</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No assets have been linked to business processes yet.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/assets">
                <Button variant="outline">View Assets</Button>
              </Link>
              <Link href="/bia/processes">
                <Button variant="outline">View Processes</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, assets } = data;

  return (
    <div className="space-y-6">
      <Link href="/bia/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-semibold">{summary.totalAssets}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Assets</p>
                <p className="text-2xl font-semibold">{summary.criticalAssets}</p>
              </div>
              <Server className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Dependencies</p>
                <p className="text-2xl font-semibold">{summary.assetsWithDependencies}</p>
              </div>
              <Server className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concentration Risk</p>
                <p className="text-2xl font-semibold">{summary.concentrationRiskCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            {summary.concentrationRiskCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Assets supporting 3+ critical processes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Concentration Risk Alert */}
      {summary.concentrationRiskCount > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Asset Concentration Risk Detected
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-500">
              The following assets support multiple mission critical processes.
              Consider redundancy planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {assets
                .filter((a: any) => a.hasConcentrationRisk)
                .map((a: any) => (
                  <Link key={a.id} href={`/assets/${a.id}`}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-amber-100">
                      {a.name} ({a.criticalProcessCount} critical)
                    </Badge>
                  </Link>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Table */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Process Dependencies</CardTitle>
          <CardDescription>
            Expand an asset to view its linked business processes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-center">Processes</TableHead>
                <TableHead className="text-center">Critical</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset: any) => (
                <Collapsible
                  key={asset.id}
                  open={expandedAssets.has(asset.id)}
                  onOpenChange={() => toggleExpanded(asset.id)}
                  asChild
                >
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/50 ${
                          asset.hasConcentrationRisk
                            ? "bg-amber-50 dark:bg-amber-950/30"
                            : ""
                        }`}
                      >
                        <TableCell>
                          {expandedAssets.has(asset.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/assets/${asset.id}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {asset.name}
                          </Link>
                          <p className="text-xs text-muted-foreground font-mono">
                            {asset.identifier}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1">
                            {TYPE_ICONS[asset.type]}
                            {asset.type}
                          </span>
                        </TableCell>
                        <TableCell>
                          {asset.tier ? (
                            <Badge
                              style={{
                                backgroundColor: asset.tier.color + "20",
                                color: asset.tier.color,
                              }}
                              variant="outline"
                            >
                              {asset.tier.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {asset.processCount}
                        </TableCell>
                        <TableCell className="text-center">
                          {asset.criticalProcessCount > 0 ? (
                            <Badge variant="destructive">
                              {asset.criticalProcessCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <div className="p-4 pl-12">
                            <p className="text-sm font-medium mb-2">
                              Linked Processes:
                            </p>
                            <div className="space-y-2">
                              {asset.processes.map((process: any) => (
                                <div
                                  key={process.id}
                                  className="flex items-center gap-4 text-sm"
                                >
                                  <Link
                                    href={`/bia/processes/${process.id}`}
                                    className="hover:underline"
                                  >
                                    {process.name}
                                  </Link>
                                  <span className="text-muted-foreground font-mono text-xs">
                                    {process.identifier}
                                  </span>
                                  {process.dependencyType && (
                                    <Badge variant="secondary">
                                      {process.dependencyType}
                                    </Badge>
                                  )}
                                  {process.tier && (
                                    <Badge
                                      style={{
                                        backgroundColor: process.tier.color + "20",
                                        color: process.tier.color,
                                      }}
                                      variant="outline"
                                    >
                                      {process.tier.name}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
