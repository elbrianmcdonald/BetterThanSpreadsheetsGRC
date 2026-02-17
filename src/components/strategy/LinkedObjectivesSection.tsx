"use client";

/**
 * Linked Objectives Section Component
 *
 * Story 3.5: Bidirectional Display (AC6-AC8)
 * AC6: Display on Risk detail page
 * AC7: Display on Control detail page
 * AC8: Display on Evidence detail page
 *
 * Shows: Objective title, Parent Goal, Parent Strategy, link to objective
 */

import Link from "next/link";
import { Target, ExternalLink, Loader2 } from "lucide-react";
import { ObjectiveStatus } from "@prisma/client";

import { api } from "@/trpc/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LinkedObjectivesSectionProps {
  entityType: "risk" | "control" | "evidence";
  entityId: string;
}

/** Objective status badge configuration */
const objectiveStatusConfig: Record<ObjectiveStatus, { color: string; label: string }> = {
  NOT_STARTED: { color: "bg-slate-100 text-slate-700", label: "Not Started" },
  IN_PROGRESS: { color: "bg-blue-100 text-blue-700", label: "In Progress" },
  AT_RISK: { color: "bg-amber-100 text-amber-700", label: "At Risk" },
  COMPLETED: { color: "bg-green-100 text-green-700", label: "Completed" },
};

export function LinkedObjectivesSection({
  entityType,
  entityId,
}: LinkedObjectivesSectionProps) {
  // Fetch linked objectives based on entity type
  const { data, isLoading } = api.objective.getLinkedToEntity.useQuery(
    { entityType, entityId },
    { enabled: !!entityId }
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Linked Objectives
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const objectives = data?.objectives || [];

  if (objectives.length === 0) {
    return null; // Don't show section if no linked objectives
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Linked Objectives
          <Badge variant="secondary">{objectives.length}</Badge>
        </CardTitle>
        <CardDescription>
          Strategic objectives linked to this {entityType}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {objectives.map((objective) => (
            <div
              key={objective.id}
              className="flex items-start gap-3 p-3 rounded-lg border group hover:bg-muted/50"
            >
              <Target className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/strategy/${objective.goal.strategy.id}/objective/${objective.id}`}
                  className="font-medium hover:underline flex items-center gap-1"
                >
                  {objective.title}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                </Link>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span>{objective.goal.strategy.title}</span>
                  <span>/</span>
                  <span>{objective.goal.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={objectiveStatusConfig[objective.status].color}>
                    {objectiveStatusConfig[objective.status].label}
                  </Badge>
                  {objective.progress !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {objective.progress}% complete
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
