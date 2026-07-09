"use client";

/**
 * Assessment Findings Tab — lists findings discovered within this assessment
 * and lets the assignee add new ones. Mirrors the Identified Risks tab.
 *
 * Findings created here are PENDING (hidden from the global findings register)
 * until the assessment is approved, at which point they publish to the register.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { CreateFindingForm } from "@/components/findings/CreateFindingForm";

const SEVERITY_BADGE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  LOW: "bg-green-100 text-green-800 border-green-300",
};

interface AssessmentFindingsTabProps {
  projectId: string;
  isReadOnly?: boolean;
}

export function AssessmentFindingsTab({
  projectId,
  isReadOnly = false,
}: AssessmentFindingsTabProps) {
  const utils = api.useUtils();
  const router = useRouter();
  // Inline Add Finding (2026-07-06): the full card form renders in place of
  // the findings list so the user stays on the assessment.
  const [adding, setAdding] = useState(false);

  const { data: findings, isLoading } = api.finding.listForProject.useQuery({
    projectId,
  });

  const refresh = () => {
    void utils.finding.listForProject.invalidate({ projectId });
    void utils.riskAssessmentProject.getById.invalidate({ id: projectId });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (adding) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Add Finding</h3>
            <p className="text-sm text-muted-foreground">
              The finding stays pending until the assessment is approved, then
              publishes to the findings register.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
            <X className="h-4 w-4 mr-1" />
            Back to findings
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <CreateFindingForm
              discoveryProjectId={projectId}
              onCreated={() => {
                refresh();
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Findings recorded during this assessment. Each stays pending until the
          assessment is approved, then publishes to the findings register.
        </p>
        {!isReadOnly && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Finding
          </Button>
        )}
      </div>

      {!findings || findings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">No findings recorded yet.</p>
          {!isReadOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Finding
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Register</th>
                <th className="px-3 py-2 font-medium">Assignee</th>
                <th className="px-3 py-2 font-medium">From</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => router.push(`/findings/${f.id}`)}
                  className="cursor-pointer border-t hover:bg-muted/30"
                >
                  <td className="px-3 py-2 font-mono text-xs text-primary">
                    {f.identifier}
                  </td>
                  <td className="px-3 py-2">{f.title}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={SEVERITY_BADGE[f.severity] ?? ""}>
                      {f.severityLabel ?? f.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{f.source}</td>
                  <td className="px-3 py-2 text-xs">{f.status}</td>
                  <td className="px-3 py-2">
                    {f.discoveryStatus === "PUBLISHED" ? (
                      <Badge className="bg-green-600 text-white text-xs">Published</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Pending
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {f.assignee?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {f.sourceRiskAssessmentQuestion?.number
                      ? `Q ${f.sourceRiskAssessmentQuestion.number}`
                      : "Direct"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
