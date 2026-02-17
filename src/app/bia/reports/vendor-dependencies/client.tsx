"use client";

/**
 * Vendor Dependencies Report Client Component
 *
 * Epic 13: BIA Reporting & Compliance
 * Story 13.4: Process-Vendor Dependency Reports
 */

import { api } from "@/trpc/react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function VendorDependenciesClient() {
  const { data, isLoading } = api.biaDashboard.getVendorDependencyReport.useQuery();

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

  if (!data || data.vendors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Vendor Dependencies</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No business processes have been linked to vendors yet.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/bia/processes">
                <Button variant="outline">View Processes</Button>
              </Link>
              <Link href="/vendors">
                <Button variant="outline">View Vendors</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { vendors, tierNames } = data;

  // Count vendors with concentration risk
  const vendorsWithRisk = vendors.filter((v) => v.hasConcentrationRisk);

  return (
    <div className="space-y-6">
      <Link href="/bia/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Vendors with Process Links
                </p>
                <p className="text-2xl font-semibold">{vendors.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Process Links
                </p>
                <p className="text-2xl font-semibold">
                  {vendors.reduce((sum, v) => sum + v.processCount, 0)}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Concentration Risk
                </p>
                <p className="text-2xl font-semibold">
                  {vendorsWithRisk.length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            {vendorsWithRisk.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Vendors with 2+ critical processes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Concentration Risk Alert */}
      {vendorsWithRisk.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Vendor Concentration Risk Detected
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-500">
              The following vendors support multiple Mission Critical processes.
              Consider diversification strategies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {vendorsWithRisk.map((v) => (
                <Link key={v.id} href={`/vendors/${v.id}`}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-amber-100">
                    {v.name} ({v.tierCounts[tierNames[0] ?? ""] ?? 0} critical)
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vendor Process Dependencies</CardTitle>
          <CardDescription>
            Click on a vendor to view linked processes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-center">Total Processes</TableHead>
                {tierNames.map((tier) => (
                  <TableHead key={tier} className="text-center">
                    {tier}
                  </TableHead>
                ))}
                <TableHead className="text-center">Unassigned</TableHead>
                <TableHead>Highest Criticality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow
                  key={vendor.id}
                  className={vendor.hasConcentrationRisk ? "bg-amber-50 dark:bg-amber-950/30" : ""}
                >
                  <TableCell>
                    <Link
                      href={`/vendors/${vendor.id}`}
                      className="font-medium hover:underline"
                    >
                      {vendor.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {vendor.identifier}
                    </p>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {vendor.processCount}
                  </TableCell>
                  {tierNames.map((tier) => (
                    <TableCell key={tier} className="text-center">
                      {vendor.tierCounts[tier] || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    {vendor.tierCounts["Unassigned"] || 0}
                  </TableCell>
                  <TableCell>
                    {vendor.highestCriticality ? (
                      <Badge
                        variant={
                          vendor.highestCriticality === tierNames[0]
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {vendor.highestCriticality}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
