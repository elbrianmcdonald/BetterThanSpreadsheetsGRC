"use client";

/**
 * Rendered at the bottom of compliance + maturity assessment detail pages.
 * Lists findings spawned from within this specific assessment (tracked via
 * Finding.sourceComplianceAssessmentId or Finding.sourceMaturityAssessmentId).
 */

import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
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

type Severity = "HIGH" | "MEDIUM" | "LOW";
type Status =
  | "NEW"
  | "NEEDS_INFO"
  | "TRIAGED"
  | "ACCEPTED"
  | "DUPLICATE"
  | "REJECTED";

function severityBadge(s: Severity) {
  const cls =
    s === "HIGH"
      ? "bg-red-100 text-red-800 border-red-200"
      : s === "MEDIUM"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-blue-100 text-blue-800 border-blue-200";
  return (
    <Badge variant="outline" className={cls}>
      {s}
    </Badge>
  );
}

function statusBadge(s: Status) {
  const cls =
    s === "NEW"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : s === "NEEDS_INFO"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : s === "TRIAGED"
          ? "bg-green-100 text-green-800 border-green-200"
          : s === "ACCEPTED"
            ? "bg-violet-100 text-violet-800 border-violet-200"
            : "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <Badge variant="outline" className={cls}>
      {s.replace("_", " ")}
    </Badge>
  );
}

function formatDate(d: Date | string) {
  const date = new Date(d);
  return date.toLocaleString();
}

export interface AssessmentFindingsListProps {
  assessmentId: string;
  assessmentType: "MATURITY" | "COMPLIANCE";
}

export function AssessmentFindingsList({
  assessmentId,
  assessmentType,
}: AssessmentFindingsListProps) {
  const { data, isLoading } = api.finding.listForAssessment.useQuery({
    assessmentId,
    assessmentType,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Findings from this assessment
              {data && data.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {data.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Every finding entered via the "Create finding" button on a
              control / subcategory / practice / activity in this assessment
              shows up here.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-4">
            No findings entered from this assessment yet. Click the "Finding"
            button next to any scored item above to capture one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Linked to</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((f) => {
                // Prefer the maturity domain linkage label; fall back to the
                // first linked compliance control.
                const linkLabel = f.sourceMaturityDomain
                  ? `${f.sourceMaturityDomain.code} — ${f.sourceMaturityDomain.name}`
                  : f.ControlLinks[0]?.control
                    ? `${f.ControlLinks[0].control.controlId} — ${f.ControlLinks[0].control.title}`
                    : "—";
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">
                      {f.identifier}
                    </TableCell>
                    <TableCell className="text-sm max-w-[260px] truncate" title={linkLabel}>
                      {linkLabel}
                    </TableCell>
                    <TableCell className="text-sm">{f.title}</TableCell>
                    <TableCell>{severityBadge(f.severity as Severity)}</TableCell>
                    <TableCell>{statusBadge(f.status as Status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.creator?.name ?? f.creator?.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(f.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/findings/${f.id}`}
                          target="_blank"
                          className="gap-1"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </Link>
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
  );
}
