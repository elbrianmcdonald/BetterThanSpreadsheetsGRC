"use client";

/**
 * MITRE ATT&CK Tactics Client Component
 *
 * Story 13.5: Tactic Browse UI
 *
 * Displays tactics in kill chain order with technique counts and links to techniques.
 */

import { useState } from "react";
import Link from "next/link";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

export function TacticsClient() {
  const [expandedTactic, setExpandedTactic] = useState<string | null>(null);

  // Fetch tactics
  const { data: tactics, isLoading, error, refetch } = api.mitre.getTactics.useQuery();

  // Fetch stats
  const { data: stats } = api.mitre.getStats.useQuery();

  // Sync mutation (for admin)
  const syncMutation = api.mitre.syncFromStix.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Synced ${result.tacticsCount} tactics, ${result.techniquesCount} techniques, ${result.subTechniquesCount} sub-techniques`
      );
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Seed if empty mutation
  const seedMutation = api.mitre.seedIfEmpty.useMutation({
    onSuccess: (result) => {
      if (result.seeded) {
        toast.success(
          `Seeded ${result.tacticsCount} tactics, ${result.techniquesCount} techniques`
        );
        refetch();
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Get tactic details when expanded
  const { data: tacticDetails } = api.mitre.getTacticById.useQuery(
    { id: expandedTactic ?? "" },
    { enabled: !!expandedTactic }
  );

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance", href: "/mitre/tactics" }, { label: "MITRE ATT&CK" }]}>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Empty state - offer to seed
  if (!tactics || tactics.length === 0) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance", href: "/mitre/tactics" }, { label: "MITRE ATT&CK" }]}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Target className="h-16 w-16 text-muted-foreground mb-6" />
          <h2 className="text-2xl font-semibold mb-2">No MITRE Data Available</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            MITRE ATT&CK data has not been loaded yet. Click below to fetch the latest
            threat intelligence from the official MITRE repository.
          </p>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading MITRE Data...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load MITRE ATT&CK Data
              </>
            )}
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout breadcrumbs={[{ label: "Governance", href: "/mitre/tactics" }, { label: "MITRE ATT&CK" }]}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-6" />
          <h2 className="text-2xl font-semibold mb-2">Error Loading Tactics</h2>
          <p className="text-muted-foreground mb-6">{error.message}</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Governance", href: "/mitre/tactics" }, { label: "MITRE ATT&CK" }]}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">MITRE ATT&CK Tactics</h1>
            <p className="text-sm text-muted-foreground">
              {stats?.tacticsCount ?? 0} tactics, {stats?.totalTechniques ?? 0} techniques
              {stats?.lastSyncAt && (
                <span className="ml-2">
                  (Last synced: {new Date(stats.lastSyncAt).toLocaleDateString()})
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync MITRE Data
            </>
          )}
        </Button>
      </div>

      {/* Tactics Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {tactics.map((tactic) => (
          <Collapsible
            key={tactic.id}
            open={expandedTactic === tactic.id}
            onOpenChange={(open) => setExpandedTactic(open ? tactic.id : null)}
          >
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {tactic.externalId}
                    </Badge>
                    <Badge variant="secondary">{tactic.techniqueCount} techniques</Badge>
                  </div>
                  <a
                    href={tactic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-left w-full">
                    <CardTitle className="text-lg hover:text-primary cursor-pointer">
                      {tactic.name}
                    </CardTitle>
                    {expandedTactic === tactic.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CardDescription className="line-clamp-2 mt-1">
                  {tactic.description.substring(0, 150)}...
                </CardDescription>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border-t pt-4 mt-2">
                    <h4 className="font-medium mb-2">Techniques in this Tactic:</h4>
                    {tacticDetails?.techniques ? (
                      <div className="flex flex-wrap gap-2">
                        {tacticDetails.techniques.slice(0, 10).map((tech) => (
                          <Link
                            key={tech.id}
                            href={`/mitre/techniques?search=${tech.externalId}`}
                          >
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-primary/10"
                            >
                              {tech.externalId} - {tech.name}
                              {tech.subTechniqueCount > 0 && (
                                <span className="ml-1 text-muted-foreground">
                                  (+{tech.subTechniqueCount})
                                </span>
                              )}
                            </Badge>
                          </Link>
                        ))}
                        {tacticDetails.techniques.length > 10 && (
                          <Link href={`/mitre/techniques?tactic=${tactic.id}`}>
                            <Badge variant="secondary" className="cursor-pointer">
                              +{tacticDetails.techniques.length - 10} more
                            </Badge>
                          </Link>
                        )}
                      </div>
                    ) : (
                      <Skeleton className="h-8 w-full" />
                    )}
                    <div className="mt-4">
                      <Link href={`/mitre/techniques?tactic=${tactic.id}`}>
                        <Button variant="outline" size="sm">
                          View All Techniques
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </AppLayout>
  );
}
