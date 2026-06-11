"use client";

/**
 * Rendered in the compliance assessment workspace "Risks" tab.
 * Mirrors AssessmentFindingsList: lists risks spawned from within this
 * specific assessment (tracked via Risk.sourceComplianceAssessmentId).
 *
 * Each row surfaces ALL its linked findings (Risk.findingLinks) as chips with
 * an inline picker to add a finding and an × to remove one. A risk must keep
 * at least one finding (risk.addFinding / risk.removeFinding).
 */

import Link from "next/link";
import { ExternalLink, Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import type { Severity } from "@prisma/client";
import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/risk/SeverityBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Status =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "OPEN"
  | "ASSIGNED"
  | "REMEDIATED"
  | "CLOSED";

function statusBadge(s: Status) {
  const cls =
    s === "OPEN"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : s === "ASSIGNED"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : s === "REMEDIATED"
          ? "bg-green-100 text-green-800 border-green-200"
          : s === "CLOSED"
            ? "bg-slate-100 text-slate-800 border-slate-200"
            : "bg-violet-100 text-violet-800 border-violet-200";
  return (
    <Badge variant="outline" className={cls}>
      {s.replace("_", " ")}
    </Badge>
  );
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString();
}

export interface AssessmentRisksListProps {
  assessmentId: string;
  assessmentType: "COMPLIANCE";
}

export function AssessmentRisksList({
  assessmentId,
  assessmentType,
}: AssessmentRisksListProps) {
  const utils = api.useUtils();
  const { data, isLoading } = api.risk.listForAssessment.useQuery({
    assessmentId,
    assessmentType,
  });

  // Findings raised in this same assessment — used to populate the per-row
  // "link finding" picker.
  const { data: findings } = api.finding.listForAssessment.useQuery({
    assessmentId,
    assessmentType: "COMPLIANCE",
  });

  const addFindingMutation = api.risk.addFinding.useMutation({
    onSuccess: () => {
      void utils.risk.listForAssessment.invalidate({
        assessmentId,
        assessmentType,
      });
    },
    onError: (e) => toast.error(e.message || "Failed to add finding"),
  });

  const removeFindingMutation = api.risk.removeFinding.useMutation({
    onSuccess: () => {
      void utils.risk.listForAssessment.invalidate({
        assessmentId,
        assessmentType,
      });
    },
    onError: (e) => toast.error(e.message || "Failed to remove finding"),
  });

  const mutating = addFindingMutation.isPending || removeFindingMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Risks from this assessment
              {data && data.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {data.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Every risk raised via the "Risk" button on a control in this
              assessment shows up here. Link each one to the finding(s) it came
              from to keep the trail connected.
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
            No risks raised from this assessment yet. Click the "Risk" button
            next to any control above to capture one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Linked control</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Linked findings</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => {
                const linkLabel = r.ControlLinks[0]?.control
                  ? `${r.ControlLinks[0].control.controlId} — ${r.ControlLinks[0].control.title}`
                  : "—";
                const linkedFindings = r.findingLinks.map((fl) => fl.finding);
                const linkedFindingIds = new Set(
                  linkedFindings.map((f) => f.id)
                );
                const onlyOne = linkedFindings.length <= 1;
                const addable =
                  findings?.filter((f) => !linkedFindingIds.has(f.id)) ?? [];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.identifier}
                    </TableCell>
                    <TableCell
                      className="text-sm max-w-[220px] truncate"
                      title={linkLabel}
                    >
                      {linkLabel}
                    </TableCell>
                    <TableCell className="text-sm">{r.title}</TableCell>
                    <TableCell>
                      <SeverityBadge
                        severity={r.severity as Severity}
                        severityLabel={r.inherentScoreLabel}
                        showTooltip={false}
                      />
                    </TableCell>
                    <TableCell>{statusBadge(r.status as Status)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1">
                          {linkedFindings.map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-xs"
                            >
                              <Link
                                href={`/findings/${f.id}`}
                                target="_blank"
                                className="font-mono text-primary underline"
                                title={f.title}
                              >
                                {f.identifier}
                              </Link>
                              <button
                                type="button"
                                aria-label={`Remove ${f.identifier}`}
                                title={
                                  onlyOne
                                    ? "A risk must keep at least one finding"
                                    : "Remove finding"
                                }
                                disabled={onlyOne || mutating}
                                onClick={() =>
                                  removeFindingMutation.mutate({
                                    riskId: r.id,
                                    findingId: f.id,
                                  })
                                }
                                className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        {addable.length > 0 && (
                          <Select
                            value=""
                            onValueChange={(v) =>
                              addFindingMutation.mutate({
                                riskId: r.id,
                                findingId: v,
                              })
                            }
                            disabled={mutating}
                          >
                            <SelectTrigger className="h-7 w-[180px] text-xs">
                              <SelectValue placeholder="Add finding" />
                            </SelectTrigger>
                            <SelectContent>
                              {addable.map((f) => (
                                <SelectItem key={f.id} value={f.id}>
                                  <span className="font-mono text-xs mr-1">
                                    {f.identifier}
                                  </span>
                                  <span>{f.title}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/risks/${r.id}`}
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
