"use client";

import Link from "next/link";
import { Plus, FileText, Loader2 } from "lucide-react";
import { ContingencyBIAStatus } from "@prisma/client";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export function SystemContingencyListClient() {
  const { data, isLoading } = api.biaSystemContingency.list.useQuery();

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Business Impact" },
        { label: "System Contingency BIA" },
      ]}
    >
      <div className="container max-w-6xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-6 w-6" />
              System Contingency BIA
            </h1>
            <p className="text-muted-foreground mt-1">
              NIST SP 800-34 Business Impact Analyses that feed the Information
              System Contingency Plan.
            </p>
          </div>
          <Button asChild>
            <Link href="/bia/system-contingency/new">
              <Plus className="h-4 w-4 mr-2" />
              New BIA
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All BIAs</CardTitle>
            <CardDescription>
              Each BIA is anchored to either an Asset (information system) or a
              Business Process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : !data?.length ? (
              <div className="text-center py-10 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No BIAs yet. Create one to begin documenting recovery
                  priorities for an information system or business process.
                </p>
                <Button asChild>
                  <Link href="/bia/system-contingency/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New BIA
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anchor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Processes</TableHead>
                    <TableHead>Resources</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((bia) => {
                    const anchorLabel = bia.asset
                      ? `${bia.asset.identifier} · ${bia.asset.name}`
                      : bia.businessProcess
                        ? `${bia.businessProcess.identifier} · ${bia.businessProcess.name}`
                        : "—";
                    const anchorType = bia.asset
                      ? "Asset"
                      : bia.businessProcess
                        ? "Process"
                        : "—";
                    return (
                      <TableRow
                        key={bia.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell>
                          <Link
                            href={`/bia/system-contingency/${bia.id}`}
                            className="block"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {anchorType}
                              </Badge>
                              <span className="text-sm">{anchorLabel}</span>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              bia.status === ContingencyBIAStatus.FINAL
                                ? "default"
                                : "outline"
                            }
                          >
                            {bia.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(bia.completionDate)}</TableCell>
                        <TableCell className="text-sm">
                          {bia._count.processes}
                        </TableCell>
                        <TableCell className="text-sm">
                          {bia._count.resources}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(bia.updatedAt)}
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
